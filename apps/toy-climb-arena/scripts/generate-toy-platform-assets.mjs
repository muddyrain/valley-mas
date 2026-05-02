import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const outputDir = resolve(appRoot, 'assets/models/platforms');

class NodeFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
      this.onloadend?.();
    });
  }
}

if (!globalThis.FileReader) {
  globalThis.FileReader = NodeFileReader;
}

function material(color, roughness = 0.46, metalness = 0.06) {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness,
    metalness,
  });
}

function addMesh(
  group,
  geometry,
  mat,
  position,
  rotation = [0, 0, 0],
  options = {},
) {
  const mesh = new Mesh(geometry, mat);
  mesh.name = options.name ?? `solid_${group.children.length + 1}`;
  mesh.userData = {
    collisionShape: options.collisionShape ?? 'box',
  };
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(group, size, mat, position, rotation = [0, 0, 0], options = {}) {
  return addMesh(
    group,
    new BoxGeometry(size[0], size[1], size[2]),
    mat,
    position,
    rotation,
    options,
  );
}

function addCylinder(
  group,
  radius,
  height,
  segments,
  mat,
  position,
  rotation = [0, 0, 0],
  options = {},
) {
  return addMesh(
    group,
    new CylinderGeometry(radius, radius, height, segments),
    mat,
    position,
    rotation,
    { collisionShape: 'cylinder', ...options },
  );
}

function createSquarePlate() {
  const group = new Group();
  group.name = 'toy_square_plate_s1';
  const crateSide = material('#B45309', 0.58, 0.04);
  const topMat = material('#FDE68A', 0.64, 0.02);
  const edgeMat = material('#F97316', 0.48, 0.05);
  const pegMat = material('#FACC15', 0.48, 0.04);

  // One complete jump-platform module: a barn toy crate with a readable soft landing top.
  addBox(group, [4.2, 0.56, 4.2], crateSide, [0, 0.28, 0]);
  addBox(group, [3.72, 0.11, 3.72], topMat, [0, 0.615, 0]);
  addBox(group, [4.32, 0.13, 0.18], edgeMat, [0, 0.69, -2.1]);
  addBox(group, [4.32, 0.13, 0.18], edgeMat, [0, 0.69, 2.1]);
  addBox(group, [0.18, 0.13, 4.32], edgeMat, [-2.1, 0.69, 0]);
  addBox(group, [0.18, 0.13, 4.32], edgeMat, [2.1, 0.69, 0]);

  for (const x of [-1.62, 1.62]) {
    for (const z of [-1.62, 1.62]) {
      addCylinder(group, 0.13, 0.16, 12, pegMat, [x, 0.82, z]);
    }
  }
  return group;
}

function createRoundDisc() {
  const group = new Group();
  group.name = 'toy_round_disc_s2';
  const body = material('#38BDF8', 0.44, 0.08);
  const top = material('#ECFEFF', 0.36, 0.04);
  const accent = material('#A78BFA', 0.34, 0.08);
  const stud = material('#3730A3', 0.4, 0.05);

  addCylinder(group, 1.7, 0.38, 32, body, [0, 0.19, 0]);
  addCylinder(group, 1.44, 0.1, 32, top, [0, 0.46, 0]);
  addMesh(group, new TorusGeometry(1.24, 0.08, 10, 32), accent, [0, 0.56, 0], [
    Math.PI / 2,
    0,
    0,
  ], { collisionShape: 'none' });
  addCylinder(group, 0.25, 0.14, 18, accent, [0, 0.66, 0]);

  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    addCylinder(group, 0.08, 0.1, 10, stud, [
      Math.cos(angle) * 0.86,
      0.7,
      Math.sin(angle) * 0.86,
    ]);
  }
  return group;
}

function createNarrowPlank() {
  const group = new Group();
  group.name = 'toy_narrow_plank_s3';
  const body = material('#FACC15', 0.5, 0.04);
  const top = material('#FEF3C7', 0.42, 0.04);
  const trim = material('#78350F', 0.5, 0.04);
  const accent = material('#EF4444', 0.4, 0.04);

  addMesh(group, new BoxGeometry(6.4, 0.32, 1.12), body, [0, 0.16, 0]);
  addMesh(group, new BoxGeometry(6.05, 0.08, 0.72), top, [0, 0.4, 0]);
  addMesh(group, new BoxGeometry(6.1, 0.1, 0.08), trim, [0, 0.5, -0.42]);
  addMesh(group, new BoxGeometry(6.1, 0.1, 0.08), trim, [0, 0.5, 0.42]);

  for (let i = 0; i < 6; i += 1) {
    const x = -2.5 + i;
    addMesh(group, new BoxGeometry(0.1, 0.075, 0.64), accent, [x, 0.55, 0]);
  }

  for (let i = 0; i < 5; i += 1) {
    const x = -2 + i;
    addCylinder(group, 0.07, 0.08, 8, top, [x, 0.63, 0]);
  }
  return group;
}

function createHayBaleBlock() {
  const group = new Group();
  group.name = 'toy_barn_hay_bale';
  const straw = material('#FDE68A', 0.68, 0.02);
  const rope = material('#92400E', 0.62, 0.03);

  addBox(group, [4.1, 0.7, 3.1], straw, [0, 0.35, 0]);
  addBox(group, [4.18, 0.1, 0.12], rope, [0, 0.38, -1.6]);
  addBox(group, [4.18, 0.1, 0.12], rope, [0, 0.38, 1.6]);
  addBox(group, [0.12, 0.1, 3.0], rope, [-2.12, 0.38, 0]);
  addBox(group, [0.12, 0.1, 3.0], rope, [2.12, 0.38, 0]);
  return group;
}

function createCrateStep() {
  const group = new Group();
  group.name = 'toy_wood_crate_step';
  const wood = material('#B45309', 0.58, 0.04);
  const dark = material('#78350F', 0.64, 0.04);
  const top = material('#FBBF24', 0.5, 0.03);

  addBox(group, [3.7, 0.52, 3.4], wood, [0, 0.26, 0]);
  addBox(group, [3.38, 0.08, 3.08], top, [0, 0.57, 0]);
  addBox(group, [2.7, 0.52, 2.45], wood, [0.18, 0.86, -0.08]);
  addBox(group, [2.42, 0.08, 2.17], top, [0.18, 1.17, -0.08]);
  for (const y of [0.5, 1.1]) {
    addBox(group, [3.82, 0.08, 0.1], dark, [0, y, -1.72]);
    addBox(group, [3.82, 0.08, 0.1], dark, [0, y, 1.72]);
  }
  return group;
}

function createBarrelRoundTop() {
  const group = new Group();
  group.name = 'toy_barrel_round_top';
  const barrel = material('#B45309', 0.55, 0.04);
  const band = material('#78350F', 0.5, 0.04);
  const top = material('#FBBF24', 0.5, 0.03);

  addCylinder(group, 1.35, 0.72, 24, barrel, [0, 0.36, 0]);
  addCylinder(group, 1.26, 0.08, 24, top, [0, 0.76, 0]);
  addMesh(group, new TorusGeometry(1.33, 0.045, 8, 28), band, [0, 0.22, 0], [
    Math.PI / 2,
    0,
    0,
  ], { collisionShape: 'none' });
  addMesh(group, new TorusGeometry(1.33, 0.045, 8, 28), band, [0, 0.55, 0], [
    Math.PI / 2,
    0,
    0,
  ], { collisionShape: 'none' });
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    const slat = addBox(group, [0.045, 0.5, 0.08], band, [
      Math.cos(angle) * 1.18,
      0.38,
      Math.sin(angle) * 1.18,
    ]);
    slat.rotation.y = -angle;
  }
  return group;
}

function createRopePlankBridge() {
  const group = new Group();
  group.name = 'toy_rope_plank_bridge';
  const plank = material('#D97706', 0.58, 0.04);
  const dark = material('#78350F', 0.62, 0.04);

  for (let i = 0; i < 5; i += 1) {
    const x = -2.1 + i * 1.05;
    const board = addBox(group, [0.78, 0.16, 1.35], plank, [x, 0.2, 0]);
    board.rotation.z = MathUtils.degToRad(i % 2 === 0 ? 1.5 : -1.2);
    addBox(group, [0.82, 0.055, 0.08], dark, [x, 0.34, -0.66]);
    addBox(group, [0.82, 0.055, 0.08], dark, [x, 0.34, 0.66]);
  }
  return group;
}

function createPuzzleFragment() {
  const group = new Group();
  group.name = 'toy_broken_puzzle_piece';
  const base = material('#A78BFA', 0.48, 0.04);
  const edge = material('#6D28D9', 0.5, 0.05);
  const safe = material('#FDE68A', 0.55, 0.02);

  const shardA = addBox(group, [2.4, 0.38, 1.8], base, [-0.42, 0.2, -0.1]);
  shardA.rotation.y = MathUtils.degToRad(-7);
  const shardB = addBox(group, [1.7, 0.34, 1.45], base, [0.82, 0.22, 0.45]);
  shardB.rotation.y = MathUtils.degToRad(14);
  addBox(group, [2.55, 0.08, 0.12], edge, [-0.38, 0.46, -0.98], [0, MathUtils.degToRad(-7), 0]);
  addBox(group, [1.5, 0.055, 0.62], safe, [0.14, 0.51, 0.05], [0, MathUtils.degToRad(5), 0]);
  addCylinder(group, 0.16, 0.09, 12, edge, [-1.32, 0.52, 0.56]);
  return group;
}

function createCrumbleCookieTile() {
  const group = new Group();
  group.name = 'toy_crumble_cookie_tile';
  const cookie = material('#F59E0B', 0.7, 0.02);
  const cookieSide = material('#B45309', 0.7, 0.02);
  const icing = material('#FDE68A', 0.58, 0.02);
  const crack = material('#7C2D12', 0.76, 0.02);
  const chip = material('#92400E', 0.72, 0.02);

  addBox(group, [2.28, 0.28, 1.42], cookie, [0, 0.32, 0]);
  addCylinder(group, 0.72, 0.28, 24, cookie, [-1.12, 0.32, -0.7]);
  addCylinder(group, 0.72, 0.28, 24, cookie, [1.12, 0.32, -0.7]);
  addCylinder(group, 0.72, 0.28, 24, cookie, [-1.12, 0.32, 0.7]);
  addCylinder(group, 0.72, 0.28, 24, cookie, [1.12, 0.32, 0.7]);
  addBox(group, [3.15, 0.18, 1.74], cookieSide, [0, 0.12, 0]);

  addBox(group, [1.76, 0.045, 0.42], icing, [-0.38, 0.485, -0.28], [
    0,
    MathUtils.degToRad(8),
    0,
  ]);
  addBox(group, [1.42, 0.045, 0.34], icing, [0.46, 0.49, 0.35], [
    0,
    MathUtils.degToRad(-10),
    0,
  ]);

  addBox(group, [2.68, 0.05, 0.045], crack, [0.08, 0.535, -0.02], [
    0,
    MathUtils.degToRad(14),
    0,
  ], { collisionShape: 'none' });
  addBox(group, [1.1, 0.05, 0.04], crack, [-0.65, 0.54, 0.45], [
    0,
    MathUtils.degToRad(-28),
    0,
  ], { collisionShape: 'none' });
  addBox(group, [0.86, 0.05, 0.04], crack, [0.95, 0.54, -0.48], [
    0,
    MathUtils.degToRad(-34),
    0,
  ], { collisionShape: 'none' });

  for (const [x, z, scale] of [
    [-1.12, -0.48, 1],
    [0.88, -0.3, 0.78],
    [-0.18, 0.58, 0.7],
    [1.16, 0.58, 0.58],
    [-1.42, 0.38, 0.52],
  ]) {
    const chipMesh = addMesh(
      group,
      new SphereGeometry(0.13 * scale, 8, 6),
      chip,
      [x, 0.56, z],
      [0, 0, 0],
      { collisionShape: 'none' },
    );
    chipMesh.scale.y = 0.28;
  }

  return group;
}

function createTrampolinePad() {
  const group = new Group();
  group.name = 'toy_trampoline_pad';
  const frame = material('#F97316', 0.42, 0.05);
  const matTop = material('#38BDF8', 0.35, 0.04);
  const spring = material('#E5E7EB', 0.3, 0.24);

  addBox(group, [3.1, 0.42, 2.6], frame, [0, 0.21, 0]);
  addBox(group, [2.42, 0.08, 1.92], matTop, [0, 0.48, 0]);
  for (const x of [-1.3, 1.3]) {
    for (const z of [-1.05, 1.05]) {
      addCylinder(group, 0.1, 0.38, 12, spring, [x, 0.68, z]);
    }
  }
  return group;
}

function createCastleBrickBlock() {
  const group = new Group();
  group.name = 'toy_castle_brick_block';
  const stone = material('#94A3B8', 0.54, 0.05);
  const dark = material('#475569', 0.58, 0.06);
  const top = material('#CBD5E1', 0.42, 0.04);
  const flag = material('#60A5FA', 0.38, 0.04);

  addBox(group, [3.95, 0.52, 3.55], stone, [0, 0.26, 0]);
  addBox(group, [3.52, 0.1, 3.12], top, [0, 0.57, 0]);
  addBox(group, [3.96, 0.08, 0.12], dark, [0, 0.44, -1.8]);
  addBox(group, [3.96, 0.08, 0.12], dark, [0, 0.44, 1.8]);
  addBox(group, [0.12, 0.08, 3.36], dark, [-1.98, 0.44, 0]);
  addBox(group, [0.12, 0.08, 3.36], dark, [1.98, 0.44, 0]);

  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      addBox(group, [0.72, 0.055, 0.08], dark, [-1.05 + col * 1.05, 0.66, -1.2 + row * 2.4], [
        0,
        MathUtils.degToRad(row === 0 ? 0 : 180),
        0,
      ], { collisionShape: 'none' });
    }
  }

  for (const x of [-1.25, 1.25]) {
    for (const z of [-1.05, 1.05]) {
      addCylinder(group, 0.11, 0.12, 12, flag, [x, 0.74, z], [0, 0, 0], {
        collisionShape: 'none',
      });
    }
  }
  return group;
}

function createCastleGearDisc() {
  const group = new Group();
  group.name = 'toy_castle_gear_disc';
  const gear = material('#7C3AED', 0.45, 0.06);
  const top = material('#DDD6FE', 0.38, 0.03);
  const hub = material('#FBBF24', 0.42, 0.04);

  addCylinder(group, 1.28, 0.34, 28, gear, [0, 0.22, 0]);
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10;
    const tooth = addBox(group, [0.34, 0.28, 0.5], gear, [
      Math.cos(angle) * 1.42,
      0.22,
      Math.sin(angle) * 1.42,
    ]);
    tooth.rotation.y = -angle;
  }
  addCylinder(group, 0.92, 0.1, 28, top, [0, 0.46, 0]);
  addCylinder(group, 0.23, 0.16, 18, hub, [0, 0.59, 0]);
  return group;
}

function createCastleDrawbridge() {
  const group = new Group();
  group.name = 'toy_castle_drawbridge';
  const plank = material('#B45309', 0.58, 0.04);
  const edge = material('#78350F', 0.62, 0.04);
  const metal = material('#CBD5E1', 0.36, 0.2);

  addBox(group, [5.85, 0.24, 1.34], plank, [0, 0.16, 0]);
  addBox(group, [5.9, 0.09, 0.1], edge, [0, 0.34, -0.68]);
  addBox(group, [5.9, 0.09, 0.1], edge, [0, 0.34, 0.68]);
  for (let i = 0; i < 5; i += 1) {
    const x = -2.25 + i * 1.12;
    addBox(group, [0.09, 0.075, 1.12], edge, [x, 0.41, 0], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  for (const x of [-2.65, 2.65]) {
    addCylinder(group, 0.08, 0.42, 12, metal, [x, 0.44, -0.48], [Math.PI / 2, 0, 0], {
      collisionShape: 'none',
    });
    addCylinder(group, 0.08, 0.42, 12, metal, [x, 0.44, 0.48], [Math.PI / 2, 0, 0], {
      collisionShape: 'none',
    });
  }
  return group;
}

function createCastleTowerCap() {
  const group = new Group();
  group.name = 'toy_castle_tower_cap';
  const base = material('#64748B', 0.5, 0.06);
  const top = material('#E2E8F0', 0.36, 0.03);
  const gold = material('#FBBF24', 0.42, 0.04);

  addCylinder(group, 1.28, 0.72, 24, base, [0, 0.36, 0]);
  addCylinder(group, 1.08, 0.12, 24, top, [0, 0.78, 0]);
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    const merlon = addBox(group, [0.36, 0.26, 0.28], base, [
      Math.cos(angle) * 1.02,
      0.98,
      Math.sin(angle) * 1.02,
    ]);
    merlon.rotation.y = -angle;
  }
  addCylinder(group, 0.16, 0.14, 16, gold, [0, 1.17, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createBarnCookieStack() {
  const group = new Group();
  group.name = 'toy_barn_cookie_stack';
  const wafer = material('#D97706', 0.68, 0.02);
  const cream = material('#FDE68A', 0.58, 0.02);
  const chocolate = material('#7C2D12', 0.72, 0.02);
  const sugar = material('#F9A8D4', 0.48, 0.02);

  addBox(group, [4.1, 0.22, 3.1], wafer, [0, 0.14, 0], [0, MathUtils.degToRad(-2), 0]);
  addBox(group, [3.78, 0.12, 2.78], cream, [0.08, 0.34, -0.02], [
    0,
    MathUtils.degToRad(3),
    0,
  ]);
  addBox(group, [3.72, 0.22, 2.72], wafer, [-0.08, 0.52, 0.04], [
    0,
    MathUtils.degToRad(5),
    0,
  ]);
  addBox(group, [3.32, 0.1, 2.32], sugar, [0.04, 0.7, -0.02], [
    0,
    MathUtils.degToRad(-4),
    0,
  ], { collisionShape: 'none' });

  for (const [x, z, s] of [
    [-1.35, -0.8, 1],
    [-0.45, 0.74, 0.72],
    [0.75, -0.55, 0.82],
    [1.35, 0.7, 0.58],
  ]) {
    const chip = addMesh(group, new SphereGeometry(0.13 * s, 8, 6), chocolate, [x, 0.8, z], [
      0,
      0,
      0,
    ], { collisionShape: 'none' });
    chip.scale.y = 0.28;
  }
  return group;
}

function createBarnAbcBlockPile() {
  const group = new Group();
  group.name = 'toy_barn_abc_block_pile';
  const red = material('#EF4444', 0.44, 0.04);
  const blue = material('#38BDF8', 0.4, 0.05);
  const yellow = material('#FACC15', 0.5, 0.03);
  const green = material('#22C55E', 0.48, 0.04);
  const ink = material('#1E293B', 0.52, 0.04);

  addBox(group, [1.55, 1.0, 1.55], red, [-0.98, 0.5, 0.48], [0, MathUtils.degToRad(-7), 0]);
  addBox(group, [1.65, 1.08, 1.65], blue, [0.62, 0.54, -0.35], [
    0,
    MathUtils.degToRad(8),
    0,
  ]);
  addBox(group, [1.45, 0.86, 1.45], yellow, [1.72, 0.43, 0.92], [
    0,
    MathUtils.degToRad(-13),
    0,
  ]);
  addBox(group, [1.42, 0.82, 1.42], green, [-0.25, 1.45, 0.18], [
    0,
    MathUtils.degToRad(10),
    0,
  ]);

  addBox(group, [0.62, 0.055, 0.1], ink, [-0.98, 1.035, -0.32], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.1, 0.055, 0.48], ink, [-1.25, 1.04, -0.32], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.1, 0.055, 0.48], ink, [-0.71, 1.04, -0.32], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.18, 0.06, 16, ink, [0.62, 1.11, -1.18], [Math.PI / 2, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.68, 0.055, 0.1], ink, [1.72, 0.895, 0.2], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createBarnPuddingCup() {
  const group = new Group();
  group.name = 'toy_barn_pudding_cup';
  const cup = material('#F97316', 0.48, 0.04);
  const cream = material('#FDE68A', 0.5, 0.02);
  const cherry = material('#EF4444', 0.38, 0.04);
  const stripe = material('#38BDF8', 0.38, 0.05);

  addCylinder(group, 1.24, 0.68, 28, cup, [0, 0.34, 0]);
  addCylinder(group, 1.38, 0.12, 28, cream, [0, 0.76, 0]);
  addMesh(group, new TorusGeometry(1.18, 0.055, 8, 28), stripe, [0, 0.48, 0], [
    Math.PI / 2,
    0,
    0,
  ], { collisionShape: 'none' });
  const cherryMesh = addMesh(group, new SphereGeometry(0.2, 12, 8), cherry, [0.22, 0.94, -0.1], [
    0,
    0,
    0,
  ], { collisionShape: 'none' });
  cherryMesh.scale.y = 0.72;
  return group;
}

function createBarnButtonCushion() {
  const group = new Group();
  group.name = 'toy_barn_button_cushion';
  const cushion = material('#38BDF8', 0.55, 0.02);
  const seam = material('#1D4ED8', 0.52, 0.03);
  const button = material('#FDE68A', 0.46, 0.03);

  addBox(group, [4.2, 0.5, 3.15], cushion, [0, 0.28, 0]);
  addBox(group, [3.72, 0.08, 2.66], material('#BAE6FD', 0.42, 0.02), [0, 0.58, 0], [
    0,
    0,
    0,
  ]);
  addBox(group, [3.78, 0.055, 0.06], seam, [0, 0.65, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.06, 0.055, 2.66], seam, [0, 0.655, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  for (const x of [-1.1, 1.1]) {
    for (const z of [-0.72, 0.72]) {
      addCylinder(group, 0.16, 0.08, 14, button, [x, 0.72, z], [0, 0, 0], {
        collisionShape: 'none',
      });
    }
  }
  return group;
}

function createCastleBookStack() {
  const group = new Group();
  group.name = 'toy_castle_book_stack';
  const coverA = material('#2563EB', 0.44, 0.04);
  const coverB = material('#DC2626', 0.46, 0.04);
  const coverC = material('#7C3AED', 0.44, 0.05);
  const pages = material('#F8FAFC', 0.52, 0.02);
  const band = material('#FACC15', 0.38, 0.04);

  addBox(group, [4.5, 0.3, 3.45], coverA, [0, 0.18, 0], [0, MathUtils.degToRad(2), 0]);
  addBox(group, [4.15, 0.1, 3.1], pages, [0.04, 0.4, -0.03], [
    0,
    MathUtils.degToRad(2),
    0,
  ]);
  addBox(group, [4.1, 0.28, 3.05], coverB, [-0.1, 0.6, 0.08], [
    0,
    MathUtils.degToRad(-4),
    0,
  ]);
  addBox(group, [3.62, 0.1, 2.64], pages, [-0.08, 0.8, 0.05], [
    0,
    MathUtils.degToRad(-4),
    0,
  ]);
  addBox(group, [3.5, 0.28, 2.55], coverC, [0.12, 1.0, -0.05], [
    0,
    MathUtils.degToRad(6),
    0,
  ]);
  addBox(group, [0.18, 0.08, 3.2], band, [-1.7, 1.2, -0.05], [0, MathUtils.degToRad(6), 0], {
    collisionShape: 'none',
  });
  return group;
}

function createCastleCoinStack() {
  const group = new Group();
  group.name = 'toy_castle_coin_stack';
  const gold = material('#FACC15', 0.36, 0.1);
  const orange = material('#F59E0B', 0.42, 0.08);
  const stamp = material('#78350F', 0.54, 0.03);

  for (let i = 0; i < 6; i += 1) {
    const coin = addCylinder(group, 1.18 - i * 0.035, 0.13, 30, i % 2 ? orange : gold, [
      (i % 2) * 0.08 - 0.04,
      0.1 + i * 0.13,
      (i % 3) * 0.04 - 0.04,
    ]);
    coin.rotation.y = MathUtils.degToRad(i * 9);
  }
  addCylinder(group, 0.34, 0.055, 20, stamp, [0.02, 0.92, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.72, 0.05, 0.09], stamp, [0.02, 0.955, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createCastleKeyBridge() {
  const group = new Group();
  group.name = 'toy_castle_key_bridge';
  const gold = material('#FBBF24', 0.38, 0.08);
  const dark = material('#92400E', 0.5, 0.04);
  const blue = material('#60A5FA', 0.36, 0.04);

  addBox(group, [5.1, 0.24, 0.72], gold, [0.25, 0.18, 0]);
  addMesh(group, new TorusGeometry(0.52, 0.1, 10, 24), gold, [-2.65, 0.18, 0], [
    Math.PI / 2,
    0,
    0,
  ]);
  addBox(group, [0.32, 0.24, 0.56], gold, [2.88, 0.18, -0.28]);
  addBox(group, [0.32, 0.24, 0.56], gold, [3.28, 0.18, 0.28]);
  addBox(group, [4.95, 0.06, 0.08], dark, [0.35, 0.36, -0.38], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [4.95, 0.06, 0.08], dark, [0.35, 0.36, 0.38], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.12, 0.08, 12, blue, [-1.1, 0.44, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.12, 0.08, 12, blue, [0.2, 0.44, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.12, 0.08, 12, blue, [1.5, 0.44, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createCastleCrownPlatform() {
  const group = new Group();
  group.name = 'toy_castle_crown_platform';
  const base = material('#FBBF24', 0.38, 0.08);
  const red = material('#EF4444', 0.42, 0.04);
  const blue = material('#38BDF8', 0.36, 0.06);
  const purple = material('#A78BFA', 0.38, 0.05);

  addCylinder(group, 1.72, 0.42, 28, base, [0, 0.25, 0]);
  addCylinder(group, 1.38, 0.12, 28, material('#FEF3C7', 0.44, 0.04), [0, 0.56, 0]);
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    const spike = addBox(group, [0.36, 0.5, 0.28], base, [
      Math.cos(angle) * 1.42,
      0.72,
      Math.sin(angle) * 1.42,
    ]);
    spike.rotation.y = -angle;
    addCylinder(group, 0.12, 0.1, 12, i % 2 ? blue : red, [
      Math.cos(angle) * 1.42,
      1.04,
      Math.sin(angle) * 1.42,
    ], [0, 0, 0], { collisionShape: 'none' });
  }
  addCylinder(group, 0.22, 0.11, 16, purple, [0, 0.73, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createBarnPicnicBasket() {
  const group = new Group();
  group.name = 'toy_barn_picnic_basket';
  const wicker = material('#B45309', 0.64, 0.03);
  const cloth = material('#FCA5A5', 0.54, 0.02);
  const cream = material('#FEF3C7', 0.48, 0.02);
  const handle = material('#78350F', 0.56, 0.04);

  addBox(group, [4.0, 0.58, 3.1], wicker, [0, 0.29, 0]);
  addBox(group, [3.6, 0.1, 2.72], cloth, [0, 0.65, 0]);
  for (let x = -1.3; x <= 1.31; x += 1.3) {
    addBox(group, [0.08, 0.018, 2.72], cream, [x, 0.696, 0], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  for (let z = -0.9; z <= 0.91; z += 0.9) {
    addBox(group, [3.6, 0.018, 0.08], cream, [0, 0.697, z], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  // Fold the basket handle behind the playable cloth instead of arching over the landing area.
  addCylinder(group, 0.07, 3.15, 12, handle, [0, 0.82, -1.76], [0, 0, Math.PI / 2], {
    collisionShape: 'none',
  });
  for (const x of [-1.5, 1.5]) {
    addCylinder(group, 0.08, 0.42, 12, handle, [x, 0.62, -1.62], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  return group;
}

function createBarnYarnBall() {
  const group = new Group();
  group.name = 'toy_barn_yarn_ball';
  const yarn = material('#F9A8D4', 0.62, 0.02);
  const strand = material('#BE185D', 0.58, 0.02);
  const patch = material('#FDE68A', 0.5, 0.02);

  const body = addMesh(group, new SphereGeometry(1.25, 20, 12), yarn, [0, 0.64, 0]);
  body.scale.y = 0.58;
  body.userData.collisionShape = 'cylinder';
  addMesh(group, new TorusGeometry(0.94, 0.045, 8, 28), strand, [0, 0.74, 0], [
    Math.PI / 2,
    MathUtils.degToRad(22),
    0,
  ], { collisionShape: 'none' });
  addMesh(group, new TorusGeometry(0.72, 0.04, 8, 24), strand, [0, 0.78, 0], [
    Math.PI / 2,
    MathUtils.degToRad(-30),
    0,
  ], { collisionShape: 'none' });
  addBox(group, [0.7, 0.05, 0.28], patch, [0.22, 1.18, -0.08], [0, MathUtils.degToRad(15), 0], {
    collisionShape: 'none',
  });
  return group;
}

function createBarnXylophoneBridge() {
  const group = new Group();
  group.name = 'toy_barn_xylophone_bridge';
  const rail = material('#78350F', 0.54, 0.04);
  const peg = material('#FDE68A', 0.42, 0.03);
  const colors = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#38BDF8', '#A78BFA'];

  addBox(group, [5.9, 0.16, 0.16], rail, [0, 0.18, -0.48]);
  addBox(group, [5.9, 0.16, 0.16], rail, [0, 0.18, 0.48]);
  colors.forEach((color, index) => {
    const x = -2.45 + index * 0.98;
    addBox(group, [0.72, 0.16, 1.02 - index * 0.055], material(color, 0.42, 0.04), [
      x,
      0.36,
      0,
    ]);
    addCylinder(group, 0.055, 0.08, 8, peg, [x - 0.2, 0.49, -0.3], [0, 0, 0], {
      collisionShape: 'none',
    });
    addCylinder(group, 0.055, 0.08, 8, peg, [x + 0.2, 0.49, 0.3], [0, 0, 0], {
      collisionShape: 'none',
    });
  });
  return group;
}

function createCastleShieldTile() {
  const group = new Group();
  group.name = 'toy_castle_shield_tile';
  const steel = material('#94A3B8', 0.42, 0.08);
  const blue = material('#2563EB', 0.36, 0.04);
  const gold = material('#FBBF24', 0.38, 0.06);

  addBox(group, [4.1, 0.34, 3.2], steel, [0, 0.22, 0]);
  addBox(group, [3.46, 0.09, 2.5], blue, [0, 0.46, 0]);
  addBox(group, [0.15, 0.08, 2.5], gold, [0, 0.54, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [3.0, 0.08, 0.13], gold, [0, 0.545, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  for (const x of [-1.55, 1.55]) {
    for (const z of [-1.08, 1.08]) {
      addCylinder(group, 0.1, 0.09, 12, gold, [x, 0.57, z], [0, 0, 0], {
        collisionShape: 'none',
      });
    }
  }
  return group;
}

function createCastleHourglassTower() {
  const group = new Group();
  group.name = 'toy_castle_hourglass_tower';
  const glass = material('#BAE6FD', 0.18, 0.18);
  const gold = material('#FBBF24', 0.36, 0.08);
  const sand = material('#FDE68A', 0.58, 0.02);

  addCylinder(group, 1.05, 0.18, 24, gold, [0, 0.12, 0]);
  addCylinder(group, 0.95, 0.5, 24, glass, [0, 0.46, 0]);
  addCylinder(group, 0.78, 0.16, 24, sand, [0, 0.31, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.86, 0.18, 24, gold, [0, 0.82, 0]);
  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI * 2 * i) / 4;
    addCylinder(group, 0.055, 0.66, 8, gold, [Math.cos(angle) * 0.92, 0.48, Math.sin(angle) * 0.92], [
      0,
      0,
      0,
    ], { collisionShape: 'none' });
  }
  return group;
}

function createCastleRibbonBridge() {
  const group = new Group();
  group.name = 'toy_castle_ribbon_bridge';
  const ribbon = material('#A78BFA', 0.48, 0.03);
  const edge = material('#6D28D9', 0.46, 0.04);
  const gold = material('#FBBF24', 0.38, 0.06);

  addBox(group, [5.8, 0.2, 1.12], ribbon, [0, 0.18, 0]);
  addBox(group, [5.72, 0.07, 0.08], edge, [0, 0.34, -0.54], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [5.72, 0.07, 0.08], edge, [0, 0.34, 0.54], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.92, 0.08, 1.0], gold, [-2.15, 0.4, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.92, 0.08, 1.0], gold, [2.15, 0.4, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createCastleTreasureChest() {
  const group = new Group();
  group.name = 'toy_castle_treasure_chest';
  const wood = material('#92400E', 0.58, 0.04);
  const gold = material('#FBBF24', 0.36, 0.08);
  const red = material('#B91C1C', 0.48, 0.04);

  addBox(group, [4.2, 0.56, 3.25], wood, [0, 0.28, 0]);
  addCylinder(group, 1.65, 4.15, 18, wood, [0, 0.66, 0], [0, 0, Math.PI / 2]);
  addBox(group, [4.34, 0.12, 0.12], gold, [0, 0.59, -1.68], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [4.34, 0.12, 0.12], gold, [0, 0.59, 1.68], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [0.42, 0.1, 0.18], gold, [0, 1.24, -1.7], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.14, 0.09, 12, red, [0, 1.31, -1.82], [Math.PI / 2, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createBarnSeesawBoard() {
  const group = new Group();
  group.name = 'toy_barn_seesaw_board';
  const board = material('#F59E0B', 0.5, 0.04);
  const grip = material('#FDE68A', 0.42, 0.03);
  const rubber = material('#EF4444', 0.46, 0.03);
  const spring = material('#38BDF8', 0.36, 0.08);
  const base = material('#78350F', 0.58, 0.04);

  addBox(group, [5.7, 0.26, 1.42], board, [0, 0.55, 0]);
  addBox(group, [5.5, 0.07, 0.92], grip, [0, 0.72, 0]);
  addBox(group, [0.28, 0.11, 1.46], rubber, [-2.55, 0.78, 0]);
  addBox(group, [0.28, 0.11, 1.46], rubber, [2.55, 0.78, 0]);
  addCylinder(group, 0.34, 1.2, 18, spring, [0, 0.31, 0], [Math.PI / 2, 0, 0]);
  addBox(group, [1.15, 0.16, 1.15], base, [0, 0.08, 0]);
  for (const x of [-1.65, 0, 1.65]) {
    addBox(group, [0.09, 0.05, 0.8], rubber, [x, 0.79, 0], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  return group;
}

function createCastleExtendableRulerBridge() {
  const group = new Group();
  group.name = 'toy_castle_extendable_ruler_bridge';
  const body = material('#FDE68A', 0.5, 0.03);
  const slide = material('#F97316', 0.44, 0.04);
  const mark = material('#7C2D12', 0.52, 0.03);
  const jewel = material('#38BDF8', 0.34, 0.08);

  addBox(group, [6.2, 0.22, 1.18], body, [0, 0.22, 0]);
  addBox(group, [3.05, 0.1, 0.86], slide, [-1.05, 0.42, 0]);
  addBox(group, [3.05, 0.1, 0.86], slide, [1.05, 0.54, 0]);
  for (let i = 0; i < 9; i += 1) {
    const x = -2.55 + i * 0.64;
    addBox(group, [0.045, 0.06, i % 2 === 0 ? 0.78 : 0.48], mark, [x, 0.64, 0], [
      0,
      0,
      0,
    ], { collisionShape: 'none' });
  }
  addCylinder(group, 0.14, 0.08, 14, jewel, [-2.8, 0.69, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.14, 0.08, 14, jewel, [2.8, 0.69, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createCastleTiltBalanceBoard() {
  const group = new Group();
  group.name = 'toy_castle_tilt_balance_board';
  const slab = material('#A78BFA', 0.44, 0.04);
  const top = material('#EDE9FE', 0.36, 0.03);
  const rim = material('#6D28D9', 0.42, 0.05);
  const base = material('#FBBF24', 0.38, 0.08);
  const center = material('#38BDF8', 0.34, 0.08);

  addBox(group, [4.75, 0.28, 2.5], slab, [0, 0.5, 0]);
  addBox(group, [4.32, 0.08, 2.04], top, [0, 0.68, 0]);
  addBox(group, [4.72, 0.09, 0.12], rim, [0, 0.75, -1.25], [0, 0, 0], {
    collisionShape: 'none',
  });
  addBox(group, [4.72, 0.09, 0.12], rim, [0, 0.75, 1.25], [0, 0, 0], {
    collisionShape: 'none',
  });
  addCylinder(group, 0.76, 0.42, 24, base, [0, 0.2, 0]);
  addCylinder(group, 0.28, 0.1, 18, center, [0, 0.78, 0], [0, 0, 0], {
    collisionShape: 'none',
  });
  return group;
}

function createBlinkAcrylicPanel() {
  const group = new Group();
  group.name = 'toy_blink_acrylic_panel';
  const glass = material('#67E8F9', 0.18, 0.18);
  const core = material('#BAE6FD', 0.2, 0.12);
  const rim = material('#2563EB', 0.32, 0.08);
  const light = material('#FDE68A', 0.32, 0.04);

  addBox(group, [3.25, 0.28, 2.42], glass, [0, 0.24, 0]);
  addBox(group, [2.68, 0.08, 1.82], core, [0, 0.42, 0]);
  addBox(group, [3.28, 0.11, 0.15], rim, [0, 0.5, -1.21]);
  addBox(group, [3.28, 0.11, 0.15], rim, [0, 0.5, 1.21]);
  addBox(group, [0.15, 0.11, 2.42], rim, [-1.62, 0.5, 0]);
  addBox(group, [0.15, 0.11, 2.42], rim, [1.62, 0.5, 0]);
  for (const x of [-0.9, 0, 0.9]) {
    addCylinder(group, 0.07, 0.08, 10, light, [x, 0.58, 0], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  return group;
}

function createConveyorTrackBelt() {
  const group = new Group();
  group.name = 'toy_conveyor_track_belt';
  const frame = material('#2563EB', 0.42, 0.08);
  const belt = material('#1F2937', 0.5, 0.08);
  const roller = material('#FBBF24', 0.36, 0.12);
  const arrow = material('#38BDF8', 0.34, 0.06);

  addBox(group, [5.8, 0.26, 1.42], frame, [0, 0.18, 0]);
  addBox(group, [5.28, 0.12, 1.0], belt, [0, 0.39, 0]);
  for (const x of [-2.35, 2.35]) {
    addCylinder(group, 0.16, 1.16, 18, roller, [x, 0.35, 0], [Math.PI / 2, 0, 0], {
      collisionShape: 'none',
    });
  }
  for (const x of [-1.25, 0, 1.25]) {
    addBox(group, [0.52, 0.035, 0.12], arrow, [x, 0.48, 0], [0, 0, 0], {
      collisionShape: 'none',
    });
    addBox(group, [0.22, 0.035, 0.22], arrow, [x + 0.28, 0.485, 0], [
      0,
      MathUtils.degToRad(45),
      0,
    ], { collisionShape: 'none' });
  }
  return group;
}

function createPlasticIceBlock() {
  const group = new Group();
  group.name = 'toy_plastic_ice_block';
  const ice = material('#BAE6FD', 0.16, 0.18);
  const side = material('#67E8F9', 0.22, 0.14);
  const shine = material('#F8FAFC', 0.22, 0.02);

  addBox(group, [3.42, 0.58, 2.72], ice, [0, 0.29, 0]);
  addBox(group, [3.14, 0.12, 2.42], side, [0, 0.64, 0]);
  addBox(group, [1.15, 0.035, 0.12], shine, [-0.7, 0.72, -0.58], [
    0,
    MathUtils.degToRad(-18),
    0,
  ], { collisionShape: 'none' });
  addBox(group, [0.82, 0.035, 0.1], shine, [0.82, 0.725, 0.55], [
    0,
    MathUtils.degToRad(21),
    0,
  ], { collisionShape: 'none' });
  return group;
}

function createGummyStickyPad() {
  const group = new Group();
  group.name = 'toy_gummy_sticky_pad';
  const gummy = material('#FB7185', 0.64, 0.02);
  const top = material('#FBCFE8', 0.58, 0.02);
  const sugar = material('#FDE68A', 0.62, 0.02);

  addCylinder(group, 1.75, 0.34, 28, gummy, [0, 0.22, 0]);
  const topPad = addCylinder(group, 1.52, 0.1, 28, top, [0, 0.48, 0]);
  topPad.scale.z = 0.78;
  addBox(group, [2.25, 0.05, 0.18], sugar, [0, 0.56, 0], [0, MathUtils.degToRad(12), 0], {
    collisionShape: 'none',
  });
  addBox(group, [1.4, 0.05, 0.14], sugar, [-0.15, 0.565, 0.46], [
    0,
    MathUtils.degToRad(-18),
    0,
  ], { collisionShape: 'none' });
  for (const [x, z] of [
    [-0.85, -0.45],
    [0.72, -0.28],
    [-0.18, 0.38],
  ]) {
    addCylinder(group, 0.08, 0.055, 10, sugar, [x, 0.6, z], [0, 0, 0], {
      collisionShape: 'none',
    });
  }
  return group;
}

function createCloudBouncePad() {
  const group = new Group();
  group.name = 'toy_cloud_bounce_pad';
  const cloud = material('#F8FAFC', 0.42, 0.02);
  const blue = material('#38BDF8', 0.36, 0.05);
  const spring = material('#E5E7EB', 0.3, 0.22);

  addCylinder(group, 1.22, 0.24, 24, cloud, [0, 0.42, 0]);
  addCylinder(group, 0.82, 0.22, 22, cloud, [-0.9, 0.46, 0.1]);
  addCylinder(group, 0.82, 0.22, 22, cloud, [0.9, 0.46, 0.1]);
  addCylinder(group, 0.72, 0.22, 20, cloud, [0, 0.5, -0.62]);
  addCylinder(group, 1.2, 0.16, 24, blue, [0, 0.22, 0]);
  for (const x of [-0.75, 0.75]) {
    addCylinder(group, 0.075, 0.32, 10, spring, [x, 0.16, 0.58]);
  }
  return group;
}

function createCrackedPuzzleCrumble() {
  const group = new Group();
  group.name = 'toy_cracked_puzzle_crumble';
  const red = material('#EF4444', 0.52, 0.04);
  const yellow = material('#FACC15', 0.5, 0.04);
  const blue = material('#38BDF8', 0.42, 0.05);
  const crack = material('#7C2D12', 0.76, 0.02);

  const left = addBox(group, [1.55, 0.3, 2.1], red, [-0.74, 0.24, 0], [
    0,
    MathUtils.degToRad(-4),
    0,
  ]);
  left.name = 'solid_left_puzzle_piece';
  const right = addBox(group, [1.55, 0.3, 2.1], yellow, [0.74, 0.24, 0], [
    0,
    MathUtils.degToRad(4),
    0,
  ]);
  right.name = 'solid_right_puzzle_piece';
  addCylinder(group, 0.32, 0.3, 18, blue, [0, 0.24, -1.0]);
  addBox(group, [2.75, 0.05, 0.045], crack, [0, 0.43, 0], [
    0,
    MathUtils.degToRad(16),
    0,
  ], { collisionShape: 'none' });
  addBox(group, [1.05, 0.05, 0.045], crack, [-0.45, 0.435, 0.46], [
    0,
    MathUtils.degToRad(-28),
    0,
  ], { collisionShape: 'none' });
  addBox(group, [0.85, 0.05, 0.045], crack, [0.7, 0.435, -0.44], [
    0,
    MathUtils.degToRad(-35),
    0,
  ], { collisionShape: 'none' });
  return group;
}

async function exportGlb(group, fileName) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(group, {
    binary: true,
    trs: false,
    onlyVisible: true,
  });
  const outputPath = resolve(outputDir, fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`generated ${outputPath}`);
}

await exportGlb(createSquarePlate(), 'toy_square_plate_s1.glb');
await exportGlb(createRoundDisc(), 'toy_round_disc_s2.glb');
await exportGlb(createNarrowPlank(), 'toy_narrow_plank_s3.glb');
await exportGlb(createHayBaleBlock(), 'toy_barn_hay_bale.glb');
await exportGlb(createCrateStep(), 'toy_wood_crate_step.glb');
await exportGlb(createBarrelRoundTop(), 'toy_barrel_round_top.glb');
await exportGlb(createRopePlankBridge(), 'toy_rope_plank_bridge.glb');
await exportGlb(createPuzzleFragment(), 'toy_broken_puzzle_piece.glb');
await exportGlb(createCrumbleCookieTile(), 'toy_crumble_cookie_tile.glb');
await exportGlb(createTrampolinePad(), 'toy_trampoline_pad.glb');
await exportGlb(createCastleBrickBlock(), 'toy_castle_brick_block.glb');
await exportGlb(createCastleGearDisc(), 'toy_castle_gear_disc.glb');
await exportGlb(createCastleDrawbridge(), 'toy_castle_drawbridge.glb');
await exportGlb(createCastleTowerCap(), 'toy_castle_tower_cap.glb');
await exportGlb(createBarnCookieStack(), 'toy_barn_cookie_stack.glb');
await exportGlb(createBarnAbcBlockPile(), 'toy_barn_abc_block_pile.glb');
await exportGlb(createBarnPuddingCup(), 'toy_barn_pudding_cup.glb');
await exportGlb(createBarnButtonCushion(), 'toy_barn_button_cushion.glb');
await exportGlb(createCastleBookStack(), 'toy_castle_book_stack.glb');
await exportGlb(createCastleCoinStack(), 'toy_castle_coin_stack.glb');
await exportGlb(createCastleKeyBridge(), 'toy_castle_key_bridge.glb');
await exportGlb(createCastleCrownPlatform(), 'toy_castle_crown_platform.glb');
await exportGlb(createBarnPicnicBasket(), 'toy_barn_picnic_basket.glb');
await exportGlb(createBarnYarnBall(), 'toy_barn_yarn_ball.glb');
await exportGlb(createBarnXylophoneBridge(), 'toy_barn_xylophone_bridge.glb');
await exportGlb(createCastleShieldTile(), 'toy_castle_shield_tile.glb');
await exportGlb(createCastleHourglassTower(), 'toy_castle_hourglass_tower.glb');
await exportGlb(createCastleRibbonBridge(), 'toy_castle_ribbon_bridge.glb');
await exportGlb(createCastleTreasureChest(), 'toy_castle_treasure_chest.glb');
await exportGlb(createBarnSeesawBoard(), 'toy_barn_seesaw_board.glb');
await exportGlb(createCastleExtendableRulerBridge(), 'toy_castle_extendable_ruler_bridge.glb');
await exportGlb(createCastleTiltBalanceBoard(), 'toy_castle_tilt_balance_board.glb');
await exportGlb(createBlinkAcrylicPanel(), 'toy_blink_acrylic_panel.glb');
await exportGlb(createConveyorTrackBelt(), 'toy_conveyor_track_belt.glb');
await exportGlb(createPlasticIceBlock(), 'toy_plastic_ice_block.glb');
await exportGlb(createGummyStickyPad(), 'toy_gummy_sticky_pad.glb');
await exportGlb(createCloudBouncePad(), 'toy_cloud_bounce_pad.glb');
await exportGlb(createCrackedPuzzleCrumble(), 'toy_cracked_puzzle_crumble.glb');
