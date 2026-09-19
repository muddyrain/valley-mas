"""Stage an isolated review project; never writes production assets."""
from pathlib import Path
import hashlib,json,shutil

APP=Path(__file__).resolve().parents[4]
SRC=Path(__file__).resolve().parent
OUT=APP/'test-output/survivor-t-pose-bind'
BASE=APP/'test-output/canonical-public-locomotion'
QA=APP/'art/blender/scripts/canonical_locomotion'
OUT.mkdir(parents=True,exist_ok=True)
for directory in ['logs','evidence','build','xia_zhiyao','su_wanxing']:
    folder=OUT/directory;folder.mkdir(exist_ok=True)
    (folder/'.gdignore').write_text('',encoding='utf-8')
for directory in ['assets','candidates']:(OUT/directory).mkdir(exist_ok=True)
for name in ['direct_drive_qa.gd','details.gd','analyze_dual.py','analyze_conversion.py','package_media.py','review.tscn']:
    shutil.copy2(QA/name,OUT/name)
for name in ['static_qa.gd','static_analysis.py','upper_dynamic.py','publish.py','review.gd','project.godot','export_presets.cfg']:
    shutil.copy2(SRC/name,OUT/name)
public=APP/'assets/animations/public_locomotion'
for clip in ['idle','walking','running']:
    shutil.copy2(public/f'public_{clip}.tres',OUT/'assets'/f'public_{clip}.tres')
library=(public/'public_locomotion.tres').read_text(encoding='utf-8')
(OUT/'assets/public_locomotion.tres').write_text(library.replace('res://assets/animations/public_locomotion/','res://assets/'),encoding='utf-8')
shutil.copy2(BASE/'candidates/canonical.glb',OUT/'candidates/canonical.glb')
for name in ['canonical-qa.json','rigs.json']+[f'{clip}-{suffix}.json' for clip in ['idle','walking','running'] for suffix in ['baked','comparison']]:
    shutil.copy2(BASE/name,OUT/name)
shutil.copy2(BASE/'evidence/canonical-runtime-samples.json',OUT/'evidence/canonical-runtime-samples.json')
snapshot=OUT/'protected-before.json'
if not snapshot.exists():
    paths=[]
    for folder in ['assets/characters','assets/animations','art/blender/rigs','characters','survivors','weapons','missions']:
        paths.extend(p for p in (APP/folder).rglob('*') if p.is_file())
    snapshot.write_text(json.dumps({str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},indent=2),encoding='utf-8')
print('Staged',OUT)
