"""Generate the Phase 3B stylized city prop pack with Blender 5.2."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy

BLENDER_DIR = Path(__file__).resolve().parent
PROJECT = BLENDER_DIR.parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from utils.export import export_asset, reset
from utils.geometry import beam, box, cylinder, panel, prism, sphere

OUT = PROJECT / "assets/world/props/city_props_v1"
ASSETS = [
    ("PRP_CITY_001_shop_sign", "commercial", 3000, (2.15, 0.42, 0.82), "shop_sign"),
    ("PRP_CITY_002_ac_unit", "residential", 2500, (1.12, 0.55, 0.78), "ac_unit"),
    ("PRP_CITY_003_power_pole", "road", 5000, (0.72, 0.52, 6.2), "power_pole"),
    ("PRP_CITY_004_power_wire_set", "road", 3000, (9.0, 0.18, 0.65), "power_wire_set"),
    ("PRP_CITY_005_traffic_light", "road", 5000, (1.25, 0.6, 4.15), "traffic_light"),
    ("PRP_CITY_006_bus_shelter", "commercial", 8000, (4.8, 1.85, 2.75), "bus_shelter"),
    ("PRP_CITY_007_awning", "commercial", 3000, (3.15, 1.25, 0.72), "awning"),
    ("PRP_CITY_008_cardboard_stack", "industrial", 1500, (1.45, 0.98, 1.12), "cardboard_stack"),
    ("PRP_CITY_009_fire_hydrant", "road", 1500, (0.62, 0.62, 0.92), "fire_hydrant"),
    ("PRP_CITY_010_broken_billboard", "industrial", 4000, (3.65, 0.52, 3.45), "broken_billboard"),
]


def shop_sign() -> None:
    box("SignBody", (2.0, 0.15, 0.68), (0, 0, 0.64), "BH_Muted_Green", 0.035)
    box("SignFace", (1.78, 0.025, 0.49), (0, -0.09, 0.65), "BH_Plastic_Light", 0.02)
    box("SignHeader", (1.76, 0.035, 0.12), (0, -0.113, 0.82), "BH_Warm_Orange", 0.01)
    for x in (-0.69, -0.42, -0.15):
        box("GraphicTile", (0.13, 0.018, 0.22), (x, -0.114, 0.61), "BH_Safety_Yellow", 0.008)
    cylinder("SignIcon", 0.13, 0.035, (0.55, -0.13, 0.65), "BH_Emergency_Red", 16, (math.pi / 2, 0, 0))
    for x in (-0.68, 0.68):
        beam("WallBracket", (x, 0.02, 0.26), (x, 0.22, 0.02), 0.035, "BH_Metal_Dark")
        box("BracketPlate", (0.12, 0.05, 0.24), (x, 0.18, 0.25), "BH_Metal_Mid", 0.012)


def ac_unit() -> None:
    box("MountRail", (1.02, 0.1, 0.1), (0, 0.1, 0.09), "BH_Metal_Dark", 0.014)
    for x in (-0.36, 0.36):
        box("WallBracket", (0.1, 0.38, 0.08), (x, 0.03, 0.18), "BH_Metal_Mid", 0.012)
    box("OutdoorCase", (0.98, 0.48, 0.56), (0, -0.02, 0.48), "BH_Plastic_Light", 0.035)
    box("VentInset", (0.69, 0.025, 0.36), (0, -0.273, 0.47), "BH_Metal_Dark", 0.014)
    for index in range(7):
        x = -0.27 + index * 0.09
        box("VentSlat", (0.028, 0.02, 0.29), (x, -0.295, 0.47), "BH_Metal_Mid", 0.008)
    cylinder("FanHub", 0.055, 0.045, (0, -0.3, 0.48), "BH_Plastic_Light", 12, (math.pi / 2, 0, 0))
    box("StatusTab", (0.11, 0.022, 0.055), (0.34, -0.276, 0.73), "BH_Safety_Yellow", 0.006)
    beam("RefrigerantPipe", (0.42, 0.05, 0.2), (0.56, 0.14, 0.02), 0.027, "BH_Metal_Mid")


def power_pole() -> None:
    cylinder("ConcreteFoot", 0.2, 0.28, (0, 0, 0.14), "BH_Concrete_Dark", 12, top=0.16)
    cylinder("Pole", 0.12, 5.85, (0, 0, 3.18), "BH_Muted_Green", 10, top=0.075)
    box("Crossarm", (0.72, 0.13, 0.12), (0, 0, 5.67), "BH_Concrete_Light", 0.018)
    for x in (-0.28, 0, 0.28):
        cylinder("Insulator", 0.07, 0.2, (x, 0, 5.82), "BH_Plastic_Light", 8, top=0.055)
        cylinder("Cap", 0.09, 0.055, (x, 0, 5.94), "BH_Metal_Mid", 8)
    box("ServiceBand", (0.26, 0.25, 0.09), (0, 0, 4.0), "BH_Safety_Yellow", 0.008)


def power_wire_set() -> None:
    curve_data = bpy.data.curves.new("BH_OverheadWireCurves", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 12
    curve_data.bevel_depth = 0.018
    curve_data.bevel_resolution = 2
    curve_data.materials.append(__import__("utils.materials", fromlist=["material"]).material("BH_Metal_Dark"))
    for lane_y in (-0.055, 0.055):
        spline = curve_data.splines.new("BEZIER")
        spline.bezier_points.add(2)
        for point, coordinate in zip(spline.bezier_points,
                                     [(-4.5, lane_y, 0.32), (0, lane_y, -0.28), (4.5, lane_y, 0.32)]):
            point.co = coordinate
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"
    source_curve = bpy.data.objects.new("BH_OverheadWireCurves_Source", curve_data)
    bpy.context.collection.objects.link(source_curve)
    source_curve.hide_set(True)
    curve = source_curve.copy()
    curve.data = source_curve.data.copy()
    curve.name = "BH_OverheadWireCurves_Export"
    bpy.context.collection.objects.link(curve)
    # Keep the editable curve in the .blend and convert a duplicate for glTF.
    bpy.ops.object.select_all(action="DESELECT")
    curve.select_set(True)
    bpy.context.view_layer.objects.active = curve
    bpy.ops.object.convert(target="MESH")
    curve = bpy.context.object
    curve["bh_group"] = "RenderMesh"
    curve.data.name = curve.name


def traffic_light() -> None:
    cylinder("Base", 0.21, 0.18, (0, 0, 0.09), "BH_Concrete_Dark", 12)
    cylinder("Post", 0.07, 3.72, (0, 0, 2.02), "BH_Metal_Mid", 10, top=0.055)
    beam("SignalArm", (0, 0, 3.62), (0, -0.35, 3.86), 0.05, "BH_Metal_Dark")
    box("SignalHousing", (0.38, 0.34, 1.0), (0, -0.36, 3.24), "BH_Metal_Dark", 0.045)
    for z, color in ((3.56, "BH_Emergency_Red"), (3.25, "BH_Safety_Yellow"), (2.94, "BH_Muted_Green")):
        cylinder("SignalLens", 0.105, 0.055, (0, -0.55, z), color, 16, (math.pi / 2, 0, 0))
    box("SideVisor", (0.46, 0.11, 0.09), (0, -0.37, 3.82), "BH_Metal_Mid", 0.015)


def bus_shelter() -> None:
    for x in (-2.18, 2.18):
        for y in (-0.68, 0.68):
            box("ShelterPost", (0.12, 0.12, 2.55), (x, y, 1.28), "BH_Metal_Mid", 0.016)
    box("Roof", (4.8, 1.82, 0.16), (0, 0, 2.63), "BH_Muted_Green", 0.035)
    box("RoofEdge", (4.85, 0.09, 0.11), (0, -0.86, 2.54), "BH_Warm_Orange", 0.012)
    for x in (-1.36, 0, 1.36):
        box("GlassPanel", (1.12, 0.045, 1.8), (x, 0.68, 1.48), "BH_Glass", 0.008)
        box("GlassLowerRail", (1.14, 0.07, 0.09), (x, 0.64, 0.58), "BH_Metal_Dark", 0.01)
    for x in (-1.32, 1.32):
        box("SeatSupport", (0.1, 0.12, 0.42), (x, -0.12, 0.38), "BH_Metal_Dark", 0.015)
    box("Bench", (2.85, 0.48, 0.14), (0, -0.12, 0.62), "BH_Plastic_Light", 0.025)
    for x in (-1.75, 1.75):
        box("RoutePanel", (0.36, 0.055, 0.72), (x, -0.75, 1.58), "BH_Glass", 0.018)
        box("RouteStripe", (0.2, 0.02, 0.055), (x, -0.786, 1.68), "BH_Safety_Yellow", 0.006)


def awning() -> None:
    box("MountBar", (3.0, 0.13, 0.13), (0, 0.08, 0.02), "BH_Metal_Dark", 0.012)
    box("Canopy", (3.1, 1.18, 0.12), (0, -0.53, 0.51), "BH_Warm_Orange", 0.028)
    box("CanopyInset", (2.92, 0.72, 0.025), (0, -0.56, 0.585), "BH_Plastic_Light", 0.008)
    for index in range(5):
        x = -1.16 + index * 0.58
        box("CanopyStripe", (0.27, 0.73, 0.018), (x, -0.56, 0.604), "BH_Muted_Green", 0.005)
    for x in (-1.42, -0.71, 0, 0.71, 1.42):
        panel("Valance", [(x - 0.28, -1.1, 0.47), (x + 0.28, -1.1, 0.47),
                           (x + 0.27, -1.1, 0.3), (x - 0.27, -1.1, 0.3)], "BH_Plastic_Light", 0.025)
    for x in (-1.38, 1.38):
        beam("Support", (x, 0.04, 0.02), (x, -1.05, 0.4), 0.035, "BH_Metal_Mid")


def cardboard_stack() -> None:
    boxes = [
        ((0.68, 0.63, 0.62), (-0.34, 0.04, 0.31), "BH_Plastic_Light"),
        ((0.58, 0.55, 0.48), (0.31, 0.08, 0.24), "BH_Concrete_Light"),
        ((0.61, 0.55, 0.5), (-0.07, 0.02, 0.87), "BH_Plastic_Light"),
    ]
    for size, pos, material_name in boxes:
        box("Carton", size, pos, material_name, 0.028, rotation=(0, 0, math.radians(-4 if pos[0] < 0 else 3)))
        box("Tape", (size[0] * 0.12, size[1] + 0.015, 0.015), (pos[0], pos[1], pos[2] + size[2] / 2 + 0.01), "BH_Safety_Yellow", 0.003)
    for x, z in ((-0.34, 0.35), (0.31, 0.27), (-0.07, 0.9)):
        box("ShippingMark", (0.21, 0.018, 0.1), (x + 0.13, -0.29, z), "BH_Warm_Orange", 0.006)


def fire_hydrant() -> None:
    cylinder("Foot", 0.27, 0.11, (0, 0, 0.055), "BH_Metal_Dark", 12)
    cylinder("Barrel", 0.19, 0.55, (0, 0, 0.39), "BH_Emergency_Red", 12, top=0.22)
    cylinder("Shoulder", 0.24, 0.14, (0, 0, 0.72), "BH_Emergency_Red", 12, top=0.17)
    cylinder("Bonnet", 0.16, 0.16, (0, 0, 0.87), "BH_Emergency_Red", 12, top=0.1)
    cylinder("Cap", 0.12, 0.09, (0, 0, 0.98), "BH_Metal_Mid", 12)
    for side in (-1, 1):
        beam("OutletNeck", (0, 0, 0.56), (side * 0.24, 0, 0.56), 0.085, "BH_Emergency_Red")
        cylinder("OutletCap", 0.12, 0.1, (side * 0.25, 0, 0.56), "BH_Plastic_Light", 12, (0, math.pi / 2, 0))
    box("IdentifierBand", (0.3, 0.31, 0.055), (0, 0, 0.37), "BH_Safety_Yellow", 0.006)


def broken_billboard() -> None:
    for x in (-1.35, 1.35):
        box("ConcreteFoot", (0.48, 0.42, 0.18), (x, 0, 0.09), "BH_Concrete_Dark", 0.018)
        cylinder("Support", 0.09, 2.6, (x, 0, 1.43), "BH_Metal_Mid", 10)
    box("BoardBacking", (3.4, 0.2, 1.85), (0, 0, 2.55), "BH_Muted_Green", 0.025)
    box("ColorField", (3.18, 0.025, 1.58), (0, -0.115, 2.55), "BH_Plastic_Light", 0.008)
    box("PosterBand", (3.12, 0.03, 0.29), (0, -0.137, 3.13), "BH_Warm_Orange", 0.006)
    for x in (-1.15, -0.72, -0.29):
        box("PosterMark", (0.22, 0.022, 0.52), (x, -0.139, 2.65), "BH_Safety_Yellow", 0.006)
    # One clean missing corner communicates light damage without a ruin silhouette.
    prism("TornCorner", [(0.78, 3.34), (1.7, 3.34), (1.7, 2.75)], 0.04, "BH_Concrete_Dark", 0)
    box("RearBrace", (0.12, 0.28, 1.8), (0, 0.12, 2.55), "BH_Metal_Dark", 0.012)


BUILDERS = {
    "shop_sign": shop_sign,
    "ac_unit": ac_unit,
    "power_pole": power_pole,
    "power_wire_set": power_wire_set,
    "traffic_light": traffic_light,
    "bus_shelter": bus_shelter,
    "awning": awning,
    "cardboard_stack": cardboard_stack,
    "fire_hydrant": fire_hydrant,
    "broken_billboard": broken_billboard,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "phase": "3B", "generator": "Blender 5.2 Python", "assets": []}
    for asset_id, category, budget, dimensions, builder_name in ASSETS:
        reset()
        BUILDERS[builder_name]()
        result = export_asset({
            "id": asset_id,
            "category": category,
            "budget": budget,
            "path": (Path("assets/world/props/city_props_v1") / f"{asset_id}.glb").as_posix(),
            "expected_size": dimensions,
        }, builder_name)
        manifest["assets"].append({
            "asset_name": asset_id,
            "file_path": result["path"],
            "source_path": result["blend"],
            "tris": result["triangles"],
            "size": result["dimensions"],
            "category": category,
            "materials": result["materials"],
        })
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PHASE_3B_CITY_PROPS: {len(manifest['assets'])} Blender assets exported")


if __name__ == "__main__":
    main()
