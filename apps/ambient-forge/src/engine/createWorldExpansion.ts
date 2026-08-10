import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { CameraViewId } from '../core/camera-tour';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { createWaterfall, type WaterfallAssembly } from './createWaterfall';
import { disposeObject3D } from './dispose';

export interface WorldExpansionAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number, delta: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getEffectCount: () => number;
  dispose: () => void;
}

interface FloatingFeature {
  root: Group;
  baseY: number;
  phase: number;
}

interface Bird {
  root: Group;
  leftWing: Mesh;
  rightWing: Mesh;
  phase: number;
  radius: number;
  height: number;
  speed: number;
}

interface PuddleRipple {
  mesh: Mesh;
  material: MeshBasicMaterial;
  phase: number;
}

interface PuddleSurface {
  water: Mesh;
  ice: Mesh;
  scaleX: number;
  scaleZ: number;
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
  segments = 7,
): Mesh {
  const direction = new Vector3().subVectors(end, start);
  const beam = new Mesh(
    new CylinderGeometry(radius, radius, direction.length(), segments),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(UP, direction.normalize());
  return beam;
}

function markLandmark(root: Group, view: CameraViewId): void {
  root.userData.cameraView = view;
}

function createIslandCore(
  name: string,
  view: CameraViewId,
  radius: number,
  depth: number,
  groundMaterial: MeshStandardMaterial,
  rockMaterial: MeshStandardMaterial,
  snowMaterial: MeshStandardMaterial,
  random: () => number,
): Group {
  const island = new Group();
  island.name = name;
  markLandmark(island, view);

  const underside = new Mesh(
    new CylinderGeometry(radius * 0.9, radius * 0.12, depth, 14, 4),
    rockMaterial,
  );
  underside.position.y = -depth * 0.5 + 0.03;
  underside.rotation.y = random() * 0.28;
  island.add(underside);

  const cap = new Mesh(new CylinderGeometry(radius, radius * 0.9, 0.34, 16), groundMaterial);
  cap.position.y = 0.16;
  cap.rotation.y = random() * 0.22;
  island.add(cap);

  const snowCap = new Mesh(
    new CylinderGeometry(radius * 0.97, radius * 0.88, 0.05, 16),
    snowMaterial,
  );
  snowCap.position.y = 0.355;
  island.add(snowCap);

  const shardGeometry = new IcosahedronGeometry(radius * 0.2, 0);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + random() * 0.42;
    const shard = new Mesh(shardGeometry, rockMaterial);
    shard.position.set(
      Math.cos(angle) * radius * (0.42 + random() * 0.26),
      -depth * (0.35 + random() * 0.46),
      Math.sin(angle) * radius * (0.42 + random() * 0.26),
    );
    shard.scale.set(0.62 + random() * 0.55, 0.75 + random() * 1.25, 0.64 + random() * 0.5);
    shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    island.add(shard);
  }
  return island;
}

function createWingGeometry(side: -1 | 1): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([0, 0, 0, side * 0.62, 0.05, -0.16, side * 0.18, 0.02, 0.28]),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createAirship(
  canvasMaterial: MeshStandardMaterial,
  timberMaterial: MeshStandardMaterial,
  brassMaterial: MeshStandardMaterial,
  lightMaterial: MeshStandardMaterial,
): { root: Group; propeller: Group; light: PointLight } {
  const airship = new Group();
  airship.name = 'expedition-airship';

  const balloon = new Mesh(new SphereGeometry(1, 18, 10), canvasMaterial);
  balloon.scale.set(2.15, 0.78, 0.78);
  balloon.rotation.z = 0.05;
  airship.add(balloon);

  for (const x of [-0.9, 0, 0.9]) {
    const band = new Mesh(new TorusGeometry(0.79, 0.035, 6, 20), brassMaterial);
    band.position.x = x;
    band.rotation.y = Math.PI / 2;
    band.scale.y = 0.96;
    airship.add(band);
  }

  const gondola = new Mesh(new BoxGeometry(1.25, 0.42, 0.58), timberMaterial);
  gondola.position.y = -1.12;
  airship.add(gondola);
  for (const x of [-0.46, 0.46]) {
    airship.add(
      createBeamBetween(
        new Vector3(x, -0.92, -0.22),
        new Vector3(x * 1.45, -0.42, -0.42),
        0.018,
        brassMaterial,
        5,
      ),
      createBeamBetween(
        new Vector3(x, -0.92, 0.22),
        new Vector3(x * 1.45, -0.42, 0.42),
        0.018,
        brassMaterial,
        5,
      ),
    );
  }

  const tail = new Mesh(new ConeGeometry(0.48, 0.78, 4), canvasMaterial);
  tail.position.x = -2.15;
  tail.rotation.z = -Math.PI / 2;
  airship.add(tail);

  const propeller = new Group();
  propeller.position.set(-0.78, -1.12, 0);
  const hub = new Mesh(new CylinderGeometry(0.08, 0.08, 0.24, 7), brassMaterial);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new Mesh(new BoxGeometry(0.07, 0.72, 0.025), brassMaterial);
    blade.rotation.z = angle;
    propeller.add(blade);
  }
  airship.add(propeller);

  const lamp = new Mesh(new SphereGeometry(0.09, 8, 6), lightMaterial);
  lamp.position.set(0.48, -1.34, 0.31);
  const light = new PointLight('#ffc36b', 0, 4.5, 2);
  light.position.copy(lamp.position);
  airship.add(lamp, light);
  return { root: airship, propeller, light };
}

export function createWorldExpansion(profile: QualityProfile): WorldExpansionAssembly {
  const root = new Group();
  root.name = 'world-expansion-layer';
  const random = seededRandom(930271);
  const floatingFeatures: FloatingFeature[] = [];
  const birds: Bird[] = [];
  const puddleRipples: PuddleRipple[] = [];
  const puddleSurfaces: PuddleSurface[] = [];

  const groundMaterial = new MeshStandardMaterial({
    color: '#66805f',
    roughness: 0.94,
    flatShading: true,
  });
  const rockMaterial = new MeshStandardMaterial({
    color: '#566260',
    roughness: 0.92,
    flatShading: true,
  });
  const stoneMaterial = new MeshStandardMaterial({
    color: '#76817d',
    roughness: 0.86,
    flatShading: true,
  });
  const darkStoneMaterial = new MeshStandardMaterial({
    color: '#263235',
    roughness: 0.96,
    flatShading: true,
  });
  const metalMaterial = new MeshStandardMaterial({
    color: '#809099',
    roughness: 0.35,
    metalness: 0.58,
  });
  const brassMaterial = new MeshStandardMaterial({
    color: '#a8894e',
    roughness: 0.34,
    metalness: 0.62,
  });
  const timberMaterial = new MeshStandardMaterial({ color: '#4b362b', roughness: 0.86 });
  const snowMaterial = new MeshStandardMaterial({
    color: '#eef4f0',
    roughness: 0.76,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const glassMaterial = new MeshStandardMaterial({
    color: '#8fc2c4',
    emissive: '#376f75',
    emissiveIntensity: 0.22,
    roughness: 0.18,
    metalness: 0.18,
    transparent: true,
    opacity: 0.72,
  });
  const lampMaterial = new MeshStandardMaterial({
    color: '#f0c878',
    emissive: '#f09a3c',
    emissiveIntensity: 0.42,
    roughness: 0.32,
  });

  const observatory = createIslandCore(
    'sky-observatory-island',
    'observatory',
    2.25,
    2.8,
    groundMaterial,
    rockMaterial,
    snowMaterial,
    random,
  );
  const observatoryBaseY = 4.05;
  observatory.position.set(-5.2, observatoryBaseY, -5.8);
  floatingFeatures.push({ root: observatory, baseY: observatoryBaseY, phase: 0.8 });

  const observatoryTerrace = new Mesh(new CylinderGeometry(1.45, 1.58, 0.24, 18), stoneMaterial);
  observatoryTerrace.position.y = 0.49;
  observatory.add(observatoryTerrace);
  const tower = new Mesh(new CylinderGeometry(0.88, 1.05, 1.15, 14), stoneMaterial);
  tower.position.y = 1.12;
  observatory.add(tower);
  const dome = new Mesh(
    new SphereGeometry(0.96, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    metalMaterial,
  );
  dome.position.y = 1.71;
  observatory.add(dome);
  const domeSnow = new Mesh(
    new SphereGeometry(0.98, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.55),
    snowMaterial,
  );
  domeSnow.position.y = 1.75;
  observatory.add(domeSnow);
  const domeSlit = new Mesh(new BoxGeometry(0.24, 0.86, 1.04), darkStoneMaterial);
  domeSlit.position.set(0.08, 2.08, 0.36);
  domeSlit.rotation.x = -0.23;
  observatory.add(domeSlit);
  const telescopeTube = createBeamBetween(
    new Vector3(0.06, 1.92, 0.18),
    new Vector3(0.22, 2.72, 1.22),
    0.12,
    brassMaterial,
    10,
  );
  const telescopeLens = new Mesh(new TorusGeometry(0.15, 0.025, 7, 18), glassMaterial);
  telescopeLens.position.set(0.22, 2.72, 1.22);
  telescopeLens.rotation.x = Math.PI / 2 - 0.65;
  observatory.add(telescopeTube, telescopeLens);
  const railing = new Mesh(new TorusGeometry(1.36, 0.035, 6, 32), brassMaterial);
  railing.position.y = 0.88;
  railing.rotation.x = Math.PI / 2;
  observatory.add(railing);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const post = new Mesh(new CylinderGeometry(0.025, 0.035, 0.5, 6), brassMaterial);
    post.position.set(Math.cos(angle) * 1.36, 0.66, Math.sin(angle) * 1.36);
    observatory.add(post);
  }
  const celestialRings = new Group();
  celestialRings.name = 'observatory-celestial-rings';
  celestialRings.position.set(-1.28, 1.08, -0.56);
  for (const [radius, x, y] of [
    [0.42, 0, 0],
    [0.34, Math.PI / 2, 0.28],
    [0.26, 0.5, Math.PI / 2],
  ] as const) {
    const ring = new Mesh(new TorusGeometry(radius, 0.025, 5, 28), brassMaterial);
    ring.rotation.set(x, y, 0);
    celestialRings.add(ring);
  }
  observatory.add(celestialRings);

  const cavern = createIslandCore(
    'waterfall-cavern-island',
    'cavern',
    2.7,
    3.65,
    groundMaterial,
    rockMaterial,
    snowMaterial,
    random,
  );
  const cavernBaseY = -3.85;
  cavern.position.set(4.6, cavernBaseY, 4.8);
  floatingFeatures.push({ root: cavern, baseY: cavernBaseY, phase: 3.7 });

  const caveMouth = new Mesh(new CircleGeometry(1.02, 24), darkStoneMaterial);
  caveMouth.name = 'cavern-mouth';
  caveMouth.position.set(1.42, -0.18, 1.42);
  caveMouth.rotation.y = Math.PI / 4;
  caveMouth.scale.y = 1.28;
  cavern.add(caveMouth);
  const caveArch = new Mesh(new TorusGeometry(1.08, 0.19, 7, 20, Math.PI), rockMaterial);
  caveArch.position.copy(caveMouth.position);
  caveArch.rotation.set(0, Math.PI / 4, Math.PI * 0.03);
  caveArch.scale.y = 1.28;
  cavern.add(caveArch);
  const caveLight = new PointLight('#73b8b6', 0.52, 5.5, 2);
  caveLight.position.set(0.98, -0.1, 0.98);
  cavern.add(caveLight);
  for (let index = 0; index < 5; index += 1) {
    const crystal = new Mesh(
      new ConeGeometry(0.1 + (index % 2) * 0.035, 0.42 + (index % 3) * 0.18, 5),
      glassMaterial,
    );
    crystal.position.set(0.78 + index * 0.18, -0.65 + (index % 2) * 0.08, 1.45 - index * 0.15);
    crystal.rotation.z = (index - 2) * 0.08;
    cavern.add(crystal);
  }
  const boardwalk = new Group();
  boardwalk.name = 'cavern-boardwalk';
  for (let index = 0; index < 8; index += 1) {
    const plank = new Mesh(new BoxGeometry(0.52, 0.08, 0.22), timberMaterial);
    plank.position.set(-0.2 + index * 0.3, 0.48 - index * 0.035, 0.62 + index * 0.22);
    plank.rotation.y = -0.64;
    boardwalk.add(plank);
  }
  cavern.add(boardwalk);
  const cavernPoolMaterial = new MeshStandardMaterial({
    color: '#4f8589',
    emissive: '#274f57',
    emissiveIntensity: 0.24,
    roughness: 0.2,
    transparent: true,
    opacity: 0.76,
    side: DoubleSide,
  });
  const cavernPool = new Mesh(new CircleGeometry(1.05, 24), cavernPoolMaterial);
  cavernPool.position.set(-0.88, 0.37, 0.08);
  cavernPool.rotation.x = -Math.PI / 2;
  cavernPool.scale.y = 0.62;
  cavern.add(cavernPool);

  const waterfall: WaterfallAssembly = createWaterfall(profile);
  waterfall.root.name = 'cavern-waterfall-system';
  waterfall.root.position.set(6.94, -3.82, 3.98);

  const puddleField = new Group();
  puddleField.name = 'weather-puddle-field';
  const puddleWaterSurfaces = new Group();
  puddleWaterSurfaces.name = 'puddle-water-surfaces';
  const puddleIceLayer = new Group();
  puddleIceLayer.name = 'puddle-ice-layer';
  const puddleMaterial = new MeshStandardMaterial({
    color: '#416f72',
    emissive: '#203e44',
    emissiveIntensity: 0.1,
    roughness: 0.16,
    metalness: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  const puddleIceMaterial = new MeshStandardMaterial({
    color: '#c2dcda',
    emissive: '#6e9ca0',
    emissiveIntensity: 0.18,
    roughness: 0.2,
    metalness: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  puddleField.add(puddleWaterSurfaces, puddleIceLayer);
  for (const [x, z, sx, sz] of [
    [-1.7, 1.2, 1.15, 0.48],
    [0.92, 1.72, 0.82, 0.42],
    [2.1, -0.72, 0.92, 0.38],
    [-2.35, -1.18, 0.68, 0.32],
    [0.25, -1.95, 0.72, 0.3],
    [3.12, 1.12, 0.54, 0.28],
  ] as const) {
    const puddle = new Mesh(new CircleGeometry(0.42, 20), puddleMaterial);
    puddle.position.set(x, 0.64, z);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(sx, sz, 1);
    puddle.renderOrder = 4;
    puddleWaterSurfaces.add(puddle);
    const ice = new Mesh(new CircleGeometry(0.42, 20), puddleIceMaterial);
    ice.position.set(x, 0.657, z);
    ice.rotation.x = -Math.PI / 2;
    ice.scale.set(sx, sz, 1);
    ice.renderOrder = 5;
    puddleIceLayer.add(ice);
    puddleSurfaces.push({ water: puddle, ice, scaleX: sx, scaleZ: sz });
    const rippleMaterial = new MeshBasicMaterial({
      color: '#acd0cc',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
    const ripple = new Mesh(new RingGeometry(0.06, 0.075, 20), rippleMaterial);
    ripple.position.set(x, 0.653, z);
    ripple.rotation.x = -Math.PI / 2;
    ripple.renderOrder = 5;
    ripple.name = `puddle-ripple-${puddleRipples.length}`;
    puddleField.add(ripple);
    puddleRipples.push({ mesh: ripple, material: rippleMaterial, phase: random() });
  }

  const cloudShadowGroup = new Group();
  cloudShadowGroup.name = 'moving-cloud-shadows';
  const cloudShadowMaterial = new MeshBasicMaterial({
    color: '#0b1a1c',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  for (let index = 0; index < 3; index += 1) {
    const shadow = new Mesh(new CircleGeometry(1.7 + index * 0.45, 18), cloudShadowMaterial);
    shadow.position.set(-6 + index * 5.4, 0.648 + index * 0.002, -1.3 + index * 1.2);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 0.46 + index * 0.08;
    cloudShadowGroup.add(shadow);
  }

  const birdFlock = new Group();
  birdFlock.name = 'bird-flock';
  const birdMaterial = new MeshBasicMaterial({
    color: '#1f2e32',
    side: DoubleSide,
  });
  const birdBodyGeometry = new ConeGeometry(0.055, 0.3, 5);
  birdBodyGeometry.rotateZ(-Math.PI / 2);
  for (let index = 0; index < 18; index += 1) {
    const bird = new Group();
    const body = new Mesh(birdBodyGeometry, birdMaterial);
    const leftWing = new Mesh(createWingGeometry(-1), birdMaterial);
    const rightWing = new Mesh(createWingGeometry(1), birdMaterial);
    bird.add(body, leftWing, rightWing);
    bird.scale.setScalar(0.46 + random() * 0.36);
    birdFlock.add(bird);
    birds.push({
      root: bird,
      leftWing,
      rightWing,
      phase: random() * Math.PI * 2,
      radius: 5.4 + random() * 5.2,
      height: 4.8 + random() * 3.2,
      speed: 0.11 + random() * 0.08,
    });
  }

  const airshipCanvasMaterial = new MeshStandardMaterial({
    color: '#7f7562',
    roughness: 0.76,
    flatShading: true,
  });
  const airship = createAirship(airshipCanvasMaterial, timberMaterial, brassMaterial, lampMaterial);
  airship.root.position.set(0, 8.6, -11.5);

  root.add(
    observatory,
    cavern,
    waterfall.root,
    puddleField,
    cloudShadowGroup,
    birdFlock,
    airship.root,
  );

  const baseGround = new Color('#66805f');
  const wetGround = new Color('#3d5847');
  const frostGround = new Color('#aebdb1');
  const baseRock = new Color('#566260');
  const wetRock = new Color('#394747');
  const baseAirshipCanvas = new Color('#7f7562');
  const wetAirshipCanvas = new Color('#555b57');
  let activeBirdCount = birds.length;
  let airshipVisible = true;

  const setQuality = (nextProfile: QualityProfile) => {
    activeBirdCount = nextProfile.dprCap > 1.5 ? birds.length : nextProfile.dprCap > 1 ? 11 : 6;
    airshipVisible = true;
    for (let index = 0; index < birds.length; index += 1) {
      const bird = birds[index];
      if (bird) bird.root.visible = index < activeBirdCount;
    }
    airship.root.visible = airshipVisible;
    cloudShadowGroup.visible = nextProfile.dprCap > 1;
    waterfall.setQuality(nextProfile);
    setShadows(root, nextProfile.shadows);
    puddleField.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    cloudShadowGroup.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
  };
  setQuality(profile);

  return {
    root,
    setQuality,
    getEffectCount: () => activeBirdCount + (airshipVisible ? 1 : 0) + puddleRipples.length,
    update(signals, elapsed, delta) {
      for (const feature of floatingFeatures) {
        feature.root.position.y =
          feature.baseY + Math.sin(elapsed * 0.24 + feature.phase) * 0.08 * signals.motionScale;
        feature.root.rotation.z =
          Math.sin(elapsed * 0.16 + feature.phase) * 0.007 * signals.motionScale;
      }
      groundMaterial.color.copy(baseGround).lerp(wetGround, signals.wetness * 0.84);
      groundMaterial.color.lerp(frostGround, signals.snowCover * 0.7);
      groundMaterial.roughness = 0.94 - signals.wetness * 0.4;
      rockMaterial.color.copy(baseRock).lerp(wetRock, signals.wetness * 0.78);
      rockMaterial.roughness = 0.92 - signals.wetness * 0.32;
      stoneMaterial.roughness = 0.86 - signals.wetness * 0.28;
      timberMaterial.roughness = 0.86 - signals.wetness * 0.26;
      snowMaterial.opacity = signals.snowCover * 0.94;
      glassMaterial.emissiveIntensity =
        0.18 + signals.sparkleBrightness * 0.9 + signals.cabinLight * 0.24;
      caveLight.intensity = 0.3 + signals.cabinLight * 0.62 + signals.sparkleBrightness * 0.28;
      cavernPoolMaterial.opacity = 0.7 + signals.rain * 0.18;
      cavernPool.rotation.z = Math.sin(elapsed * 0.24) * 0.018 * signals.motionScale;
      celestialRings.rotation.y +=
        delta * (0.08 + signals.sparkleBrightness * 0.16) * signals.motionScale;
      celestialRings.rotation.x = Math.sin(elapsed * 0.18) * 0.16 * signals.motionScale;

      const puddleGrowth = 0.35 + signals.puddleDepth * 0.75;
      puddleMaterial.opacity = signals.puddleDepth * (1 - signals.iceCover * 0.45) * 0.68;
      puddleMaterial.roughness = 0.22 - signals.puddleDepth * 0.12;
      puddleIceMaterial.opacity = signals.iceCover * 0.82;
      puddleIceMaterial.roughness = 0.28 - signals.iceCover * 0.12;
      for (const surface of puddleSurfaces) {
        surface.water.scale.set(surface.scaleX * puddleGrowth, surface.scaleZ * puddleGrowth, 1);
        surface.ice.scale.copy(surface.water.scale).multiplyScalar(1.015);
      }
      for (const ripple of puddleRipples) {
        const phase = (elapsed * (0.42 + signals.rain * 0.9) + ripple.phase) % 1;
        ripple.mesh.scale.setScalar(0.7 + phase * 5.2);
        ripple.material.opacity = signals.rain * (1 - phase) * 0.34 * (1 - signals.iceCover) ** 2;
      }
      cloudShadowMaterial.opacity = signals.cloudCover * signals.daylight * 0.11;
      for (let index = 0; index < cloudShadowGroup.children.length; index += 1) {
        const shadow = cloudShadowGroup.children[index];
        if (!shadow) continue;
        shadow.position.x =
          -7 + ((elapsed * (0.22 + signals.windStrength * 0.72) + index * 5.1) % 18);
        shadow.position.z = -2.2 + Math.sin(elapsed * 0.08 + index * 2.1) * 2.6;
      }

      const stormFlightScale = 1 - signals.rain * 0.34 - signals.snow * 0.18;
      for (let index = 0; index < activeBirdCount; index += 1) {
        const bird = birds[index];
        if (!bird) continue;
        const angle = elapsed * bird.speed * stormFlightScale + bird.phase;
        const centerX = index % 3 === 0 ? -3.2 : 0;
        const centerZ = index % 3 === 0 ? -3.8 : -0.6;
        bird.root.position.set(
          centerX + Math.cos(angle) * bird.radius - signals.windStrength * 0.8,
          bird.height + Math.sin(angle * 2.4 + bird.phase) * 0.42,
          centerZ + Math.sin(angle) * bird.radius,
        );
        bird.root.rotation.y = -angle + Math.PI / 2;
        bird.root.rotation.z = Math.sin(angle * 1.7) * 0.14 - signals.windStrength * 0.08;
        const flap = 0.16 + Math.sin(elapsed * (5.8 + bird.speed * 12) + bird.phase) * 0.48;
        bird.leftWing.rotation.z = flap;
        bird.rightWing.rotation.z = -flap;
      }

      const airshipAngle = elapsed * (0.025 + signals.windStrength * 0.026) * signals.motionScale;
      airship.root.position.set(
        Math.cos(airshipAngle) * 12.8,
        7.6 + Math.sin(airshipAngle * 2.2) * 0.65,
        Math.sin(airshipAngle) * 10.6 - 2.8,
      );
      airship.root.rotation.y = -airshipAngle + Math.PI / 2;
      airship.root.rotation.z = Math.sin(airshipAngle * 2.2) * 0.04;
      airship.propeller.rotation.x +=
        delta * (4.5 + signals.windStrength * 11) * signals.motionScale;
      airship.light.intensity = signals.cabinLight * 0.78;
      lampMaterial.emissiveIntensity = 0.2 + signals.cabinLight * 1.45;
      airshipCanvasMaterial.color
        .copy(baseAirshipCanvas)
        .lerp(wetAirshipCanvas, signals.wetness * 0.5);
      waterfall.update(signals, elapsed);
    },
    dispose() {
      disposeObject3D(root);
    },
  };
}
