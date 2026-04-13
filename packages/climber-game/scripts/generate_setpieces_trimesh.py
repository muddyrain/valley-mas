import math
import os

import numpy as np
import trimesh


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'assets', 'models', 'setpieces'))


def _face_color(mesh: trimesh.Trimesh, rgba: tuple[int, int, int, int]) -> trimesh.Trimesh:
    mesh.visual.face_colors = np.tile(np.array(rgba, dtype=np.uint8), (len(mesh.faces), 1))
    return mesh


def _transform(
    mesh: trimesh.Trimesh,
    translate: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotate_xyz: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
) -> trimesh.Trimesh:
    out = mesh.copy()
    out.apply_scale(scale)
    mat = trimesh.transformations.euler_matrix(*rotate_xyz)
    mat[:3, 3] = np.array(translate)
    out.apply_transform(mat)
    return out


def _box(extents: tuple[float, float, float], color: tuple[int, int, int, int]) -> trimesh.Trimesh:
    return _face_color(trimesh.creation.box(extents=extents), color)


def _cylinder(radius: float, height: float, color: tuple[int, int, int, int], sections: int = 24) -> trimesh.Trimesh:
    return _face_color(trimesh.creation.cylinder(radius=radius, height=height, sections=sections), color)


def _cone(radius: float, height: float, color: tuple[int, int, int, int], sections: int = 16) -> trimesh.Trimesh:
    return _face_color(trimesh.creation.cone(radius=radius, height=height, sections=sections), color)


def _export(name: str, meshes: list[trimesh.Trimesh]) -> None:
    scene = trimesh.Scene(meshes)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f'{name}.glb')
    glb = scene.export(file_type='glb')
    with open(path, 'wb') as f:
        f.write(glb)


def build_rock_slab() -> None:
    stone = (126, 134, 142, 255)
    edge = (99, 106, 113, 255)
    pieces = [
        _transform(_box((2.8, 0.55, 1.6), stone), (0.0, 0.28, 0.0), rotate_xyz=(0.07, 0.0, 0.03)),
        _transform(_box((2.2, 0.22, 1.2), edge), (0.12, 0.55, -0.08), rotate_xyz=(0.02, 0.0, -0.04)),
        _transform(_box((0.5, 0.18, 0.4), edge), (-0.9, 0.58, 0.3), rotate_xyz=(0.0, 0.2, 0.0)),
    ]
    _export('rock_slab', pieces)


def build_boulder_round() -> None:
    stone = (112, 118, 125, 255)
    core = _face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.95), stone)
    pieces = [
        _transform(core, (0.0, 0.95, 0.0), scale=(1.15, 0.92, 1.0)),
        _transform(_box((0.6, 0.2, 0.5), (90, 96, 103, 255)), (0.3, 0.22, -0.1), rotate_xyz=(0.0, 0.4, 0.0)),
    ]
    _export('boulder_round', pieces)


def build_stump_short() -> None:
    bark = (117, 77, 43, 255)
    ring = (171, 126, 84, 255)
    pieces = [
        _transform(_cylinder(0.56, 0.84, bark, sections=18), (0.0, 0.42, 0.0)),
        _transform(_cylinder(0.5, 0.06, ring, sections=18), (0.0, 0.86, 0.0)),
    ]
    _export('stump_short', pieces)


def build_log_tilt() -> None:
    wood = (142, 93, 55, 255)
    cap = (191, 145, 95, 255)
    main = _cylinder(0.34, 3.8, wood, sections=20)
    pieces = [
        _transform(main, (0.0, 0.72, 0.0), rotate_xyz=(0.0, 0.0, math.pi / 2)),
        _transform(_cylinder(0.35, 0.08, cap, sections=20), (-1.9, 0.72, 0.0), rotate_xyz=(0.0, math.pi / 2, 0.0)),
        _transform(_cylinder(0.35, 0.08, cap, sections=20), (1.9, 0.72, 0.0), rotate_xyz=(0.0, math.pi / 2, 0.0)),
    ]
    _export('log_tilt', pieces)


def build_branch_bridge() -> None:
    wood = (155, 105, 63, 255)
    rope = (108, 86, 62, 255)
    pieces: list[trimesh.Trimesh] = []
    for i in range(-3, 4):
        pieces.append(
            _transform(
                _box((0.48, 0.12, 0.9), wood),
                (i * 0.58, 0.14 + (0.02 if i % 2 == 0 else -0.01), 0.0),
                rotate_xyz=(0.0, 0.0, 0.03 if i % 2 == 0 else -0.03),
            )
        )
    pieces.append(_transform(_cylinder(0.04, 4.2, rope, sections=12), (0.0, 0.32, -0.44), rotate_xyz=(0.0, 0.0, math.pi / 2)))
    pieces.append(_transform(_cylinder(0.04, 4.2, rope, sections=12), (0.0, 0.32, 0.44), rotate_xyz=(0.0, 0.0, math.pi / 2)))
    _export('branch_bridge', pieces)


def build_pillar_thin() -> None:
    stone = (166, 165, 160, 255)
    dark = (115, 114, 108, 255)
    pieces = [
        _transform(_cylinder(0.32, 3.2, stone, sections=16), (0.0, 1.6, 0.0)),
        _transform(_box((0.9, 0.22, 0.9), dark), (0.0, 0.11, 0.0)),
        _transform(_box((0.76, 0.2, 0.76), dark), (0.0, 3.24, 0.0)),
    ]
    _export('pillar_thin', pieces)


def build_crate_tall() -> None:
    shell = (132, 87, 49, 255)
    brace = (97, 64, 36, 255)
    pieces = [_transform(_box((1.55, 2.4, 1.55), shell), (0.0, 1.2, 0.0))]
    for x in (-0.65, 0.65):
        for z in (-0.65, 0.65):
            pieces.append(_transform(_box((0.12, 2.35, 0.12), brace), (x, 1.2, z)))
    pieces.append(_transform(_box((1.58, 0.1, 0.2), brace), (0.0, 1.2, 0.0), rotate_xyz=(0.0, 0.0, 0.8)))
    pieces.append(_transform(_box((1.58, 0.1, 0.2), brace), (0.0, 1.2, 0.0), rotate_xyz=(0.0, 0.0, -0.8)))
    _export('crate_tall', pieces)


def build_ledge_hook() -> None:
    metal = (146, 157, 168, 255)
    dark = (92, 100, 109, 255)
    pieces = [
        _transform(_box((2.6, 0.24, 1.0), metal), (0.0, 1.12, -0.1)),
        _transform(_box((0.36, 1.9, 0.9), dark), (1.12, 0.95, -0.06)),
        _transform(_box((0.36, 1.9, 0.9), dark), (-1.12, 0.95, -0.06)),
        _transform(_box((1.85, 0.22, 0.34), dark), (0.0, 0.2, 0.3)),
    ]
    _export('ledge_hook', pieces)


def build_cliff_block() -> None:
    stone_a = (118, 123, 127, 255)
    stone_b = (98, 103, 107, 255)
    pieces = [
        _transform(_box((2.3, 1.4, 2.2), stone_a), (0.0, 0.7, 0.0), rotate_xyz=(0.0, 0.2, 0.0)),
        _transform(_box((1.2, 0.65, 1.0), stone_b), (0.5, 1.42, -0.35), rotate_xyz=(0.08, -0.1, 0.0)),
    ]
    _export('cliff_block', pieces)


def build_beam_cross() -> None:
    beam = (164, 110, 66, 255)
    iron = (98, 105, 112, 255)
    pieces = [
        _transform(_box((3.3, 0.22, 0.44), beam), (0.0, 0.6, 0.0)),
        _transform(_box((0.44, 0.22, 3.1), beam), (0.0, 0.84, 0.0)),
        _transform(_cylinder(0.08, 0.54, iron, sections=16), (0.0, 0.72, 0.0)),
    ]
    _export('beam_cross', pieces)


def build_stepping_stone() -> None:
    stone = (147, 151, 156, 255)
    top = (173, 177, 181, 255)
    core = _face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.62), stone)
    pieces = [
        _transform(core, (0.0, 0.42, 0.0), scale=(1.35, 0.6, 1.1)),
        _transform(_box((0.85, 0.06, 0.56), top), (0.06, 0.71, -0.03), rotate_xyz=(0.0, 0.25, 0.0)),
    ]
    _export('stepping_stone', pieces)


def build_rope_post() -> None:
    wood = (128, 86, 50, 255)
    rope = (113, 91, 67, 255)
    metal = (152, 157, 163, 255)
    pieces = [
        _transform(_cylinder(0.18, 2.3, wood, sections=14), (0.0, 1.15, 0.0)),
        _transform(_cone(0.22, 0.35, wood, sections=12), (0.0, 2.48, 0.0)),
        _transform(_cylinder(0.04, 1.8, rope, sections=12), (0.0, 1.54, 0.34), rotate_xyz=(math.pi / 2, 0.0, 0.0)),
        _transform(_cylinder(0.04, 1.8, rope, sections=12), (0.0, 1.2, -0.34), rotate_xyz=(math.pi / 2, 0.0, 0.0)),
        _transform(_cylinder(0.14, 0.07, metal, sections=16), (0.0, 0.04, 0.0)),
    ]
    _export('rope_post', pieces)


def build_hut_frame_small() -> None:
    wood = (140, 97, 59, 255)
    roof = (118, 78, 45, 255)
    pieces: list[trimesh.Trimesh] = []
    for x in (-1.2, 1.2):
        for z in (-1.0, 1.0):
            pieces.append(_transform(_box((0.18, 2.2, 0.18), wood), (x, 1.1, z)))
    pieces.append(_transform(_box((2.7, 0.16, 0.18), wood), (0.0, 2.25, -1.0)))
    pieces.append(_transform(_box((2.7, 0.16, 0.18), wood), (0.0, 2.25, 1.0)))
    pieces.append(_transform(_box((0.18, 0.16, 2.2), wood), (-1.2, 2.25, 0.0)))
    pieces.append(_transform(_box((0.18, 0.16, 2.2), wood), (1.2, 2.25, 0.0)))
    pieces.append(_transform(_box((2.9, 0.12, 2.4), roof), (0.0, 2.62, 0.0)))
    _export('hut_frame_small', pieces)


def build_hut_frame_large() -> None:
    wood = (146, 102, 62, 255)
    roof = (123, 83, 50, 255)
    pieces: list[trimesh.Trimesh] = []
    for x in (-1.8, 1.8):
        for z in (-1.4, 1.4):
            pieces.append(_transform(_box((0.22, 2.8, 0.22), wood), (x, 1.4, z)))
    pieces.append(_transform(_box((4.0, 0.2, 0.22), wood), (0.0, 2.9, -1.4)))
    pieces.append(_transform(_box((4.0, 0.2, 0.22), wood), (0.0, 2.9, 1.4)))
    pieces.append(_transform(_box((0.22, 0.2, 3.0), wood), (-1.8, 2.9, 0.0)))
    pieces.append(_transform(_box((0.22, 0.2, 3.0), wood), (1.8, 2.9, 0.0)))
    pieces.append(_transform(_box((4.4, 0.14, 3.3), roof), (0.0, 3.28, 0.0)))
    _export('hut_frame_large', pieces)


def build_arch_gate() -> None:
    stone = (137, 140, 143, 255)
    pieces = [
        _transform(_box((0.7, 3.1, 0.8), stone), (-1.3, 1.55, 0.0)),
        _transform(_box((0.7, 3.1, 0.8), stone), (1.3, 1.55, 0.0)),
        _transform(_box((3.3, 0.6, 0.9), stone), (0.0, 3.1, 0.0)),
    ]
    _export('arch_gate', pieces)


def build_tunnel_frame() -> None:
    metal = (138, 145, 154, 255)
    dark = (95, 102, 110, 255)
    pieces: list[trimesh.Trimesh] = []
    for x in (-1.7, 1.7):
        pieces.append(_transform(_box((0.28, 2.5, 3.6), metal), (x, 1.25, 0.0)))
    pieces.append(_transform(_box((3.7, 0.26, 3.6), metal), (0.0, 2.52, 0.0)))
    pieces.append(_transform(_box((3.9, 0.12, 3.8), dark), (0.0, 2.8, 0.0)))
    _export('tunnel_frame', pieces)


def build_cube_frame() -> None:
    beam = (153, 109, 67, 255)
    pieces: list[trimesh.Trimesh] = []
    sx, sy, sz = 1.25, 1.25, 1.25
    t = 0.16
    for y in (-sy, sy):
        for z in (-sz, sz):
            pieces.append(_transform(_box((2 * sx + t, t, t), beam), (0.0, y + sy, z)))
    for x in (-sx, sx):
        for z in (-sz, sz):
            pieces.append(_transform(_box((t, 2 * sy + t, t), beam), (x, sy, z)))
    for x in (-sx, sx):
        for y in (-sy, sy):
            pieces.append(_transform(_box((t, t, 2 * sz + t), beam), (x, y + sy, 0.0)))
    _export('cube_frame', pieces)


def build_house_tunnel() -> None:
    wall = (170, 132, 95, 255)
    roof = (132, 88, 55, 255)
    pieces = [
        _transform(_box((0.25, 2.4, 2.2), wall), (-1.35, 1.2, 0.0)),
        _transform(_box((0.25, 2.4, 2.2), wall), (1.35, 1.2, 0.0)),
        _transform(_box((2.95, 0.25, 0.25), wall), (0.0, 2.35, -0.98)),
        _transform(_box((2.95, 0.25, 0.25), wall), (0.0, 2.35, 0.98)),
        _transform(_box((3.4, 0.2, 2.5), roof), (0.0, 2.85, 0.0)),
    ]
    _export('house_tunnel', pieces)


def build_cloud_pad() -> None:
    white = (248, 251, 255, 255)
    shadow = (226, 236, 248, 255)
    pieces = [
        _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=1.0), white), (-0.85, 0.62, -0.1), scale=(1.12, 0.62, 0.92)),
        _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=1.0), white), (0.0, 0.7, 0.0), scale=(1.28, 0.66, 1.02)),
        _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=1.0), white), (0.88, 0.62, 0.1), scale=(1.06, 0.6, 0.9)),
        _transform(_box((3.2, 0.16, 1.9), shadow), (0.0, 0.2, 0.0)),
    ]
    _export('cloud_pad', pieces)


def build_cloud_ring() -> None:
    white = (250, 252, 255, 255)
    shadow = (228, 238, 249, 255)
    pieces: list[trimesh.Trimesh] = []
    for i in range(8):
        angle = i * (math.tau / 8)
        x = math.cos(angle) * 1.35
        z = math.sin(angle) * 1.05
        pieces.append(
            _transform(
                _face_color(trimesh.creation.icosphere(subdivisions=1, radius=0.52), white),
                (x, 0.56 + (0.04 if i % 2 == 0 else -0.03), z),
                scale=(1.2, 0.76, 1.0),
            )
        )
    pieces.append(_transform(_box((2.6, 0.14, 2.0), shadow), (0.0, 0.2, 0.0)))
    _export('cloud_ring', pieces)


def build_cloud_arch() -> None:
    white = (250, 252, 255, 255)
    shadow = (230, 239, 249, 255)
    pieces = [
        _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.75), white), (-1.1, 1.0, 0.0), scale=(1.05, 0.92, 1.0)),
        _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.86), white), (0.0, 1.22, 0.0), scale=(1.08, 0.88, 1.05)),
        _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.75), white), (1.1, 1.0, 0.0), scale=(1.05, 0.92, 1.0)),
        _transform(_box((3.5, 0.15, 1.5), shadow), (0.0, 0.26, 0.0)),
    ]
    _export('cloud_arch', pieces)


def build_floating_island() -> None:
    grass = (129, 175, 120, 255)
    soil = (124, 88, 58, 255)
    rock = (102, 107, 112, 255)
    pieces = [
        _transform(_box((3.6, 0.24, 2.5), grass), (0.0, 0.46, 0.0)),
        _transform(_box((2.8, 0.9, 1.9), soil), (0.0, -0.02, 0.0), rotate_xyz=(0.05, 0.0, -0.03)),
        _transform(_cone(0.85, 1.4, rock, sections=10), (0.0, -0.9, 0.0)),
    ]
    _export('floating_island', pieces)


def build_spiral_pillar() -> None:
    stone = (158, 160, 163, 255)
    step = (124, 126, 130, 255)
    pieces: list[trimesh.Trimesh] = [
        _transform(_cylinder(0.5, 4.4, stone, sections=16), (0.0, 2.2, 0.0))
    ]
    for i in range(10):
        angle = i * 0.62
        x = math.cos(angle) * 0.95
        z = math.sin(angle) * 0.95
        y = 0.45 + i * 0.34
        pieces.append(
            _transform(
                _box((0.7, 0.12, 0.42), step),
                (x, y, z),
                rotate_xyz=(0.0, angle, 0.0),
            )
        )
    _export('spiral_pillar', pieces)


def build_sky_bridge_long() -> None:
    beam = (156, 111, 69, 255)
    rope = (109, 92, 70, 255)
    pieces: list[trimesh.Trimesh] = []
    for i in range(-6, 7):
        pieces.append(_transform(_box((0.56, 0.12, 1.0), beam), (i * 0.6, 0.16, 0.0)))
    pieces.append(_transform(_cylinder(0.045, 7.8, rope, sections=12), (0.0, 0.52, -0.48), rotate_xyz=(0.0, 0.0, math.pi / 2)))
    pieces.append(_transform(_cylinder(0.045, 7.8, rope, sections=12), (0.0, 0.52, 0.48), rotate_xyz=(0.0, 0.0, math.pi / 2)))
    _export('sky_bridge_long', pieces)


def build_prism_gate() -> None:
    metal = (141, 150, 162, 255)
    neon = (189, 230, 255, 255)
    pieces = [
        _transform(_box((0.32, 3.0, 0.6), metal), (-1.25, 1.5, 0.0)),
        _transform(_box((0.32, 3.0, 0.6), metal), (1.25, 1.5, 0.0)),
        _transform(_box((2.9, 0.28, 0.6), metal), (0.0, 3.05, 0.0)),
        _transform(_box((2.2, 0.1, 0.2), neon), (0.0, 2.3, 0.0)),
    ]
    _export('prism_gate', pieces)


def build_bonus_pack_20() -> None:
    for name in (
        'lotus_pad',
        'meteor_chunk',
        'neon_pillar',
        'drum_platform',
        'zigzag_beam',
        'fan_blade',
        'bridge_arc',
        'crystal_cluster',
        'moon_step',
        'star_frame',
        'barrel_tower',
        'totem_mask',
        'shell_ridge',
        'wing_platform',
        'vortex_ring',
        'tower_gate',
        'hex_pad',
        'bridge_lattice',
        'orb_podium',
        'dune_backbone',
    ):
        if name == 'lotus_pad':
            pieces = [
                _transform(_box((2.8, 0.18, 2.1), (119, 172, 121, 255)), (0.0, 0.22, 0.0)),
                _transform(_face_color(trimesh.creation.icosphere(subdivisions=1, radius=0.46), (236, 171, 206, 255)), (0.0, 0.52, 0.0), scale=(1.1, 0.52, 1.1)),
            ]
        elif name == 'meteor_chunk':
            pieces = [
                _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.9), (92, 95, 108, 255)), (0.0, 0.7, 0.0), scale=(1.42, 0.78, 1.15)),
                _transform(_box((1.2, 0.16, 0.8), (118, 120, 135, 255)), (0.1, 1.05, -0.05), rotate_xyz=(0.0, 0.4, 0.0)),
            ]
        elif name == 'neon_pillar':
            pieces = [
                _transform(_cylinder(0.42, 3.2, (106, 114, 125, 255), sections=18), (0.0, 1.6, 0.0)),
                _transform(_box((0.95, 0.14, 0.95), (183, 238, 255, 255)), (0.0, 3.18, 0.0)),
            ]
        elif name == 'drum_platform':
            pieces = [
                _transform(_cylinder(1.05, 1.1, (152, 86, 70, 255), sections=22), (0.0, 0.56, 0.0)),
                _transform(_cylinder(0.98, 0.08, (232, 207, 170, 255), sections=22), (0.0, 1.08, 0.0)),
            ]
        elif name == 'zigzag_beam':
            pieces = [
                _transform(_box((1.4, 0.16, 0.6), (166, 118, 74, 255)), (-1.4, 0.3, 0.0), rotate_xyz=(0.0, 0.35, 0.0)),
                _transform(_box((1.4, 0.16, 0.6), (166, 118, 74, 255)), (0.0, 0.5, 0.0), rotate_xyz=(0.0, -0.35, 0.0)),
                _transform(_box((1.4, 0.16, 0.6), (166, 118, 74, 255)), (1.4, 0.7, 0.0), rotate_xyz=(0.0, 0.35, 0.0)),
            ]
        elif name == 'fan_blade':
            pieces = [
                _transform(_box((2.8, 0.14, 0.42), (137, 146, 158, 255)), (0.0, 0.46, 0.0)),
                _transform(_box((0.42, 0.14, 2.8), (137, 146, 158, 255)), (0.0, 0.46, 0.0)),
                _transform(_cylinder(0.18, 0.36, (97, 104, 112, 255), sections=16), (0.0, 0.46, 0.0)),
            ]
        elif name == 'bridge_arc':
            pieces = [
                _transform(_box((3.6, 0.16, 1.0), (156, 112, 73, 255)), (0.0, 0.75, 0.0)),
                _transform(_box((3.6, 0.12, 0.16), (105, 85, 63, 255)), (0.0, 0.34, -0.42)),
                _transform(_box((3.6, 0.12, 0.16), (105, 85, 63, 255)), (0.0, 0.34, 0.42)),
            ]
        elif name == 'crystal_cluster':
            pieces = [
                _transform(_cone(0.42, 1.45, (162, 230, 252, 255), sections=7), (-0.3, 0.72, -0.12)),
                _transform(_cone(0.52, 1.72, (134, 213, 246, 255), sections=7), (0.46, 0.86, 0.08)),
                _transform(_box((1.9, 0.14, 1.2), (196, 239, 255, 255)), (0.08, 0.2, 0.0)),
            ]
        elif name == 'moon_step':
            pieces = [
                _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.9), (229, 232, 236, 255)), (0.0, 0.58, 0.0), scale=(1.55, 0.52, 0.96)),
                _transform(_box((2.3, 0.14, 1.4), (213, 218, 226, 255)), (0.0, 0.22, 0.0)),
            ]
        elif name == 'star_frame':
            pieces = [
                _transform(_box((2.2, 0.14, 0.36), (245, 200, 101, 255)), (0.0, 0.62, 0.0), rotate_xyz=(0.0, 0.0, 0.6)),
                _transform(_box((2.2, 0.14, 0.36), (245, 200, 101, 255)), (0.0, 0.62, 0.0), rotate_xyz=(0.0, 0.0, -0.6)),
                _transform(_box((2.2, 0.14, 0.36), (245, 200, 101, 255)), (0.0, 0.62, 0.0)),
            ]
        elif name == 'barrel_tower':
            pieces = [
                _transform(_cylinder(0.78, 2.3, (139, 94, 57, 255), sections=18), (0.0, 1.15, 0.0)),
                _transform(_cylinder(0.84, 0.08, (104, 111, 118, 255), sections=18), (0.0, 0.08, 0.0)),
                _transform(_cylinder(0.84, 0.08, (104, 111, 118, 255), sections=18), (0.0, 2.22, 0.0)),
            ]
        elif name == 'totem_mask':
            pieces = [
                _transform(_box((1.2, 2.8, 0.9), (170, 117, 78, 255)), (0.0, 1.4, 0.0)),
                _transform(_box((0.82, 0.16, 0.18), (58, 52, 49, 255)), (0.0, 2.02, 0.42)),
                _transform(_box((0.62, 0.14, 0.16), (58, 52, 49, 255)), (0.0, 1.52, 0.42)),
            ]
        elif name == 'shell_ridge':
            pieces = [
                _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.85), (226, 204, 186, 255)), (0.0, 0.54, 0.0), scale=(1.75, 0.48, 1.06)),
                _transform(_box((2.7, 0.12, 1.6), (212, 188, 170, 255)), (0.0, 0.18, 0.0)),
            ]
        elif name == 'wing_platform':
            pieces = [
                _transform(_box((1.8, 0.12, 0.72), (173, 181, 193, 255)), (-1.02, 0.46, 0.0), rotate_xyz=(0.0, 0.22, 0.0)),
                _transform(_box((1.8, 0.12, 0.72), (173, 181, 193, 255)), (1.02, 0.46, 0.0), rotate_xyz=(0.0, -0.22, 0.0)),
                _transform(_box((0.82, 0.14, 0.78), (137, 147, 159, 255)), (0.0, 0.46, 0.0)),
            ]
        elif name == 'vortex_ring':
            pieces = [
                _transform(_cylinder(1.3, 0.16, (117, 138, 173, 255), sections=22), (0.0, 0.42, 0.0)),
                _transform(_cylinder(0.86, 0.18, (82, 97, 130, 255), sections=22), (0.0, 0.62, 0.0)),
            ]
        elif name == 'tower_gate':
            pieces = [
                _transform(_box((0.6, 3.6, 0.7), (139, 145, 150, 255)), (-1.5, 1.8, 0.0)),
                _transform(_box((0.6, 3.6, 0.7), (139, 145, 150, 255)), (1.5, 1.8, 0.0)),
                _transform(_box((3.6, 0.44, 0.8), (139, 145, 150, 255)), (0.0, 3.5, 0.0)),
            ]
        elif name == 'hex_pad':
            pieces = [
                _transform(_cylinder(1.22, 0.18, (136, 167, 208, 255), sections=6), (0.0, 0.24, 0.0)),
                _transform(_cylinder(0.72, 0.08, (201, 228, 252, 255), sections=6), (0.0, 0.38, 0.0)),
            ]
        elif name == 'bridge_lattice':
            pieces = [
                _transform(_box((3.9, 0.14, 0.94), (154, 112, 72, 255)), (0.0, 0.34, 0.0)),
                _transform(_box((3.7, 0.1, 0.1), (105, 83, 59, 255)), (0.0, 0.62, -0.38)),
                _transform(_box((3.7, 0.1, 0.1), (105, 83, 59, 255)), (0.0, 0.62, 0.38)),
            ]
        elif name == 'orb_podium':
            pieces = [
                _transform(_cylinder(0.9, 0.54, (126, 133, 143, 255), sections=20), (0.0, 0.28, 0.0)),
                _transform(_face_color(trimesh.creation.icosphere(subdivisions=2, radius=0.48), (199, 229, 255, 255)), (0.0, 0.86, 0.0)),
            ]
        elif name == 'dune_backbone':
            pieces = [
                _transform(_box((3.8, 0.16, 1.7), (187, 164, 124, 255)), (0.0, 0.25, 0.0)),
                _transform(_box((2.8, 0.3, 1.1), (171, 145, 106, 255)), (0.1, 0.48, 0.0), rotate_xyz=(0.0, 0.16, 0.0)),
            ]
        else:
            continue
        _export(name, pieces)


def main() -> None:
    build_rock_slab()
    build_boulder_round()
    build_stump_short()
    build_log_tilt()
    build_branch_bridge()
    build_pillar_thin()
    build_crate_tall()
    build_ledge_hook()
    build_cliff_block()
    build_beam_cross()
    build_stepping_stone()
    build_rope_post()
    build_hut_frame_small()
    build_hut_frame_large()
    build_arch_gate()
    build_tunnel_frame()
    build_cube_frame()
    build_house_tunnel()
    build_cloud_pad()
    build_cloud_ring()
    build_cloud_arch()
    build_floating_island()
    build_spiral_pillar()
    build_sky_bridge_long()
    build_prism_gate()
    build_bonus_pack_20()
    print(f'Generated new setpieces in: {OUTPUT_DIR}')


if __name__ == '__main__':
    main()
