"""Audit supplied ZIPs and copy original PNG bytes; never transcode artwork."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import zipfile

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = Path.home() / "Downloads"
NAMES = [
    "蓝时归航_Expedition_HUD_2.0_UI素材包.zip",
    "蓝时归航_Expedition_HUD_2.0_UI素材包_v2.zip",
    "蓝时归航_Expedition_HUD_2.0_第二批A_UI素材包.zip",
    "蓝时归航_Expedition_HUD_2.0_第二批C_UI素材包.zip",
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def category(name):
    for prefix, folder in [
        ("hud_skill_slot_", "buttons"), ("hud_return_", "buttons"),
        ("hud_small_button_", "buttons"), ("hud_tiny_button_", "buttons"),
        ("hud_progress_", "progress"), ("hud_portrait_", "portraits"),
        ("world_", "world"), ("icon_", "icons"), ("ui_", "common"),
        ("hud_", "panels"),
    ]:
        if name.startswith(prefix):
            return folder
    raise ValueError(f"Unclassified asset: {name}")


def main():
    temporary = Path(tempfile.mkdtemp(prefix="blue-hour-hud-2-"))
    output = PROJECT / "assets/ui/expedition_hud"
    report = {"temporary_directory": str(temporary), "archives": [], "pngs": [], "duplicates": []}
    selected = {}
    for number, name in enumerate(NAMES):
        source = SOURCE / name
        before = digest(source)
        folder = temporary / str(number + 1)
        folder.mkdir()
        with zipfile.ZipFile(source) as archive:
            if archive.testzip() is not None:
                raise ValueError(f"ZIP CRC failure: {source}")
            for entry in archive.infolist():
                target = (folder / entry.filename).resolve()
                if not target.is_relative_to(folder.resolve()):
                    raise ValueError(f"Unsafe ZIP entry: {entry.filename}")
                archive.extract(entry, folder)
        rows = []
        for path in sorted(folder.rglob("*.png")):
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                image.load()
                alpha = image.getchannel("A").getextrema() if "A" in image.getbands() else None
                row = {"archive": name, "name": path.name, "extracted": str(path),
                       "size": list(image.size), "mode": image.mode, "alpha_range": alpha,
                       "sha256": digest(path), "bytes": path.stat().st_size,
                       "anomalous_dimensions": min(image.size) < 4 or max(image.size) > 4096}
            if path.name in selected:
                previous = selected[path.name]
                same = previous["sha256"] == row["sha256"]
                report["duplicates"].append({"name": path.name, "identical": same,
                    "previous_archive": previous["archive"], "selected_archive": name,
                    "reason": "identical bytes" if same else "explicit v2 supersedes base; both preserved in temp"})
                if not same and not name.endswith("_v2.zip"):
                    raise ValueError(f"Unresolved conflicting asset: {path.name}")
            selected[path.name] = row
            rows.append(row)
        assert digest(source) == before, "Original attachment changed"
        report["archives"].append({"path": str(source), "sha256": before, "png_count": len(rows)})
        report["pngs"].extend(rows)
    for name, row in selected.items():
        destination = output / category(name) / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and digest(destination) != row["sha256"]:
            raise ValueError(f"Existing asset differs: {destination}")
        shutil.copyfile(row["extracted"], destination)
        assert digest(destination) == row["sha256"]
        row["destination"] = destination.relative_to(PROJECT).as_posix()
    report["unique_png_count"] = len(selected)
    report["png_count"] = len(report["pngs"])
    (PROJECT / "art/EXPEDITION_HUD_ASSET_AUDIT.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "pngs"}, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
