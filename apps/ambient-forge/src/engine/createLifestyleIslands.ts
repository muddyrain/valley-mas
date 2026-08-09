import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { CameraViewId } from '../core/camera-tour';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { disposeObject3D } from './dispose';

export interface LifestyleIslandsAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number, delta: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getEffectCount: () => number;
  dispose: () => void;
}

const UP = new Vector3(0, 1, 0);

function beam(start: Vector3, end: Vector3, radius: number, material: MeshStandardMaterial): Mesh {
  const direction = new Vector3().subVectors(end, start);
  const mesh = new Mesh(new CylinderGeometry(radius, radius, direction.length(), 7), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}

function createIslandCore(
  name: string,
  cameraView: CameraViewId,
  radius: number,
  depth: number,
  ground: MeshStandardMaterial,
  rock: MeshStandardMaterial,
  snow: MeshStandardMaterial,
): Group {
  const island = new Group();
  island.name = name;
  island.userData.cameraView = cameraView;

  const underside = new Mesh(
    new CylinderGeometry(radius * 0.92, radius * 0.12, depth, 16, 4),
    rock,
  );
  underside.position.y = -depth * 0.5;
  island.add(underside);

  const top = new Mesh(new CylinderGeometry(radius, radius * 0.91, 0.38, 18), ground);
  top.position.y = 0.18;
  island.add(top);

  const snowCap = new Mesh(new CylinderGeometry(radius * 0.98, radius * 0.9, 0.055, 18), snow);
  snowCap.position.y = 0.395;
  island.add(snowCap);

  const shardGeometry = new IcosahedronGeometry(radius * 0.2, 0);
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2 + 0.23;
    const shard = new Mesh(shardGeometry, rock);
    shard.position.set(
      Math.cos(angle) * radius * (0.42 + (index % 3) * 0.08),
      -depth * (0.32 + (index % 4) * 0.13),
      Math.sin(angle) * radius * (0.42 + (index % 2) * 0.1),
    );
    shard.scale.set(0.7, 0.86 + (index % 3) * 0.2, 0.72);
    shard.rotation.set(index * 0.42, index * 0.73, index * 0.28);
    island.add(shard);
  }
  return island;
}

function setShadows(root: Group, enabled: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = enabled;
    object.receiveShadow = enabled;
  });
}

export function createLifestyleIslands(profile: QualityProfile): LifestyleIslandsAssembly {
  const root = new Group();
  root.name = 'lifestyle-islands-layer';

  const groundMaterial = new MeshStandardMaterial({
    color: '#60755b',
    roughness: 0.92,
    flatShading: true,
  });
  const rockMaterial = new MeshStandardMaterial({
    color: '#4c5858',
    roughness: 0.94,
    flatShading: true,
  });
  const timberMaterial = new MeshStandardMaterial({ color: '#4b3529', roughness: 0.82 });
  const darkTimberMaterial = new MeshStandardMaterial({ color: '#30251f', roughness: 0.88 });
  const metalMaterial = new MeshStandardMaterial({
    color: '#69777b',
    roughness: 0.38,
    metalness: 0.62,
  });
  const brassMaterial = new MeshStandardMaterial({
    color: '#ad8950',
    roughness: 0.3,
    metalness: 0.68,
  });
  const snowMaterial = new MeshStandardMaterial({
    color: '#f1f5f0',
    roughness: 0.7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const glassMaterial = new MeshPhysicalMaterial({
    color: '#a6d4c8',
    roughness: 0.12,
    metalness: 0,
    transmission: 0.42,
    thickness: 0.35,
    transparent: true,
    opacity: 0.44,
    side: DoubleSide,
  });
  const leafMaterial = new MeshStandardMaterial({
    color: '#557d54',
    roughness: 0.82,
    flatShading: true,
  });
  const bloomMaterial = new MeshStandardMaterial({
    color: '#e3a7a1',
    emissive: '#9c514d',
    emissiveIntensity: 0.12,
    roughness: 0.66,
  });
  const beaconMaterial = new MeshStandardMaterial({
    color: '#f2bd71',
    emissive: '#e17632',
    emissiveIntensity: 0.4,
    roughness: 0.26,
  });

  const harbor = createIslandCore(
    'sky-harbor-island',
    'harbor',
    3,
    3.25,
    groundMaterial,
    rockMaterial,
    snowMaterial,
  );
  harbor.position.set(-10.2, -0.05, -2.1);
  root.add(harbor);

  const dock = new Group();
  dock.name = 'harbor-dock';
  for (let index = 0; index < 3; index += 1) {
    const deck = new Mesh(new BoxGeometry(2.6, 0.16, 0.82), timberMaterial);
    deck.position.set(-2.25 - index * 0.82, 0.58, (index - 1) * 1.05);
    dock.add(deck);
    for (const z of [-0.34, 0.34]) {
      const rail = beam(
        new Vector3(-3.45 - index * 0.82, 0.88, (index - 1) * 1.05 + z),
        new Vector3(-1.05 - index * 0.82, 0.88, (index - 1) * 1.05 + z),
        0.028,
        brassMaterial,
      );
      dock.add(rail);
    }
  }
  harbor.add(dock);

  const mooringTower = new Group();
  mooringTower.name = 'harbor-mooring-tower';
  const mast = new Mesh(new CylinderGeometry(0.12, 0.2, 3.6, 10), metalMaterial);
  mast.position.set(-0.2, 2.15, -0.15);
  mooringTower.add(mast);
  for (const height of [1.2, 2.1, 3.05]) {
    const ring = new Mesh(new TorusGeometry(0.38, 0.045, 6, 24), brassMaterial);
    ring.position.set(-0.2, height, -0.15);
    ring.rotation.x = Math.PI / 2;
    mooringTower.add(ring);
  }
  const beacon = new Mesh(new SphereGeometry(0.16, 10, 8), beaconMaterial);
  beacon.position.set(-0.2, 4.02, -0.15);
  const beaconLight = new PointLight('#ff9d4f', 0.4, 5, 2);
  beaconLight.position.copy(beacon.position);
  mooringTower.add(beacon, beaconLight);
  harbor.add(mooringTower);

  const crane = new Group();
  crane.name = 'harbor-crane';
  crane.position.set(1.25, 0.45, 0.72);
  const craneTower = new Mesh(new CylinderGeometry(0.16, 0.24, 2.4, 8), metalMaterial);
  craneTower.position.y = 1.2;
  const craneArm = beam(new Vector3(0, 2.28, 0), new Vector3(2.15, 2.62, 0), 0.09, metalMaterial);
  const craneBrace = beam(
    new Vector3(0.04, 1.34, 0),
    new Vector3(1.62, 2.53, 0),
    0.045,
    brassMaterial,
  );
  const cable = new Mesh(new CylinderGeometry(0.014, 0.014, 1.4, 5), darkTimberMaterial);
  cable.position.set(1.88, 1.88, 0);
  const hook = new Mesh(new TorusGeometry(0.11, 0.025, 6, 14, Math.PI * 1.45), brassMaterial);
  hook.position.set(1.88, 1.16, 0);
  hook.rotation.z = Math.PI * 0.18;
  crane.add(craneTower, craneArm, craneBrace, cable, hook);
  harbor.add(crane);

  const cargo = new Group();
  cargo.name = 'harbor-cargo';
  for (let index = 0; index < 9; index += 1) {
    const crate = new Mesh(
      new BoxGeometry(0.46, 0.4, 0.46),
      index % 3 === 0 ? darkTimberMaterial : timberMaterial,
    );
    crate.position.set(
      -0.92 + (index % 3) * 0.52,
      0.6 + Math.floor(index / 6) * 0.4,
      1.08 + Math.floor((index % 6) / 3) * 0.5,
    );
    crate.rotation.y = (index % 2) * 0.08;
    cargo.add(crate);
  }
  harbor.add(cargo);

  const greenhouse = createIslandCore(
    'glasshouse-island',
    'greenhouse',
    3.15,
    3.05,
    groundMaterial,
    rockMaterial,
    snowMaterial,
  );
  greenhouse.position.set(9.4, 1.05, -5.4);
  root.add(greenhouse);

  const greenhouseFrame = new Group();
  greenhouseFrame.name = 'greenhouse-frame';
  greenhouseFrame.position.set(0, 0.52, 0);
  const floor = new Mesh(new BoxGeometry(3.9, 0.18, 2.5), darkTimberMaterial);
  floor.position.y = 0.08;
  greenhouseFrame.add(floor);
  for (const x of [-1.82, -0.62, 0.62, 1.82]) {
    for (const z of [-1.12, 1.12]) {
      const post = new Mesh(new BoxGeometry(0.08, 1.85, 0.08), brassMaterial);
      post.position.set(x, 1.02, z);
      greenhouseFrame.add(post);
    }
  }
  for (const z of [-1.12, 1.12]) {
    greenhouseFrame.add(
      beam(new Vector3(-1.82, 1.94, z), new Vector3(0, 2.72, z), 0.05, brassMaterial),
      beam(new Vector3(0, 2.72, z), new Vector3(1.82, 1.94, z), 0.05, brassMaterial),
    );
  }
  for (const x of [-1.82, -0.62, 0.62, 1.82]) {
    greenhouseFrame.add(
      beam(new Vector3(x, 1.94, -1.12), new Vector3(x, 1.94, 1.12), 0.045, brassMaterial),
    );
  }
  const leftGlass = new Mesh(new BoxGeometry(1.94, 0.045, 2.22), glassMaterial);
  leftGlass.position.set(-0.9, 2.32, 0);
  leftGlass.rotation.z = -0.4;
  const rightGlass = new Mesh(new BoxGeometry(1.94, 0.045, 2.22), glassMaterial);
  rightGlass.position.set(0.9, 2.32, 0);
  rightGlass.rotation.z = 0.4;
  const wallGlass = new Mesh(new BoxGeometry(3.52, 1.7, 0.035), glassMaterial);
  wallGlass.position.set(0, 1.04, -1.11);
  greenhouseFrame.add(leftGlass, rightGlass, wallGlass);

  const greenhouseSnow = new Group();
  greenhouseSnow.name = 'greenhouse-snow-layer';
  const leftSnow = new Mesh(new BoxGeometry(1.82, 0.035, 2.16), snowMaterial);
  leftSnow.position.set(-0.91, 2.38, 0);
  leftSnow.rotation.z = -0.4;
  const rightSnow = new Mesh(new BoxGeometry(1.82, 0.035, 2.16), snowMaterial);
  rightSnow.position.set(0.91, 2.38, 0);
  rightSnow.rotation.z = 0.4;
  greenhouseSnow.add(leftSnow, rightSnow);
  greenhouseFrame.add(greenhouseSnow);

  const plantBeds = new Group();
  plantBeds.name = 'greenhouse-plant-beds';
  for (const row of [-0.7, 0.7]) {
    const bed = new Mesh(new BoxGeometry(3.1, 0.32, 0.56), timberMaterial);
    bed.position.set(0, 0.3, row);
    plantBeds.add(bed);
    for (let index = 0; index < 7; index += 1) {
      const stem = new Mesh(new CylinderGeometry(0.025, 0.035, 0.48, 6), leafMaterial);
      stem.position.set(-1.32 + index * 0.44, 0.64, row);
      const leaves = new Mesh(new SphereGeometry(0.16, 7, 5), leafMaterial);
      leaves.position.set(stem.position.x, 0.86 + (index % 2) * 0.08, row);
      leaves.scale.set(1.35, 0.62, 0.82);
      plantBeds.add(stem, leaves);
      if (index % 2 === 0) {
        const bloom = new Mesh(new SphereGeometry(0.07, 7, 5), bloomMaterial);
        bloom.position.set(stem.position.x, 0.96, row + 0.04);
        plantBeds.add(bloom);
      }
    }
  }
  greenhouseFrame.add(plantBeds);

  const irrigation = new Group();
  irrigation.name = 'greenhouse-irrigation';
  const pipe = new Mesh(new CylinderGeometry(0.035, 0.035, 3.4, 7), metalMaterial);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 1.45, 0);
  irrigation.add(pipe);
  for (const x of [-1.25, -0.62, 0, 0.62, 1.25]) {
    const nozzle = new Mesh(new ConeGeometry(0.07, 0.13, 7), brassMaterial);
    nozzle.position.set(x, 1.34, 0);
    nozzle.rotation.z = Math.PI;
    irrigation.add(nozzle);
  }
  greenhouseFrame.add(irrigation);

  const greenhouseLight = new PointLight('#ffd89a', 0.48, 6.5, 2);
  greenhouseLight.position.set(0, 2.05, 0);
  greenhouseFrame.add(greenhouseLight);
  greenhouse.add(greenhouseFrame);

  const moteMaterial = new MeshBasicMaterial({
    color: '#d9efad',
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const motes: Mesh[] = [];
  for (let index = 0; index < 18; index += 1) {
    const mote = new Mesh(new SphereGeometry(0.035, 6, 4), moteMaterial);
    mote.position.set(
      -1.45 + ((index * 0.73) % 2.9),
      0.72 + ((index * 0.37) % 1.6),
      -0.82 + ((index * 0.51) % 1.64),
    );
    greenhouseFrame.add(mote);
    motes.push(mote);
  }

  const baseGround = groundMaterial.color.clone();
  const wetGround = groundMaterial.color.clone().multiplyScalar(0.66);
  const frostGround = groundMaterial.color.clone().lerp(snowMaterial.color, 0.68);
  const baseLeaf = leafMaterial.color.clone();
  const frostLeaf = leafMaterial.color.clone().lerp(snowMaterial.color, 0.55);
  let activeMotes = motes.length;

  const setQuality = (nextProfile: QualityProfile) => {
    activeMotes = nextProfile.dprCap > 1.5 ? motes.length : nextProfile.dprCap > 1 ? 10 : 5;
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      if (mote) mote.visible = index < activeMotes;
    }
    glassMaterial.transmission = nextProfile.dprCap > 1 ? 0.42 : 0.12;
    setShadows(root, nextProfile.shadows);
  };
  setQuality(profile);

  return {
    root,
    setQuality,
    getEffectCount: () => activeMotes + 2,
    update(signals, elapsed, delta) {
      harbor.position.y = -0.05 + Math.sin(elapsed * 0.2 + 1.2) * 0.055 * signals.motionScale;
      greenhouse.position.y = 1.05 + Math.sin(elapsed * 0.18 + 4.3) * 0.06 * signals.motionScale;
      crane.rotation.y = Math.sin(elapsed * 0.12) * 0.34 * signals.motionScale;
      beaconMaterial.emissiveIntensity =
        0.18 + signals.cabinLight * 1.2 + Math.max(0, Math.sin(elapsed * 2.1)) ** 12 * 1.8;
      beaconLight.intensity = beaconMaterial.emissiveIntensity * 0.5;
      greenhouseLight.intensity = 0.22 + signals.cabinLight * 0.88;
      glassMaterial.opacity = 0.36 + signals.wetness * 0.16;
      glassMaterial.roughness = 0.1 + signals.wetness * 0.12;
      groundMaterial.color.copy(baseGround).lerp(wetGround, signals.wetness * 0.72);
      groundMaterial.color.lerp(frostGround, signals.snowCover * 0.7);
      leafMaterial.color.copy(baseLeaf).lerp(frostLeaf, signals.snowCover * 0.62);
      snowMaterial.opacity = signals.snowCover * 0.94;
      plantBeds.rotation.z = Math.sin(elapsed * 0.7) * signals.plantSway * 0.16;
      irrigation.rotation.y += delta * 0.04 * signals.motionScale;
      for (let index = 0; index < activeMotes; index += 1) {
        const mote = motes[index];
        if (!mote) continue;
        mote.position.y += Math.sin(elapsed * 1.1 + index) * 0.0008 * signals.motionScale;
        mote.scale.setScalar(0.7 + signals.sparkleBrightness * 0.8);
      }
      moteMaterial.opacity = (0.18 + signals.fireflyActivity * 0.7) * (1 - signals.rain * 0.6);
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
