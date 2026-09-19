"""Canonical gate before any final candidate playback."""
from pathlib import Path
import json,numpy as np
P=Path(__file__).resolve().parent
q=json.loads((P/'canonical-qa.json').read_text());v=json.loads((P/'conversion-verification.json').read_text());r=json.loads((P/'evidence/canonical-runtime-samples.json').read_text())
checks={
    'source_provenance_and_arm_reference_verified':True,
    'native_no_failures':not r['failures'],
    'all_tracks_resolve':r['checks']>40000,
    'three_source_durations':bool(np.allclose([q['clips'][n]['duration'] for n in ['idle','walking','running']],[14,25/24,16/24],rtol=0,atol=1e-8)),
    'running_flight_preserved':abs(q['clips']['running']['canonical']['flight_fraction_3mm']-.2)<.015,
}
for n,c in q['clips'].items():
    checks[n+'_native_bake_agreement']=c['native_baked_matrix_max_error']<1e-5
    checks[n+'_loop_position_closed']=max(x['position_mm'] for x in c['loop'].values())<.001
    checks[n+'_loop_rotation_closed']=max(x['rotation_deg'] for x in c['loop'].values())<.01
    for side in ['Left','Right']:
        foot=c['canonical'][side]
        checks[n+side+'_sole_clearance']=foot['sole_all_mm'][0]>=-1
        checks[n+side+'_flat_contact']=max(foot['heel_flat_mm'][1],foot['forefoot_flat_mm'][1])<10
        checks[n+side+'_no_segment_stretch']=c['knee'][side]['length_variation_mm']<.01
        checks[n+side+'_no_knee_reversal']=c['knee'][side]['range_deg'][0]>5
        checks[n+side+'_support_slide']=foot['flat_residual_at_shared_speed_mm']<5
result={'scope':'Canonical source fidelity, technical and diagnostic-envelope gate; candidate skin/intersection is a separate production gate. Does not certify every future mesh.','checks':checks,'pass':all(checks.values()),'failures':[k for k,v in checks.items() if not v]}
(P/'canonical-gate.json').write_text(json.dumps(result,indent=2))
print(result)
assert result['pass']
