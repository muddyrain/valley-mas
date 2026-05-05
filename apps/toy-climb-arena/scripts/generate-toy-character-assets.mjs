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
const outputDir = resolve(appRoot, 'assets/models/characters');

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

function material(color, roughness = 0.45, metalness = 0.04) {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness,
    metalness,
  });
}

function addMesh(group, geometry, mat, position, rotation = [0, 0, 0], scale = [1, 1, 1], name) {
  const mesh = new Mesh(geometry, mat);
  mesh.name = name ?? `part_${group.children.length + 1}`;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(group, size, mat, position, rotation = [0, 0, 0], name) {
  return addMesh(group, new BoxGeometry(size[0], size[1], size[2]), mat, position, rotation, [1, 1, 1], name);
}

function addCylinder(group, radiusTop, radiusBottom, height, segments, mat, position, rotation = [0, 0, 0], name) {
  return addMesh(group, new CylinderGeometry(radiusTop, radiusBottom, height, segments), mat, position, rotation, [1, 1, 1], name);
}

function addSphere(group, radius, widthSegments, heightSegments, mat, position, scale = [1, 1, 1], name) {
  return addMesh(group, new SphereGeometry(radius, widthSegments, heightSegments), mat, position, [0, 0, 0], scale, name);
}

function addTorus(group, majorRadius, tubeRadius, mat, position, rotation = [0, 0, 0], name) {
  return addMesh(group, new TorusGeometry(majorRadius, tubeRadius, 12, 36), mat, position, rotation, [1, 1, 1], name);
}

function createToyHero() {
  const root = new Group();
  root.name = 'toy_hero';

  const skin = material('#F7D6A5', 0.5, 0.02);
  const blush = material('#FCA5A5', 0.58, 0.0);
  const hair = material('#7C2D12', 0.54, 0.02);
  const suit = material('#2563EB', 0.42, 0.07);
  const suitDark = material('#1E40AF', 0.46, 0.08);
  const scarf = material('#EF4444', 0.46, 0.03);
  const gold = material('#FACC15', 0.38, 0.08);
  const teal = material('#22D3EE', 0.32, 0.05);
  const white = material('#F8FAFC', 0.46, 0.02);
  const black = material('#111827', 0.4, 0.05);
  const boot = material('#7C3F1D', 0.55, 0.04);
  const glove = material('#FEF3C7', 0.48, 0.02);
  const backpack = material('#F97316', 0.48, 0.04);
  const seam = material('#0F172A', 0.5, 0.03);

  // Body core
  addCylinder(root, 0.22, 0.28, 0.58, 28, suit, [0, 0.22, 0], [0, 0, 0], 'torso_body');
  addCylinder(root, 0.205, 0.235, 0.38, 28, white, [0, 0.31, 0.035], [MathUtils.degToRad(4), 0, 0], 'torso_front_panel');
  addBox(root, [0.42, 0.055, 0.08], gold, [0, 0.24, 0.245], [0, 0, 0], 'torso_belt');
  addBox(root, [0.12, 0.075, 0.09], teal, [0, 0.245, 0.3], [0, 0, 0], 'torso_buckle');
  addCylinder(root, 0.085, 0.085, 0.12, 18, gold, [-0.115, 0.49, 0.22], [Math.PI / 2, 0, 0], 'torso_button_left');
  addCylinder(root, 0.085, 0.085, 0.12, 18, gold, [0.115, 0.49, 0.22], [Math.PI / 2, 0, 0], 'torso_button_right');

  // Backpack and straps
  addBox(root, [0.38, 0.5, 0.15], backpack, [0, 0.28, -0.21], [0, 0, 0], 'torso_backpack');
  addBox(root, [0.065, 0.45, 0.08], suitDark, [-0.16, 0.33, 0.18], [0.04, 0, -0.08], 'torso_strap_left');
  addBox(root, [0.065, 0.45, 0.08], suitDark, [0.16, 0.33, 0.18], [0.04, 0, 0.08], 'torso_strap_right');
  addCylinder(root, 0.055, 0.055, 0.15, 16, teal, [-0.21, 0.4, -0.28], [Math.PI / 2, 0, 0], 'torso_pack_light_left');
  addCylinder(root, 0.055, 0.055, 0.15, 16, teal, [0.21, 0.4, -0.28], [Math.PI / 2, 0, 0], 'torso_pack_light_right');

  // Head and face
  addSphere(root, 0.24, 32, 24, skin, [0, 0.78, 0], [1.06, 1.08, 1.0], 'head_main');
  addSphere(root, 0.08, 18, 12, skin, [-0.235, 0.77, 0.015], [0.65, 1, 0.65], 'head_ear_left');
  addSphere(root, 0.08, 18, 12, skin, [0.235, 0.77, 0.015], [0.65, 1, 0.65], 'head_ear_right');
  addSphere(root, 0.042, 12, 8, blush, [-0.125, 0.735, 0.212], [1.25, 0.55, 0.28], 'head_blush_left');
  addSphere(root, 0.042, 12, 8, blush, [0.125, 0.735, 0.212], [1.25, 0.55, 0.28], 'head_blush_right');
  addSphere(root, 0.036, 12, 8, black, [-0.08, 0.805, 0.22], [0.75, 1.1, 0.45], 'head_eye_left');
  addSphere(root, 0.036, 12, 8, black, [0.08, 0.805, 0.22], [0.75, 1.1, 0.45], 'head_eye_right');
  addSphere(root, 0.014, 8, 6, white, [-0.092, 0.82, 0.245], [1, 1, 0.5], 'head_eye_glint_left');
  addSphere(root, 0.014, 8, 6, white, [0.068, 0.82, 0.245], [1, 1, 0.5], 'head_eye_glint_right');
  addSphere(root, 0.026, 10, 8, skin, [0, 0.755, 0.245], [0.95, 0.75, 0.6], 'head_nose');
  addBox(root, [0.11, 0.018, 0.016], seam, [0, 0.705, 0.245], [0, 0, 0], 'head_smile');

  // Hair cap and bangs
  addSphere(root, 0.255, 32, 12, hair, [0, 0.89, -0.02], [1.03, 0.58, 0.95], 'head_hair_cap');
  for (let i = 0; i < 7; i += 1) {
    const x = -0.15 + i * 0.05;
    const z = 0.19 - Math.abs(i - 3) * 0.012;
    addSphere(root, 0.06, 14, 10, hair, [x, 0.89 - Math.abs(i - 3) * 0.011, z], [0.85, 0.75, 0.7], `head_bang_${i + 1}`);
  }

  // Goggles on forehead
  addTorus(root, 0.085, 0.014, gold, [-0.1, 0.98, 0.075], [Math.PI / 2, 0, 0], 'head_goggle_left');
  addTorus(root, 0.085, 0.014, gold, [0.1, 0.98, 0.075], [Math.PI / 2, 0, 0], 'head_goggle_right');
  addBox(root, [0.07, 0.024, 0.026], gold, [0, 0.98, 0.075], [0, 0, 0], 'head_goggle_bridge');
  addSphere(root, 0.062, 18, 12, teal, [-0.1, 0.98, 0.08], [1, 1, 0.22], 'head_lens_left');
  addSphere(root, 0.062, 18, 12, teal, [0.1, 0.98, 0.08], [1, 1, 0.22], 'head_lens_right');

  // Scarf
  addTorus(root, 0.235, 0.033, scarf, [0, 0.58, 0.025], [Math.PI / 2, 0, 0], 'torso_scarf_ring');
  addBox(root, [0.1, 0.32, 0.055], scarf, [0.17, 0.42, 0.235], [0.18, 0, -0.18], 'torso_scarf_tail_right');
  addBox(root, [0.085, 0.23, 0.05], scarf, [0.06, 0.41, 0.25], [-0.1, 0, 0.08], 'torso_scarf_tail_left');

  // Limbs: many separate pieces make the rigid animator visibly richer.
  const makeArm = (side) => {
    const sx = side === 'left' ? -1 : 1;
    addSphere(root, 0.085, 18, 12, gold, [sx * 0.3, 0.47, 0.0], [1, 1, 1], `arm_${side}_shoulder_joint`);
    addCylinder(root, 0.065, 0.075, 0.28, 18, suit, [sx * 0.37, 0.31, 0.01], [0, 0, sx * MathUtils.degToRad(13)], `arm_${side}_upper`);
    addSphere(root, 0.068, 16, 10, suitDark, [sx * 0.4, 0.16, 0.02], [1, 1, 1], `arm_${side}_elbow`);
    addCylinder(root, 0.052, 0.062, 0.24, 18, suitDark, [sx * 0.39, 0.02, 0.02], [0, 0, sx * MathUtils.degToRad(-5)], `arm_${side}_forearm`);
    addSphere(root, 0.073, 18, 12, glove, [sx * 0.38, -0.13, 0.035], [1.12, 0.8, 0.95], `arm_${side}_glove`);
    addCylinder(root, 0.028, 0.028, 0.09, 10, glove, [sx * 0.31, -0.13, 0.088], [Math.PI / 2, 0, sx * 0.2], `arm_${side}_thumb`);
  };
  makeArm('left');
  makeArm('right');

  const makeLeg = (side) => {
    const sx = side === 'left' ? -1 : 1;
    addSphere(root, 0.088, 18, 12, suitDark, [sx * 0.14, -0.08, 0.0], [1, 0.92, 1], `leg_${side}_hip_joint`);
    addCylinder(root, 0.08, 0.075, 0.32, 18, suit, [sx * 0.15, -0.25, 0.005], [0, 0, sx * MathUtils.degToRad(2)], `leg_${side}_thigh`);
    addSphere(root, 0.072, 18, 12, gold, [sx * 0.15, -0.42, 0.02], [1, 0.8, 1], `leg_${side}_knee_pad`);
    addCylinder(root, 0.066, 0.07, 0.28, 18, suitDark, [sx * 0.15, -0.58, 0.025], [0, 0, sx * MathUtils.degToRad(-2)], `leg_${side}_shin`);
    addBox(root, [0.18, 0.095, 0.27], boot, [sx * 0.15, -0.76, 0.085], [0, sx * MathUtils.degToRad(2), 0], `leg_${side}_boot`);
    addBox(root, [0.15, 0.028, 0.22], gold, [sx * 0.15, -0.705, 0.06], [0, 0, 0], `leg_${side}_boot_band`);
  };
  makeLeg('left');
  makeLeg('right');

  // Toy seams and collector-grade polish.
  for (const x of [-0.165, 0.165]) {
    addCylinder(root, 0.022, 0.022, 0.08, 10, seam, [x, 0.18, 0.265], [Math.PI / 2, 0, 0], `torso_side_screw_${x < 0 ? 'left' : 'right'}`);
    addCylinder(root, 0.018, 0.018, 0.055, 10, seam, [x, -0.02, 0.235], [Math.PI / 2, 0, 0], `torso_lower_screw_${x < 0 ? 'left' : 'right'}`);
  }

  root.position.y = 0.76;
  return root;
}

async function exportGlb(group, fileName) {
  await mkdir(outputDir, { recursive: true });
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(group, { binary: true });
  const outputPath = resolve(outputDir, fileName);
  await writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`generated ${outputPath}`);
}

await exportGlb(createToyHero(), 'toy_hero.glb');
