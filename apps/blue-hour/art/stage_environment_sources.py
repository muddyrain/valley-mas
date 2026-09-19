"""Copy the four user-approved textured sources byte-for-byte and record their audit."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

from audit_world_sources import audit, read_glb

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "PRP_Utility_Pole_A": "Meshy_AI_PRP_Utility_Pole_A_0918142959_texture.glb",
    "PRP_Parking_Sign_A": "Meshy_AI_PRP_Parking_Sign_A_0918143006_texture.glb",
    "PRP_Storefront_AFrame_Sign_A": "Meshy_AI_Wooden_A_Frame_Chalkb_0918142926_texture.glb",
    "PRP_Bicycle_A": "Meshy_AI_PRP_Bicycle_A_0918142914_texture.glb",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_directory", type=Path)
    args = parser.parse_args()
    records = []
    for asset_id, filename in SOURCES.items():
        source = args.source_directory / filename
        record = audit(source)
        _, document, _ = read_glb(source)
        record["vertices"] = sum(
            document["accessors"][primitive["attributes"]["POSITION"]]["count"]
            for mesh in document["meshes"] for primitive in mesh["primitives"]
        )
        target = ROOT / "assets/world/props/street" / (asset_id + ".glb")
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != record["sha256"]:
            raise RuntimeError(f"Refusing to replace a different existing source: {target}")
        shutil.copyfile(source, target)
        assert hashlib.sha256(target.read_bytes()).hexdigest() == record["sha256"]
        record.update(id=asset_id, runtime_source="res://" + target.relative_to(ROOT).as_posix())
        records.append(record)
    destination = ROOT / "art/environment_street_sources.json"
    destination.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for record in records:
        print(record["id"], record["triangles"], record["vertices"], record["size"], record["textures"])


if __name__ == "__main__":
    main()
