"""Normalize FBX image filename metadata; preserve geometry, skin, rest and clips."""
import argparse
import array
import hashlib
import json
from pathlib import Path
import sys

from io_scene_fbx import encode_bin, parse_fbx


def digest(node):
    result = hashlib.sha256(node.id + bytes(node.props_type))
    for prop in node.props:
        result.update(prop.tobytes() if isinstance(prop, array.array) else repr(prop).encode())
    for child in node.elems:
        result.update(digest(child).encode())
    return result.hexdigest()


def encode(node):
    methods = dict(zip("BCZYILFDRSifdlbc", ["bool", "char", "int8", "int16", "int32", "int64", "float32", "float64", "bytes", "string", "int32_array", "float32_array", "float64_array", "int64_array", "bool_array", "byte_array"]))
    target = encode_bin.FBXElem(node.id)
    for code, prop in zip(node.props_type, node.props):
        getattr(target, "add_" + methods[chr(code)])(prop)
    target.elems.extend(encode(child) for child in node.elems)
    return target


parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("report", type=Path)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
root, version = parse_fbx.parse(str(args.source))
objects = next(node for node in root.elems if node.id == b"Objects")
before = {obj.props[0]: digest(obj) for obj in objects.elems}
changed = []
for obj in objects.elems:
    if obj.id in (b"Video", b"Texture"):
        for node in obj.elems:
            if node.id in (b"Filename", b"FileName", b"RelativeFilename"):
                assert node.props[0].endswith(b".fbm")
                node.props[0] = b"survivor_animation_template_embedded.jpg"
                changed.append(node.id.decode())
assert len(changed) == 4
args.output.parent.mkdir(parents=True, exist_ok=True)
with encode_bin.FBXElem.enable_multithreading_cm():
    encoded = encode(root)
encode_bin.write(str(args.output), encoded, version)
parsed, _ = parse_fbx.parse(str(args.output))
assert digest(parsed) == digest(root)
unchanged = [obj for obj in objects.elems if obj.id not in (b"Video", b"Texture")]
assert all(digest(obj) == before[obj.props[0]] for obj in unchanged)
report = {"source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(), "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "changed_image_filename_fields": changed, "unchanged_other_objects": len(unchanged), "geometry_skin_rest_animations_unchanged": True}
args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
