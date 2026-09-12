"""Inspect supplied GLBs without changing their bytes; stage audited sources for Godot."""
import argparse
import hashlib
import json
import pathlib
import shutil
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPECS = [
    ("BLD_001_supermarket", "001_", "buildings/commercial", "building_supermarket"),
    ("BLD_002_house_small_a", "002_", "buildings/residential", "building_house_small_a"),
    ("BLD_003_house_small_b", "003_", "buildings/residential", "building_house_small_b"),
    ("BLD_004_pharmacy", "004_", "buildings/commercial", "building_pharmacy"),
    ("BLD_005_restaurant_small", "005_", "buildings/commercial", "building_restaurant_small"),
    ("BLD_006_warehouse_small", "006_", "buildings/industrial", "building_warehouse_small"),
    ("BLD_007_gas_station", "007_", "buildings/service", "building_gas_station"),
    ("BLD_008_auto_repair_shop", "008_", "buildings/service", "building_auto_repair_shop"),
    ("VEH_001_sedan_a", "VEH_001", "vehicles", "vehicle_sedan_a"),
    ("VEH_002_suv", "Silver_Urban", "vehicles", "vehicle_suv"),
    ("VEH_003_van", "White_Cargo", "vehicles", "vehicle_van"),
    ("PRP_001_street_lamp", "PRP_001", "props/street", "prop_street_lamp"),
    ("PRP_002_trash_bin", "PRP_002", "props/street", "prop_trash_bin"),
    ("BAR_001_chainlink_fence", "0912032355", "barriers", "barrier_chainlink_source"),
    ("VEG_001_tree_broadleaf_a", "0912032102", "vegetation", "vegetation_tree_broadleaf_a"),
    ("VEG_002_bush_a", "VEG_002", "vegetation", "vegetation_bush_a"),
]


def read_glb(path):
    raw = path.read_bytes()
    magic, version, size = struct.unpack_from("<III", raw)
    assert magic == 0x46546C67 and version == 2 and size == len(raw)
    length, tag = struct.unpack_from("<II", raw, 12)
    assert tag == 0x4E4F534A
    doc = json.loads(raw[20:20 + length])
    offset = 20 + length
    binary_size, tag = struct.unpack_from("<II", raw, offset)
    assert tag == 0x004E4942
    return raw, doc, raw[offset + 8:offset + 8 + binary_size]


def values(doc, binary, index):
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    kind = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}[accessor["componentType"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    fmt = "<" + kind * count
    stride = view.get("byteStride", struct.calcsize(fmt))
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(accessor["count"])]


def audit(path):
    raw, doc, binary = read_glb(path)
    # Reject unhandled transforms rather than reporting local bounds as world bounds.
    for node in doc.get("nodes", []):
        assert not any(k in node for k in ("matrix", "rotation", "scale", "translation")), node
    vertices, triangles, degenerate = [], 0, 0
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            assert primitive.get("mode", 4) == 4
            positions = values(doc, binary, primitive["attributes"]["POSITION"])
            indices = [i[0] for i in values(doc, binary, primitive["indices"])]
            triangles += len(indices) // 3
            for i in range(0, len(indices), 3):
                a, b, c = [positions[j] for j in indices[i:i + 3]]
                u, v = [b[j]-a[j] for j in range(3)], [c[j]-a[j] for j in range(3)]
                cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
                degenerate += sum(x*x for x in cross) < 1e-18
            vertices.extend(positions)
    lo = [min(v[i] for v in vertices) for i in range(3)]
    hi = [max(v[i] for v in vertices) for i in range(3)]
    images = []
    for img in doc.get("images", []):
        view = doc["bufferViews"][img["bufferView"]]
        data = binary[view.get("byteOffset", 0):view.get("byteOffset", 0)+view["byteLength"]]
        dimensions = list(struct.unpack_from(">II", data, 16)) if data.startswith(b"\x89PNG") else jpeg_size(data)
        images.append({"mime": img.get("mimeType"), "bytes": len(data), "dimensions": dimensions})
    return {"source": str(path), "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
            "mesh_count": len(doc["meshes"]), "triangles": triangles, "degenerate_triangles": degenerate,
            "min": lo, "max": hi, "size": [hi[i]-lo[i] for i in range(3)],
            "nodes": doc["nodes"], "materials": doc.get("materials", []), "textures": images,
            "source_scale": [1, 1, 1], "up": "+Y", "forward": "pending visual review"}


def jpeg_size(data):
    offset = 2
    while offset < len(data) - 4:
        if data[offset] != 255:
            offset += 1
            continue
        marker = data[offset + 1]
        offset += 2
        if marker in (216, 217):
            continue
        length = int.from_bytes(data[offset:offset+2], "big")
        if marker in (192, 193, 194, 195):
            return [int.from_bytes(data[offset+5:offset+7], "big"), int.from_bytes(data[offset+3:offset+5], "big")]
        offset += length
    return []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=pathlib.Path)
    args = parser.parse_args()
    files = list(args.source.glob("*.glb"))
    reports = []
    for asset_id, token, folder, name in SPECS:
        matches = [p for p in files if ("Meshy_AI_" + token in p.name if token[:3].isdigit() and len(token) == 4 else token in p.name)]
        if len(matches) != 1:
            reports.append({"id": asset_id, "missing": True})
            continue
        report = audit(matches[0])
        dest = ROOT / "assets/world" / folder / (name + "_model.glb")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(matches[0], dest)
        report.update(id=asset_id, path="res://" + dest.relative_to(ROOT).as_posix(),
                      wrapper="res://scenes/world/" + folder + "/" + name.replace("_source", "") + ".tscn")
        reports.append(report)
        print(asset_id, report["triangles"], [round(x, 3) for x in report["size"]])
    (ROOT / "art/world_asset_audit.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
