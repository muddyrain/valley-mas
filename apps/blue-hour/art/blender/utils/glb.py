"""Read the delivered GLB, rather than trusting Blender's authoring statistics."""
import hashlib
import json
import struct
from pathlib import Path


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if (magic, version, length) != (b"glTF", 2, len(data)):
        raise ValueError(f"Invalid GLB header: {path}")
    offset, doc, binary = 12, None, b""
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        if offset + 8 + size > len(data):
            raise ValueError("Truncated GLB chunk")
        chunk = data[offset + 8:offset + 8 + size]
        if kind == b"JSON":
            doc = json.loads(chunk)
        elif kind == b"BIN\x00":
            binary = chunk
        offset += 8 + size
    if doc is None:
        raise ValueError("Missing GLB JSON")
    return doc, binary


def statistics(path):
    doc, binary = read_glb(path)
    render, collisions, material_names = 0, 0, set()
    lower, upper = [float("inf")] * 3, [float("-inf")] * 3
    fingerprints = []
    for node in doc.get("nodes", []):
        if "mesh" not in node:
            continue
        is_proxy = node.get("name", "").endswith("-convcolonly")
        collisions += int(is_proxy)
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            if primitive.get("mode", 4) != 4:
                raise ValueError("Only triangle primitives are supported")
            accessor = doc["accessors"][primitive["attributes"]["POSITION"]]
            if is_proxy:
                continue
            count = doc["accessors"][primitive["indices"]]["count"] if "indices" in primitive else accessor["count"]
            if count % 3:
                raise ValueError("Incomplete triangles")
            render += count // 3
            for axis in range(3):
                lower[axis] = min(lower[axis], accessor["min"][axis])
                upper[axis] = max(upper[axis], accessor["max"][axis])
            if "material" in primitive:
                material_names.add(doc["materials"][primitive["material"]]["name"])
            view = doc["bufferViews"][accessor["bufferView"]]
            start = view.get("byteOffset", 0)
            fingerprints.append(hashlib.sha256(binary[start:start + view["byteLength"]]).hexdigest())
    return {"triangles": render, "materials": sorted(material_names), "collision_proxies": collisions,
            "bounds_min": [round(v, 5) for v in lower], "bounds_max": [round(v, 5) for v in upper],
            "dimensions": [round(b - a, 5) for a, b in zip(lower, upper)],
            "geometry_hash": hashlib.sha256("".join(sorted(fingerprints)).encode()).hexdigest(),
            "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(), "bytes": Path(path).stat().st_size}
