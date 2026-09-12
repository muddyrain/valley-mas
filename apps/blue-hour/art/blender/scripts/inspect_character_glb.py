"""Read GLB bytes, including skin attributes; requires only Python's standard library."""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def read_glb(path):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2 or length != len(raw):
        raise ValueError(f'Invalid GLB 2.0 header: {path}')
    offset, document, binary = 12, None, b''
    while offset < length:
        size, kind = struct.unpack_from('<II', raw, offset)
        chunk = raw[offset + 8:offset + 8 + size]
        if len(chunk) != size:
            raise ValueError('Truncated GLB chunk')
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + size
    if document is None:
        raise ValueError('Missing GLB JSON')
    return document, binary


def accessor_values(document, binary, index):
    accessor = document['accessors'][index]
    view = document['bufferViews'][accessor['bufferView']]
    if view.get('buffer', 0) != 0 or 'sparse' in accessor:
        raise ValueError('External buffers and sparse accessors are unsupported')
    formats = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
    counts = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    fmt = '<' + formats[accessor['componentType']] * counts[accessor['type']]
    stride = view.get('byteStride', struct.calcsize(fmt))
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    values = [struct.unpack_from(fmt, binary, start + i * stride) for i in range(accessor['count'])]
    if accessor.get('normalized'):
        maximum = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[accessor['componentType']]
        values = [tuple(max(-1, value / maximum) for value in row) for row in values]
    return values


def image_resolution(payload):
    """Read PNG/JPEG dimensions without decoding pixels or extra dependencies."""
    if payload.startswith(b'\x89PNG\r\n\x1a\n'):
        return list(struct.unpack_from('>II', payload, 16))
    if payload.startswith(b'\xff\xd8'):
        offset = 2
        while offset + 4 <= len(payload):
            if payload[offset] != 255:
                raise ValueError('Invalid JPEG marker')
            marker = payload[offset + 1]
            offset += 2
            if marker == 255:
                offset -= 1
                continue
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            size = struct.unpack_from('>H', payload, offset)[0]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                height, width = struct.unpack_from('>HH', payload, offset + 3)
                return [width, height]
            offset += size
    raise ValueError('Unsupported embedded image format')


def inspect(path):
    document, binary = read_glb(path)
    nodes = document.get('nodes', [])
    parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
    joints = sorted({joint for skin in document.get('skins', []) for joint in skin['joints']})
    name = lambda i: nodes[i].get('name', f'node_{i}')
    primitives = [p for mesh in document.get('meshes', []) for p in mesh['primitives']]
    attributes = [p['attributes'] for p in primitives]
    weights = [row for a in attributes if 'WEIGHTS_0' in a
               for row in accessor_values(document, binary, a['WEIGHTS_0'])]
    images = []
    for item in document.get('images', []):
        view = document['bufferViews'][item['bufferView']]
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        images.append({**item, 'resolution': image_resolution(payload),
                       'sha256': hashlib.sha256(payload).hexdigest()})
    return {
        'path': str(Path(path).as_posix()),
        'sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        'mesh_count': len(document.get('meshes', [])),
        'material_count': len(document.get('materials', [])),
        'texture_count': len(document.get('textures', [])),
        'images': images,
        'skeleton': bool(joints), 'skin_count': len(document.get('skins', [])),
        'skinned_mesh_nodes': [name(i) for i, n in enumerate(nodes) if 'skin' in n and 'mesh' in n],
        'vertex_weights': bool(weights),
        'animation_count': len(document.get('animations', [])),
        'bone_count': len(joints), 'bone_names': [name(i) for i in joints],
        'bone_hierarchy': {name(i): name(parents[i]) if parents.get(i) in joints else None for i in joints},
        'nodes': nodes,
        'vertex_count': sum(document['accessors'][a['POSITION']]['count'] for a in attributes),
        'triangles': sum(document['accessors'][p['indices']]['count'] // 3 for p in primitives),
        'attributes': attributes,
        'unweighted_vertices': sum(sum(w) < 0.999 for w in weights),
        'maximum_weight_sum_error': max((abs(sum(w) - 1) for w in weights), default=0),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    report = [inspect(path) for path in args.files]
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    for item in report:
        print(f"{item['path']}: mesh={item['mesh_count']} bones={item['bone_count']} skin={item['skin_count']} animations={item['animation_count']}")
