"""Generate Phase 3C compact anime-stylized urban dressing with Blender 5.2."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy

BLENDER_DIR = Path(__file__).resolve().parent
PROJECT = BLENDER_DIR.parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from utils.export import export_asset, reset
from utils.geometry import beam, box, cylinder, sphere

OUT = PROJECT / "assets/world/props/city_props_v2"
SPECS = [
    ("planter_box_pair", "residential", (1.65, 0.58, 0.58), ["RESIDENTIAL", "GARDEN"]),
    ("neighborhood_notice_board", "residential", (1.28, 1.72, 0.28), ["RESIDENTIAL", "COMMUNITY"]),
    ("recycling_bin_pair", "residential", (1.08, 0.96, 0.65), ["RESIDENTIAL", "ROAD_EDGE"]),
    ("delivery_lockbox", "residential", (0.72, 0.82, 0.58), ["RESIDENTIAL", "COMMERCIAL"]),
    ("garden_tool_cart", "residential", (1.16, 0.86, 0.62), ["RESIDENTIAL", "GARDEN"]),
    ("storefront_menu_stand", "commercial", (0.62, 1.06, 0.48), ["COMMERCIAL", "FRONTAGE"]),
    ("beverage_crate_stack", "commercial", (1.12, 0.88, 0.74), ["COMMERCIAL", "FRONTAGE"]),
    ("delivery_handcart", "commercial", (0.86, 1.08, 0.62), ["COMMERCIAL", "INDUSTRIAL"]),
    ("sidewalk_banner_stand", "commercial", (0.92, 2.05, 0.44), ["COMMERCIAL", "FRONTAGE"]),
    ("storefront_flag_pair", "commercial", (1.12, 1.46, 0.28), ["COMMERCIAL", "FRONTAGE"]),
    ("street_bollard_set", "road", (1.12, 0.82, 0.42), ["ROAD", "ROAD_EDGE"]),
    ("utility_cabinet", "road", (0.76, 1.15, 0.62), ["ROAD", "ROAD_EDGE"]),
    ("guardrail_segment", "road", (2.42, 0.82, 0.26), ["ROAD", "ROAD_EDGE"]),
    ("bicycle_parking_rack", "road", (1.82, 0.68, 0.54), ["ROAD", "RESIDENTIAL"]),
    ("bus_stop_post", "road", (0.48, 2.35, 0.36), ["ROAD", "COMMERCIAL"]),
    ("fallen_market_sign", "aftermath", (1.42, 0.20, 0.92), ["AFTERMATH", "COMMERCIAL"]),
    ("cloth_tarp_bundle", "aftermath", (1.34, 0.46, 0.98), ["AFTERMATH", "INDUSTRIAL"]),
    ("scattered_box_debris", "aftermath", (1.46, 0.34, 1.02), ["AFTERMATH", "INDUSTRIAL"]),
    ("broken_fence_section", "aftermath", (2.12, 0.94, 0.24), ["AFTERMATH", "RESIDENTIAL"]),
    ("roadside_grass_patch", "vegetation", (1.42, 0.24, 1.12), ["VEGETATION", "ROAD_EDGE"]),
    ("small_bush_cluster", "vegetation", (1.42, 0.76, 1.04), ["VEGETATION", "RESIDENTIAL"]),
    ("neglected_planter", "vegetation", (1.12, 0.72, 0.76), ["VEGETATION", "RESIDENTIAL"]),
    ("small_vine_patch", "vegetation", (1.12, 0.94, 0.18), ["VEGETATION", "WALL_EDGE"]),
    ("umbrella_stand", "residential", (0.92, 1.42, 0.62), ["RESIDENTIAL", "COMMERCIAL"]),
]


def planter_box_pair():
    box("PlanterBody", (1.52, 0.5, 0.46), (0, 0, 0.27), "BH_Concrete_Light", 0.045)
    box("SoilTop", (1.38, 0.37, 0.035), (0, 0, 0.54), "BH_Concrete_Dark", 0.01)
    for x in (-0.48, 0, 0.48):
        sphere("LeafCrown", 0.22, (x, 0, 0.72), "BH_Muted_Green", (1.0, 0.78, 0.8))
        cylinder("Flower", 0.08, 0.045, (x + 0.04, -0.02, 0.91), "BH_Warm_Orange", 8)


def neighborhood_notice_board():
    for x in (-0.48, 0.48):
        box("Post", (0.085, 0.09, 1.25), (x, 0, 0.63), "BH_Muted_Green", 0.012)
    box("Board", (1.22, 0.14, 0.98), (0, -0.035, 1.19), "BH_Concrete_Light", 0.035)
    box("NoticeField", (1.02, 0.025, 0.74), (0, -0.117, 1.2), "BH_Plastic_Light", 0.016)
    for x, mat in ((-0.28, "BH_Warm_Orange"), (0.02, "BH_Safety_Yellow"), (0.31, "BH_Muted_Green")):
        box("PaperBlock", (0.2, 0.018, 0.42), (x, -0.138, 1.17), mat, 0.008)
    box("FootRail", (1.08, 0.18, 0.11), (0, 0, 0.12), "BH_Metal_Dark", 0.02)


def recycling_bin_pair():
    for x, color in ((-0.28, "BH_Muted_Green"), (0.28, "BH_Safety_Yellow")):
        box("BinBody", (0.43, 0.55, 0.72), (x, 0, 0.41), color, 0.055)
        box("BinLid", (0.48, 0.6, 0.12), (x, 0, 0.83), "BH_Metal_Dark", 0.03)
        box("Label", (0.22, 0.018, 0.16), (x, -0.287, 0.55), "BH_Plastic_Light", 0.008)


def delivery_lockbox():
    box("Base", (0.67, 0.56, 0.17), (0, 0, 0.09), "BH_Metal_Dark", 0.025)
    box("Cabinet", (0.62, 0.48, 0.68), (0, 0, 0.48), "BH_Muted_Green", 0.045)
    box("Door", (0.5, 0.025, 0.48), (0, -0.25, 0.48), "BH_Plastic_Light", 0.025)
    box("Slot", (0.24, 0.025, 0.06), (0, -0.27, 0.63), "BH_Metal_Dark", 0.008)
    cylinder("Dial", 0.055, 0.035, (0.18, -0.28, 0.3), "BH_Safety_Yellow", 10, (1.5708, 0, 0))


def garden_tool_cart():
    box("CartTray", (0.86, 0.56, 0.17), (0, 0.02, 0.5), "BH_Muted_Green", 0.025)
    for x in (-0.36, 0.36):
        cylinder("Wheel", 0.17, 0.1, (x, 0, 0.19), "BH_Metal_Dark", 10, (1.5708, 0, 0))
        beam("Handle", (x * 0.8, 0.03, 0.52), (x * 0.8, 0.42, 0.86), 0.035, "BH_Metal_Mid")
    for x, mat in ((-0.2, "BH_Warm_Orange"), (0.08, "BH_Safety_Yellow"), (0.31, "BH_Metal_Dark")):
        box("ToolGrip", (0.12, 0.14, 0.11), (x, 0.1, 0.67), mat, 0.018)


def storefront_menu_stand():
    box("MenuPanel", (0.54, 0.12, 0.66), (0, 0, 0.7), "BH_Muted_Green", 0.025, rotation=(0, 0, -0.12))
    box("MenuFace", (0.43, 0.025, 0.48), (0, -0.074, 0.72), "BH_Plastic_Light", 0.012, rotation=(0, 0, -0.12))
    for z in (0.55, 0.68, 0.81):
        box("MenuStripe", (0.26, 0.012, 0.025), (0.02, -0.092, z), "BH_Warm_Orange", 0.004)
    for x in (-0.18, 0.18):
        beam("Leg", (x, 0, 0.38), (x * 1.3, 0, 0.04), 0.035, "BH_Metal_Dark")
    box("Foot", (0.58, 0.32, 0.08), (0, 0, 0.05), "BH_Metal_Dark", 0.02)


def beverage_crate_stack():
    for x, y, z, mat in ((-0.27, 0, 0.24, "BH_Emergency_Red"), (0.27, 0, 0.24, "BH_Muted_Green"), (0, 0.03, 0.68, "BH_Safety_Yellow")):
        box("Crate", (0.5, 0.48, 0.4), (x, y, z), mat, 0.035)
        for slat in range(3):
            box("CrateSlat", (0.38, 0.02, 0.035), (x, -0.247, z - 0.1 + slat * 0.1), "BH_Plastic_Light", 0.008)


def delivery_handcart():
    box("LoadBed", (0.62, 0.78, 0.11), (0, 0.1, 0.42), "BH_Muted_Green", 0.025)
    for x in (-0.28, 0.28):
        beam("Frame", (x, 0.38, 0.36), (x, 0.44, 0.98), 0.035, "BH_Metal_Dark")
        cylinder("Wheel", 0.16, 0.09, (x, 0.06, 0.17), "BH_Metal_Dark", 10, (1.5708, 0, 0))
    box("Parcel", (0.42, 0.44, 0.38), (0, 0.06, 0.67), "BH_Plastic_Light", 0.025)
    box("Tape", (0.07, 0.46, 0.02), (0.03, 0.06, 0.87), "BH_Warm_Orange", 0.004)


def sidewalk_banner_stand():
    box("Banner", (0.82, 0.07, 1.2), (0, 0, 1.18), "BH_Warm_Orange", 0.025)
    box("BannerInset", (0.63, 0.025, 0.84), (0, -0.045, 1.2), "BH_Plastic_Light", 0.014)
    for z in (0.94, 1.14, 1.34):
        box("GraphicBand", (0.34, 0.014, 0.05), (0, -0.064, z), "BH_Muted_Green", 0.004)
    box("Foot", (0.86, 0.5, 0.12), (0, 0, 0.06), "BH_Metal_Dark", 0.024)
    beam("Stem", (0, 0, 0.12), (0, 0, 0.52), 0.035, "BH_Metal_Mid")


def storefront_flag_pair():
    for x, mat in ((-0.34, "BH_Warm_Orange"), (0.34, "BH_Muted_Green")):
        beam("Bracket", (x, 0.12, 1.25), (x, 0.12, 0.18), 0.035, "BH_Metal_Dark")
        box("Flag", (0.42, 0.07, 0.42), (x, 0.04, 0.88), mat, 0.02, rotation=(0, 0, 0.12 if x < 0 else -0.12))
        box("FlagMark", (0.12, 0.025, 0.16), (x, -0.005, 0.89), "BH_Safety_Yellow", 0.008)
    box("WallPlate", (1.0, 0.13, 0.12), (0, 0.12, 1.28), "BH_Metal_Mid", 0.015)


def street_bollard_set():
    for x in (-0.38, 0, 0.38):
        cylinder("BollardBase", 0.17, 0.1, (x, 0, 0.05), "BH_Concrete_Dark", 10)
        cylinder("Bollard", 0.105, 0.62, (x, 0, 0.4), "BH_Muted_Green", 10, top=0.085)
        box("Reflector", (0.18, 0.025, 0.1), (x, -0.094, 0.56), "BH_Safety_Yellow", 0.008)


def utility_cabinet():
    box("CabinetFoot", (0.68, 0.58, 0.12), (0, 0, 0.06), "BH_Concrete_Dark", 0.025)
    box("Cabinet", (0.62, 0.52, 0.94), (0, 0, 0.56), "BH_Muted_Green", 0.04)
    box("Door", (0.48, 0.025, 0.74), (0, -0.267, 0.57), "BH_Plastic_Light", 0.018)
    for z in (0.33, 0.42, 0.51):
        box("Vent", (0.22, 0.014, 0.025), (0, -0.286, z), "BH_Metal_Dark", 0.004)
    box("WarningTab", (0.12, 0.018, 0.12), (0.15, -0.284, 0.82), "BH_Safety_Yellow", 0.006)


def guardrail_segment():
    for x in (-1.05, 1.05):
        box("SupportFoot", (0.22, 0.22, 0.12), (x, 0, 0.06), "BH_Concrete_Dark", 0.022)
        box("SupportPost", (0.1, 0.12, 0.64), (x, 0, 0.42), "BH_Metal_Mid", 0.015)
    box("Rail", (2.35, 0.17, 0.16), (0, 0, 0.72), "BH_Safety_Yellow", 0.035)
    box("RailInset", (1.88, 0.02, 0.06), (0, -0.094, 0.72), "BH_Metal_Dark", 0.008)


def bicycle_parking_rack():
    for x in (-0.62, 0.62):
        box("FootPlate", (0.24, 0.3, 0.08), (x, 0, 0.04), "BH_Metal_Dark", 0.014)
    for x in (-0.48, 0, 0.48):
        beam("LoopLeft", (x - 0.16, 0, 0.08), (x - 0.16, 0, 0.58), 0.035, "BH_Metal_Mid")
        beam("LoopCrown", (x - 0.16, 0, 0.58), (x + 0.16, 0, 0.58), 0.035, "BH_Metal_Mid")
        beam("LoopRight", (x + 0.16, 0, 0.58), (x + 0.16, 0, 0.08), 0.035, "BH_Metal_Mid")


def bus_stop_post():
    box("Base", (0.32, 0.3, 0.12), (0, 0, 0.06), "BH_Concrete_Dark", 0.02)
    box("Post", (0.1, 0.1, 1.9), (0, 0, 1.08), "BH_Metal_Mid", 0.018)
    box("Sign", (0.44, 0.12, 0.46), (0, 0, 1.85), "BH_Muted_Green", 0.025)
    box("RouteMark", (0.2, 0.025, 0.18), (0, -0.074, 1.87), "BH_Plastic_Light", 0.01)
    box("Band", (0.34, 0.025, 0.06), (0, -0.09, 1.68), "BH_Safety_Yellow", 0.006)


def fallen_market_sign():
    box("SignBoard", (1.24, 0.14, 0.8), (0, 0, 0.42), "BH_Muted_Green", 0.03, rotation=(0.08, 0, 0.1))
    box("ColorPanel", (0.92, 0.025, 0.48), (0, -0.078, 0.45), "BH_Plastic_Light", 0.01, rotation=(0.08, 0, 0.1))
    box("Header", (0.82, 0.03, 0.12), (0, -0.1, 0.59), "BH_Warm_Orange", 0.006, rotation=(0.08, 0, 0.1))
    beam("BentLeg", (-0.42, 0.12, 0.2), (-0.54, 0.48, 0.04), 0.045, "BH_Metal_Dark")
    beam("Leg", (0.4, 0.18, 0.2), (0.52, 0.48, 0.04), 0.045, "BH_Metal_Dark")


def cloth_tarp_bundle():
    box("FoldBase", (1.18, 0.86, 0.24), (0, 0, 0.16), "BH_Muted_Green", 0.075)
    for x, z, mat in ((-0.3, 0.37, "BH_Plastic_Light"), (0.02, 0.42, "BH_Muted_Green"), (0.28, 0.35, "BH_Warm_Orange")):
        box("Fold", (0.48, 0.72, 0.18), (x, 0, z), mat, 0.07, rotation=(0.04, 0, 0.08 * (1 if x >= 0 else -1)))
    for x in (-0.44, 0.44):
        box("Tie", (0.08, 0.92, 0.06), (x, 0, 0.42), "BH_Safety_Yellow", 0.014)


def scattered_box_debris():
    pieces = [(-0.42, -0.08, 0.16, 0.46), (0.0, 0.12, 0.13, 0.32), (0.42, -0.08, 0.18, 0.5)]
    for index, (x, y, size, height) in enumerate(pieces):
        box("FlatCarton", (size, 0.46, 0.08), (x, y, 0.04), "BH_Plastic_Light", 0.018, rotation=(0, 0, -0.08 + index * 0.08))
        box("OpenFlap", (size * 0.82, 0.36, 0.035), (x, y, height * 0.18), "BH_Warm_Orange", 0.01, rotation=(0.02, 0, 0.12 - index * 0.08))
    box("SmallBox", (0.38, 0.34, 0.28), (0.18, 0.18, 0.14), "BH_Concrete_Light", 0.025, rotation=(0, 0, -0.12))


def broken_fence_section():
    for x, z in ((-0.82, 0.51), (0.82, 0.42)):
        box("FencePost", (0.16, 0.17, z * 2), (x, 0, z), "BH_Muted_Green", 0.018, rotation=(0, 0, 0.05 if x < 0 else -0.06))
    for z in (0.34, 0.66):
        box("Rail", (1.95, 0.12, 0.09), (0, 0, z), "BH_Concrete_Light", 0.016, rotation=(0, 0, -0.04))
    for x in (-0.45, -0.12, 0.3, 0.56):
        box("Picket", (0.09, 0.1, 0.55), (x, 0, 0.5), "BH_Muted_Green", 0.012, rotation=(0, 0, 0.03 if x < 0 else -0.03))


def roadside_grass_patch():
    box("SoilFootprint", (1.34, 0.94, 0.06), (0, 0, 0.03), "BH_Concrete_Dark", 0.045)
    for x, y, height in ((-0.48, -0.22, 0.2), (-0.24, 0.17, 0.32), (0.02, -0.1, 0.24), (0.32, 0.2, 0.36), (0.5, -0.2, 0.22)):
        beam("GrassBlade", (x, y, 0.04), (x + 0.06, y + 0.015, height), 0.035, "BH_Muted_Green")


def small_bush_cluster():
    box("Soil", (1.24, 0.84, 0.08), (0, 0, 0.04), "BH_Concrete_Dark", 0.04)
    for x, y, radius in ((-0.37, 0, 0.37), (0, -0.02, 0.48), (0.38, 0.03, 0.35)):
        sphere("BushMass", radius, (x, y, 0.35 + radius * 0.45), "BH_Muted_Green", (1.05, 0.9, 0.78))
    sphere("LeafAccent", 0.17, (0.03, -0.38, 0.48), "BH_Safety_Yellow", (1, 0.75, 0.65))


def neglected_planter():
    box("CrackedPot", (0.98, 0.68, 0.52), (0, 0, 0.27), "BH_Concrete_Light", 0.08, rotation=(0, 0, 0.04))
    box("Soil", (0.78, 0.48, 0.045), (0, 0, 0.55), "BH_Concrete_Dark", 0.018)
    for x, height in ((-0.28, 0.58), (-0.08, 0.76), (0.2, 0.62), (0.33, 0.88)):
        beam("WiltStem", (x, 0, 0.57), (x + 0.08, 0, height), 0.025, "BH_Muted_Green")
        sphere("WiltLeaf", 0.12, (x + 0.11, -0.015, height - 0.05), "BH_Muted_Green", (1.2, 0.65, 0.45))


def small_vine_patch():
    box("MountPlate", (0.84, 0.08, 0.9), (0, 0.04, 0.48), "BH_Concrete_Light", 0.025)
    for x, z in ((-0.3, 0.13), (-0.12, 0.31), (0.08, 0.48), (0.29, 0.7), (0.03, 0.84)):
        beam("VineStem", (x, -0.015, z), (x + 0.18, -0.02, z + 0.11), 0.025, "BH_Muted_Green")
        sphere("Leaf", 0.095, (x + 0.18, -0.035, z + 0.12), "BH_Muted_Green", (1.3, 0.72, 0.48))


def umbrella_stand():
    cylinder("StandBase", 0.31, 0.1, (0, 0, 0.05), "BH_Concrete_Dark", 12)
    cylinder("StandBody", 0.22, 0.84, (0, 0, 0.5), "BH_Muted_Green", 10, top=0.19)
    box("Rim", (0.48, 0.48, 0.1), (0, 0, 0.9), "BH_Metal_Mid", 0.035)
    for x, mat in ((-0.14, "BH_Warm_Orange"), (0.0, "BH_Muted_Green"), (0.14, "BH_Safety_Yellow")):
        beam("UmbrellaHandle", (x, 0, 0.95), (x, 0, 1.36), 0.025, mat)
        sphere("UmbrellaCap", 0.11, (x, 0, 1.4), mat, (1.0, 0.7, 0.55))


BUILDERS = {
    "planter_box_pair": planter_box_pair,
    "neighborhood_notice_board": neighborhood_notice_board,
    "recycling_bin_pair": recycling_bin_pair,
    "delivery_lockbox": delivery_lockbox,
    "garden_tool_cart": garden_tool_cart,
    "storefront_menu_stand": storefront_menu_stand,
    "beverage_crate_stack": beverage_crate_stack,
    "delivery_handcart": delivery_handcart,
    "sidewalk_banner_stand": sidewalk_banner_stand,
    "storefront_flag_pair": storefront_flag_pair,
    "street_bollard_set": street_bollard_set,
    "utility_cabinet": utility_cabinet,
    "guardrail_segment": guardrail_segment,
    "bicycle_parking_rack": bicycle_parking_rack,
    "bus_stop_post": bus_stop_post,
    "fallen_market_sign": fallen_market_sign,
    "cloth_tarp_bundle": cloth_tarp_bundle,
    "scattered_box_debris": scattered_box_debris,
    "broken_fence_section": broken_fence_section,
    "roadside_grass_patch": roadside_grass_patch,
    "small_bush_cluster": small_bush_cluster,
    "neglected_planter": neglected_planter,
    "small_vine_patch": small_vine_patch,
    "umbrella_stand": umbrella_stand,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "phase": "3C", "generator": "Blender 5.2 Python", "style": "Anime Stylized / BLUE HOUR ART BIBLE V1", "assets": []}
    for index, (name, category, size, tags) in enumerate(SPECS, start=11):
        asset_id = f"PRP_CITY_{index:03d}_{name}"
        reset()
        BUILDERS[name]()
        result = export_asset({
            "id": asset_id,
            "category": category,
            "budget": 1500,
            "path": (Path("assets/world/props/city_props_v2") / f"{asset_id}.glb").as_posix(),
            "expected_size": size,
        }, name)
        manifest["assets"].append({
            "asset_name": asset_id,
            "file_path": result["path"],
            "source_path": result["blend"],
            "tris": result["triangles"],
            "size": result["dimensions"],
            "category": category,
            "tags": tags,
            "materials": result["materials"],
            "new_model": True,
            "placement_integrated": True,
            "collision": False,
        })
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PHASE_3C_CITY_PROPS: {len(manifest['assets'])} Blender assets exported")


if __name__ == "__main__":
    main()
