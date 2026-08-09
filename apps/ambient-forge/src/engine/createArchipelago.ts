import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { disposeObject3D } from './dispose';

export interface ArchipelagoAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getEffectCount: () => number;
  dispose: () => void;
}

interface FloatingIsland {
  root: Group;
  baseY: number;
  phase: number;
}

interface SwayingTree {
  root: Group;
  phase: number;
}

const UP = new Vector3(0, 1, 0);

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function setShadows(root: Group, enabled: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = enabled;
    object.receiveShadow = enabled;
  });
}

function createBeamBetween(
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial,
): Mesh {
  const direction = new Vector3().subVectors(end, start);
  const beam = new Mesh(new CylinderGeometry(radius, radius, direction.length(), 6), material);
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(UP, direction.normalize());
  return beam;
}

function createIslandBase(
  name: string,
  radius: number,
  depth: number,
  groundMaterial: MeshStandardMaterial,
  rockMaterial: MeshStandardMaterial,
  snowMaterial: MeshStandardMaterial,
  random: () => number,
): Group {
  const island = new Group();
  island.name = name;
  const underside = new Mesh(
    new CylinderGeometry(radius * 0.92, radius * 0.12, depth, 12, 3),
    rockMaterial,
  );
  underside.position.y = -depth * 0.5 + 0.03;
  underside.rotation.y = random() * 0.3;
  island.add(underside);

  const cap = new Mesh(new CylinderGeometry(radius, radius * 0.92, 0.3, 14), groundMaterial);
  cap.position.y = 0.15;
  cap.rotation.y = random() * 0.2;
  island.add(cap);

  const snowCap = new Mesh(
    new CylinderGeometry(radius * 0.97, radius * 0.9, 0.045, 14),
    snowMaterial,
  );
  snowCap.position.y = 0.325;
  island.add(snowCap);

  const shardGeometry = new IcosahedronGeometry(radius * 0.22, 0);
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + random() * 0.5;
    const shard = new Mesh(shardGeometry, rockMaterial);
    shard.position.set(
      Math.cos(angle) * radius * (0.45 + random() * 0.2),
      -depth * (0.34 + random() * 0.36),
      Math.sin(angle) * radius * (0.45 + random() * 0.2),
    );
    shard.scale.set(0.7 + random() * 0.5, 0.6 + random() * 0.9, 0.72 + random() * 0.45);
    shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    island.add(shard);
  }
  return island;
}

function createTree(
  trunkMaterial: MeshStandardMaterial,
  foliageMaterial: MeshStandardMaterial,
  snowMaterial: MeshStandardMaterial,
  scale: number,
  phase: number,
): SwayingTree {
  const tree = new Group();
  tree.scale.setScalar(scale);
  const trunk = new Mesh(new CylinderGeometry(0.1, 0.18, 1.25, 7), trunkMaterial);
  trunk.position.y = 0.92;
  tree.add(trunk);
  const crownGeometry = new IcosahedronGeometry(0.58, 1);
  for (const [x, y, z, crownScale] of [
    [-0.28, 1.62, 0, 0.82],
    [0.28, 1.68, 0.06, 0.76],
    [0, 2.02, -0.04, 0.9],
  ] as const) {
    const crown = new Mesh(crownGeometry, foliageMaterial);
    crown.position.set(x, y, z);
    crown.scale.setScalar(crownScale);
    tree.add(crown);
    const snow = new Mesh(
      new SphereGeometry(0.47, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      snowMaterial,
    );
    snow.position.set(x, y + 0.17, z);
    snow.scale.set(crownScale, crownScale * 0.24, crownScale * 0.82);
    tree.add(snow);
  }
  return { root: tree, phase };
}

function createSuspensionBridge(
  start: Vector3,
  end: Vector3,
  timberMaterial: MeshStandardMaterial,
  ropeMaterial: MeshStandardMaterial,
  snowMaterial: MeshStandardMaterial,
): Group {
  const bridge = new Group();
  bridge.name = 'garden-suspension-bridge';
  const direction = new Vector3().subVectors(end, start);
  const yaw = -Math.atan2(direction.z, direction.x);
  const side = new Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(0.38);
  const points: Vector3[] = [];
  const plankCount = 13;
  for (let index = 0; index < plankCount; index += 1) {
    const progress = index / (plankCount - 1);
    const point = new Vector3().lerpVectors(start, end, progress);
    point.y -= Math.sin(progress * Math.PI) * 0.34;
    points.push(point);
    const plank = new Mesh(new BoxGeometry(0.25, 0.085, 0.72), timberMaterial);
    plank.position.copy(point);
    plank.rotation.y = yaw;
    plank.rotation.z = Math.sin((progress - 0.5) * Math.PI) * 0.08;
    bridge.add(plank);
    const snow = new Mesh(new BoxGeometry(0.23, 0.025, 0.67), snowMaterial);
    snow.position.copy(point).add(new Vector3(0, 0.056, 0));
    snow.rotation.y = yaw;
    snow.rotation.z = plank.rotation.z;
    bridge.add(snow);
  }
  for (const sideDirection of [-1, 1]) {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (!previous || !current) continue;
      const railStart = previous
        .clone()
        .addScaledVector(side, sideDirection)
        .add(new Vector3(0, 0.48, 0));
      const railEnd = current
        .clone()
        .addScaledVector(side, sideDirection)
        .add(new Vector3(0, 0.48, 0));
      bridge.add(createBeamBetween(railStart, railEnd, 0.022, ropeMaterial));
    }
    for (const endpoint of [start, end]) {
      const post = new Mesh(new CylinderGeometry(0.05, 0.07, 0.9, 7), timberMaterial);
      post.position
        .copy(endpoint)
        .addScaledVector(side, sideDirection)
        .add(new Vector3(0, 0.42, 0));
      bridge.add(post);
    }
  }
  return bridge;
}

export function createArchipelago(profile: QualityProfile): ArchipelagoAssembly {
  const root = new Group();
  root.name = 'floating-archipelago';
  const random = seededRandom(284071);
  const floatingIslands: FloatingIsland[] = [];
  const swayingTrees: SwayingTree[] = [];
  const lanternLights: PointLight[] = [];
  const farIslands: Group[] = [];

  const rockMaterial = new MeshStandardMaterial({
    color: '#596563',
    roughness: 0.92,
    flatShading: true,
  });
  const groundMaterial = new MeshStandardMaterial({
    color: '#6f875f',
    roughness: 0.94,
    flatShading: true,
  });
  const stoneMaterial = new MeshStandardMaterial({
    color: '#77807c',
    roughness: 0.9,
    flatShading: true,
  });
  const timberMaterial = new MeshStandardMaterial({ color: '#4c362a', roughness: 0.88 });
  const ropeMaterial = new MeshStandardMaterial({ color: '#625143', roughness: 1 });
  const foliageMaterial = new MeshStandardMaterial({
    color: '#527357',
    roughness: 0.9,
    flatShading: true,
  });
  const roofMaterial = new MeshStandardMaterial({ color: '#51474a', roughness: 0.74 });
  const snowMaterial = new MeshStandardMaterial({
    color: '#edf3f0',
    roughness: 0.78,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const lanternMaterial = new MeshStandardMaterial({
    color: '#f2c977',
    emissive: '#ef9b3d',
    emissiveIntensity: 0.45,
    roughness: 0.38,
  });
  const crystalMaterial = new MeshStandardMaterial({
    color: '#83b8b6',
    emissive: '#3e7f83',
    emissiveIntensity: 0.48,
    roughness: 0.22,
    metalness: 0.12,
  });
  const waterMaterial = new MeshStandardMaterial({
    color: '#618f91',
    roughness: 0.16,
    metalness: 0.08,
    transparent: true,
    opacity: 0.72,
    side: DoubleSide,
  });

  const garden = createIslandBase(
    'lantern-garden-island',
    2.05,
    2.5,
    groundMaterial,
    rockMaterial,
    snowMaterial,
    random,
  );
  const gardenBaseY = -0.7;
  garden.position.set(8.05, gardenBaseY, 1.12);
  garden.userData.cameraView = 'garden';
  floatingIslands.push({ root: garden, baseY: gardenBaseY, phase: 0.7 });
  const terrace = new Mesh(new CylinderGeometry(1.02, 1.16, 0.18, 10), stoneMaterial);
  terrace.position.y = 0.42;
  garden.add(terrace);
  for (const [x, z] of [
    [-0.68, -0.68],
    [0.68, -0.68],
    [-0.68, 0.68],
    [0.68, 0.68],
  ] as const) {
    const post = new Mesh(new CylinderGeometry(0.075, 0.1, 1.34, 7), timberMaterial);
    post.position.set(x, 1.12, z);
    garden.add(post);
  }
  const pavilionRoof = new Mesh(new ConeGeometry(1.32, 0.52, 4), roofMaterial);
  pavilionRoof.position.y = 1.92;
  pavilionRoof.rotation.y = Math.PI / 4;
  garden.add(pavilionRoof);
  const pavilionSnow = new Mesh(new ConeGeometry(1.29, 0.16, 4), snowMaterial);
  pavilionSnow.position.y = 2.15;
  pavilionSnow.rotation.y = Math.PI / 4;
  garden.add(pavilionSnow);
  for (const x of [-0.42, 0.42]) {
    const lantern = new Mesh(new BoxGeometry(0.24, 0.38, 0.24), lanternMaterial);
    lantern.position.set(x, 1.17, 0.02);
    garden.add(lantern);
    const light = new PointLight('#ffb35a', 0, 4.8, 1.8);
    light.position.copy(lantern.position);
    garden.add(light);
    lanternLights.push(light);
  }
  for (const [x, z, scale, phase] of [
    [-1.18, 0.52, 0.72, 0.3],
    [1.2, -0.42, 0.66, 1.8],
  ] as const) {
    const tree = createTree(timberMaterial, foliageMaterial, snowMaterial, scale, phase);
    tree.root.position.set(x, 0.25, z);
    garden.add(tree.root);
    swayingTrees.push(tree);
  }

  const crystalIsland = createIslandBase(
    'crystal-grove-island',
    1.72,
    2.8,
    groundMaterial,
    rockMaterial,
    snowMaterial,
    random,
  );
  const crystalBaseY = -1.2;
  crystalIsland.position.set(-7.7, crystalBaseY, 3.45);
  crystalIsland.userData.cameraView = 'crystal';
  floatingIslands.push({ root: crystalIsland, baseY: crystalBaseY, phase: 2.2 });
  const crystalRing = new Mesh(new TorusGeometry(0.98, 0.09, 6, 16), stoneMaterial);
  crystalRing.position.y = 0.41;
  crystalRing.rotation.x = Math.PI / 2;
  crystalIsland.add(crystalRing);
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2 + 0.25;
    const height = 0.72 + (index % 3) * 0.3;
    const crystal = new Mesh(
      new ConeGeometry(0.2 + (index % 2) * 0.06, height, 5),
      crystalMaterial,
    );
    crystal.position.set(Math.cos(angle) * 0.7, 0.36 + height * 0.5, Math.sin(angle) * 0.7);
    crystal.rotation.z = Math.cos(angle) * 0.15;
    crystal.rotation.x = Math.sin(angle) * 0.12;
    crystalIsland.add(crystal);
  }
  const crystalTree = createTree(timberMaterial, foliageMaterial, snowMaterial, 0.7, 3.4);
  crystalTree.root.position.set(-0.92, 0.22, -0.42);
  crystalIsland.add(crystalTree.root);
  swayingTrees.push(crystalTree);

  const ruinIsland = createIslandBase(
    'ruined-pool-island',
    2.02,
    3.1,
    groundMaterial,
    rockMaterial,
    snowMaterial,
    random,
  );
  const ruinBaseY = -1.55;
  ruinIsland.position.set(2.35, ruinBaseY, -8.15);
  ruinIsland.userData.cameraView = 'ruins';
  floatingIslands.push({ root: ruinIsland, baseY: ruinBaseY, phase: 4.1 });
  const pool = new Mesh(new CircleGeometry(0.78, 18), waterMaterial);
  pool.position.set(0.45, 0.34, 0.35);
  pool.rotation.x = -Math.PI / 2;
  ruinIsland.add(pool);
  for (const x of [-0.72, 0.72]) {
    const column = new Mesh(new CylinderGeometry(0.16, 0.2, 1.55, 8), stoneMaterial);
    column.position.set(x, 1.08, -0.54);
    ruinIsland.add(column);
  }
  const lintel = new Mesh(new BoxGeometry(1.78, 0.22, 0.34), stoneMaterial);
  lintel.position.set(0, 1.88, -0.54);
  lintel.rotation.z = -0.04;
  ruinIsland.add(lintel);
  for (const [x, z, height] of [
    [-1.25, 0.42, 0.72],
    [1.24, -0.1, 0.54],
    [-0.96, -0.96, 0.42],
  ] as const) {
    const brokenColumn = new Mesh(new CylinderGeometry(0.13, 0.18, height, 7), stoneMaterial);
    brokenColumn.position.set(x, 0.34 + height * 0.5, z);
    brokenColumn.rotation.z = (x + z) * 0.06;
    ruinIsland.add(brokenColumn);
  }
  const ruinTree = createTree(timberMaterial, foliageMaterial, snowMaterial, 0.82, 5.6);
  ruinTree.root.position.set(-1.14, 0.22, 0.8);
  ruinIsland.add(ruinTree.root);
  swayingTrees.push(ruinTree);

  const bridge = createSuspensionBridge(
    new Vector3(4.5, 0.58, 1.08),
    new Vector3(6.15, -0.25, 1.11),
    timberMaterial,
    ropeMaterial,
    snowMaterial,
  );
  root.add(bridge);

  const farSpecs = [
    [-10.8, -6.2, -4.55, 0.68, 1.8],
    [10.6, -8.6, -4.8, 0.72, 0.4],
    [-3.7, -11.2, -5.05, 0.58, 2.9],
    [11.2, -7.4, -5.25, 0.62, 4.2],
    [-12.2, 1.8, -5.4, 0.52, 5.3],
  ] as const;
  for (let index = 0; index < farSpecs.length; index += 1) {
    const spec = farSpecs[index];
    if (!spec) continue;
    const [x, z, y, radius, phase] = spec;
    const farIsland = createIslandBase(
      `distant-island-${index + 1}`,
      radius,
      1.5 + radius,
      groundMaterial,
      rockMaterial,
      snowMaterial,
      random,
    );
    farIsland.position.set(x, y, z);
    const marker = new Mesh(
      index % 2 === 0
        ? new ConeGeometry(radius * 0.18, 0.56 + radius * 0.38, 6)
        : new CylinderGeometry(radius * 0.1, radius * 0.14, 0.5 + radius * 0.32, 7),
      index % 2 === 0 ? foliageMaterial : stoneMaterial,
    );
    marker.position.y = 0.64;
    farIsland.add(marker);
    farIslands.push(farIsland);
    floatingIslands.push({ root: farIsland, baseY: y, phase });
  }

  root.add(garden, crystalIsland, ruinIsland, ...farIslands);

  const baseGround = new Color('#6f875f');
  const wetGround = new Color('#425c48');
  const frostGround = new Color('#afbeb3');
  const baseRock = new Color('#596563');
  const wetRock = new Color('#414c4b');
  const baseFoliage = new Color('#527357');
  const wetFoliage = new Color('#36533f');
  const frostFoliage = new Color('#92a797');

  let visibleFarCount = farIslands.length;
  const setQuality = (nextProfile: QualityProfile) => {
    visibleFarCount = nextProfile.dprCap > 1.5 ? farIslands.length : nextProfile.dprCap > 1 ? 4 : 3;
    for (let index = 0; index < farIslands.length; index += 1) {
      const island = farIslands[index];
      if (island) island.visible = index < visibleFarCount;
    }
    setShadows(root, nextProfile.shadows);
  };
  setQuality(profile);

  return {
    root,
    setQuality,
    getEffectCount: () => visibleFarCount,
    update(signals, elapsed) {
      for (const island of floatingIslands) {
        island.root.position.y =
          island.baseY + Math.sin(elapsed * 0.28 + island.phase) * 0.06 * signals.motionScale;
        island.root.rotation.z =
          Math.sin(elapsed * 0.18 + island.phase * 1.4) * 0.006 * signals.motionScale;
      }
      for (const tree of swayingTrees) {
        tree.root.rotation.z =
          -signals.windStrength * 0.045 +
          Math.sin(elapsed * (1.1 + signals.windStrength) + tree.phase) * signals.plantSway * 0.72;
      }
      groundMaterial.color.copy(baseGround).lerp(wetGround, signals.wetness * 0.86);
      groundMaterial.color.lerp(frostGround, signals.snowCover * 0.7);
      groundMaterial.roughness = 0.94 - signals.wetness * 0.38;
      rockMaterial.color.copy(baseRock).lerp(wetRock, signals.wetness * 0.76);
      rockMaterial.roughness = 0.92 - signals.wetness * 0.32;
      foliageMaterial.color.copy(baseFoliage).lerp(wetFoliage, signals.wetness * 0.68);
      foliageMaterial.color.lerp(frostFoliage, signals.snowCover * 0.58);
      foliageMaterial.roughness = 0.9 - signals.wetness * 0.24;
      timberMaterial.roughness = 0.88 - signals.wetness * 0.28;
      stoneMaterial.roughness = 0.9 - signals.wetness * 0.32;
      snowMaterial.opacity = signals.snowCover * 0.94;
      waterMaterial.opacity = 0.66 + signals.rain * 0.18;
      crystalMaterial.emissiveIntensity =
        0.38 +
        signals.sparkleBrightness * 1.35 +
        Math.sin(elapsed * 1.8) * 0.08 * signals.motionScale;
      lanternMaterial.emissiveIntensity = 0.25 + signals.cabinLight * 1.7;
      for (const light of lanternLights) light.intensity = signals.cabinLight * 0.82;
    },
    dispose() {
      disposeObject3D(root);
    },
  };
}
