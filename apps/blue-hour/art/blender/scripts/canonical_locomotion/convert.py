"""Reproducible offline retarget from Godot .tres samples to the frozen canonical rig.

Run with Blender's bundled Python for numpy/mathutils. All solving occurs in
Godot metre coordinates; no FBX Action or public locomotion is an input.
"""
import hashlib
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from mathutils import Matrix, Quaternion, Vector

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
CONFIG_PATH = OUT/'conversion-profile.json'
CONFIG = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
RIGS = json.loads((OUT/'rigs.json').read_text(encoding='utf-8'))
SIDES = ('Left', 'Right')


def rotation(m):
    u, _, v = np.linalg.svd(m[:3, :3])
    return u @ v


def align(a, b):
    return np.array(Vector(a).rotation_difference(Vector(b)).to_matrix())


def smooth(x):
    x = np.clip(x, 0, 1)
    return x*x*(3-2*x)


class Rig:
    def __init__(self, data):
        self.data = data
        self.names = [b['name'] for b in data['bones']]
        self.ids = {n.removeprefix('mixamorig_'): i for i, n in enumerate(self.names)}
        self.parents = [int(b['parent']) for b in data['bones']]
        self.rest = np.array([b['world'] for b in data['bones']], dtype=float)
        self.rot = np.array([rotation(m) for m in self.rest])
        self.local = np.array([b['rest'] for b in data['bones']], dtype=float)
        self.patches = {}
        self.vertices = []
        self.weights = []
        self.binds = []
        self.bindposes = []
        for mesh in data['meshes']:
            v = np.c_[np.array(mesh['vertices']), np.ones(len(mesh['vertices']))]
            w = np.array(mesh['weights']).reshape(len(v), -1)
            bi = np.array(mesh['indices'], dtype=int).reshape(len(v), -1)
            binds = np.array([x['bone'] for x in mesh['binds']], dtype=int)
            bp = np.array([x['pose'] for x in mesh['binds']])
            self.vertices.append(v)
            self.weights.append(w)
            self.binds.append(binds[bi])
            self.bindposes.append(bp[bi])
        self.vertices = np.concatenate(self.vertices)
        self.weights = np.concatenate(self.weights)
        self.binds = np.concatenate(self.binds)
        self.bindposes = np.concatenate(self.bindposes)
        self.bindverts = np.einsum('nvij,nj->nvi', self.bindposes, self.vertices)
        self.restverts = self.skin(self.rest)
        for side in SIDES:
            sign = 1 if side == 'Left' else -1
            ids = np.where((self.restverts[:, 0]*sign > 0) & (self.restverts[:, 1] < .06))[0]
            z = self.restverts[ids, 2]
            self.patches[side] = {'sole': ids, 'heel': ids[z <= z.min()+.3*np.ptp(z)], 'forefoot': ids[z >= z.min()+.7*np.ptp(z)]}
            for part in ('heel', 'forefoot'):
                subset = self.patches[side][part]
                low = self.restverts[subset, 1].min()
                self.patches[side][part+'_contact'] = subset[self.restverts[subset, 1] <= low+.003]
        self.sole_ids = np.unique(np.concatenate([self.patches[s]['sole'] for s in SIDES]))

    def skin(self, pose, ids=None):
        if ids is None:
            return np.einsum('nvij,nvj,nv->ni', pose[self.binds], self.bindverts, self.weights)[:, :3]
        return np.einsum('nvij,nvj,nv->ni', pose[self.binds[ids]], self.bindverts[ids], self.weights[ids])[:, :3]

    def contact(self, pose, side):
        result = {}
        for part, ids in self.patches[side].items():
            pts = self.skin(pose, ids)
            result[part] = pts.mean(axis=0).tolist() if part.endswith('contact') else float(pts[:, 1].min())
        return result

    def segment(self, a, b):
        return np.linalg.norm(self.rest[self.ids[a], :3, 3]-self.rest[self.ids[b], :3, 3])


S, T = Rig(RIGS['source']), Rig(RIGS['target'])
MAP = CONFIG['mapping']
C = CONFIG['compensation']
RATIO = float(np.mean([sum(T.segment(side+a, side+b) for a, b in [('UpperLeg','LowerLeg'), ('LowerLeg','Foot')])/sum(S.segment(side+a, side+b) for a, b in [('UpLeg','Leg'), ('Leg','Foot')]) for side in SIDES]))
TR = T.rest
SR = S.rest
SOURCE_SCALE = np.array([np.linalg.norm(m[:3, 0]) for m in SR])
REFERENCE = T.rot.copy()
# A bind pose and a T bind pose are different anatomical poses, not just axes.
# Calibrate one shared target authoring pose from source limb directions. This
# is an offline animation reference; neither Skeleton Rest nor Skin is edited.
for side in SIDES:
    for target,child,source,source_child in (
        ('Shoulder','UpperArm','Shoulder','Arm'),
        ('UpperArm','LowerArm','Arm','ForeArm'),
        ('LowerArm','Hand','ForeArm','Hand')):
        ti=T.ids[side+target]
        tv=TR[T.ids[side+child],:3,3]-TR[ti,:3,3]
        sv=SR[S.ids[side+source_child],:3,3]-SR[S.ids[side+source],:3,3]
        REFERENCE[ti]=align(tv,sv)@T.rot[ti]
    ti=T.ids[side+'Hand']
    sv=S.rot[S.ids[side+'Hand']][:,1]
    REFERENCE[ti]=align(T.rot[ti][:,1],sv)@T.rot[ti]


def forward(rotations, hips):
    pose = TR.copy()
    for i, parent in enumerate(T.parents):
        pose[i, :3, :3] = rotations[i]
        if T.names[i] == 'Hips':
            pose[i, :3, 3] = hips
        elif parent >= 0:
            offset = T.rot[parent].T @ (TR[i, :3, 3]-TR[parent, :3, 3])
            pose[i, :3, 3] = pose[parent, :3, 3]+rotations[parent]@offset
    return pose


def base_pose(source):
    rotations = T.rot.copy()
    for target_name, source_name in MAP.items():
        if source_name:
            ti, si = T.ids[target_name], S.ids[source_name]
            rotations[ti] = rotation(source[si]) @ S.rot[si].T @ REFERENCE[ti]
    # Pelvis is not at the same anatomical point in these two hierarchies.
    # Transfer the upper-leg midpoint, then derive the target Hips origin.
    src_mid = np.mean([source[S.ids[s+'UpLeg'], :3, 3] for s in SIDES], axis=0)
    src_rest_mid = np.mean([SR[S.ids[s+'UpLeg'], :3, 3] for s in SIDES], axis=0)
    target_mid = np.mean([TR[T.ids[s+'UpperLeg'], :3, 3] for s in SIDES], axis=0)
    mid = target_mid + (src_mid-src_rest_mid)*RATIO
    offset = T.rot[T.ids['Hips']].T@(target_mid-TR[T.ids['Hips'], :3, 3])
    hips = mid-rotations[T.ids['Hips']]@offset
    return forward(rotations, hips)


def solve_leg(pose, side, ankle, pole):
    ui, li, fi = [T.ids[side+x] for x in ('UpperLeg','LowerLeg','Foot')]
    origin = pose[ui, :3, 3]
    a, b = T.segment(side+'UpperLeg', side+'LowerLeg'), T.segment(side+'LowerLeg', side+'Foot')
    delta = ankle-origin
    distance = np.linalg.norm(delta)
    direction = delta/max(distance, 1e-9)
    d = np.clip(distance, abs(a-b)+1e-6, a+b-1e-6)
    axis = pole-origin
    axis -= direction*np.dot(axis, direction)
    if np.linalg.norm(axis) < 1e-5:
        axis = np.array([0, 0, 1.0])-direction*direction[2]
    axis /= np.linalg.norm(axis)
    along = (a*a-b*b+d*d)/(2*d)
    knee = origin+direction*along+axis*math.sqrt(max(0, a*a-along*along))
    current_upper = pose[li, :3, 3]-origin
    pose[ui, :3, :3] = align(current_upper, knee-origin)@rotation(pose[ui])
    current_lower = pose[fi, :3, 3]-pose[li, :3, 3]
    pose[li, :3, :3] = align(current_lower, ankle-knee)@rotation(pose[li])
    pose[li, :3, 3] = knee
    pose[fi, :3, 3] = ankle
    toe = T.ids[side+'Toes']
    pose[toe, :3, 3] = ankle+rotation(pose[fi])@T.rot[fi].T@(TR[toe, :3, 3]-TR[fi, :3, 3])


def rotate_foot(pose, side, angle):
    fi, ti = T.ids[side+'Foot'], T.ids[side+'Toes']
    delta = np.array(Matrix.Rotation(angle, 3, 'X'))
    origin = pose[fi, :3, 3].copy()
    for bone in (fi, ti):
        pose[bone, :3, :3] = delta@pose[bone, :3, :3]
        pose[bone, :3, 3] = origin+delta@(pose[bone, :3, 3]-origin)


def measures(pose, rig):
    joints = {name.removeprefix('mixamorig_'): pose[i, :3, 3].tolist() for i, name in enumerate(rig.names)}
    return {'joints': joints, 'feet': {side: rig.contact(pose, side) for side in SIDES}}


def retarget(name):
    data = json.loads((OUT/(name+'-source.json')).read_text())
    samples = []
    raw_samples = []
    source_samples = []
    compensation = []
    for frame, sample in enumerate(data['samples']):
        source = np.array(sample['poses'], dtype=float)
        base = base_pose(source)
        pose = base.copy()
        contacts = {side: S.contact(source, side) for side in SIDES}
        goals = {}
        poles = {}
        for side in SIDES:
            sf, tf = S.ids[side+'Foot'], T.ids[side+'Foot']
            goals[side] = TR[tf, :3, 3]+(source[sf, :3, 3]-SR[sf, :3, 3])*RATIO
            # Transfer the anatomical bend plane, not an absolute knee point.
            # Different Rest hip/ankle heights can otherwise cross the target pole.
            sh = source[S.ids[side+'UpLeg'], :3, 3]
            sk = source[S.ids[side+'Leg'], :3, 3]
            sa = source[S.ids[side+'Foot'], :3, 3]
            axis = (sa-sh)/np.linalg.norm(sa-sh)
            bend = sk-sh-axis*np.dot(sk-sh,axis)
            bend /= max(np.linalg.norm(bend),1e-9)
            poles[side] = pose[T.ids[side+'UpperLeg'], :3, 3]+bend
            solve_leg(pose, side, goals[side], poles[side])

        hips_adjust = 0.0
        pitch = {side: 0.0 for side in SIDES}
        # Match actual sole height/roll, not ankle height. Contact centres retain
        # proportional horizontal source trajectories through the entire cycle.
        for iteration in range(20):
            for side in SIDES:
                source_contact = contacts[side]
                target_contact = T.contact(pose, side)
                # Solve the functional sole vector in 3D; a pitch-only solver
                # becomes singular when a rest-space foot points across the body.
                points = [np.array(target_contact[k+'_contact']) for k in ('heel','forefoot')]
                source_points = [np.array(source_contact[k+'_contact']) for k in ('heel','forefoot')]
                desired = source_points[1]-source_points[0]
                desired[1] = source_contact['forefoot']-source_contact['heel']
                delta = align(points[1]-points[0], desired)
                fi, ti = T.ids[side+'Foot'], T.ids[side+'Toes']
                origin = pose[fi,:3,3].copy()
                for bone in (fi,ti):
                    pose[bone,:3,:3] = delta@pose[bone,:3,:3]
                    pose[bone,:3,3] = origin+delta@(pose[bone,:3,3]-origin)
                pitch[side] += math.acos(np.clip((np.trace(delta)-1)/2,-1,1))
                target_contact = T.contact(pose,side)
                desired_height = max(C['sole_clearance_m'], source_contact['sole']*RATIO)
                goals[side][1] += desired_height-target_contact['sole']
                src_ids = S.patches[side]['forefoot_contact']
                tgt_ids = T.patches[side]['forefoot_contact']
                source_rest = S.restverts[src_ids].mean(axis=0)
                target_rest = T.restverts[tgt_ids].mean(axis=0)
                desired_point = target_rest+(np.array(source_contact['forefoot_contact'])-source_rest)*RATIO
                current_point = np.array(target_contact['forefoot_contact'])
                goals[side][[0, 2]] += (desired_point-current_point)[[0, 2]]

            # Only Hips animation adapts reach; Root and rig object transforms
            # remain identity. A smooth reserve avoids numerical knee lock.
            correction = 0.0
            for side in SIDES:
                origin = pose[T.ids[side+'UpperLeg'], :3, 3]
                a, b = T.segment(side+'UpperLeg', side+'LowerLeg'), T.segment(side+'LowerLeg', side+'Foot')
                reach = math.sqrt(a*a+b*b+2*a*b*math.cos(math.radians(C['minimum_knee_flexion_degrees'])))
                horizontal2 = np.sum((goals[side]-origin)[[0, 2]]**2)
                ceiling = goals[side][1]+math.sqrt(max(.01, reach*reach-horizontal2))
                correction = min(correction, ceiling-origin[1])
            if correction < 0:
                hips_adjust += correction
                pose = forward(np.array([rotation(m) for m in pose]), pose[T.ids['Hips'], :3, 3]+[0, correction, 0])
            for side in SIDES:
                solve_leg(pose, side, goals[side], poles[side])

        # The input clips close exactly; explicitly reuse the first solution to
        # avoid accumulated floating-point differences in endpoint metadata.
        if frame == len(data['samples'])-1:
            pose = np.array(samples[0]['poses'])
        for i, parent in enumerate(T.parents):
            if parent >= 0 and T.names[i] != 'Hips':
                actual = np.linalg.norm(pose[i, :3, 3]-pose[parent, :3, 3])
                expected = np.linalg.norm(TR[i, :3, 3]-TR[parent, :3, 3])
                assert abs(actual-expected) < 1e-5, (name, frame, T.names[i], actual, expected)
        record = measures(pose, T)
        record.update(time=sample['time'], poses=pose.tolist())
        samples.append(record)
        raw_samples.append(dict(time=sample['time'], **measures(base, T)))
        source_samples.append(dict(time=sample['time'], **measures(source, S)))
        compensation.append({'time': sample['time'], 'hips_y': float(pose[T.ids['Hips'], 1, 3]-base[T.ids['Hips'], 1, 3]), 'foot_pitch_degrees': {s: math.degrees(pitch[s]) for s in SIDES}})
        if frame % 240 == 0:
            print(name, frame, '/', len(data['samples']), flush=True)
    result = {'name': name, 'length': data['length'], 'step': data['step'], 'stride_ratio': RATIO, 'mapping': MAP, 'target_names': T.names, 'samples': samples, 'source_sha256': data['source_sha256'], 'target_sha256': hashlib.sha256((OUT/'candidates/canonical.glb').read_bytes()).hexdigest()}
    (OUT/(name+'-baked.json')).write_text(json.dumps(result), encoding='utf-8')
    (OUT/(name+'-comparison.json')).write_text(json.dumps({'source': source_samples, 'raw': raw_samples, 'compensation': compensation}), encoding='utf-8')
    print(name, 'DONE; stride ratio', RATIO, flush=True)


if __name__ == '__main__':
    (OUT/'authoring-reference.json').write_text(json.dumps({'target_names':T.names,'global_rotations':REFERENCE.tolist(),'skeleton_rest_changed':False,'derived_only_from':'source Rest limb directions and canonical Rest; no character data'}),encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--clip', choices=('idle', 'walking', 'running'), action='append')
    options = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for clip_name in options.clip or ('idle', 'walking', 'running'):
        retarget(clip_name)
