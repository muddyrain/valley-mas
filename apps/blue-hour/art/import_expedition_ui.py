"""Crop supplied UI artwork; no painting, synthesis or icon replacement."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "art/ui/expedition"
RUNTIME = PROJECT / "assets/ui/expedition/hud"
# Source regions include edge antialiasing, but omit the almost-transparent export canvas.
# Width controls proportional downsampling; nine-slice margins are measured in output pixels.
ASSETS = [
    ("01_hud_time_panel_bg", "panels/hud_time_panel_bg", (133, 211, 2040, 512), 480, [16, 12, 16, 12]),
    ("02_hud_day_panel_bg", "panels/hud_day_panel_bg", (243, 390, 1218, 707), 156, [12, 12, 12, 12]),
    ("03_hud_resource_card_bg", "panels/hud_resource_card_bg", (415, 363, 1125, 666), 112, [12, 12, 12, 12]),
    ("04_hud_menu_button_bg", "buttons/hud_menu_button_default", (193, 212, 1581, 667), 156, [18, 15, 18, 15]),
    ("05_hud_survivor_card_bg", "panels/hud_survivor_card_bg_normal", (173, 238, 1446, 718), 300, [30, 24, 24, 16]),
    ("06_hud_command_bar_bg", "panels/hud_command_bar_bg", (97, 189, 2075, 528), 600, [42, 24, 42, 24]),
    ("07_world_interaction_panel_bg", "panels/world_poi_card_bg_normal", (109, 306, 1333, 739), 282, [18, 16, 18, 16]),
    ("07_world_interaction_panel_bg", "panels/world_poi_tail", (655, 733, 776, 795), 28, [0, 0, 0, 0]),
    ("08_hud_discovery_panel_bg", "panels/hud_mission_panel_bg", (150, 205, 973, 1228), 280, [18, 64, 18, 54]),
    ("09_hud_minimap_frame", "minimap/hud_minimap_frame", (104, 129, 1175, 1134), 228, [40, 28, 36, 32]),
    ("10_hud_action_button_states", "buttons/hud_action_button_default", (80, 185, 720, 540), 156, [22, 20, 22, 22]),
    ("10_hud_action_button_states", "buttons/hud_action_button_hover", (755, 185, 1420, 540), 156, [22, 20, 22, 22]),
    ("10_hud_action_button_states", "buttons/hud_action_button_disabled", (1455, 185, 2100, 540), 156, [22, 20, 22, 22]),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, help="Extracted ui_batch1 directory; omit to rebuild stored originals")
    args = parser.parse_args()
    SOURCE.mkdir(parents=True, exist_ok=True)
    manifest = {"package": "blue-hour-homeward-ui-batch1.zip", "processing": "crop + proportional Lanczos downsample", "assets": {}}
    for original, relative, region, width, margins in ASSETS:
        source = SOURCE / (original[3:] + ".png")
        if args.source:
            shutil.copyfile(args.source / (original + ".png"), source)
        image = Image.open(source).convert("RGBA").crop(region)
        dimensions = (width, round(image.height * width / image.width))
        image = image.resize(dimensions, Image.Resampling.LANCZOS)
        output = RUNTIME / (relative + ".png")
        image.save(output)
        manifest["assets"][relative] = {
            "source": str(source.relative_to(PROJECT)).replace("\\", "/"),
            "original": original + ".png",
            "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "region": list(region), "size": list(dimensions), "nine_slice": margins,
        }
    (RUNTIME / "docs/surfaces.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
