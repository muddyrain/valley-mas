"""Isolated unchanged public clips and before/after candidates for sleeve QA."""
from pathlib import Path
import shutil,json,hashlib
SRC=Path(__file__).resolve().parent;APP=SRC.parents[3]
OUT=APP/'test-output/survivor-upper-skin';BASE=APP/'test-output/survivor-t-pose-bind'
OUT.mkdir(parents=True,exist_ok=True)
for name in ['logs','evidence','build','xia_zhiyao','su_wanxing']:
    p=OUT/name;p.mkdir(exist_ok=True);(p/'.gdignore').write_text('')
for name in ['candidates','assets']:(OUT/name).mkdir(exist_ok=True)
for name in ['direct_drive_qa.gd','review.gd','review.tscn','project.godot','export_presets.cfg']:
    shutil.copy2(BASE/name,OUT/name)
for p in (BASE/'assets').glob('*.tres'):shutil.copy2(p,OUT/'assets'/p.name)
shutil.copy2(BASE/'candidates/canonical.glb',OUT/'candidates/canonical.glb')
for cid in ['xia_zhiyao','su_wanxing']:shutil.copy2(BASE/f'candidates/{cid}.glb',OUT/f'candidates/{cid}_reference.glb')
for p in SRC.iterdir():
    if p.suffix in ['.py','.gd'] and p.name!='prepare.py':shutil.copy2(p,OUT/p.name)
snapshot=OUT/'protected-before.json'
if not snapshot.exists():
    paths=[]
    for folder in ['assets/characters','assets/animations','art/blender/rigs','missions','survivors','weapons']:
        paths.extend(p for p in (APP/folder).rglob('*') if p.is_file())
    paths.extend((BASE/'candidates').glob('*.glb'))
    paths.extend(BASE/c/(c+'_t_pose_bind.blend') for c in ['xia_zhiyao','su_wanxing'])
    snapshot.write_text(json.dumps({str(p.resolve()):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},indent=2))
project=OUT/'project.godot';project.write_text(project.read_text().replace('Unified Survivor T Pose Bind Review','Survivor Upper Skin Review'))
preset=OUT/'export_presets.cfg'
preset.write_text(preset.read_text().replace('SurvivorBindReview.exe','SurvivorSkinReview.exe').replace('direct_drive_qa.gd,','direct_drive_qa.gd,capture_upper.gd,'))
print(OUT)
