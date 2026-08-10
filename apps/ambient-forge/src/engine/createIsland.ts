import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { createInstancedTreeBatch } from './createInstancedTrees';
import { createIslandDetails } from './createIslandDetails';
import { createRadialAlphaTexture } from './createRadialAlphaTexture';
import { createWaterfall } from './createWaterfall';
import { disposeObject3D } from './dispose';

export interface IslandAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getEffectCount: () => number;
  dispose: () => void;
}

interface BladePose {
  x: number;
  z: number;
  scale: number;
  yaw: number;
  lean: number;
  phase: number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function enableShadows(root: Object3D, enabled: boolean): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = enabled;
    mesh.receiveShadow = enabled;
  });
}

function createFacetedRockGeometry(): BufferGeometry {
  const rings = [
    { y: 0.04, radius: 5.08 },
    { y: -0.52, radius: 4.88 },
    { y: -1.35, radius: 4.18 },
    { y: -2.28, radius: 3.46 },
    { y: -3.28, radius: 2.58 },
    { y: -4.18, radius: 1.62 },
    { y: -5.02, radius: 0.58 },
  ];
  const segments = 16;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const upperColor = new Color('#768079');
  const lowerColor = new Color('#444b4b');

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    if (!ring) continue;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const irregularity =
        1 +
        Math.sin(segment * 2.17 + ringIndex * 1.31) * 0.055 +
        Math.sin(segment * 4.63 - ringIndex * 0.73) * 0.028;
      const radius = ring.radius * irregularity;
      positions.push(Math.cos(angle) * radius, ring.y, Math.sin(angle) * radius);
      const shade = ringIndex / (rings.length - 1);
      const color = upperColor.clone().lerp(lowerColor, shade * 0.82);
      color.offsetHSL(0, 0, Math.sin(segment * 2.4 + ringIndex) * 0.018);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const topLeft = ringIndex * segments + segment;
      const topRight = ringIndex * segments + next;
      const bottomLeft = (ringIndex + 1) * segments + segment;
      const bottomRight = (ringIndex + 1) * segments + next;
      const flip = (segment + ringIndex) % 2 === 0;
      if (flip) {
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      } else {
        indices.push(topLeft, bottomLeft, bottomRight, topLeft, bottomRight, topRight);
      }
    }
  }

  const bottomIndex = positions.length / 3;
  positions.push(0, -5.18, 0);
  colors.push(lowerColor.r, lowerColor.g, lowerColor.b);
  const lastRingOffset = (rings.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(
      bottomIndex,
      lastRingOffset + ((segment + 1) % segments),
      lastRingOffset + segment,
    );
  }

  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new Float32BufferAttribute(positions, 3));
  indexed.setAttribute('color', new Float32BufferAttribute(colors, 3));
  indexed.setIndex(indices);
  const faceted = indexed.toNonIndexed();
  indexed.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

function createIrregularCapGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(5.12, 4.98, 0.42, 32, 2, false);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const radius = Math.hypot(x, z);
    if (radius >= 0.01) {
      const angle = Math.atan2(z, x);
      const edgeScale = 1 + Math.sin(angle * 5 + 0.8) * 0.022 + Math.sin(angle * 11 - 0.3) * 0.014;
      positions.setX(index, x * edgeScale);
      positions.setZ(index, z * edgeScale);
    }
    if (y > 0.16) positions.setY(index, y + Math.sin(x * 1.18 + z * 0.42) * 0.025);
    const shade = 0.83 + (Math.sin(x * 1.7 + z * 2.1) * 0.5 + 0.5) * 0.17;
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade * 0.97;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createGableGeometry(width: number, height: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-width / 2, 0, 0, width / 2, 0, 0, 0, height, 0], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createWindow(
  paneMaterial: MeshStandardMaterial,
  frameMaterial: MeshStandardMaterial,
): Group {
  const window = new Group();
  const pane = new Mesh(new PlaneGeometry(0.5, 0.58), paneMaterial);
  window.add(pane);
  const horizontal = new BoxGeometry(0.62, 0.055, 0.055);
  const vertical = new BoxGeometry(0.055, 0.7, 0.055);
  for (const y of [-0.32, 0, 0.32]) {
    const frame = new Mesh(horizontal, frameMaterial);
    frame.position.set(0, y, 0.025);
    window.add(frame);
  }
  for (const x of [-0.28, 0, 0.28]) {
    const frame = new Mesh(vertical, frameMaterial);
    frame.position.set(x, 0, 0.025);
    window.add(frame);
  }
  return window;
}

function createBladeGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-0.045, 0, 0, 0.045, 0, 0, 0, 0.44, 0], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

export function createIsland(profile: QualityProfile): IslandAssembly {
  const root = new Group();
  root.name = 'floating-island';
  const breathingRoot = new Group();
  root.add(breathingRoot);
  const random = seededRandom(7831);

  const rockMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.015,
    flatShading: true,
  });
  const rock = new Mesh(createFacetedRockGeometry(), rockMaterial);
  breathingRoot.add(rock);

  const soilMaterial = new MeshStandardMaterial({
    color: '#50483a',
    roughness: 0.96,
    flatShading: true,
  });
  const soilEdge = new Mesh(new CylinderGeometry(5.06, 5.0, 0.3, 32, 1), soilMaterial);
  soilEdge.position.y = 0.08;
  breathingRoot.add(soilEdge);

  const grassMaterial = new MeshStandardMaterial({
    color: '#708b61',
    roughness: 0.94,
    vertexColors: true,
  });
  const grassCap = new Mesh(createIrregularCapGeometry(), grassMaterial);
  grassCap.position.y = 0.33;
  breathingRoot.add(grassCap);

  const strataMaterial = new MeshStandardMaterial({
    color: '#3f4848',
    roughness: 0.95,
    flatShading: true,
  });
  const cliffShardMaterial = new MeshStandardMaterial({
    color: '#5a6460',
    roughness: 0.92,
    flatShading: true,
  });
  const shardGeometry = new IcosahedronGeometry(0.48, 0);
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2 + random() * 0.18;
    const depth = 0.8 + random() * 3.4;
    const radius = 4.65 - depth * 0.72;
    const shard = new Mesh(shardGeometry, index % 3 === 0 ? strataMaterial : cliffShardMaterial);
    shard.position.set(Math.cos(angle) * radius, -depth, Math.sin(angle) * radius);
    shard.scale.set(0.48 + random() * 0.6, 0.3 + random() * 0.85, 0.42 + random() * 0.55);
    shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    breathingRoot.add(shard);
  }

  const pathMaterial = new MeshStandardMaterial({ color: '#a48c64', roughness: 0.98 });
  for (let index = 0; index < 14; index += 1) {
    const progress = index / 13;
    const stone = new Mesh(new CylinderGeometry(0.2, 0.27, 0.075, 8), pathMaterial);
    stone.position.set(
      -3.75 + progress * 4.95,
      0.57,
      2.65 - progress * 1.48 + Math.sin(progress * Math.PI) * 0.22,
    );
    stone.rotation.y = random() * Math.PI;
    stone.scale.set(0.82 + random() * 0.4, 1, 0.76 + random() * 0.45);
    breathingRoot.add(stone);
  }

  const puddleMaterial = new MeshStandardMaterial({
    color: '#9cb8b2',
    emissive: '#355b56',
    emissiveIntensity: 0.12,
    roughness: 0.06,
    metalness: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const puddleIceMaterial = new MeshStandardMaterial({
    color: '#c8dedd',
    emissive: '#789fa2',
    emissiveIntensity: 0.18,
    roughness: 0.2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  const puddleGroup = new Group();
  puddleGroup.name = 'main-island-puddles';
  const puddleIceGroup = new Group();
  puddleIceGroup.name = 'main-island-puddle-ice';
  const puddleSurfaces: Array<{ water: Mesh; ice: Mesh; stretch: number }> = [];
  for (const [x, z, radius, stretch, rotation] of [
    [-3.42, 1.18, 0.72, 0.5, 0.18],
    [-2.42, 2.28, 0.62, 0.42, -0.34],
    [-0.82, 1.92, 0.5, 0.36, 0.58],
    [1.7, 2.18, 0.66, 0.4, -0.22],
    [2.94, 1.02, 0.56, 0.34, 0.42],
    [3.38, -0.82, 0.48, 0.3, -0.46],
  ] as const) {
    const puddle = new Mesh(new CircleGeometry(radius, 18), puddleMaterial);
    puddle.position.set(x, 0.59, z);
    puddle.rotation.set(-Math.PI / 2, 0, rotation);
    puddle.scale.y = stretch;
    puddle.renderOrder = 2;
    puddleGroup.add(puddle);
    const ice = new Mesh(new CircleGeometry(radius, 18), puddleIceMaterial);
    ice.position.set(x, 0.596, z);
    ice.rotation.set(-Math.PI / 2, 0, rotation);
    ice.scale.y = stretch;
    ice.renderOrder = 3;
    puddleIceGroup.add(ice);
    puddleSurfaces.push({ water: puddle, ice, stretch });
  }
  breathingRoot.add(puddleGroup, puddleIceGroup);

  const snowMaterial = new MeshStandardMaterial({
    color: '#e3ece8',
    roughness: 0.86,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const snowAccentMaterial = new MeshStandardMaterial({
    color: '#f2f5f2',
    roughness: 0.78,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const house = new Group();
  house.position.set(0.82, 0.47, 0.16);
  const wallMaterial = new MeshStandardMaterial({ color: '#a27d59', roughness: 0.86 });
  const timberMaterial = new MeshStandardMaterial({ color: '#4b372d', roughness: 0.9 });
  const roofMaterial = new MeshStandardMaterial({ color: '#514748', roughness: 0.84 });
  const foundationMaterial = new MeshStandardMaterial({ color: '#6e706a', roughness: 0.96 });
  const foundation = new Mesh(new BoxGeometry(2.72, 0.28, 2.08), foundationMaterial);
  foundation.position.y = 0.14;
  house.add(foundation);
  const walls = new Mesh(new BoxGeometry(2.5, 1.55, 1.9), wallMaterial);
  walls.position.y = 0.92;
  house.add(walls);

  const gableGeometry = createGableGeometry(2.5, 0.82);
  for (const z of [-0.956, 0.956]) {
    const gable = new Mesh(gableGeometry, wallMaterial);
    gable.position.set(0, 1.695, z);
    gable.material.side = DoubleSide;
    house.add(gable);
  }

  for (const side of [-1, 1]) {
    const roofPanel = new Mesh(new BoxGeometry(1.58, 0.13, 2.25), roofMaterial);
    roofPanel.position.set(side * 0.65, 2.08, 0);
    roofPanel.rotation.z = side * -0.55;
    house.add(roofPanel);
    const gutter = new Mesh(new CylinderGeometry(0.045, 0.045, 2.28, 7), roofMaterial);
    gutter.position.set(side * 1.34, 1.66, 0);
    gutter.rotation.x = Math.PI / 2;
    const snowRoof = new Mesh(new BoxGeometry(1.5, 0.055, 2.18), snowAccentMaterial);
    snowRoof.position.set(side * 0.65, 2.17, 0);
    snowRoof.rotation.z = side * -0.55;
    house.add(gutter, snowRoof);
  }
  const ridge = new Mesh(new CylinderGeometry(0.105, 0.105, 2.32, 8), roofMaterial);
  ridge.position.y = 2.5;
  ridge.rotation.x = Math.PI / 2;
  const snowRidge = new Mesh(new CylinderGeometry(0.08, 0.08, 2.25, 8), snowAccentMaterial);
  snowRidge.position.y = 2.59;
  snowRidge.rotation.x = Math.PI / 2;
  house.add(ridge, snowRidge);

  const cornerPostGeometry = new BoxGeometry(0.09, 1.52, 0.09);
  for (const x of [-1.19, 1.19]) {
    for (const z of [-0.91, 0.91]) {
      const post = new Mesh(cornerPostGeometry, timberMaterial);
      post.position.set(x, 0.93, z);
      house.add(post);
    }
  }
  for (const z of [-0.963, 0.963]) {
    const crossBeam = new Mesh(new BoxGeometry(2.46, 0.1, 0.08), timberMaterial);
    crossBeam.position.set(0, 1.66, z);
    house.add(crossBeam);
  }
  for (const y of [0.48, 0.82, 1.16, 1.5]) {
    const frontSeam = new Mesh(new BoxGeometry(2.28, 0.022, 0.026), timberMaterial);
    frontSeam.position.set(0, y, 0.968);
    frontSeam.scale.y = 0.55;
    house.add(frontSeam);
    const sideSeam = new Mesh(new BoxGeometry(0.026, 0.022, 1.72), timberMaterial);
    sideSeam.position.set(1.268, y, 0);
    sideSeam.scale.y = 0.55;
    house.add(sideSeam);
  }
  const gablePost = new Mesh(new BoxGeometry(0.075, 0.84, 0.06), timberMaterial);
  gablePost.position.set(0, 2.08, 0.982);
  house.add(gablePost);
  for (const side of [-1, 1]) {
    const gableTrim = new Mesh(new BoxGeometry(1.42, 0.065, 0.065), timberMaterial);
    gableTrim.position.set(side * 0.59, 2.08, 0.986);
    gableTrim.rotation.z = side * -0.55;
    house.add(gableTrim);
    for (let row = 0; row < 6; row += 1) {
      const distance = 0.18 + row * 0.2;
      const tileRow = new Mesh(new BoxGeometry(0.045, 0.045, 2.16), timberMaterial);
      tileRow.position.set(side * distance, 2.49 - distance * Math.tan(0.55) + 0.035, 0);
      tileRow.rotation.z = side * -0.55;
      house.add(tileRow);
    }
  }

  const chimney = new Mesh(new BoxGeometry(0.32, 0.88, 0.36), foundationMaterial);
  chimney.position.set(0.62, 2.33, -0.28);
  house.add(chimney);
  const chimneyCap = new Mesh(new BoxGeometry(0.44, 0.12, 0.46), roofMaterial);
  chimneyCap.position.set(0.62, 2.8, -0.28);
  const chimneySnow = new Mesh(new BoxGeometry(0.48, 0.055, 0.5), snowAccentMaterial);
  chimneySnow.position.set(0.62, 2.89, -0.28);
  house.add(chimneyCap, chimneySnow);

  const windowMaterial = new MeshStandardMaterial({
    color: '#f6cc7e',
    emissive: '#f0a941',
    emissiveIntensity: 1,
    roughness: 0.34,
  });
  const frontWindow = createWindow(windowMaterial, timberMaterial);
  frontWindow.position.set(-0.48, 1.03, 0.958);
  house.add(frontWindow);
  const planterMaterial = new MeshStandardMaterial({ color: '#5b3d2d', roughness: 0.92 });
  const planterLeafMaterial = new MeshStandardMaterial({ color: '#55744e', roughness: 0.88 });
  const planterBlossomMaterial = new MeshStandardMaterial({ color: '#d9b3b0', roughness: 0.76 });
  const planter = new Mesh(new BoxGeometry(0.86, 0.16, 0.2), planterMaterial);
  planter.position.set(-0.48, 0.6, 1.06);
  house.add(planter);
  for (let index = 0; index < 5; index += 1) {
    const plant = new Group();
    plant.position.set(-0.8 + index * 0.16, 0.72 + (index % 2) * 0.04, 1.11);
    const leaves = new Mesh(new SphereGeometry(0.085, 7, 5), planterLeafMaterial);
    leaves.scale.set(1, 0.8, 0.8);
    const blossom = new Mesh(new SphereGeometry(0.038, 7, 5), planterBlossomMaterial);
    blossom.position.y = 0.08;
    plant.add(leaves, blossom);
    house.add(plant);
  }
  const sideWindow = createWindow(windowMaterial, timberMaterial);
  sideWindow.position.set(1.258, 1.04, -0.18);
  sideWindow.rotation.y = Math.PI / 2;
  house.add(sideWindow);

  const door = new Mesh(new BoxGeometry(0.58, 1.08, 0.08), timberMaterial);
  door.position.set(0.5, 0.71, 0.988);
  house.add(door);
  for (const y of [0.42, 0.72, 1.02]) {
    const doorPanel = new Mesh(new BoxGeometry(0.4, 0.2, 0.025), roofMaterial);
    doorPanel.position.set(0.5, y, 1.035);
    house.add(doorPanel);
  }
  const doorLintel = new Mesh(new BoxGeometry(0.72, 0.08, 0.09), roofMaterial);
  doorLintel.position.set(0.5, 1.28, 1.01);
  house.add(doorLintel);
  const handleMaterial = new MeshStandardMaterial({
    color: '#d7b06c',
    roughness: 0.4,
    metalness: 0.4,
  });
  const doorHandle = new Mesh(new SphereGeometry(0.045, 8, 6), handleMaterial);
  doorHandle.position.set(0.69, 0.72, 1.045);
  house.add(doorHandle);
  const porch = new Mesh(new BoxGeometry(0.96, 0.13, 0.54), foundationMaterial);
  porch.position.set(0.5, 0.12, 1.17);
  const porchSnow = new Mesh(new BoxGeometry(0.9, 0.035, 0.5), snowMaterial);
  porchSnow.position.set(0.5, 0.205, 1.17);
  house.add(porch, porchSnow);

  const cabinLight = new PointLight('#ffb65a', 1.2, 7, 1.8);
  cabinLight.position.set(0.05, 1.25, 1.24);
  house.add(cabinLight);

  const smokePositions = new Float32Array(24 * 3);
  const smokeSeeds = new Float32Array(24);
  for (let index = 0; index < 24; index += 1) smokeSeeds[index] = random();
  const smokeGeometry = new BufferGeometry();
  smokeGeometry.setAttribute('position', new BufferAttribute(smokePositions, 3));
  const softParticleTexture = createRadialAlphaTexture();
  const smokeMaterial = new PointsMaterial({
    color: '#c7cfcb',
    size: 0.4,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    alphaMap: softParticleTexture,
    alphaTest: 0.015,
  });
  const smoke = new Points(smokeGeometry, smokeMaterial);
  smoke.frustumCulled = false;
  house.add(smoke);
  breathingRoot.add(house);

  const trunkMaterial = new MeshStandardMaterial({ color: '#5b4434', roughness: 0.94 });
  const baseLeafColors = [new Color('#3f624b'), new Color('#557759'), new Color('#6f895f')];
  const frostLeafColors = [new Color('#789082'), new Color('#8ea092'), new Color('#a3ae9a')];
  const leafMaterials = baseLeafColors.map(
    (color, index) =>
      new MeshStandardMaterial({
        color,
        roughness: index === 2 ? 0.9 : 0.88,
        flatShading: true,
      }),
  );
  const treeSpecs = [
    [-2.6, -0.72, 1.04, 0.4],
    [-1.72, -1.94, 0.76, 2.1],
    [2.98, -1.15, 0.67, 4.2],
    [3.12, 1.26, 0.53, 5.5],
    [-3.42, 1.25, 0.57, 3.3],
  ] as const;
  const treeBatch = createInstancedTreeBatch(
    treeSpecs.map(([x, z, scale, phase]) => ({ x, y: 0.46, z, scale, phase })),
    trunkMaterial,
    leafMaterials,
    snowAccentMaterial,
  );
  breathingRoot.add(treeBatch.root);
  const canopySnowGeometry = new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);

  const bladeMaterial = new MeshStandardMaterial({
    color: '#82a269',
    roughness: 0.9,
    side: DoubleSide,
  });
  const bladePoses: BladePose[] = [];
  while (bladePoses.length < 220) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 4.65;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const insideHouse = x > -0.7 && x < 2.35 && z > -1.0 && z < 1.65;
    const insidePond = ((x + 3.67) / 1.2) ** 2 + ((z - 0.82) / 0.72) ** 2 < 1;
    const insideWell = (x + 0.72) ** 2 + (z + 2.68) ** 2 < 0.9 ** 2;
    const insideCampfire = (x + 2.18) ** 2 + (z - 0.15) ** 2 < 0.82 ** 2;
    const insideBench = Math.abs(x - 1.08) < 0.92 && Math.abs(z - 3.28) < 0.55;
    const insideLookout = (x - 2.96) ** 2 + (z - 2.72) ** 2 < 1.05 ** 2;
    if (insideHouse || insidePond || insideWell || insideCampfire || insideBench || insideLookout)
      continue;
    bladePoses.push({
      x,
      z,
      scale: 0.58 + random() * 0.92,
      yaw: random() * Math.PI,
      lean: (random() - 0.5) * 0.16,
      phase: random() * Math.PI * 2,
    });
  }
  const grassBlades = new InstancedMesh(createBladeGeometry(), bladeMaterial, bladePoses.length);
  grassBlades.name = 'grass-blades';
  const bladeDummy = new Object3D();
  for (let index = 0; index < bladePoses.length; index += 1) {
    const pose = bladePoses[index];
    if (!pose) continue;
    bladeDummy.position.set(pose.x, 0.54, pose.z);
    bladeDummy.rotation.set(0, pose.yaw, pose.lean);
    bladeDummy.scale.set(1, pose.scale, 1);
    bladeDummy.updateMatrix();
    grassBlades.setMatrixAt(index, bladeDummy.matrix);
  }
  grassBlades.instanceMatrix.needsUpdate = true;
  breathingRoot.add(grassBlades);

  const flowerGeometry = new SphereGeometry(0.055, 7, 5);
  const flowerMaterials = [
    new MeshStandardMaterial({ color: '#d8b6c4', roughness: 0.78 }),
    new MeshStandardMaterial({ color: '#d8cd91', roughness: 0.78 }),
  ];
  for (let index = 0; index < 24; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.8 + random() * 2.55;
    const flower = new Mesh(flowerGeometry, flowerMaterials[index % 2]);
    flower.position.set(Math.cos(angle) * radius, 0.64, Math.sin(angle) * radius);
    flower.scale.setScalar(0.72 + random() * 0.5);
    breathingRoot.add(flower);
  }

  const stoneMaterial = new MeshStandardMaterial({ color: '#7b8179', roughness: 0.96 });
  for (const [x, z, size] of [
    [-4.18, -0.18, 0.38],
    [3.48, 0.06, 0.62],
    [-0.38, -3.64, 0.42],
    [2.08, 3.14, 0.34],
  ] as const) {
    const boulder = new Mesh(new IcosahedronGeometry(size, 1), stoneMaterial);
    boulder.position.set(x, 0.64, z);
    boulder.scale.y = 0.72;
    boulder.rotation.set(random(), random(), random());
    breathingRoot.add(boulder);
    const snowCap = new Mesh(
      new SphereGeometry(size * 0.78, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      snowAccentMaterial,
    );
    snowCap.position.set(x, 0.64 + size * 0.38, z);
    snowCap.scale.set(1, 0.22, 0.82);
    snowCap.rotation.y = boulder.rotation.y;
    breathingRoot.add(snowCap);
  }

  for (const [x, z, radius, stretch] of [
    [-2.0, 0.15, 1.18, 0.76],
    [2.65, -0.18, 1.04, 0.68],
    [0.1, -2.72, 0.92, 0.84],
    [-3.2, 2.0, 0.82, 0.74],
    [2.1, 2.46, 0.78, 0.8],
    [-0.45, 2.65, 0.9, 0.66],
    [3.45, 0.95, 0.72, 0.62],
    [-2.85, -2.35, 0.7, 0.76],
    [1.35, -2.45, 0.76, 0.72],
    [-3.85, 0.1, 0.58, 0.64],
  ] as const) {
    const patch = new Mesh(new CircleGeometry(radius, 14), snowMaterial);
    patch.position.set(x, 0.558, z);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = random() * Math.PI;
    patch.scale.y = stretch;
    breathingRoot.add(patch);
  }
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2 + 0.16;
    const bank = new Mesh(canopySnowGeometry, snowAccentMaterial);
    bank.position.set(Math.cos(angle) * 4.55, 0.57, Math.sin(angle) * 4.55);
    bank.scale.set(0.72, 0.09, 0.38);
    bank.rotation.y = -angle;
    breathingRoot.add(bank);
  }

  const details = createIslandDetails(profile);
  const waterfall = createWaterfall(profile);
  breathingRoot.add(details.root, waterfall.root);

  const fireflyBase = new Float32Array(88 * 3);
  const fireflyPositions = new Float32Array(88 * 3);
  for (let index = 0; index < 88; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.4 + random() * 4.2;
    fireflyBase[index * 3] = Math.cos(angle) * radius;
    fireflyBase[index * 3 + 1] = 1 + random() * 3.8;
    fireflyBase[index * 3 + 2] = Math.sin(angle) * radius;
    fireflyPositions.set(fireflyBase.subarray(index * 3, index * 3 + 3), index * 3);
  }
  const fireflyGeometry = new BufferGeometry();
  fireflyGeometry.setAttribute('position', new BufferAttribute(fireflyPositions, 3));
  const fireflyMaterial = new PointsMaterial({
    color: '#ffd37f',
    size: 0.12,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    alphaMap: softParticleTexture,
    alphaTest: 0.015,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const fireflies = new Points(fireflyGeometry, fireflyMaterial);
  breathingRoot.add(fireflies);

  let fireflyCount = profile.fireflies;
  const setQuality = (nextProfile: QualityProfile) => {
    fireflyCount = nextProfile.fireflies;
    fireflyGeometry.setDrawRange(0, fireflyCount);
    details.setQuality(nextProfile);
    waterfall.setQuality(nextProfile);
    treeBatch.setQuality(nextProfile);
    grassBlades.count = Math.min(bladePoses.length, nextProfile.grassBlades);
    enableShadows(breathingRoot, nextProfile.shadows);
    cabinLight.castShadow = false;
  };
  setQuality(profile);

  const baseGrass = new Color('#708b61');
  const wetGrass = new Color('#344d3d');
  const baseSoil = new Color('#50483a');
  const wetSoil = new Color('#302f29');
  const basePath = new Color('#a48c64');
  const wetPath = new Color('#4e4c43');
  const dryRockTint = new Color('#ffffff');
  const wetRockTint = new Color('#b3c2bc');
  const baseWall = new Color('#a27d59');
  const wetWall = new Color('#806246');
  const baseRoof = new Color('#514748');
  const wetRoof = new Color('#37373b');
  const baseStone = new Color('#7b8179');
  const wetStone = new Color('#555d59');
  const frostGrass = new Color('#b8c5ba');
  return {
    root,
    setQuality,
    getEffectCount: () => fireflyCount + details.getParticleCount() + waterfall.getParticleCount(),
    update(signals, elapsed) {
      const pulse = Math.sin(elapsed * 2.05) * signals.islandBreath;
      breathingRoot.scale.setScalar(1 + pulse);
      root.position.y = Math.sin(elapsed * 0.42) * 0.075 * signals.motionScale;
      details.update(signals, elapsed);
      waterfall.update(signals, elapsed);

      treeBatch.update(signals, elapsed);

      for (let index = 0; index < grassBlades.count; index += 1) {
        const pose = bladePoses[index];
        if (!pose) continue;
        const wave =
          signals.windStrength * 0.085 +
          Math.sin(elapsed * (1.5 + signals.windStrength * 2.3) + pose.phase + pose.x * 0.22) *
            signals.plantSway *
            0.86;
        bladeDummy.position.set(pose.x, 0.54, pose.z);
        bladeDummy.rotation.set(
          Math.cos(elapsed * 1.08 + pose.phase) * signals.plantSway * 0.22,
          pose.yaw,
          pose.lean - wave,
        );
        bladeDummy.scale.set(1, pose.scale, 1);
        bladeDummy.updateMatrix();
        grassBlades.setMatrixAt(index, bladeDummy.matrix);
      }
      grassBlades.instanceMatrix.needsUpdate = true;

      for (let index = 0; index < smokeSeeds.length; index += 1) {
        const seed = smokeSeeds[index] ?? 0;
        const phase = (elapsed * 0.12 + seed) % 1;
        smokePositions[index * 3] =
          0.62 - signals.windStrength * phase * 1.65 + Math.sin(phase * 9 + seed * 8) * 0.08;
        smokePositions[index * 3 + 1] = 2.9 + phase * 2.1;
        smokePositions[index * 3 + 2] =
          -0.28 - signals.windStrength * phase * 0.42 + Math.cos(phase * 7 + seed * 5) * 0.06;
      }
      const smokePositionAttribute = smokeGeometry.attributes.position;
      if (smokePositionAttribute) smokePositionAttribute.needsUpdate = true;

      windowMaterial.emissiveIntensity = 0.18 + signals.cabinLight * 2.35;
      cabinLight.intensity = signals.cabinLight * 2.15;
      smokeMaterial.opacity = (0.045 + signals.cabinLight * 0.1) * (1 - signals.rain * 0.38);
      grassMaterial.color.copy(baseGrass).lerp(wetGrass, signals.wetness * 0.92);
      grassMaterial.color.lerp(frostGrass, signals.snowCover * 0.72);
      grassMaterial.roughness = 0.94 - signals.wetness * 0.48;
      bladeMaterial.color.copy(baseGrass).offsetHSL(0.01, 0.05, 0.035);
      bladeMaterial.color.lerp(wetGrass, signals.wetness * 0.78);
      bladeMaterial.color.lerp(frostGrass, signals.snowCover * 0.78);
      bladeMaterial.roughness = 0.9 - signals.wetness * 0.36;
      wallMaterial.color.copy(baseWall).lerp(wetWall, signals.wetness * 0.55);
      wallMaterial.roughness = 0.86 - signals.wetness * 0.18;
      roofMaterial.color.copy(baseRoof).lerp(wetRoof, signals.wetness * 0.7);
      roofMaterial.roughness = 0.84 - signals.wetness * 0.34;
      soilMaterial.color.copy(baseSoil).lerp(wetSoil, signals.wetness * 0.9);
      soilMaterial.roughness = 0.96 - signals.wetness * 0.4;
      rockMaterial.color.copy(dryRockTint).lerp(wetRockTint, signals.wetness * 0.78);
      rockMaterial.roughness = 0.88 - signals.wetness * 0.42;
      stoneMaterial.color.copy(baseStone).lerp(wetStone, signals.wetness * 0.72);
      stoneMaterial.roughness = 0.96 - signals.wetness * 0.3;
      pathMaterial.color.copy(basePath).lerp(wetPath, signals.wetness * 0.9);
      pathMaterial.roughness = 0.98 - signals.wetness * 0.52;
      const puddleGrowth = 0.4 + signals.puddleDepth * 0.7;
      puddleMaterial.opacity = signals.puddleDepth * (1 - signals.iceCover * 0.52) * 0.58;
      puddleMaterial.emissiveIntensity = 0.07 + signals.daylight * 0.08;
      puddleIceMaterial.opacity = signals.iceCover * 0.84;
      for (const surface of puddleSurfaces) {
        surface.water.scale.set(puddleGrowth, surface.stretch * puddleGrowth, 1);
        surface.ice.scale.set(puddleGrowth * 1.015, surface.stretch * puddleGrowth * 1.015, 1);
      }
      snowMaterial.opacity = signals.snowCover * 0.9;
      snowAccentMaterial.opacity = signals.snowCover * 0.96;
      for (let index = 0; index < leafMaterials.length; index += 1) {
        const material = leafMaterials[index];
        const base = baseLeafColors[index];
        const frost = frostLeafColors[index];
        if (!material || !base || !frost) continue;
        material.color.copy(base).lerp(frost, signals.snowCover * 0.48);
      }
      fireflyMaterial.opacity = 0.02 + signals.fireflyActivity * 0.9;
      fireflyMaterial.size = 0.08 + signals.sparkleBrightness * 0.11;

      const positions = fireflyGeometry.attributes.position;
      if (positions) {
        for (let index = 0; index < fireflyCount; index += 1) {
          const offset = index * 3;
          positions.setXYZ(
            index,
            (fireflyBase[offset] ?? 0) + Math.sin(elapsed * 0.7 + index) * 0.12,
            (fireflyBase[offset + 1] ?? 0) + Math.sin(elapsed * 1.1 + index * 1.7) * 0.16,
            (fireflyBase[offset + 2] ?? 0) + Math.cos(elapsed * 0.62 + index) * 0.12,
          );
        }
        positions.needsUpdate = true;
      }
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
