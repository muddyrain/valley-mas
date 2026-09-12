"""Standard-library validator over actual GLB data; usable outside Blender."""
import argparse
import json
import math
from pathlib import Path
from asset_specs import specs, GROUPS
from utils.glb import read_glb, statistics
from utils.materials import PALETTE, linear

PROJECT = Path(__file__).resolve().parents[2]


def validate(batch=None):
    errors = []
    manifest_path = PROJECT / "assets/generated/manifest.json"
    if not manifest_path.exists():
        return ["Missing manifest.json"], 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))["assets"]
    catalog = (PROJECT / "art/MODEL_CATALOG.md").read_text(encoding="utf-8")
    expected = {key: item for key, item in specs().items() if batch is None or item["batch"] == batch}
    fingerprints = {}
    for key, spec in expected.items():
        try:
            item = manifest[key]
            path = PROJECT / item["path"]
            assert item["path"] == spec["path"], "file naming"
            assert key in catalog and f"../{item['path']}" in catalog, "Catalog registration"
            if not spec["procedural"]:
                assert path.is_file(), "missing external vehicle wrapper"
                source = PROJECT / spec["source_glb"]
                actual = statistics(source)
                for field in ("triangles", "materials", "geometry_hash", "sha256", "bytes"):
                    assert item[field] == actual[field], f"external source drift: {field}"
                assert item["source_dimensions"] == actual["dimensions"], "external source units"
                assert item["triangles"] <= spec["budget"], "reviewed external source budget"
                # Transformed scene bounds and simple collision are checked by Godot.
                continue
            assert (PROJECT / item["blend"]).is_file(), "missing Blender source"
            assert (PROJECT / item["generator"]).is_file(), "missing generator"
            actual = statistics(path)
            assert 500 <= actual["bytes"] <= 8_000_000, "abnormal GLB file size"
            assert 0 < actual["triangles"] <= spec["budget"], "triangle budget"
            for field in actual:
                assert item[field] == actual[field], f"manifest drift: {field}"
            doc, binary = read_glb(path)
            assert not doc.get("images") and not doc.get("textures"), "V1 uses shared texture-free materials"
            assert not doc.get("animations") and not doc.get("cameras"), "unexpected scene data"
            assert all(math.isfinite(v) and 0 < v < 30 for v in actual["dimensions"]), "abnormal dimensions"
            if spec["category"] not in ("weapons",):
                assert -0.02 <= actual["bounds_min"][1] <= 0.03, "origin must touch ground"
            if "StreetLamp" in key:
                assert 5 <= actual["dimensions"][1] <= 7, "street lamp scale"
            if spec["category"] == "vehicles":
                assert (8 <= actual["dimensions"][2] <= 10) if "EvacBus" in key else (4 <= actual["dimensions"][2] <= 4.9), "vehicle scale"
            assert set(actual["materials"]) <= set(PALETTE), "unknown material"
            for mat in doc.get("materials", []):
                if mat["name"] not in PALETTE:
                    raise AssertionError("material naming")
                code, roughness, metallic = PALETTE[mat["name"]]
                expected_color = [linear(int(code[i:i + 2], 16) / 255) for i in (0, 2, 4)] + [1]
                pbr = mat.get("pbrMetallicRoughness", {})
                assert all(abs(a - b) < 0.0001 for a, b in zip(expected_color, pbr.get("baseColorFactor", [1]*4))), "palette mismatch"
                assert abs(pbr.get("roughnessFactor", 1) - roughness) < .0001, "roughness mismatch"
                assert abs(pbr.get("metallicFactor", 1) - metallic) < .0001, "metallic mismatch"
            for node in doc.get("nodes", []):
                assert node.get("name", "").startswith("BH_"), "node naming"
                assert node.get("scale", [1, 1, 1]) == [1, 1, 1], "unapplied scale"
                assert node.get("rotation", [0, 0, 0, 1]) == [0, 0, 0, 1], "unapplied rotation"
                assert node.get("translation", [0, 0, 0]) == [0, 0, 0], "unapplied translation"
                assert "matrix" not in node, "unexpected matrix transform"
                if node.get("name", "").endswith("-convcolonly"):
                    for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                        assert doc["accessors"][primitive["indices"]]["count"] == 36, "proxy must be a simple box"
            needs_collision = spec["category"] not in ("weapons", "characters")
            assert (actual["collision_proxies"] > 0) == needs_collision, "collision ownership"
            assert actual["geometry_hash"] not in fingerprints, f"duplicate render geometry with {fingerprints.get(actual['geometry_hash'])}"
            fingerprints[actual["geometry_hash"]] = key
            for view in doc.get("bufferViews", []):
                assert view.get("byteOffset", 0) + view["byteLength"] <= len(binary), "out of bounds buffer"
        except (AssertionError, KeyError, ValueError, OSError) as exc:
            errors.append(f"{key}: {exc}")
    all_specs = specs()
    all_ids = set(all_specs)
    all_paths = {spec["path"] for spec in all_specs.values()}
    for path in (PROJECT / "assets/generated").glob("*.glb"):
        if path.relative_to(PROJECT).as_posix() not in all_paths:
            errors.append(f"Unregistered asset: {path.name}")
    if set(manifest) - all_ids:
        errors.append("Unregistered manifest entries")
    return errors, len(expected)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", choices=list(GROUPS))
    args = parser.parse_args()
    errors, count = validate(args.batch)
    for error in errors:
        print("FAIL", error)
    print(f"ASSET VALIDATION: {count} assets, {len(errors)} failures")
    raise SystemExit(bool(errors))
