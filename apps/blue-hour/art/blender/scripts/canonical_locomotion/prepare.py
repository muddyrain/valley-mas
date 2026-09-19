"""Prepare isolated canonical conversion without modifying any input."""
from pathlib import Path
import json, hashlib, shutil
OUT=Path(__file__).resolve().parent
APP=OUT.parents[1]
for d in ['assets','candidates','evidence','logs','sources']:
    (OUT/d).mkdir(exist_ok=True)
protected=set()
for directory in ['art/blender/rigs','assets/characters','assets/animations','survivors','missions','weapons','core','test-output/survivor-unified-rig/xia_zhiyao','test-output/survivor-unified-rig/su_wanxing']:
    protected.update(str(p.resolve()) for p in (APP/directory).rglob('*') if p.is_file())
protected.update(str(p.resolve()) for p in (APP/'art/blender/characters').glob('standard_survivor_*.blend'))
snapshot={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sorted(protected) if Path(p).is_file() and 'public_locomotion' not in p}
if not (OUT/'protected-before.json').exists():
    (OUT/'protected-before.json').write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
for cid in ['xia_zhiyao','su_wanxing']:
    shutil.copy2(APP/f'test-output/survivor-unified-rig/{cid}/{cid}_unified_rig_candidate.glb',OUT/f'candidates/{cid}.glb')
for clip in ['idle','walking','running']:
    shutil.copy2(APP/f'assets/characters/survivor_animation_template/animations/{clip}.tres',OUT/f'sources/{clip}.tres')
    bootstrap=APP/f'assets/animations/public_locomotion/public_{clip}.tres'
    if bootstrap.exists():shutil.copy2(bootstrap,OUT/f'assets/public_{clip}.tres')
bootstrap=APP/'assets/animations/public_locomotion/public_locomotion.tres'
if bootstrap.exists():
    (OUT/'assets/public_locomotion.tres').write_text(bootstrap.read_text().replace('res://assets/animations/public_locomotion/','res://assets/'),encoding='utf-8')
sampler=(APP/'art/blender/scripts/export_locomotion_retarget.gd').read_text()
sampler=sampler.replace('res://test-output/xia-zhiyao-locomotion/','res://test-output/canonical-public-locomotion/')
sampler=sampler.replace('\tvar target: Node3D = (load(TARGET) as PackedScene).instantiate() as Node3D\n','').replace('\troot.add_child(target)\n','').replace('\ttarget.queue_free()\n','')
sampler=sampler.replace('"rigs.json", {"source": describe(source), "target": describe(target)}','"source-rig.json", {"source": describe(source)}')
sampler='\n'.join(line for line in sampler.splitlines() if not line.startswith('const TARGET:'))+'\n'
(OUT/'sample_source.gd').write_text(sampler,encoding='utf-8')
print('Prepared',len(snapshot),'protected files')
