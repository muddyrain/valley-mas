import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import {
  createNpcRuntimeState,
  createNpcSnapshot,
  getNpcCameraPose,
  type NpcActivity,
  type NpcCameraPose,
  type NpcId,
  type NpcRoute,
  type NpcRuntimeState,
  type NpcSnapshot,
  type NpcViewMode,
  stepNpcRuntime,
} from '../core/npc';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { disposeObject3D } from './dispose';

export interface NpcSystemAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number, delta: number) => void;
  setQuality: (profile: QualityProfile) => void;
  setSelected: (id: NpcId | null) => void;
  getSnapshots: () => readonly NpcSnapshot[];
  getCameraPose: (id: NpcId, mode: Exclude<NpcViewMode, 'orbit'>) => NpcCameraPose | null;
  dispose: () => void;
}

interface CharacterRig {
  id: NpcId;
  root: Group;
  torso: Group;
  head: Group;
  leftArm: Group;
  rightArm: Group;
  leftLeg: Group;
  rightLeg: Group;
  highDetail: Group;
  snowLayer: Group;
  marker: Mesh;
  coatMaterial: MeshStandardMaterial;
  snowMaterial: MeshStandardMaterial;
}

interface NpcRecord {
  route: NpcRoute;
  state: NpcRuntimeState;
  snapshot: NpcSnapshot;
  rig: CharacterRig;
  bob: (elapsed: number, motionScale: number) => number;
}

interface CharacterPalette {
  coat: string;
  coatAccent: string;
  trousers: string;
  hair: string;
  skin: string;
  leather: string;
  metal: string;
}

const ROUTES: Readonly<Record<NpcId, NpcRoute>> = Object.freeze({
  traveler: {
    speed: 0.72,
    nodes: [
      { position: [-2.45, 0.64, 1.15], activity: 'observing', waitSeconds: 2.4 },
      { position: [-1.52, 0.64, 2.25] },
      { position: [-0.32, 0.63, 2.12], activity: 'idle', waitSeconds: 1.8 },
      { position: [1.45, 0.64, 1.78] },
      { position: [2.76, 0.63, 0.76], activity: 'observing', waitSeconds: 2.1 },
      { position: [2.58, 0.63, -0.86] },
      { position: [1.22, 0.63, -1.56], activity: 'idle', waitSeconds: 1.4 },
      { position: [-0.7, 0.64, -1.65] },
      { position: [-2.35, 0.64, -0.62], activity: 'observing', waitSeconds: 1.9 },
    ],
  },
  mechanic: {
    speed: 0.64,
    nodes: [
      { position: [-11.0, 0.4, -1.12], activity: 'working', waitSeconds: 2.8 },
      { position: [-9.18, 0.4, -1.4], activity: 'working', waitSeconds: 3.2 },
      { position: [-9.62, 0.4, -2.4], activity: 'observing', waitSeconds: 1.8 },
      { position: [-10.82, 0.4, -2.8] },
      { position: [-12.22, 0.63, -2.12], activity: 'working', waitSeconds: 2.6 },
      { position: [-11.42, 0.42, -1.58] },
    ],
  },
  gardener: {
    speed: 0.56,
    nodes: [
      { position: [9.4, 1.75, -4.03], activity: 'observing', waitSeconds: 1.6 },
      { position: [9.4, 1.75, -4.62] },
      { position: [8.24, 1.75, -5.02], activity: 'working', waitSeconds: 3.4 },
      { position: [8.28, 1.75, -5.78] },
      { position: [9.4, 1.75, -5.45], activity: 'observing', waitSeconds: 2.2 },
      { position: [10.55, 1.75, -5.82], activity: 'working', waitSeconds: 3.4 },
      { position: [10.56, 1.75, -5.02] },
      { position: [9.4, 1.75, -4.62], activity: 'idle', waitSeconds: 1.4 },
    ],
  },
});

const PALETTES: Readonly<Record<NpcId, CharacterPalette>> = Object.freeze({
  traveler: {
    coat: '#526b78',
    coatAccent: '#b76f4d',
    trousers: '#3f4a50',
    hair: '#39312f',
    skin: '#c99372',
    leather: '#5a3b2d',
    metal: '#9caaac',
  },
  mechanic: {
    coat: '#6d6655',
    coatAccent: '#d39a4f',
    trousers: '#353d42',
    hair: '#302d2a',
    skin: '#b77e62',
    leather: '#4d3024',
    metal: '#8d9a9e',
  },
  gardener: {
    coat: '#66815f',
    coatAccent: '#d49a91',
    trousers: '#4a5442',
    hair: '#5a4030',
    skin: '#d4a07e',
    leather: '#735039',
    metal: '#9ba8a0',
  },
});

const createMaterial = (color: string, roughness = 0.76, metalness = 0) =>
  new MeshStandardMaterial({ color, roughness, metalness, flatShading: true });

function createLimb(
  name: string,
  length: number,
  radius: number,
  material: MeshStandardMaterial,
  endMaterial: MeshStandardMaterial,
  endScale = 1,
): Group {
  const pivot = new Group();
  pivot.name = name;
  const limb = new Mesh(new CylinderGeometry(radius * 0.82, radius, length, 7), material);
  limb.position.y = -length * 0.5;
  const end = new Mesh(new IcosahedronGeometry(radius * 1.08 * endScale, 1), endMaterial);
  end.position.y = -length;
  end.scale.set(0.9, 1.18, 0.86);
  pivot.add(limb, end);
  return pivot;
}

function addFace(head: Group, skin: MeshStandardMaterial, hair: MeshStandardMaterial): void {
  const face = new Mesh(new IcosahedronGeometry(0.205, 2), skin);
  face.scale.set(0.9, 1.08, 0.88);
  head.add(face);

  const hairCap = new Mesh(
    new SphereGeometry(0.205, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hair,
  );
  hairCap.position.y = 0.055;
  hairCap.scale.set(0.95, 0.78, 0.95);
  head.add(hairCap);

  const eyeMaterial = createMaterial('#172126', 0.5);
  for (const x of [-0.07, 0.07]) {
    const eye = new Mesh(new SphereGeometry(0.018, 7, 5), eyeMaterial);
    eye.position.set(x, 0.018, 0.177);
    head.add(eye);
  }
  const nose = new Mesh(new ConeGeometry(0.022, 0.07, 6), skin);
  nose.position.set(0, -0.025, 0.205);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
}

function addTravelerDetails(
  rig: CharacterRig,
  palette: CharacterPalette,
  leather: MeshStandardMaterial,
  metal: MeshStandardMaterial,
): void {
  const backpack = new Group();
  backpack.name = 'traveler-backpack';
  backpack.position.set(0, 0.91, -0.24);
  const pack = new Mesh(new BoxGeometry(0.38, 0.52, 0.2), leather);
  pack.position.y = -0.02;
  const flap = new Mesh(new BoxGeometry(0.4, 0.17, 0.225), createMaterial('#79533b', 0.88));
  flap.position.set(0, 0.18, 0);
  const bedroll = new Mesh(new CylinderGeometry(0.095, 0.095, 0.42, 9), createMaterial('#889381'));
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.y = 0.34;
  backpack.add(pack, flap, bedroll);
  rig.root.add(backpack);

  const scarfMaterial = createMaterial(palette.coatAccent, 0.72);
  const scarf = new Mesh(new TorusGeometry(0.17, 0.035, 6, 16), scarfMaterial);
  scarf.name = 'traveler-scarf';
  scarf.position.y = 1.27;
  scarf.rotation.x = Math.PI / 2;
  const scarfTail = new Mesh(new BoxGeometry(0.09, 0.38, 0.035), scarfMaterial);
  scarfTail.position.set(-0.11, 1.07, -0.2);
  scarfTail.rotation.z = 0.16;
  rig.highDetail.add(scarf, scarfTail);

  const compass = new Mesh(new CylinderGeometry(0.05, 0.05, 0.025, 12), metal);
  compass.name = 'traveler-compass';
  compass.position.set(0.23, 0.92, 0.2);
  compass.rotation.x = Math.PI / 2;
  rig.highDetail.add(compass);
}

function addMechanicDetails(
  rig: CharacterRig,
  palette: CharacterPalette,
  leather: MeshStandardMaterial,
  metal: MeshStandardMaterial,
): void {
  const apron = new Mesh(new BoxGeometry(0.42, 0.54, 0.045), leather);
  apron.name = 'mechanic-apron';
  apron.position.set(0, 0.86, 0.22);
  apron.rotation.x = -0.04;
  rig.root.add(apron);

  const goggles = new Group();
  goggles.name = 'mechanic-goggles';
  goggles.position.set(0, 1.51, 0.19);
  const lensMaterial = new MeshStandardMaterial({
    color: '#84b2b8',
    emissive: '#365e65',
    emissiveIntensity: 0.18,
    roughness: 0.18,
    metalness: 0.42,
  });
  for (const x of [-0.08, 0.08]) {
    const rim = new Mesh(new TorusGeometry(0.055, 0.012, 6, 14), metal);
    rim.position.x = x;
    const lens = new Mesh(new CircleGeometry(0.045, 12), lensMaterial);
    lens.position.set(x, 0, 0.006);
    goggles.add(rim, lens);
  }
  const bridge = new Mesh(new BoxGeometry(0.07, 0.015, 0.014), metal);
  goggles.add(bridge);
  rig.highDetail.add(goggles);

  const cap = new Mesh(
    new CylinderGeometry(0.21, 0.18, 0.1, 10),
    createMaterial(palette.coatAccent),
  );
  cap.position.y = 1.67;
  const brim = new Mesh(new BoxGeometry(0.24, 0.025, 0.13), createMaterial(palette.coatAccent));
  brim.position.set(0, 1.62, 0.15);
  rig.root.add(cap, brim);

  const toolBelt = new Mesh(new TorusGeometry(0.23, 0.035, 6, 18), leather);
  toolBelt.position.y = 0.7;
  toolBelt.rotation.x = Math.PI / 2;
  rig.root.add(toolBelt);
  for (const x of [-0.18, 0.18]) {
    const tool = new Mesh(new BoxGeometry(0.035, 0.24, 0.045), metal);
    tool.position.set(x, 0.61, 0.2);
    tool.rotation.z = x * 0.8;
    rig.highDetail.add(tool);
  }
}

function addGardenerDetails(
  rig: CharacterRig,
  palette: CharacterPalette,
  leather: MeshStandardMaterial,
  metal: MeshStandardMaterial,
): void {
  const hatMaterial = createMaterial('#9a8154', 0.92);
  const hatBrim = new Mesh(new CylinderGeometry(0.34, 0.34, 0.035, 18), hatMaterial);
  hatBrim.position.y = 1.63;
  const hatCrown = new Mesh(new ConeGeometry(0.2, 0.27, 12), hatMaterial);
  hatCrown.position.y = 1.77;
  rig.root.add(hatBrim, hatCrown);

  const apron = new Mesh(new BoxGeometry(0.4, 0.52, 0.04), createMaterial('#d9c9a7', 0.88));
  apron.name = 'gardener-apron';
  apron.position.set(0, 0.86, 0.22);
  rig.root.add(apron);

  const wateringCan = new Group();
  wateringCan.name = 'gardener-watering-can';
  wateringCan.position.set(0.02, -0.47, 0.12);
  const canBody = new Mesh(new CylinderGeometry(0.12, 0.14, 0.24, 10), metal);
  canBody.rotation.z = Math.PI / 2;
  const handle = new Mesh(new TorusGeometry(0.14, 0.018, 6, 16, Math.PI), metal);
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 0.1;
  const spout = new Mesh(new ConeGeometry(0.055, 0.34, 8), metal);
  spout.rotation.z = -Math.PI / 2;
  spout.position.x = 0.27;
  wateringCan.add(canBody, handle, spout);
  rig.rightArm.add(wateringCan);

  const flowerMaterial = createMaterial(palette.coatAccent, 0.72);
  for (let index = 0; index < 5; index += 1) {
    const petal = new Mesh(new SphereGeometry(0.035, 6, 4), flowerMaterial);
    const angle = (index / 5) * Math.PI * 2;
    petal.position.set(0.19 + Math.cos(angle) * 0.035, 1.2 + Math.sin(angle) * 0.035, 0.2);
    petal.scale.set(1.2, 0.65, 0.5);
    rig.highDetail.add(petal);
  }
  const satchel = new Mesh(new BoxGeometry(0.24, 0.3, 0.14), leather);
  satchel.position.set(-0.27, 0.77, -0.03);
  satchel.rotation.z = -0.08;
  rig.root.add(satchel);
}

function createCharacter(id: NpcId): CharacterRig {
  const palette = PALETTES[id];
  const root = new Group();
  root.name = `npc-${id}`;
  root.userData.npcId = id;

  const coatMaterial = createMaterial(palette.coat, 0.8);
  const accentMaterial = createMaterial(palette.coatAccent, 0.7);
  const trousersMaterial = createMaterial(palette.trousers, 0.86);
  const hairMaterial = createMaterial(palette.hair, 0.9);
  const skinMaterial = createMaterial(palette.skin, 0.82);
  const leatherMaterial = createMaterial(palette.leather, 0.9);
  const metalMaterial = createMaterial(palette.metal, 0.34, 0.52);

  const torso = new Group();
  torso.name = `${id}-torso`;
  torso.position.y = 0.92;
  const coat = new Mesh(new CylinderGeometry(0.21, 0.27, 0.67, 9), coatMaterial);
  coat.scale.z = 0.82;
  const collar = new Mesh(new TorusGeometry(0.18, 0.035, 6, 16), accentMaterial);
  collar.position.y = 0.3;
  collar.rotation.x = Math.PI / 2;
  const belt = new Mesh(new TorusGeometry(0.235, 0.028, 6, 18), leatherMaterial);
  belt.position.y = -0.24;
  belt.rotation.x = Math.PI / 2;
  torso.add(coat, collar, belt);
  root.add(torso);

  const highDetail = new Group();
  highDetail.name = 'npc-high-detail';
  root.add(highDetail);

  const head = new Group();
  head.name = `${id}-head`;
  head.position.y = 1.47;
  addFace(head, skinMaterial, hairMaterial);
  root.add(head);

  const leftArm = createLimb(`${id}-left-arm`, 0.54, 0.075, coatMaterial, skinMaterial, 0.8);
  const rightArm = createLimb(`${id}-right-arm`, 0.54, 0.075, coatMaterial, skinMaterial, 0.8);
  leftArm.position.set(-0.27, 1.17, 0);
  rightArm.position.set(0.27, 1.17, 0);
  root.add(leftArm, rightArm);

  const leftLeg = createLimb(
    `${id}-left-leg`,
    0.62,
    0.085,
    trousersMaterial,
    leatherMaterial,
    1.08,
  );
  const rightLeg = createLimb(
    `${id}-right-leg`,
    0.62,
    0.085,
    trousersMaterial,
    leatherMaterial,
    1.08,
  );
  leftLeg.position.set(-0.115, 0.67, 0);
  rightLeg.position.set(0.115, 0.67, 0);
  root.add(leftLeg, rightLeg);

  const markerMaterial = new MeshStandardMaterial({
    color: '#d8e6bc',
    emissive: '#829662',
    emissiveIntensity: 0.42,
    roughness: 0.35,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  const marker = new Mesh(new TorusGeometry(0.34, 0.025, 6, 28), markerMaterial);
  marker.name = `${id}-selection-ring`;
  marker.position.y = 0.025;
  marker.rotation.x = Math.PI / 2;
  root.add(marker);

  const hitboxMaterial = new MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const hitbox = new Mesh(new CylinderGeometry(0.4, 0.42, 1.8, 8), hitboxMaterial);
  hitbox.name = `${id}-hitbox`;
  hitbox.position.y = 0.9;
  hitbox.userData.raycastOnly = true;
  root.add(hitbox);

  const snowMaterial = new MeshStandardMaterial({
    color: '#edf4ef',
    roughness: 0.7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const snowLayer = new Group();
  snowLayer.name = `${id}-snow-layer`;
  for (const x of [-0.22, 0.22]) {
    const shoulderSnow = new Mesh(new SphereGeometry(0.1, 7, 4), snowMaterial);
    shoulderSnow.position.set(x, 1.19, 0);
    shoulderSnow.scale.set(1.1, 0.22, 0.75);
    snowLayer.add(shoulderSnow);
  }
  const headSnow = new Mesh(new SphereGeometry(0.18, 8, 5), snowMaterial);
  headSnow.position.set(0, 1.66, 0);
  headSnow.scale.set(1.08, 0.2, 0.9);
  snowLayer.add(headSnow);
  root.add(snowLayer);

  const rig: CharacterRig = {
    id,
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    highDetail,
    snowLayer,
    marker,
    coatMaterial,
    snowMaterial,
  };

  if (id === 'traveler') addTravelerDetails(rig, palette, leatherMaterial, metalMaterial);
  if (id === 'mechanic') addMechanicDetails(rig, palette, leatherMaterial, metalMaterial);
  if (id === 'gardener') addGardenerDetails(rig, palette, leatherMaterial, metalMaterial);

  root.traverse((object) => {
    if (object instanceof Mesh) object.userData.npcId = id;
  });
  return rig;
}

function animateRig(
  rig: CharacterRig,
  activity: NpcActivity,
  gaitPhase: number,
  elapsed: number,
  motionScale: number,
): void {
  const walking = activity === 'walking';
  const swing = walking ? Math.sin(gaitPhase) * 0.58 * motionScale : 0;
  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  rig.leftArm.rotation.x = -swing * 0.72;
  rig.rightArm.rotation.x = swing * 0.72;
  rig.torso.rotation.z = walking ? Math.sin(gaitPhase * 0.5) * 0.025 * motionScale : 0;
  rig.root.position.y += walking ? Math.abs(Math.sin(gaitPhase)) * 0.035 * motionScale : 0;
  rig.head.rotation.y =
    activity === 'observing'
      ? Math.sin(elapsed * 0.72 + (rig.id === 'traveler' ? 0 : 1.4)) * 0.38 * motionScale
      : 0;

  if (activity === 'working') {
    const work = Math.sin(elapsed * 3.2) * 0.36 * motionScale;
    rig.rightArm.rotation.x = -0.72 + work;
    rig.leftArm.rotation.x = -0.34 - work * 0.4;
    rig.torso.rotation.x = 0.08 + Math.max(0, work) * 0.06;
  } else {
    rig.torso.rotation.x = 0;
  }
}

function setShadows(root: Group, enabled: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object.userData.raycastOnly) {
      object.castShadow = false;
      object.receiveShadow = false;
      return;
    }
    object.castShadow = enabled;
    object.receiveShadow = enabled;
  });
}

export function createNpcSystem(profile: QualityProfile): NpcSystemAssembly {
  const root = new Group();
  root.name = 'npc-system';
  const records: NpcRecord[] = [
    {
      route: ROUTES.traveler,
      state: createNpcRuntimeState('traveler', ROUTES.traveler),
      snapshot: createNpcSnapshot(createNpcRuntimeState('traveler', ROUTES.traveler)),
      rig: createCharacter('traveler'),
      bob: (elapsed, motionScale) => Math.sin(elapsed * 0.42) * 0.075 * motionScale,
    },
    {
      route: ROUTES.mechanic,
      state: createNpcRuntimeState('mechanic', ROUTES.mechanic),
      snapshot: createNpcSnapshot(createNpcRuntimeState('mechanic', ROUTES.mechanic)),
      rig: createCharacter('mechanic'),
      bob: (elapsed, motionScale) => Math.sin(elapsed * 0.2 + 1.2) * 0.055 * motionScale,
    },
    {
      route: ROUTES.gardener,
      state: createNpcRuntimeState('gardener', ROUTES.gardener),
      snapshot: createNpcSnapshot(createNpcRuntimeState('gardener', ROUTES.gardener)),
      rig: createCharacter('gardener'),
      bob: (elapsed, motionScale) => Math.sin(elapsed * 0.18 + 4.3) * 0.06 * motionScale,
    },
  ];

  for (const record of records) {
    record.rig.root.position.set(...record.state.position);
    root.add(record.rig.root);
  }

  const setQuality = (nextProfile: QualityProfile) => {
    const showHighDetail = nextProfile.dprCap > 1;
    for (const record of records) record.rig.highDetail.visible = showHighDetail;
    setShadows(root, nextProfile.shadows);
  };
  setQuality(profile);

  return {
    root,
    setQuality,
    setSelected(id) {
      for (const record of records) {
        const material = record.rig.marker.material as MeshStandardMaterial;
        material.opacity = record.rig.id === id ? 0.72 : 0;
      }
    },
    getSnapshots: () =>
      records.map((record) => ({
        ...record.snapshot,
        position: [...record.snapshot.position],
        forward: [...record.snapshot.forward],
      })),
    getCameraPose(id, mode) {
      const record = records.find((candidate) => candidate.rig.id === id);
      return record ? getNpcCameraPose(record.snapshot, mode) : null;
    },
    update(signals, elapsed, delta) {
      for (const record of records) {
        record.state = stepNpcRuntime(
          record.state,
          record.route,
          { rain: signals.rain, snow: signals.snow, daylight: signals.daylight },
          delta,
        );
        const bob = record.bob(elapsed, signals.motionScale);
        record.snapshot = createNpcSnapshot(record.state);
        record.snapshot.position[1] += bob;
        record.rig.root.position.set(...record.snapshot.position);
        record.rig.root.rotation.y = Math.atan2(
          record.snapshot.forward[0],
          record.snapshot.forward[2],
        );
        animateRig(
          record.rig,
          record.snapshot.activity,
          record.snapshot.gaitPhase,
          elapsed,
          signals.motionScale,
        );
        record.rig.marker.rotation.z = elapsed * 0.34;
        record.rig.coatMaterial.roughness = 0.82 - signals.wetness * 0.24;
        record.rig.snowMaterial.opacity = signals.snowCover * 0.82;
        record.rig.snowLayer.visible = signals.snowCover > 0.01;
      }
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
