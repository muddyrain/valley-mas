"""Keep frozen animation channels byte-for-byte while replacing selected baked curves."""

import copy
import json
import math
import struct


RUN_CHANNELS = {
    (f"{side}{bone}", "rotation")
    for side in ("Left", "Right")
    for bone in ("Shoulder", "UpperArm", "LowerArm", "Hand")
}
DEATH_LEG_CHANNELS = {
    (f"{side}{bone}", "rotation")
    for side in ("Left", "Right")
    for bone in ("UpperLeg", "LowerLeg", "Foot")
}
DEATH_CHANNELS = DEATH_LEG_CHANNELS | {("Hips", "translation")}


def _read_glb(path):
    data = open(path, "rb").read()
    magic, version, length = struct.unpack_from("<III", data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError(f"Invalid GLB: {path}")
    chunks = []
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks.append((kind, data[offset:offset + size]))
        offset += size
    if len(chunks) != 2 or chunks[0][0] != 0x4E4F534A or chunks[1][0] != 0x004E4942:
        raise ValueError(f"Unexpected GLB chunks: {path}")
    return json.loads(chunks[0][1]), chunks[1][1]


def _write_glb(path, document, binary):
    document["buffers"][0]["byteLength"] = len(binary)
    payload = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload += b" " * (-len(payload) % 4)
    binary += b"\0" * (-len(binary) % 4)
    length = 12 + 8 + len(payload) + 8 + len(binary)
    with open(path, "wb") as file:
        file.write(struct.pack("<III", 0x46546C67, 2, length))
        file.write(struct.pack("<II", len(payload), 0x4E4F534A))
        file.write(payload)
        file.write(struct.pack("<II", len(binary), 0x004E4942))
        file.write(binary)


def _channel_map(document):
    animation = document["animations"][0]
    return {
        (document["nodes"][channel["target"]["node"]]["name"], channel["target"]["path"]): channel
        for channel in animation["channels"]
    }


def _floats(document, binary, accessor_index):
    accessor = document["accessors"][accessor_index]
    if accessor["componentType"] != 5126:
        raise ValueError("Animation accessor must contain float32 values")
    width = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    view = document["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", 4 * width)
    return [struct.unpack_from("<" + "f" * width, binary, offset + row * stride) for row in range(accessor["count"])]


def _slerp(left, right, weight):
    dot = sum(a * b for a, b in zip(left, right))
    if dot < 0.0:
        right = tuple(-value for value in right)
        dot = -dot
    if dot > 0.9995:
        values = [a + weight * (b - a) for a, b in zip(left, right)]
    else:
        theta = math.acos(max(-1.0, min(1.0, dot)))
        scale = math.sin(theta)
        values = [
            a * math.sin((1.0 - weight) * theta) / scale + b * math.sin(weight * theta) / scale
            for a, b in zip(left, right)
        ]
    magnitude = math.sqrt(sum(value * value for value in values))
    return tuple(value / magnitude for value in values)


def merge_clip_channels(baseline_path, candidate_path, output_path, clip_name):
    baseline, baseline_bin = _read_glb(baseline_path)
    candidate, candidate_bin = _read_glb(candidate_path)
    allowed = RUN_CHANNELS if clip_name == "survivor_run" else DEATH_CHANNELS
    baseline_animation = baseline["animations"][0]
    candidate_animation = candidate["animations"][0]
    baseline_channels = _channel_map(baseline)
    candidate_channels = _channel_map(candidate)
    if not allowed <= baseline_channels.keys() or not allowed <= candidate_channels.keys():
        raise ValueError(f"Missing {clip_name} channels")

    extras = baseline_animation.setdefault("extras", {})
    original_samplers = extras.setdefault("BH_original_leg_samplers", {})
    accessor_offset = len(baseline["accessors"])
    view_offset = len(baseline["bufferViews"])
    binary_offset = len(baseline_bin)
    baseline_bin += candidate_bin
    for view in candidate["bufferViews"]:
        copied = copy.deepcopy(view)
        copied["byteOffset"] = copied.get("byteOffset", 0) + binary_offset
        baseline["bufferViews"].append(copied)
    for accessor in candidate["accessors"]:
        copied = copy.deepcopy(accessor)
        copied["bufferView"] += view_offset
        baseline["accessors"].append(copied)

    for key in sorted(allowed):
        baseline_channel = baseline_channels[key]
        candidate_channel = candidate_channels[key]
        source_sampler = candidate_animation["samplers"][candidate_channel["sampler"]]
        sampler = copy.deepcopy(source_sampler)
        sampler["input"] += accessor_offset
        sampler["output"] += accessor_offset
        if clip_name == "death" and key in DEATH_LEG_CHANNELS:
            key_name = "/".join(key)
            original_index = original_samplers.setdefault(key_name, baseline_channel["sampler"])
            original_sampler = baseline_animation["samplers"][original_index]
            old_times = _floats(baseline, baseline_bin, original_sampler["input"])
            new_times = _floats(baseline, baseline_bin, sampler["input"])
            if len(old_times) != len(new_times) or any(abs(a[0] - b[0]) > 0.0001 for a, b in zip(old_times, new_times)):
                raise ValueError(f"Death keyframe times changed: {key_name}")
            old_values = _floats(baseline, baseline_bin, original_sampler["output"])
            new_values = _floats(baseline, baseline_bin, sampler["output"])
            end_time = new_times[-1][0]
            blended = []
            for time, old_value, new_value in zip(new_times, old_values, new_values):
                progress = time[0] / end_time
                weight = max(0.0, min(1.0, (progress - 0.7) / 0.2))
                weight = weight * weight * (3.0 - 2.0 * weight)
                blended.extend(_slerp(old_value, new_value, weight))
            output_view = len(baseline["bufferViews"])
            baseline["bufferViews"].append({"buffer": 0, "byteOffset": len(baseline_bin), "byteLength": len(blended) * 4})
            baseline_bin += struct.pack("<" + "f" * len(blended), *blended)
            output_accessor = copy.deepcopy(baseline["accessors"][sampler["output"]])
            output_accessor["bufferView"] = output_view
            sampler["output"] = len(baseline["accessors"])
            baseline["accessors"].append(output_accessor)
        baseline_channel["sampler"] = len(baseline_animation["samplers"])
        baseline_animation["samplers"].append(sampler)

    _write_glb(output_path, baseline, baseline_bin)
