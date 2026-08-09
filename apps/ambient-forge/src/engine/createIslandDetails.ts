import {
  AdditiveBlending,
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
  MeshStandardMaterial,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { createRadialAlphaTexture } from './createRadialAlphaTexture';

export interface IslandDetailsAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getParticleCount: () => number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function createFenceSegment(
  timberMaterial: MeshStandardMaterial,
  x: number,
  z: number,
  rotation: number,
): Group {
  const segment = new Group();
  segment.position.set(x, 0.55, z);
  segment.rotation.y = rotation;
  const postGeometry = new BoxGeometry(0.1, 0.92, 0.1);
  const postCapGeometry = new BoxGeometry(0.15, 0.06, 0.15);
  const railGeometry = new BoxGeometry(1.22, 0.09, 0.075);
  for (const postX of [-0.58, 0.58]) {
    const post = new Mesh(postGeometry, timberMaterial);
    post.position.set(postX, 0.4, 0);
    const cap = new Mesh(postCapGeometry, timberMaterial);
    cap.position.set(postX, 0.89, 0);
    segment.add(post, cap);
  }
  for (const y of [0.24, 0.58]) {
    const rail = new Mesh(railGeometry, timberMaterial);
    rail.position.y = y;
    rail.rotation.z = -0.035;
    segment.add(rail);
  }
  const brace = new Mesh(new BoxGeometry(1.16, 0.065, 0.06), timberMaterial);
  brace.position.y = 0.42;
  brace.rotation.z = -0.24;
  segment.add(brace);
  return segment;
}

function createLantern(
  x: number,
  z: number,
  timberMaterial: MeshStandardMaterial,
  lanternMaterial: MeshStandardMaterial,
): { root: Group; light: PointLight } {
  const root = new Group();
  root.position.set(x, 0.55, z);
  const post = new Mesh(new CylinderGeometry(0.045, 0.065, 1.12, 7), timberMaterial);
  post.position.y = 0.56;
  const cap = new Mesh(new ConeGeometry(0.22, 0.18, 4), timberMaterial);
  cap.position.y = 1.28;
  cap.rotation.y = Math.PI / 4;
  const lampBase = new Mesh(new BoxGeometry(0.24, 0.055, 0.24), timberMaterial);
  lampBase.position.y = 0.87;
  const lamp = new Mesh(new BoxGeometry(0.2, 0.28, 0.2), lanternMaterial);
  lamp.position.y = 1.03;
  const frameGeometry = new BoxGeometry(0.024, 0.3, 0.024);
  const frames: Mesh[] = [];
  for (const frameX of [-0.108, 0.108]) {
    for (const frameZ of [-0.108, 0.108]) {
      const frame = new Mesh(frameGeometry, timberMaterial);
      frame.position.set(frameX, 1.03, frameZ);
      frames.push(frame);
    }
  }
  const light = new PointLight('#ffc56d', 0.4, 3.4, 1.8);
  light.position.y = 1.05;
  root.add(post, cap, lampBase, lamp, ...frames, light);
  return { root, light };
}

function createBush(
  x: number,
  z: number,
  scale: number,
  foliageMaterial: MeshStandardMaterial,
  geometry: IcosahedronGeometry,
): Group {
  const bush = new Group();
  bush.position.set(x, 0.58, z);
  bush.scale.setScalar(scale);
  for (const [offsetX, offsetY, offsetZ, size] of [
    [-0.24, 0.12, 0.02, 0.42],
    [0.24, 0.1, 0.04, 0.38],
    [0, 0.31, -0.05, 0.46],
  ] as const) {
    const cluster = new Mesh(geometry, foliageMaterial);
    cluster.position.set(offsetX, offsetY, offsetZ);
    cluster.scale.set(size, size * 0.86, size);
    bush.add(cluster);
  }
  return bush;
}

function createFootbridge(
  timberMaterial: MeshStandardMaterial,
  metalMaterial: MeshStandardMaterial,
): Group {
  const bridge = new Group();
  bridge.name = 'arched-footbridge';
  bridge.position.set(-4.05, 0.58, 0.84);
  bridge.rotation.y = -0.04;
  const plankGeometry = new BoxGeometry(0.9, 0.08, 0.17);
  for (let index = 0; index < 9; index += 1) {
    const progress = index / 8;
    const arch = Math.sin(progress * Math.PI) * 0.18;
    const plank = new Mesh(plankGeometry, timberMaterial);
    plank.position.set(0, 0.09 + arch, -0.68 + progress * 1.36);
    plank.rotation.x = Math.cos(progress * Math.PI) * -0.06;
    bridge.add(plank);
  }
  for (const x of [-0.36, 0.36]) {
    const beam = new Mesh(new BoxGeometry(0.07, 0.07, 1.54), metalMaterial);
    beam.position.set(x, 0.04, 0);
    bridge.add(beam);
  }
  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.64, 0, 0.64]) {
      const post = new Mesh(new BoxGeometry(0.055, 0.55, 0.055), timberMaterial);
      post.position.set(x, 0.38 + (z === 0 ? 0.16 : 0), z);
      bridge.add(post);
    }
    for (const z of [-0.33, 0.33]) {
      const rail = new Mesh(new BoxGeometry(0.055, 0.055, 0.72), timberMaterial);
      rail.position.set(x, 0.6 + (Math.abs(z) < 0.1 ? 0.1 : 0.04), z);
      rail.rotation.x = z < 0 ? -0.12 : 0.12;
      bridge.add(rail);
    }
  }
  return bridge;
}

function createBench(
  timberMaterial: MeshStandardMaterial,
  metalMaterial: MeshStandardMaterial,
): Group {
  const bench = new Group();
  bench.name = 'garden-bench';
  bench.position.set(1.08, 0.55, 3.28);
  bench.rotation.y = -0.08;
  const seat = new Mesh(new BoxGeometry(1.32, 0.11, 0.42), timberMaterial);
  seat.position.y = 0.48;
  bench.add(seat);
  for (const y of [0.76, 0.98]) {
    const backSlat = new Mesh(new BoxGeometry(1.3, 0.12, 0.09), timberMaterial);
    backSlat.position.set(0, y, -0.17);
    bench.add(backSlat);
  }
  for (const x of [-0.52, 0.52]) {
    const leg = new Mesh(new BoxGeometry(0.09, 0.48, 0.09), metalMaterial);
    leg.position.set(x, 0.24, 0);
    leg.rotation.z = x * 0.08;
    const backPost = new Mesh(new BoxGeometry(0.085, 0.82, 0.085), metalMaterial);
    backPost.position.set(x, 0.66, -0.19);
    backPost.rotation.x = -0.08;
    bench.add(leg, backPost);
  }
  return bench;
}

function createWindmill(
  timberMaterial: MeshStandardMaterial,
  stoneMaterial: MeshStandardMaterial,
  foliageMaterial: MeshStandardMaterial,
  metalMaterial: MeshStandardMaterial,
): { root: Group; rotor: Group } {
  const windmill = new Group();
  windmill.name = 'windmill';
  windmill.position.set(-6.05, 0, -1.15);
  windmill.rotation.y = 0.12;
  const isletRock = new Mesh(new CylinderGeometry(1.08, 0.24, 1.62, 10), stoneMaterial);
  isletRock.position.y = -0.54;
  const isletCap = new Mesh(new CylinderGeometry(1.1, 0.96, 0.18, 12), foliageMaterial);
  isletCap.position.y = 0.31;
  const tower = new Mesh(new CylinderGeometry(0.29, 0.48, 1.72, 10), stoneMaterial);
  tower.position.y = 1.2;
  const roof = new Mesh(new ConeGeometry(0.46, 0.42, 8), timberMaterial);
  roof.position.y = 2.26;
  const axle = new Mesh(new CylinderGeometry(0.075, 0.075, 0.48, 8), metalMaterial);
  axle.position.set(0, 1.96, 0.3);
  axle.rotation.x = Math.PI / 2;
  windmill.add(isletRock, isletCap, tower, roof, axle);

  const rotor = new Group();
  rotor.position.set(0, 1.96, 0.56);
  const hub = new Mesh(new CylinderGeometry(0.13, 0.13, 0.18, 10), metalMaterial);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  for (let index = 0; index < 4; index += 1) {
    const bladeRoot = new Group();
    bladeRoot.rotation.z = (index / 4) * Math.PI * 2;
    const spar = new Mesh(new BoxGeometry(0.075, 1.18, 0.055), timberMaterial);
    spar.position.y = 0.56;
    const sail = new Mesh(new BoxGeometry(0.25, 0.56, 0.035), timberMaterial);
    sail.position.set(0.1, 0.72, 0.015);
    sail.rotation.z = -0.08;
    bladeRoot.add(spar, sail);
    rotor.add(bladeRoot);
  }
  windmill.add(rotor);
  return { root: windmill, rotor };
}

function createWaterwheel(
  timberMaterial: MeshStandardMaterial,
  metalMaterial: MeshStandardMaterial,
): { root: Group; wheel: Group } {
  const root = new Group();
  root.name = 'waterfall-waterwheel';
  root.position.set(-4.28, 0.12, 1.58);
  root.rotation.y = -0.08;

  for (const x of [-0.46, 0.46]) {
    const support = new Mesh(new BoxGeometry(0.09, 1.12, 0.09), timberMaterial);
    support.position.set(x, 0.32, 0.04);
    support.rotation.z = x * 0.34;
    root.add(support);
  }
  const axle = new Mesh(new CylinderGeometry(0.09, 0.09, 0.52, 10), metalMaterial);
  axle.rotation.x = Math.PI / 2;
  root.add(axle);

  const wheel = new Group();
  const rimGeometry = new TorusGeometry(0.66, 0.055, 7, 28);
  for (const z of [-0.13, 0.13]) {
    const rim = new Mesh(rimGeometry, timberMaterial);
    rim.position.z = z;
    wheel.add(rim);
  }
  for (let index = 0; index < 4; index += 1) {
    const spoke = new Mesh(new BoxGeometry(0.055, 1.24, 0.055), timberMaterial);
    spoke.rotation.z = (index / 4) * Math.PI;
    wheel.add(spoke);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const paddle = new Mesh(new BoxGeometry(0.28, 0.12, 0.34), timberMaterial);
    paddle.position.set(Math.sin(angle) * 0.75, Math.cos(angle) * 0.75, 0);
    paddle.rotation.z = -angle;
    wheel.add(paddle);
  }
  const hub = new Mesh(new CylinderGeometry(0.14, 0.14, 0.32, 10), metalMaterial);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  root.add(wheel);
  return { root, wheel };
}

function createLookoutTelescope(
  timberMaterial: MeshStandardMaterial,
  stoneMaterial: MeshStandardMaterial,
  metalMaterial: MeshStandardMaterial,
): Group {
  const lookout = new Group();
  lookout.name = 'lookout-telescope';
  lookout.position.set(2.96, 0.53, 2.72);
  lookout.rotation.y = -0.38;

  const terrace = new Mesh(new CylinderGeometry(0.78, 0.9, 0.14, 12), stoneMaterial);
  terrace.position.y = 0.07;
  lookout.add(terrace);
  const mount = new Mesh(new CylinderGeometry(0.12, 0.16, 0.28, 10), metalMaterial);
  mount.position.y = 0.84;
  lookout.add(mount);
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    const leg = new Mesh(new CylinderGeometry(0.025, 0.045, 0.78, 7), timberMaterial);
    leg.position.set(Math.cos(angle) * 0.2, 0.45, Math.sin(angle) * 0.2);
    leg.rotation.z = Math.cos(angle) * -0.28;
    leg.rotation.x = Math.sin(angle) * 0.28;
    lookout.add(leg);
  }

  const telescope = new Group();
  telescope.position.set(0, 1.08, 0);
  telescope.rotation.z = -0.24;
  const tube = new Mesh(new CylinderGeometry(0.105, 0.14, 0.86, 12), metalMaterial);
  tube.rotation.z = Math.PI / 2;
  const frontRing = new Mesh(new TorusGeometry(0.145, 0.035, 7, 18), timberMaterial);
  frontRing.position.x = 0.44;
  frontRing.rotation.y = Math.PI / 2;
  const lens = new Mesh(
    new CircleGeometry(0.105, 16),
    new MeshStandardMaterial({
      color: '#8fc7c1',
      emissive: '#467f7d',
      emissiveIntensity: 0.5,
      metalness: 0.08,
      roughness: 0.22,
    }),
  );
  lens.position.x = 0.455;
  lens.rotation.y = Math.PI / 2;
  const eyepiece = new Mesh(new CylinderGeometry(0.055, 0.075, 0.16, 10), timberMaterial);
  eyepiece.position.x = -0.48;
  eyepiece.rotation.z = Math.PI / 2;
  telescope.add(tube, frontRing, lens, eyepiece);
  lookout.add(telescope);
  return lookout;
}

function createPondDetails(
  timberMaterial: MeshStandardMaterial,
  foliageMaterial: MeshStandardMaterial,
): Group {
  const pondDetails = new Group();
  pondDetails.name = 'pond-reeds-and-lilies';
  const lilyMaterial = new MeshStandardMaterial({
    color: '#527b58',
    roughness: 0.82,
    side: DoubleSide,
  });
  const blossomMaterial = new MeshStandardMaterial({ color: '#e7c0c8', roughness: 0.72 });
  for (const [x, z, scale, bloom] of [
    [-3.72, 0.7, 1, true],
    [-3.42, 0.98, 0.76, false],
    [-3.92, 1.03, 0.68, true],
    [-3.52, 0.56, 0.62, false],
  ] as const) {
    const lily = new Mesh(new CircleGeometry(0.18, 14), lilyMaterial);
    lily.position.set(x, 0.584, z);
    lily.rotation.x = -Math.PI / 2;
    lily.scale.setScalar(scale);
    pondDetails.add(lily);
    if (bloom) {
      const flower = new Mesh(new SphereGeometry(0.065, 8, 5), blossomMaterial);
      flower.position.set(x + 0.03, 0.64, z - 0.015);
      flower.scale.y = 0.58;
      pondDetails.add(flower);
    }
  }
  const reedGeometry = new CylinderGeometry(0.012, 0.018, 0.62, 6);
  const seedGeometry = new CylinderGeometry(0.032, 0.044, 0.16, 7);
  for (const [baseX, baseZ] of [
    [-4.22, 0.48],
    [-4.08, 1.22],
    [-3.18, 0.72],
  ] as const) {
    for (let index = 0; index < 4; index += 1) {
      const reed = new Mesh(reedGeometry, foliageMaterial);
      reed.position.set(baseX + index * 0.065, 0.82 + (index % 2) * 0.08, baseZ + index * 0.025);
      reed.rotation.z = (index - 1.5) * 0.025;
      pondDetails.add(reed);
      if (index % 2 === 0) {
        const seed = new Mesh(seedGeometry, timberMaterial);
        seed.position.set(reed.position.x, reed.position.y + 0.36, reed.position.z);
        seed.rotation.z = reed.rotation.z;
        pondDetails.add(seed);
      }
    }
  }
  return pondDetails;
}

export function createIslandDetails(profile: QualityProfile): IslandDetailsAssembly {
  const root = new Group();
  root.name = 'island-details';
  const random = seededRandom(90517);

  const timberMaterial = new MeshStandardMaterial({
    color: '#4d382b',
    roughness: 0.92,
  });
  const stoneMaterial = new MeshStandardMaterial({
    color: '#747a73',
    roughness: 0.96,
    flatShading: true,
  });
  const foliageMaterial = new MeshStandardMaterial({
    color: '#476d4f',
    roughness: 0.9,
    flatShading: true,
  });
  const metalMaterial = new MeshStandardMaterial({
    color: '#413d3a',
    roughness: 0.68,
    metalness: 0.25,
  });
  const snowMaterial = new MeshStandardMaterial({
    color: '#edf3ef',
    roughness: 0.82,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const well = new Group();
  well.name = 'stone-well';
  well.position.set(-0.72, 0.5, -2.68);
  const wellBase = new Mesh(new CylinderGeometry(0.72, 0.8, 0.44, 12), stoneMaterial);
  wellBase.position.y = 0.22;
  const wellRim = new Mesh(new TorusGeometry(0.61, 0.12, 6, 18), stoneMaterial);
  wellRim.position.y = 0.52;
  wellRim.rotation.x = Math.PI / 2;
  const wellDark = new Mesh(
    new CylinderGeometry(0.47, 0.47, 0.035, 16),
    new MeshStandardMaterial({ color: '#172329', roughness: 0.72 }),
  );
  wellDark.position.y = 0.53;
  well.add(wellBase, wellRim, wellDark);
  const wellStoneGeometry = new BoxGeometry(0.32, 0.18, 0.22);
  for (let row = 0; row < 2; row += 1) {
    for (let index = 0; index < 12; index += 1) {
      const angle = ((index + row * 0.5) / 12) * Math.PI * 2;
      const stone = new Mesh(wellStoneGeometry, stoneMaterial);
      stone.position.set(Math.cos(angle) * 0.66, 0.12 + row * 0.19, Math.sin(angle) * 0.66);
      stone.rotation.y = -angle;
      stone.scale.set(0.9 + random() * 0.18, 0.86 + random() * 0.12, 0.9 + random() * 0.12);
      well.add(stone);
    }
  }
  for (const x of [-0.68, 0.68]) {
    const post = new Mesh(new BoxGeometry(0.12, 1.42, 0.12), timberMaterial);
    post.position.set(x, 1.12, 0);
    well.add(post);
  }
  const wellBeam = new Mesh(new BoxGeometry(1.58, 0.12, 0.14), timberMaterial);
  wellBeam.position.y = 1.82;
  well.add(wellBeam);
  for (const side of [-1, 1]) {
    const roof = new Mesh(new BoxGeometry(0.94, 0.1, 1.16), metalMaterial);
    roof.position.set(side * 0.37, 2.05, 0);
    roof.rotation.z = side * -0.48;
    const roofSnow = new Mesh(new BoxGeometry(0.9, 0.035, 1.12), snowMaterial);
    roofSnow.position.set(side * 0.37, 2.14, 0);
    roofSnow.rotation.z = side * -0.48;
    well.add(roof, roofSnow);
    for (let row = 0; row < 5; row += 1) {
      const roofStrip = new Mesh(new BoxGeometry(0.86, 0.035, 0.08), timberMaterial);
      roofStrip.position.set(side * 0.37, 2.11, -0.44 + row * 0.22);
      roofStrip.rotation.z = side * -0.48;
      well.add(roofStrip);
    }
  }
  const crank = new Mesh(new CylinderGeometry(0.11, 0.11, 0.86, 8), timberMaterial);
  crank.position.set(0, 1.48, 0);
  crank.rotation.z = Math.PI / 2;
  const crankArm = new Mesh(new BoxGeometry(0.3, 0.045, 0.045), metalMaterial);
  crankArm.position.set(0.78, 1.48, 0);
  crankArm.rotation.z = 0.46;
  const crankHandle = new Mesh(new CylinderGeometry(0.035, 0.035, 0.2, 7), timberMaterial);
  crankHandle.position.set(0.9, 1.59, 0);
  crankHandle.rotation.x = Math.PI / 2;
  well.add(crank, crankArm, crankHandle);
  const rope = new Mesh(new CylinderGeometry(0.012, 0.012, 0.72, 6), timberMaterial);
  rope.position.set(0.16, 1.36, 0);
  const bucket = new Mesh(new CylinderGeometry(0.16, 0.13, 0.25, 8), metalMaterial);
  bucket.position.set(0.16, 0.9, 0);
  well.add(rope, bucket);
  root.add(well);

  const bridge = createFootbridge(timberMaterial, metalMaterial);
  const bench = createBench(timberMaterial, metalMaterial);
  const windmill = createWindmill(timberMaterial, stoneMaterial, foliageMaterial, metalMaterial);
  const waterwheel = createWaterwheel(timberMaterial, metalMaterial);
  const telescope = createLookoutTelescope(timberMaterial, stoneMaterial, metalMaterial);
  const pondDetails = createPondDetails(timberMaterial, foliageMaterial);
  for (let index = 0; index < 9; index += 1) {
    const progress = index / 8;
    const arch = Math.sin(progress * Math.PI) * 0.18;
    const plankSnow = new Mesh(new BoxGeometry(0.84, 0.025, 0.15), snowMaterial);
    plankSnow.position.set(0, 0.145 + arch, -0.68 + progress * 1.36);
    plankSnow.rotation.x = Math.cos(progress * Math.PI) * -0.06;
    bridge.add(plankSnow);
  }
  const benchSnow = new Mesh(new BoxGeometry(1.26, 0.035, 0.38), snowMaterial);
  benchSnow.position.y = 0.555;
  bench.add(benchSnow);
  const windmillSnow = new Mesh(new ConeGeometry(0.43, 0.17, 8), snowMaterial);
  windmillSnow.position.y = 2.37;
  const windmillGroundSnow = new Mesh(new CylinderGeometry(1.07, 1.0, 0.055, 12), snowMaterial);
  windmillGroundSnow.position.y = 0.43;
  windmill.root.add(windmillSnow, windmillGroundSnow);
  const lookoutSnow = new Mesh(new CylinderGeometry(0.75, 0.82, 0.035, 12), snowMaterial);
  lookoutSnow.position.y = 0.16;
  telescope.add(lookoutSnow);
  root.add(bridge, bench, windmill.root, waterwheel.root, telescope, pondDetails);

  for (const [x, z, rotation] of [
    [-3.24, -2.78, -0.24],
    [-2.08, -3.24, -0.14],
    [1.42, -3.55, 0.08],
    [2.64, -3.25, 0.18],
    [3.58, -2.55, 0.38],
  ] as const) {
    root.add(createFenceSegment(timberMaterial, x, z, rotation));
  }

  const lanternMaterial = new MeshStandardMaterial({
    color: '#ffd48a',
    emissive: '#f0a541',
    emissiveIntensity: 1,
    roughness: 0.28,
  });
  const lanterns = [
    createLantern(-2.78, 2.05, timberMaterial, lanternMaterial),
    createLantern(-0.72, 1.56, timberMaterial, lanternMaterial),
  ];
  for (const lantern of lanterns) root.add(lantern.root);

  const bushGeometry = new IcosahedronGeometry(1, 1);
  const bushSnowGeometry = new SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const bushes: Group[] = [];
  for (const [x, z, scale] of [
    [-4.02, -0.22, 0.74],
    [-3.52, 2.02, 0.62],
    [-2.2, 3.42, 0.56],
    [1.8, -3.62, 0.6],
    [3.78, -0.3, 0.72],
    [3.42, 2.42, 0.58],
    [0.25, 3.7, 0.5],
  ] as const) {
    const bush = createBush(x, z, scale, foliageMaterial, bushGeometry);
    bush.userData.phase = random() * Math.PI * 2;
    bushes.push(bush);
    root.add(bush);
    const bushSnow = new Mesh(bushSnowGeometry, snowMaterial);
    bushSnow.position.set(x, 0.94 + scale * 0.2, z);
    bushSnow.scale.set(scale * 0.48, scale * 0.12, scale * 0.42);
    root.add(bushSnow);
  }

  const campfire = new Group();
  campfire.name = 'campfire';
  campfire.position.set(-2.18, 0.53, 0.15);
  const campStoneGeometry = new IcosahedronGeometry(0.17, 0);
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const stone = new Mesh(campStoneGeometry, stoneMaterial);
    stone.position.set(Math.cos(angle) * 0.5, 0.11, Math.sin(angle) * 0.5);
    stone.scale.set(1, 0.68, 1);
    campfire.add(stone);
  }
  const logGeometry = new CylinderGeometry(0.085, 0.11, 0.82, 7);
  for (const rotation of [-0.62, 0.62]) {
    const log = new Mesh(logGeometry, timberMaterial);
    log.position.y = 0.2;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rotation;
    campfire.add(log);
  }
  const flameOuterMaterial = new MeshStandardMaterial({
    color: '#f29a42',
    emissive: '#f06d2f',
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const flameInnerMaterial = new MeshStandardMaterial({
    color: '#ffe080',
    emissive: '#ffc653',
    emissiveIntensity: 2.8,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const flameRoot = new Group();
  flameRoot.position.y = 0.32;
  const flameBase = new Mesh(new SphereGeometry(0.23, 8, 6), flameOuterMaterial);
  flameBase.position.y = 0.18;
  flameBase.scale.y = 0.72;
  const flameOuter = new Mesh(new ConeGeometry(0.25, 0.56, 8), flameOuterMaterial);
  flameOuter.position.y = 0.38;
  const flameInner = new Mesh(new ConeGeometry(0.13, 0.42, 7), flameInnerMaterial);
  flameInner.position.set(0.04, 0.3, 0.04);
  const flameSide = new Mesh(new ConeGeometry(0.1, 0.34, 7), flameOuterMaterial);
  flameSide.position.set(-0.16, 0.25, -0.02);
  flameSide.rotation.z = 0.28;
  flameRoot.add(flameBase, flameOuter, flameInner, flameSide);
  const fireLight = new PointLight('#ff943d', 1.15, 5.2, 1.8);
  fireLight.position.y = 0.78;
  campfire.add(flameRoot, fireLight);

  const emberPositions = new Float32Array(32 * 3);
  const emberSeeds = new Float32Array(32);
  for (let index = 0; index < emberSeeds.length; index += 1) emberSeeds[index] = random();
  const emberGeometry = new BufferGeometry();
  emberGeometry.setAttribute('position', new BufferAttribute(emberPositions, 3));
  const emberTexture = createRadialAlphaTexture();
  const emberMaterial = new PointsMaterial({
    color: '#ffbd63',
    size: 0.065,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    alphaMap: emberTexture,
    alphaTest: 0.015,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const embers = new Points(emberGeometry, emberMaterial);
  embers.frustumCulled = false;
  campfire.add(embers);
  root.add(campfire);

  let emberCount = 32;
  let windmillAngle = 0;
  let waterwheelAngle = 0;
  let lastElapsed = 0;
  const setQuality = (nextProfile: QualityProfile) => {
    emberCount = Math.min(32, Math.max(12, Math.ceil(nextProfile.fireflies * 0.36)));
    emberGeometry.setDrawRange(0, emberCount);
  };
  setQuality(profile);

  const baseTimber = new Color('#4d382b');
  const wetTimber = new Color('#342d29');
  const baseStone = new Color('#747a73');
  const wetStone = new Color('#515a56');
  const baseFoliage = new Color('#476d4f');
  const wetFoliage = new Color('#34543f');
  return {
    root,
    setQuality,
    getParticleCount: () => emberCount,
    update(signals, elapsed) {
      const detailDelta = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      timberMaterial.color.copy(baseTimber).lerp(wetTimber, signals.wetness * 0.72);
      timberMaterial.roughness = 0.92 - signals.wetness * 0.24;
      stoneMaterial.color.copy(baseStone).lerp(wetStone, signals.wetness * 0.68);
      stoneMaterial.roughness = 0.96 - signals.wetness * 0.28;
      foliageMaterial.color.copy(baseFoliage).lerp(wetFoliage, signals.wetness * 0.62);
      snowMaterial.opacity = signals.snowCover * 0.94;
      lanternMaterial.emissiveIntensity = 0.16 + signals.cabinLight * 2.1;
      for (const lantern of lanterns) lantern.light.intensity = signals.cabinLight * 0.7;
      windmillAngle -=
        detailDelta * (0.28 + signals.windStrength * 3.2) * (0.35 + signals.motionScale * 0.65);
      windmill.rotor.rotation.z = windmillAngle;
      windmill.root.rotation.z =
        Math.sin(elapsed * 0.74) * signals.plantSway * 0.08 - signals.windStrength * 0.008;
      waterwheelAngle += detailDelta * (0.48 + signals.rain * 1.9) * signals.motionScale;
      waterwheel.wheel.rotation.z = waterwheelAngle;

      for (let index = 0; index < bushes.length; index += 1) {
        const bush = bushes[index];
        if (!bush) continue;
        const phase = Number(bush.userData.phase ?? index);
        bush.rotation.z =
          -signals.windStrength * 0.045 +
          Math.sin(elapsed * (1.3 + signals.windStrength) + phase) * signals.plantSway * 0.5;
      }

      const fireStrength = Math.max(0.08, 1 - signals.rain * 0.88 - signals.snow * 0.58);
      const flicker = 0.88 + Math.sin(elapsed * 8.2) * 0.08 + Math.sin(elapsed * 13.7) * 0.04;
      flameRoot.rotation.z =
        -signals.windStrength * 0.2 + Math.sin(elapsed * 5.4) * 0.035 * signals.motionScale;
      flameBase.scale.set(0.92 + flicker * 0.08, (0.65 + flicker * 0.08) * fireStrength, 0.92);
      flameOuter.scale.set(0.92 + flicker * 0.08, flicker * fireStrength, 0.92);
      flameInner.scale.set(0.88, (1.08 - flicker * 0.08) * fireStrength, 0.88);
      flameSide.scale.y = (0.82 + Math.sin(elapsed * 10.8) * 0.14) * fireStrength;
      flameSide.rotation.z =
        0.28 - signals.windStrength * 0.12 + Math.sin(elapsed * 7.1) * 0.05 * signals.motionScale;
      flameOuterMaterial.opacity = 0.16 + fireStrength * 0.7;
      flameInnerMaterial.opacity = 0.2 + fireStrength * 0.72;
      fireLight.intensity = fireStrength * flicker * (0.45 + signals.cabinLight * 0.95);
      emberMaterial.opacity = fireStrength * 0.76;
      emberGeometry.setDrawRange(0, Math.floor(emberCount * fireStrength));
      for (let index = 0; index < emberCount; index += 1) {
        const seed = emberSeeds[index] ?? 0;
        const phase = (elapsed * (0.22 + seed * 0.09) + seed) % 1;
        emberPositions[index * 3] =
          Math.sin(phase * 12 + seed * 9) * 0.16 - signals.windStrength * phase * 0.72;
        emberPositions[index * 3 + 1] = 0.72 + phase * 1.42;
        emberPositions[index * 3 + 2] = Math.cos(phase * 10 + seed * 7) * 0.13;
      }
      const emberAttribute = emberGeometry.attributes.position;
      if (emberAttribute) emberAttribute.needsUpdate = true;
    },
  };
}
