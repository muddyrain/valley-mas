"""Publish the single unintegrated library and reproducible offline tools."""
from pathlib import Path
import json,shutil,hashlib
OUT=Path(__file__).resolve().parent;APP=OUT.parents[1]
dest=APP/'assets/animations/public_locomotion';dest.mkdir(parents=True,exist_ok=True)
for name in ['idle','walking','running']:
    shutil.copy2(OUT/f'assets/public_{name}.tres',dest/f'public_{name}.tres')
library=(OUT/'assets/public_locomotion.tres').read_text().replace('res://assets/public_','res://assets/animations/public_locomotion/public_')
(dest/'public_locomotion.tres').write_text(library,encoding='utf-8')
manifest=json.loads((OUT/'conversion-verification.json').read_text())
manifest.update(status='canonical_qa_pass; dual_candidate_skin_qa_fail; not_integrated',rig='BH_Humanoid_Rig_v1',qa_report='docs/CANONICAL_PUBLIC_LOCOMOTION_REPORT.md',source_directory='assets/characters/survivor_animation_template/animations',authoring_reference='one common reference pose derived from source Rest; frozen target Skeleton Rest is unchanged',gameplay_speed_changed=False)
(dest/'provenance.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
scripts=APP/'art/blender/scripts/canonical_locomotion';scripts.mkdir(parents=True,exist_ok=True)
names=['prepare.py','build_canonical_proxy.py','sample_source.gd','describe_canonical.gd','conversion-profile.json','convert.py','bake.gd','direct_drive_qa.gd','details.gd','analyze_conversion.py','analyze_dual.py','verify_conversion.py','gate.py','package_media.py','project.godot','review.gd','review.tscn','export_presets.cfg','publish.py','finalize.py']
for name in names:
    if (OUT/name).exists():shutil.copy2(OUT/name,scripts/name)
snapshot=json.loads((OUT/'protected-before.json').read_text());differences=[]
for filename,old in snapshot.items():
    p=Path(filename);new=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
    if new!=old:differences.append({'path':filename,'before':old,'after':new})
(OUT/'protection-result.json').write_text(json.dumps({'count':len(snapshot),'unchanged':len(snapshot)-len(differences),'differences':differences},indent=2))
print('Published one common library; protected',len(snapshot),'differences',differences)
