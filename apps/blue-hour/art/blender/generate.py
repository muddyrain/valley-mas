"""Blender entry point. Batches are validated before the next batch is allowed."""
import argparse
import importlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from asset_specs import GROUPS, specs
from utils.export import PROJECT, RUNTIME, reset, export_asset

GENERATORS = {"architecture": "generate_building_modules", "props": "generate_city_props",
              "vehicles": "generate_vehicles", "weapons": "generate_weapons", "infected": "generate_infected"}


def write_catalog(manifest):
    header = """# BLUE HOUR STARTER ENVIRONMENT KIT V1

生成真源为 `blender/asset_specs.py` 与各类别生成器；数值从实际 GLB 读取。蓝时号使用用户提供的 VEH_BLUE_HOUR，其余为原创 Blender 程序模型。先复用，再创建。

每项均展示于 `scenes/debug/art_showcase.tscn`。表中地点表示已接入的视觉位置，其余资产保存在展示场景供后续组合；不表示新增搜索对象或武器玩法。完整数据与哈希见 `assets/generated/manifest.json`。尺寸按 Godot X/Y/Z（宽/高/深，米）；面数只计渲染网格。

| ID / 中文用途 | 类别 | GLB / Blender 源 | Tris | 材质 | 简化碰撞 | 当前使用位置 | 程序生成 / Placeholder | 来源 |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
"""
    lines = [header]
    for key, item in sorted(manifest["assets"].items()):
        if not item["procedural"]:
            lines.append(f"| {key}<br>{item['usage']} | {item['category']} | [GLB](../{item['source_glb']}) / [Wrapper](../{item['path']}) | {item['triangles']} | {', '.join(item['materials'])} | {item['collision_proxies']} Box | {'；'.join(item['used_in'])} | 否 / 否 | 用户提供 Meshy GLB |\n")
            continue
        lines.append(f"| {key}<br>{item['usage']} | {item['category']} | [GLB](../{item['path']}) / [blend]({item['blend'].removeprefix('art/')}) | {item['triangles']} | {', '.join(item['materials'])} | {item['collision_proxies']} Box→Convex" + ("；宿主提供" if not item['collision_proxies'] else "") + f" | {'；'.join(item['used_in'])} | 是 / {'是' if item['placeholder'] else '否'} | Blender Generated |\n")
    lines.append(f"\n合计：{len(manifest['assets'])} 个模型，{sum(a['triangles'] for a in manifest['assets'].values())} 个渲染三角形。几何预算为上限，简单模块不会为填满预算而增加面数。\n")
    (PROJECT / "art/MODEL_CATALOG.md").write_text("".join(lines), encoding="utf-8")


def main():
    import bpy
    if bpy.app.version[:2] != (5, 2):
        raise RuntimeError(f"BLUE HOUR V1 requires Blender 5.2, found {bpy.app.version_string}")
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", choices=list(GROUPS), required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    for name in ("ART_BIBLE.md", "ASSET_PIPELINE.md", "MODEL_CATALOG.md"):
        (PROJECT / "art" / name).read_text(encoding="utf-8")
    module = importlib.import_module("generators." + GENERATORS[args.batch])
    manifest_path = RUNTIME / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"version": 1, "assets": {}}
    for asset_id, spec in specs().items():
        if spec["batch"] != args.batch:
            continue
        if not spec["procedural"]:
            # External originals and their reviewed wrapper are not Blender outputs.
            if not (PROJECT / spec["source_glb"]).is_file() or not (PROJECT / spec["path"]).is_file():
                raise FileNotFoundError(spec["source_glb"])
            continue
        reset()
        module.build(asset_id)
        item = export_asset(spec, "art/blender/generators/" + GENERATORS[args.batch] + ".py")
        manifest["assets"][asset_id] = item
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_catalog(manifest)
    print("BH_BATCH_PASS", args.batch)


if __name__ == "__main__":
    main()
