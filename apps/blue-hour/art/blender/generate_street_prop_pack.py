"""Generate the Phase 3A street prop pack as small, material-only GLBs.

The project normally runs this geometry through Blender.  The CI/workstation
used for this delivery has no Blender binary, so this dependency-free writer
keeps the same stable IDs, metric dimensions, ground pivots, and low-poly
style while producing importable GLBs for Godot.  The output is intentionally
simple: boxes, cylinders, rings, and UV spheres with flat-color materials.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/world/props/street_prop_pack_v1"
MANIFEST = OUT / "manifest.json"

MATERIALS = {
    "paint_blue": [0.18, 0.34, 0.42, 1.0],
    "paint_green": [0.25, 0.37, 0.31, 1.0],
    "paint_orange": [0.86, 0.34, 0.11, 1.0],
    "paint_yellow": [0.93, 0.71, 0.21, 1.0],
    "paint_red": [0.55, 0.16, 0.12, 1.0],
    "wood": [0.44, 0.30, 0.18, 1.0],
    "concrete": [0.43, 0.46, 0.44, 1.0],
    "metal": [0.25, 0.29, 0.30, 1.0],
    "dark": [0.08, 0.10, 0.10, 1.0],
    "glass": [0.19, 0.47, 0.55, 1.0],
    "leaf": [0.29, 0.46, 0.25, 1.0],
    "clay": [0.70, 0.31, 0.18, 1.0],
    "cardboard": [0.64, 0.49, 0.29, 1.0],
    "rubber": [0.06, 0.07, 0.07, 1.0],
}


class Mesh:
    def __init__(self) -> None:
        self.positions: list[tuple[float, float, float]] = []
        self.normals: list[tuple[float, float, float]] = []
        self.indices: list[int] = []
        self.materials: list[str] = []
        self.ranges: list[tuple[int, int, str]] = []

    def tri(self, vertices: list[tuple[float, float, float]], normal: tuple[float, float, float], material: str) -> None:
        start = len(self.positions)
        self.positions.extend(vertices)
        self.normals.extend([normal] * len(vertices))
        self.indices.extend(range(start, start + len(vertices)))
        self.ranges.append((len(self.indices) - len(vertices), len(vertices), material))

    def box(self, size: tuple[float, float, float], center: tuple[float, float, float], material: str, bevel: float = 0.0) -> None:
        sx, sy, sz = (v * 0.5 for v in size)
        cx, cy, cz = center
        x0, x1, y0, y1, z0, z1 = cx - sx, cx + sx, cy - sy, cy + sy, cz - sz, cz + sz
        faces = [
            ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1)),
            ([(x1, y0, z1), (x0, y0, z1), (x0, y1, z1), (x1, y1, z1)], (0, 0, 1)),
            ([(x0, y0, z1), (x0, y0, z0), (x0, y1, z0), (x0, y1, z1)], (-1, 0, 0)),
            ([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], (1, 0, 0)),
            ([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)),
            ([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], (0, -1, 0)),
        ]
        for points, normal in faces:
            self.tri([points[0], points[1], points[2], points[0], points[2], points[3]], normal, material)

    def cylinder(self, radius: float, height: float, center: tuple[float, float, float], material: str, sides: int = 12) -> None:
        cx, cy, cz = center
        bottom, top = cy - height * 0.5, cy + height * 0.5
        for i in range(sides):
            a0, a1 = math.tau * i / sides, math.tau * (i + 1) / sides
            p0 = (cx + radius * math.cos(a0), bottom, cz + radius * math.sin(a0))
            p1 = (cx + radius * math.cos(a1), bottom, cz + radius * math.sin(a1))
            p2 = (p1[0], top, p1[2])
            p3 = (p0[0], top, p0[2])
            normal = (math.cos((a0 + a1) * 0.5), 0, math.sin((a0 + a1) * 0.5))
            self.tri([p0, p1, p2, p0, p2, p3], normal, material)
            self.tri([(cx, top, cz), p3, p2], (0, 1, 0), material)
            self.tri([(cx, bottom, cz), p1, p0], (0, -1, 0), material)

    def ring(self, major: float, tube: float, center: tuple[float, float, float], material: str, sides: int = 16, rings: int = 8) -> None:
        cx, cy, cz = center
        for i in range(sides):
            a0, a1 = math.tau * i / sides, math.tau * (i + 1) / sides
            for j in range(rings):
                b0, b1 = math.tau * j / rings, math.tau * (j + 1) / rings
                def point(a: float, b: float) -> tuple[float, float, float]:
                    return (cx + (major + tube * math.cos(b)) * math.cos(a), cy + tube * math.sin(b), cz + (major + tube * math.cos(b)) * math.sin(a))
                p00, p10, p11, p01 = point(a0, b0), point(a1, b0), point(a1, b1), point(a0, b1)
                def normal(p: tuple[float, float, float]) -> tuple[float, float, float]:
                    return ((p[0] - cx) / (major + tube), (p[1] - cy) / tube, (p[2] - cz) / (major + tube))
                self.tri([p00, p10, p11, p00, p11, p01], normal(p00), material)

    def sphere(self, radius: float, center: tuple[float, float, float], material: str, segments: int = 10, rows: int = 6) -> None:
        cx, cy, cz = center
        for i in range(segments):
            a0, a1 = math.tau * i / segments, math.tau * (i + 1) / segments
            for j in range(rows):
                b0 = -math.pi * 0.5 + math.pi * j / rows
                b1 = -math.pi * 0.5 + math.pi * (j + 1) / rows
                def point(a: float, b: float) -> tuple[float, float, float]:
                    return (cx + radius * math.cos(b) * math.cos(a), cy + radius * math.sin(b), cz + radius * math.cos(b) * math.sin(a))
                p00, p10, p11, p01 = point(a0, b0), point(a1, b0), point(a1, b1), point(a0, b1)
                self.tri([p00, p10, p11, p00, p11, p01], ((p00[0] - cx) / radius, (p00[1] - cy) / radius, (p00[2] - cz) / radius), material)


def asset_mesh(asset_id: str) -> tuple[Mesh, tuple[float, float, float]]:
    m = Mesh()
    if asset_id.endswith("trash_bin"):
        m.cylinder(.30, .82, (0, .46, 0), "paint_green"); m.cylinder(.34, .12, (0, .92, 0), "metal"); dims = (.68, 1.0, .68)
    elif asset_id.endswith("mailbox"):
        m.box((.55, .42, .34), (0, 1.05, 0), "paint_blue"); m.cylinder(.275, .55, (0, 1.26, 0), "paint_blue", 12); m.box((.08, .07, .03), (0, 1.05, -.29), "metal"); dims = (.65, 1.55, .55)
    elif asset_id.endswith("street_lamp_b"):
        m.cylinder(.24, .16, (0, .08, 0), "concrete"); m.cylinder(.07, 5.4, (0, 2.8, 0), "metal"); m.box((1.05, .08, .08), (.48, 5.45, 0), "metal"); m.box((.42, .20, .16), (1.0, 5.36, 0), "paint_yellow"); dims = (1.3, 5.55, .35)
    elif asset_id.endswith("traffic_cone"):
        m.box((.44, .06, .44), (0, .03, 0), "rubber"); m.cylinder(.18, .58, (0, .35, 0), "paint_orange"); m.cylinder(.12, .11, (0, .39, 0), "concrete"); dims = (.46, .68, .46)
    elif asset_id.endswith("road_barrier"):
        m.box((2.1, .18, .35), (0, .72, 0), "paint_yellow"); m.box((.13, .72, .13), (-.82, .36, 0), "metal"); m.box((.13, .72, .13), (.82, .36, 0), "metal"); dims = (2.2, 1.1, .5)
    elif asset_id.endswith("bus_stop_sign"):
        m.cylinder(.18, .12, (0, .06, 0), "concrete"); m.cylinder(.045, 2.3, (0, 1.2, 0), "metal"); m.box((.58, .75, .10), (0, 2.25, 0), "paint_blue"); m.box((.3, .18, .02), (0, 2.25, -.06), "paint_yellow"); dims = (.65, 2.7, .25)
    elif asset_id.endswith("bench"):
        m.box((1.75, .12, .52), (0, .52, 0), "wood"); m.box((1.75, .12, .58), (0, .93, .18), "wood");
        for x in (-.65, .65): m.box((.12, .5, .12), (x, .25, 0), "metal")
        dims = (1.95, 1.2, .72)
    elif asset_id.endswith("vending_machine"):
        m.box((.98, 1.75, .72), (0, .94, 0), "paint_blue"); m.box((.68, 1.1, .03), (-.08, 1.17, -.38), "glass"); m.box((.16, .46, .04), (.34, 1.28, -.40), "dark"); dims = (1.05, 1.9, .8)
    elif asset_id.endswith("bicycle"):
        m.ring(.36, .045, (-.38, .38, 0), "metal"); m.ring(.36, .045, (.38, .38, 0), "metal"); m.box((.75, .06, .06), (0, .48, 0), "metal"); m.box((.06, .65, .06), (0, .62, 0), "metal"); m.box((.42, .05, .05), (.25, .88, 0), "metal"); m.box((.42, .04, .04), (-.25, .78, 0), "rubber"); dims = (1.0, 1.15, .18)
    elif asset_id.endswith("flower_pot_set"):
        for x, z, c in [(-.45, 0, "clay"), (0, .12, "paint_blue"), (.45, 0, "clay")]:
            m.cylinder(.22, .25, (x, .13, z), c); m.sphere(.28, (x, .48, z), "leaf", 8, 5)
        dims = (1.35, .8, .6)
    elif asset_id.endswith("laundry_rack"):
        for x in (-.8, .8): m.box((.07, 1.45, .07), (x, .75, 0), "metal")
        m.box((1.7, .07, .07), (0, 1.42, 0), "metal"); m.box((1.3, .05, .55), (0, 1.08, 0), "paint_blue"); dims = (1.9, 1.55, .65)
    elif asset_id.endswith("patio_table_set"):
        m.cylinder(.42, .08, (0, .75, 0), "wood"); m.cylinder(.06, .75, (0, .38, 0), "metal")
        for x in (-.75, .75): m.box((.42, .58, .42), (x, .30, 0), "wood")
        dims = (1.9, 1.2, 1.05)
    elif asset_id.endswith("wood_fence_segment"):
        for x in (-1.4, 0, 1.4): m.box((.14, 1.55, .14), (x, .78, 0), "wood")
        for y in (.45, 1.18): m.box((2.95, .09, .08), (0, y, 0), "wood")
        dims = (3.1, 1.65, .18)
    elif asset_id.endswith("package_box_set"):
        m.box((.55, .48, .5), (-.3, .25, 0), "cardboard"); m.box((.42, .36, .4), (.32, .20, .04), "cardboard"); dims = (1.05, .55, .65)
    elif asset_id.endswith("garbage_bag_pile"):
        for x, z, r in [(-.32, 0, .28), (.28, .02, .25), (0, .3, .22)]: m.sphere(r, (x, r, z), "dark", 10, 6)
        dims = (1.05, .72, .85)
    elif asset_id.endswith("fallen_bicycle"):
        m.ring(.36, .045, (-.38, .07, 0), "metal"); m.ring(.36, .045, (.38, .07, 0), "metal"); m.box((.75, .06, .06), (0, .13, 0), "metal"); m.box((.06, .18, .06), (0, .2, 0), "metal"); dims = (1.0, .22, .18)
    elif asset_id.endswith("broken_sign"):
        m.cylinder(.10, .10, (0, .05, 0), "concrete"); m.cylinder(.035, 1.15, (0, .62, 0), "metal"); m.box((.85, .52, .08), (0, 1.25, 0), "paint_red"); m.box((.55, .04, .02), (0, 1.25, -.05), "paint_yellow"); dims = (1.0, 1.6, .2)
    elif asset_id.endswith("tire_stack"):
        for y in (.22, .58, .94): m.ring(.34, .12, (0, y, 0), "rubber"); dims = (.95, 1.3, .95)
    else:
        raise KeyError(asset_id)
    return m, dims


def write_glb(path: Path, mesh: Mesh) -> dict:
    materials = sorted({r[2] for r in mesh.ranges})
    blobs = bytearray()
    def append(data: bytes) -> tuple[int, int]:
        while len(blobs) % 4: blobs.append(0)
        start = len(blobs); blobs.extend(data); return start, len(data)
    pos_off, pos_len = append(struct.pack("<%sf" % (len(mesh.positions) * 3), *(v for p in mesh.positions for v in p)))
    norm_off, norm_len = append(struct.pack("<%sf" % (len(mesh.normals) * 3), *(v for n in mesh.normals for v in n)))
    idx_off, idx_len = append(struct.pack("<%sI" % len(mesh.indices), *mesh.indices))
    views = [{"buffer": 0, "byteOffset": pos_off, "byteLength": pos_len, "target": 34962}, {"buffer": 0, "byteOffset": norm_off, "byteLength": norm_len, "target": 34962}, {"buffer": 0, "byteOffset": idx_off, "byteLength": idx_len, "target": 34963}]
    pmin = [min(p[i] for p in mesh.positions) for i in range(3)]; pmax = [max(p[i] for p in mesh.positions) for i in range(3)]
    accessors = [{"bufferView": 0, "componentType": 5126, "count": len(mesh.positions), "type": "VEC3", "min": pmin, "max": pmax}, {"bufferView": 1, "componentType": 5126, "count": len(mesh.normals), "type": "VEC3"}, {"bufferView": 2, "componentType": 5125, "count": len(mesh.indices), "type": "SCALAR", "min": [0], "max": [len(mesh.positions) - 1]}]
    primitives = []
    for start, count, material in mesh.ranges:
        primitives.append({"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": materials.index(material), "extras": {"index_start": start, "index_count": count}})
    # A single index accessor cannot express primitive ranges without byte offsets;
    # duplicate the range metadata into separate meshes below and keep each mesh's
    # indices local.  This also makes Godot's imported materials easy to inspect.
    meshes = []
    nodes = []
    for primitive_index, (start, count, material) in enumerate(mesh.ranges):
        local_indices = mesh.indices[start:start + count]
        local_blob = struct.pack("<%sI" % len(local_indices), *local_indices)
        # Reuse the shared position/normal accessors and create a byte-offset view.
        view_index = len(views); local_offset, local_length = append(local_blob); views.append({"buffer": 0, "byteOffset": local_offset, "byteLength": local_length, "target": 34963})
        accessor_index = len(accessors); accessors.append({"bufferView": view_index, "componentType": 5125, "count": len(local_indices), "type": "SCALAR", "min": [min(local_indices)], "max": [max(local_indices)]})
        meshes.append({"name": f"Mesh_{primitive_index:02d}", "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": accessor_index, "material": materials.index(material)}]})
        nodes.append({"name": f"Part_{primitive_index:02d}", "mesh": primitive_index})
    doc = {"asset": {"version": "2.0", "generator": "BLUE HOUR Phase 3A procedural GLB writer"}, "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes, "materials": [{"name": name, "pbrMetallicRoughness": {"baseColorFactor": MATERIALS[name], "metallicFactor": 0.05, "roughnessFactor": 0.82}} for name in materials], "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(blobs)}]}
    encoded = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    while len(encoded) % 4: encoded += b" "
    while len(blobs) % 4: blobs.append(0)
    total = 12 + 8 + len(encoded) + 8 + len(blobs)
    payload = struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(encoded), b"JSON") + encoded + struct.pack("<I4s", len(blobs), b"BIN\x00") + bytes(blobs)
    path.write_bytes(payload)
    return {"triangles": sum(count for _, count, _ in mesh.ranges) // 3, "materials": materials, "dimensions": [round(pmax[i] - pmin[i], 3) for i in range(3)], "bounds_min": [round(v, 3) for v in pmin], "bounds_max": [round(v, 3) for v in pmax], "generator": "generate_street_prop_pack.py", "backend": "procedural_glb_fallback_no_blender"}


ASSETS = [
    ("PRP_STREET_001_trash_bin", "street", (500, 2000)), ("PRP_STREET_002_mailbox", "street", (500, 2000)),
    ("PRP_STREET_003_street_lamp_b", "street", (1500, 5000)), ("PRP_STREET_004_traffic_cone", "street", (300, 1500)),
    ("PRP_STREET_005_road_barrier", "street", (500, 2500)), ("PRP_STREET_006_bus_stop_sign", "street", (500, 2000)),
    ("PRP_STREET_007_bench", "street", (500, 2500)), ("PRP_STREET_008_vending_machine", "street", (1200, 5000)),
    ("PRP_HOUSE_001_bicycle", "house", (800, 5000)), ("PRP_HOUSE_002_flower_pot_set", "house", (500, 3000)),
    ("PRP_HOUSE_003_laundry_rack", "house", (500, 3500)), ("PRP_HOUSE_004_patio_table_set", "house", (800, 4500)),
    ("PRP_HOUSE_005_wood_fence_segment", "house", (500, 2500)), ("PRP_HOUSE_006_package_box_set", "house", (300, 2000)),
    ("PRP_RUIN_001_garbage_bag_pile", "ruin", (500, 2500)), ("PRP_RUIN_002_fallen_bicycle", "ruin", (800, 5000)),
    ("PRP_RUIN_003_broken_sign", "ruin", (500, 2500)), ("PRP_RUIN_004_tire_stack", "ruin", (500, 2500)),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "phase": "3A", "backend": "procedural_glb_fallback_no_blender", "assets": {}}
    for asset_id, category, budget in ASSETS:
        mesh, dims = asset_mesh(asset_id)
        path = OUT / f"{asset_id}.glb"
        stats = write_glb(path, mesh)
        stats["id"] = asset_id; stats["category"] = category; stats["budget"] = list(budget); stats["pivot"] = "ground_center"; stats["source"] = "procedural fallback; Blender unavailable"
        manifest["assets"][asset_id] = stats
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(ASSETS)} GLBs in {OUT}")


if __name__ == "__main__":
    main()
