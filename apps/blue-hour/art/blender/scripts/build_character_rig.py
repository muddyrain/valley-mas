"""One import/fit/bind/pose/export pipeline for reviewed survivor fits."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from create_humanoid_rig import APP_ROOT, BLENDER_ROOT, save_rig
from fit_humanoid_rig import fit_character
from bind_character import bind_character
from export_character_glb import export_character
from pose_test import pose_test


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--character', choices=['xia_zhiyao', 'su_wanxing'], default='xia_zhiyao')
    parser.add_argument('--skip-render', action='store_true')
    parser.add_argument('--output', type=Path, help='Optional staging GLB; runtime is promoted only after review')
    parser.add_argument('--report-dir', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    character = args.character
    args.report_dir = args.report_dir or APP_ROOT / f'test-output/replacement/{character}/poses'
    if not args.report_dir.is_absolute():
        args.report_dir = (APP_ROOT.parents[1] / args.report_dir).resolve()
    if not (BLENDER_ROOT / 'rigs/BH_Humanoid_Rig_v1.blend').exists():
        save_rig(BLENDER_ROOT / 'rigs/BH_Humanoid_Rig_v1.blend')
    source = APP_ROOT / f'assets/characters/{character}/source/{character}.glb'
    rig, meshes, config = fit_character(source, BLENDER_ROOT / f'rigs/{character}_fit.json')
    weights = bind_character(rig, meshes, config)
    # Packed images make the editable character independent of external texture paths.
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    character_blend = BLENDER_ROOT / f'characters/{character}.blend'
    character_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(character_blend))
    output = args.output or APP_ROOT / f'test-output/replacement/{character}/{character}.glb'
    output = output.resolve()
    exported = export_character(rig, meshes, output)
    exported['path'] = output.relative_to(APP_ROOT).as_posix()
    report = {'source_sha256': config['source_sha256'], 'weights': weights, 'export': exported}
    (BLENDER_ROOT / f'rigs/{character}_build_report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    poses = pose_test(rig, meshes, args.report_dir, render=not args.skip_render)
    poses['export_sha256'] = exported['sha256']
    (BLENDER_ROOT / f'rigs/{character}_pose_report.json').write_text(json.dumps(poses, indent=2) + '\n', encoding='utf-8')
    print('BH HUMANOID BUILD COMPLETE: staged skeleton + skin + static pose samples; zero actions')


if __name__ == '__main__':
    main()
