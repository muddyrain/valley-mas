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
