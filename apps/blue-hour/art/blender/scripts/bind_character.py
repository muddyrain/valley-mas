"""Fresh automatic heat on seam-welded proxies, then reviewed A-pose corrections."""
import bpy
import numpy as np
import heapq
import bmesh
from mathutils.kdtree import KDTree


def smooth(low, high, value):
    t = max(0, min(1, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def weight_audit(mesh):
    rows = [[g.weight for g in v.groups if g.weight > 0] for v in mesh.data.vertices]
    return {'vertices': len(rows), 'unweighted': sum(not r for r in rows),
            'max_influences': max(map(len, rows), default=0),
            'max_sum_error': max((abs(sum(r) - 1) for r in rows), default=0),
            'method': mesh.get('weight_method', 'automatic_heat'),
            'corrections': {key: mesh[key] for key in ('heat_unweighted_vertices', 'heat_proxy_vertices',
                'hair_vertices', 'hair_core_vertices', 'hair_junction_edges',
                'hair_arm_weight_before', 'hair_arm_weight_after') if key in mesh}}


def albedo_per_vertex(mesh):
    material = mesh.data.materials[0]
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    image = principled.inputs['Base Color'].links[0].from_node.image
    pixels = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape((image.size[1], image.size[0], 4))
    color = np.zeros((len(mesh.data.vertices), 3))
    count = np.zeros(len(mesh.data.vertices))
    for loop in mesh.data.loops:
        uv = mesh.data.uv_layers.active.data[loop.index].uv
        x = min(image.size[0] - 1, max(0, int(uv.x * image.size[0])))
        y = min(image.size[1] - 1, max(0, int(uv.y * image.size[1])))
        color[loop.vertex_index] += pixels[y, x, :3]
        count[loop.vertex_index] += 1
    return color / np.maximum(count[:, None], 1)


def classify_regions(mesh, colors, character='xia_zhiyao'):
    """Geodesic region fill from reviewed seeds; labels travel along the surface.

    This keeps texture patches with their sleeve and fills dark hair highlights,
    while preventing nearby skirt/mascot surfaces from following an arm.
    """
    points = np.array([v.co[:] for v in mesh.data.vertices])
    coordinates, inverse = np.unique(np.round(points, 5), axis=0, return_inverse=True)
    color = np.zeros((len(coordinates), 3))
    np.add.at(color, inverse, colors)
    color /= np.bincount(inverse)[:, None]
    edges = np.unique(np.sort(inverse[np.array([tuple(e.vertices) for e in mesh.data.edges])], axis=1), axis=0)
    adjacency = [[] for _ in coordinates]
    for a, b in edges:
        cost = float(np.linalg.norm(coordinates[a] - coordinates[b]) * (1 + 8 * np.linalg.norm(color[a] - color[b])))
        adjacency[a].append((b, cost))
        adjacency[b].append((a, cost))
    labels = np.full(len(coordinates), -1, dtype=int)
    distance = np.full(len(coordinates), np.inf)
    queue = []
    for i, ((x, y, z), (r, g, b)) in enumerate(zip(coordinates, color)):
        brown = r > 1.08 * g and g > .99 * b
        label = -1
        su_hair = character == 'su_wanxing' and z > .84 and y > .025
        xia_hair = character == 'xia_zhiyao' and z > .91 and brown
        if z > 1.285 or su_hair or xia_hair:
            label = 1
        elif character == 'su_wanxing' and .70 < z < 1.075 and abs(x) > .27 and y < 0:
            label = 2 if x >= 0 else 3
        elif character == 'xia_zhiyao' and .70 < z < 1.20 and abs(x) > .155 + .40 * (1.18-z) and y < .075:
            label = 2 if x >= 0 else 3
        elif z < .70 or (abs(x) < .09 and z < 1.235 and y < 0):
            label = 0
        elif abs(x) < .11 and y < -.08 and z < 1.17:
            label = 0
        elif abs(x) < .20 and z < .90 and y < .015:
            label = 0
        if label >= 0:
            labels[i], distance[i] = label, 0
            heapq.heappush(queue, (0, i))
    while queue:
        cost, vertex = heapq.heappop(queue)
        if cost > distance[vertex]:
            continue
        for neighbor, edge_cost in adjacency[vertex]:
            candidate = cost + edge_cost
            if candidate < distance[neighbor]:
                distance[neighbor] = candidate
                labels[neighbor] = labels[vertex]
                heapq.heappush(queue, (candidate, neighbor))
    # Tiny disconnected internal surfaces inherit the closest classified surface.
    from mathutils.kdtree import KDTree
    known = np.flatnonzero(labels >= 0)
    tree = KDTree(len(known))
    for i in known:
        tree.insert(coordinates[i], int(i))
    tree.balance()
    for i in np.flatnonzero(labels < 0):
        _, neighbor, _ = tree.find(coordinates[i])
        labels[i] = labels[neighbor]
    return labels[inverse]


def correct_reviewed_regions(mesh, rig, config):
    """Fresh A-pose masks: keep hair on the head, lower coat on the torso, soles rigid."""
    if config.get('weight_corrections') != 'reviewed_a_pose_surfaces':
        raise ValueError('Review surface masks against this source hash before correcting weights')
    regions = classify_regions(mesh, albedo_per_vertex(mesh), config['character'])
    names = [group.name for group in mesh.vertex_groups]
    indices = {name: i for i, name in enumerate(names)}
    arm_indices = [i for i,n in enumerate(names) if any(part in n for part in ('Arm','Shoulder','Hand'))]
    weights = np.zeros((len(mesh.data.vertices), len(names)))
    for vertex in mesh.data.vertices:
        for group in vertex.groups:
            weights[vertex.index, group.group] = group.weight
    hair = regions == 1
    mesh['hair_arm_weight_before'] = float(weights[hair][:,arm_indices].sum(axis=1).max())
    weights[hair] = 0
    weights[hair, indices['Head']] = 1
    for vertex, region in zip(mesh.data.vertices, regions):
        x,y,z = vertex.co
        row = weights[vertex.index]
        if region == 0 and abs(x) < .17 and .90 < z < 1.20:
            amount = (1 - smooth(1.10, 1.20, z)) * (1 - smooth(.14, .17, abs(x)))
            removed = row[arm_indices].sum() * amount
            row[arm_indices] *= 1 - amount
            chest = smooth(1.0, 1.13, z)
            row[indices['Spine']] += removed * (1 - chest)
            row[indices['Chest']] += removed * chest
        if z < .23:
            # Laces and upper boots blend into the ankle; the entire sole follows Foot.
            amount = 1 - smooth(.18, .23, z)
            row *= 1 - amount
            row[indices[('Left' if x >= 0 else 'Right') + 'Foot']] += amount
        if row.sum() < .000001:
            raise ValueError('Region correction removed every influence')
    # Meshy leaves some hair/cloth junctions on one continuous surface.
    # Relax the transition on that surface, with hair cores and distant cloth fixed.
    coordinates = np.array([v.co[:] for v in mesh.data.vertices])
    _, inverse = np.unique(np.round(coordinates, 5), axis=0, return_inverse=True)
    edges = np.unique(np.sort(inverse[np.array([tuple(e.vertices) for e in mesh.data.edges])],axis=1),axis=0)
    welded = np.zeros((inverse.max()+1,len(names)))
    np.add.at(welded,inverse,weights)
    welded /= np.bincount(inverse)[:,None]
    labels = np.zeros(len(welded),dtype=bool)
    labels[inverse[hair]] = True
    crossing = edges[labels[edges[:,0]] != labels[edges[:,1]]]
    distance = np.full(len(welded),100)
    distance[np.unique(crossing)] = 0
    for _ in range(16):
        previous = distance.copy()
        np.minimum.at(distance,edges[:,0],previous[edges[:,1]]+1)
        np.minimum.at(distance,edges[:,1],previous[edges[:,0]]+1)
    blend = np.clip((16-distance)/4,0,1)*.65
    degree = np.bincount(edges.ravel(),minlength=len(welded))
    for _ in range(96):
        adjacent = np.zeros_like(welded)
        np.add.at(adjacent,edges[:,0],welded[edges[:,1]])
        np.add.at(adjacent,edges[:,1],welded[edges[:,0]])
        welded += blend[:,None]*(adjacent/np.maximum(degree[:,None],1)-welded)
    weights = welded[inverse]
    core = hair & (distance[inverse] >= 16)
    mesh['hair_core_vertices'] = int(core.sum())
    mesh['hair_junction_edges'] = len(crossing)
    mesh['hair_arm_weight_after'] = float(weights[core][:,arm_indices].sum(axis=1).max())
    correct_infected_tshirt_weights(mesh, weights, names, rig)
    correct_infected_leg_weights(mesh, weights, names)
    for group in mesh.vertex_groups:
        group.remove(list(range(len(mesh.data.vertices))))
    for vertex,row in enumerate(weights):
        strongest = np.argsort(row)[-4:]
        total = sum(row[i] for i in strongest)
        for i in strongest:
            if row[i] > 0:
                mesh.vertex_groups[i].add([vertex], float(row[i] / total), 'REPLACE')
    mesh['hair_vertices'] = int(hair.sum())
    mesh['weight_method'] += '_reviewed_hair_coat_shoe_corrections'


def correct_infected_tshirt_weights(mesh, weights, names, rig):
    """Rebuild both arm chains from local segment proximity; heat transfer crossed islands."""
    if mesh.get('character_id', '') != 'infected_basic_a':
        return
    indices = {name: i for i, name in enumerate(names)}
    arm_names = {
        'Left': ['LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand'],
        'Right': ['RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand'],
    }
    torso = [indices['Spine'], indices['Chest'], indices['UpperChest']]
    arm_indices = [indices[name] for side in arm_names.values() for name in side]

    def segment_distance(point: np.ndarray, a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
        axis = b - a
        length_sq = float(np.dot(axis, axis))
        t = 0.0 if length_sq < 1e-10 else float(np.clip(np.dot(point - a, axis) / length_sq, 0.0, 1.0))
        return float(np.linalg.norm(point - (a + axis * t))), t

    segments: dict[str, list[tuple[str, np.ndarray, np.ndarray]]] = {}
    for side, chain in arm_names.items():
        segments[side] = []
        for bone_name in chain:
            bone = rig.data.bones[bone_name]
            segments[side].append((bone_name, np.array(bone.head_local), np.array(bone.tail_local)))
    adjusted = 0
    for vertex in mesh.data.vertices:
        point = np.array(vertex.co)
        side = 'Left' if point[0] >= 0.0 else 'Right'
        distances = [segment_distance(point, a, b) for _, a, b in segments[side]]
        nearest_index = min(range(len(distances)), key=lambda i: distances[i][0])
        nearest_distance, segment_t = distances[nearest_index]
        # Only repair vertices that heat assigned to an arm and are spatially close to that chain.
        envelope = 0.085 if nearest_index >= 2 else 0.11
        existing_side = [indices[name] for name in arm_names[side]]
        existing_arm = float(sum(weights[vertex.index, i] for i in existing_side))
        if nearest_distance > envelope or existing_arm < 0.12 or point[2] < 0.56 or point[2] > 1.34:
            continue
        row = weights[vertex.index]
        # Remove non-local torso/opposite-arm pollution, retaining smooth local heat weights.
        non_local = 1.0 - existing_arm
        if nearest_index > 0:
            local_values = row[existing_side].copy()
            row[:] *= 0.0
            row[existing_side] = local_values
        else:
            row[torso] = 0.0
        opposite = [indices[name] for name in arm_names['Right' if side == 'Left' else 'Left']]
        row[opposite] = 0.0
        row[existing_side] *= 1.0 + non_local
        adjusted += 1
    mesh['infected_tshirt_vertices_adjusted'] = adjusted
    mesh['infected_tshirt_arm_weight_after'] = float(weights[:, arm_indices].sum(axis=1).max())


def correct_infected_leg_weights(mesh, weights, names):
    """Prevent heat transfer from binding one pant leg to the opposite leg chain."""
    if mesh.get('character_id', '') != 'infected_basic_a':
        return
    indices = {name: i for i, name in enumerate(names)}
    left = [indices[name] for name in ('LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'LeftToes')]
    right = [indices[name] for name in ('RightUpperLeg', 'RightLowerLeg', 'RightFoot', 'RightToes')]
    corrected = 0
    for vertex in mesh.data.vertices:
        x, _y, z = vertex.co
        if z >= 0.95 or abs(x) < (0.035 if z < 0.45 else 0.045):
            continue
        own, opposite = (left, right) if x >= 0.0 else (right, left)
        opposite_weight = float(weights[vertex.index, opposite].sum())
        if opposite_weight <= 0.05:
            continue
        weights[vertex.index, opposite] = 0.0
        own_weight = float(weights[vertex.index, own].sum())
        if own_weight > 1e-6:
            weights[vertex.index, own] *= (own_weight + opposite_weight) / own_weight
        else:
            weights[vertex.index, own[0]] = opposite_weight
        corrected += 1
    mesh['infected_leg_cross_weight_vertices_fixed'] = corrected


def solve_seam_welded_heat(mesh, rig):
    """Solve fresh weights on a welded copy, retaining source render geometry/UVs."""
    proxy = mesh.copy()
    proxy.data = mesh.data.copy()
    proxy.vertex_groups.clear()
    proxy.modifiers.clear()
    proxy.parent = None
    bpy.context.collection.objects.link(proxy)
    bm = bmesh.new()
    bm.from_mesh(proxy.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.00001)
    bm.to_mesh(proxy.data)
    bm.free()
    try:
        bpy.ops.object.select_all(action='DESELECT')
        proxy.select_set(True)
        rig.select_set(True)
        # Centimetres improve the heat solver's numerical conditioning.
        proxy.scale = rig.scale = (100, 100, 100)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        if weight_audit(proxy)['unweighted']:
            raise RuntimeError('Welded heat left unweighted vertices; manual review required')
        tree = KDTree(len(proxy.data.vertices))
        for v in proxy.data.vertices:
            tree.insert(v.co, v.index)
        tree.balance()
        mesh.vertex_groups.clear()
        groups = [mesh.vertex_groups.new(name=g.name) for g in proxy.vertex_groups]
        for vertex in mesh.data.vertices:
            _, index, distance = tree.find(vertex.co)
            if distance > .000011:
                raise RuntimeError('Heat proxy no longer matches the original surface')
            for group in proxy.data.vertices[index].groups:
                groups[group.group].add([vertex.index], group.weight, 'REPLACE')
        mesh['weight_method'] = 'fresh_heat_on_seam_welded_centimetre_proxy'
        mesh['heat_proxy_vertices'] = len(proxy.data.vertices)
    finally:
        rig.scale = (1, 1, 1)
        data = proxy.data
        bpy.data.objects.remove(proxy, do_unlink=True)
        bpy.data.meshes.remove(data)


def bind_character(rig, meshes, config):
    rig.data.bones['Root'].use_deform = False
    for mesh in meshes:
        bpy.ops.object.select_all(action='DESELECT')
        mesh.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        unweighted = weight_audit(mesh)['unweighted']
        mesh['heat_unweighted_vertices'] = unweighted
        if unweighted:
            solve_seam_welded_heat(mesh, rig)
        else:
            mesh['weight_method'] = 'direct_automatic_heat'
        correct_reviewed_regions(mesh, rig, config)
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.vertex_group_limit_total(limit=4)
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        for modifier in mesh.modifiers:
            if modifier.type == 'ARMATURE':
                modifier.use_deform_preserve_volume = False
        audit = weight_audit(mesh)
        if audit['unweighted'] or audit['max_sum_error'] > .00001:
            raise RuntimeError('Invalid weights; do not export')
    rig.data.bones['Root'].use_deform = True
    return {mesh.name: weight_audit(mesh) for mesh in meshes}
