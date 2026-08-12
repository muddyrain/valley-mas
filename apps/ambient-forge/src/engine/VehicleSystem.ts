import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { NpcSnapshot } from '../core/npc';
import type { VehicleId } from '../core/playable-world';
import type { QualityProfile } from '../core/quality';
import {
  TOWN_LAYOUT_SCALE,
  TOWN_PLAYABLE_MAX_X,
  TOWN_PLAYABLE_MAX_Z,
  TOWN_PLAYABLE_MIN_X,
  TOWN_PLAYABLE_MIN_Z,
} from '../core/town-layout';
import { getPedestrianBrakeScale } from '../core/town-life';
import {
  findNavigationRoute,
  findNearestNavigationNode,
  type NavigationGraph,
  resolveCircleAgainstRects,
  type TownCollider,
  type TownVec2,
} from '../core/town-navigation';
import {
  clampVehicleAdvance,
  getIntersectionSpeedScale,
  getIntersectionYieldDecision,
  getOrientedVehicleOverlap,
  getParkingApproachSpeed,
  getRightHandLaneJunctionTarget,
  getRightHandLaneTarget,
  getRightHandLaneWaypoints,
  getTrafficLaneDecision,
  getVehicleClearanceScale,
} from '../core/town-traffic';
import type { WorldEventAction } from '../core/world-events';
import type { ParkingSpot } from './createGroundTown';
import { disposeObject3D } from './dispose';

export interface VehicleControlInput {
  throttle: number;
  steer: number;
  brake: boolean;
}

export type VehicleStatus = 'parked' | 'driving' | 'traffic' | 'autoparking' | 'mission';

export interface VehicleWorldTaskAssignment {
  eventId: string;
  stageId: string;
  vehicleId: VehicleId;
  label: string;
  action: Extract<WorldEventAction, 'drive' | 'tow'>;
  target: readonly [number, number, number];
  driverId?: string;
}

export interface VehicleWorldTaskStatus {
  eventId: string;
  stageId: string;
  vehicleId: VehicleId;
  phase: 'traveling' | 'working';
  distance: number;
  workingSeconds: number;
}

export interface VehicleSnapshot {
  id: VehicleId;
  position: [number, number, number];
  heading: number;
  speed: number;
  status: VehicleStatus;
  driverId: string | null;
  reservedBy: string | null;
  laneMode: 'right' | 'passing';
}

export interface VehicleCameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface VehicleSystemAssembly {
  root: Group;
  setControlled: (id: VehicleId | null, driverId?: string | null) => void;
  setControlInput: (input: VehicleControlInput) => void;
  playDoorTransition: (id: VehicleId, duration: number, side?: 'left' | 'right' | 'both') => void;
  reserveForResident: (id: VehicleId, residentId: string | null) => void;
  requestAutopark: (id: VehicleId, driverId?: string | null) => void;
  assignWorldTask: (task: VehicleWorldTaskAssignment | null) => void;
  getWorldTaskStatus: () => VehicleWorldTaskStatus | null;
  getNearestVehicle: (
    position: readonly [number, number, number],
    radius: number,
  ) => VehicleSnapshot | null;
  getSnapshot: (id: VehicleId) => VehicleSnapshot | null;
  getSnapshots: () => readonly VehicleSnapshot[];
  getCameraPose: (id: VehicleId) => VehicleCameraPose | null;
  recover: (id: VehicleId) => void;
  teleportVehicle: (
    id: VehicleId,
    position: readonly [number, number, number],
    heading: number,
  ) => void;
  update: (
    delta: number,
    observerPosition?: readonly [number, number, number],
    pedestrians?: readonly NpcSnapshot[],
  ) => void;
  setQuality: (profile: QualityProfile) => void;
  dispose: () => void;
}

interface VehicleRecord {
  id: VehicleId;
  root: Group;
  position: [number, number, number];
  heading: number;
  speed: number;
  status: VehicleStatus;
  autoparkTarget: ParkingSpot | null;
  waypoints: TownVec2[];
  waypointIndex: number;
  trafficRoute: readonly string[];
  safePosition: [number, number, number];
  safeHeading: number;
  stuckSeconds: number;
  offscreenSeconds: number;
  trafficBlockedSeconds: number;
  trafficDirection: 1 | -1;
  laneOffset: number;
  passingVehicleId: string | null;
  doors: Array<{ root: Group; direction: number; side: 'left' | 'right' }>;
  doorTransition: {
    elapsed: number;
    duration: number;
    side: 'left' | 'right' | 'both';
  } | null;
  wheels: Mesh[];
  missionVisuals: Readonly<Record<VehicleMissionVisual, Group>>;
  driver: Group;
  driverId: string | null;
  reservedBy: string | null;
}

type VehicleMissionVisual = 'cargo' | 'passenger' | 'tow';

const COLORS: Readonly<Record<VehicleId, { body: string; accent: string }>> = {
  copper: { body: '#b96746', accent: '#f0b071' },
  sage: { body: '#688773', accent: '#a9c29c' },
  cream: { body: '#d0c4a5', accent: '#8aa4ad' },
  navy: { body: '#405d78', accent: '#91b7c4' },
  amber: { body: '#c98a3e', accent: '#f2c66e' },
  teal: { body: '#477f80', accent: '#91c5bb' },
  rose: { body: '#a85f6b', accent: '#e2a0a4' },
  slate: { body: '#58656d', accent: '#aab6b4' },
  sand: { body: '#b59b70', accent: '#e3c88e' },
};

const STARTS: Readonly<Record<VehicleId, { position: [number, number, number]; heading: number }>> =
  {
    copper: { position: [-9.3 * TOWN_LAYOUT_SCALE, 0.38, -4.5 * TOWN_LAYOUT_SCALE], heading: 0 },
    sage: {
      position: [19 * TOWN_LAYOUT_SCALE, 0.38, -1.1 * TOWN_LAYOUT_SCALE],
      heading: -Math.PI / 2,
    },
    cream: { position: [-23 * TOWN_LAYOUT_SCALE, 0.38, 0], heading: Math.PI / 2 },
    navy: {
      position: [-12 * TOWN_LAYOUT_SCALE, 0.38, -8 * TOWN_LAYOUT_SCALE],
      heading: Math.PI / 2,
    },
    amber: {
      position: [12 * TOWN_LAYOUT_SCALE, 0.38, 8 * TOWN_LAYOUT_SCALE],
      heading: -Math.PI / 2,
    },
    teal: {
      position: [0, 0.38, -38 * TOWN_LAYOUT_SCALE],
      heading: -Math.PI / 2,
    },
    rose: {
      position: [50 * TOWN_LAYOUT_SCALE, 0.38, -38 * TOWN_LAYOUT_SCALE],
      heading: Math.PI / 2,
    },
    slate: {
      position: [42 * TOWN_LAYOUT_SCALE, 0.38, 47 * TOWN_LAYOUT_SCALE],
      heading: 0,
    },
    sand: {
      position: [45.2 * TOWN_LAYOUT_SCALE, 0.38, 54.8 * TOWN_LAYOUT_SCALE],
      heading: 0,
    },
  };

const TRAFFIC_ROUTES: Readonly<Partial<Record<VehicleId, readonly string[]>>> = Object.freeze({
  cream: [
    'road-harbor',
    'road-west-coast-east',
    'road-west-coast-ne',
    'road-west-coast-north',
    'road-west-coast-west',
    'road-west-coast-south',
    'road-west-coast-se',
    'road-west-coast-east',
    'road-harbor',
  ],
  navy: ['road-nw', 'road-ne', 'road-east', 'road-se', 'road-south', 'road-sw', 'road-west'],
  amber: [
    'road-se',
    'road-south',
    'road-sw',
    'road-west',
    'road-nw',
    'road-ne',
    'road-east',
    'road-garden',
    'road-east-district-west',
    'road-east-district-sw',
    'road-east-district-south',
    'road-east-district-se',
    'road-east-district-east',
    'road-east-district-ne',
    'road-east-district-nw',
    'road-east-district-west',
    'road-garden',
    'road-east',
  ],
  teal: [
    'road-north-old-town-south',
    'road-north-old-town-west',
    'road-north-old-town-north',
    'road-north-old-town-east',
  ],
  rose: [
    'road-northeast-hillside-south',
    'road-northeast-hillside-west',
    'road-northeast-hillside-north',
    'road-northeast-hillside-east',
  ],
  slate: [
    'road-southeast-garden-west',
    'road-southeast-garden-north',
    'road-southeast-garden-east',
    'road-southeast-garden-south',
  ],
});

const RIGHT_HAND_LANE_OFFSET = 1.05 * TOWN_LAYOUT_SCALE;

const createMaterial = (color: string, roughness = 0.68, metalness = 0.05) =>
  new MeshStandardMaterial({ color, roughness, metalness });

function createVehicleDriver(id: VehicleId): Group {
  const driver = new Group();
  driver.name = `${id}-driver`;
  const coatColors: Readonly<Record<VehicleId, string>> = {
    copper: '#536d7c',
    sage: '#718562',
    cream: '#a46d59',
    navy: '#586d91',
    amber: '#8d654a',
    teal: '#58756c',
    rose: '#815b69',
    slate: '#596875',
    sand: '#8b7354',
  };
  const coat = createMaterial(coatColors[id], 0.78, 0.01);
  const skin = createMaterial('#c99270', 0.84, 0);
  const hair = createMaterial('#352f2d', 0.9, 0);
  const dark = createMaterial('#273033', 0.56, 0.24);
  const torso = new Mesh(new CylinderGeometry(0.19, 0.24, 0.48, 10), coat);
  torso.position.set(-0.36, 1.13, -0.18);
  torso.rotation.x = -0.08;
  const head = new Mesh(new SphereGeometry(0.19, 12, 9), skin);
  head.position.set(-0.36, 1.52, -0.08);
  const hairCap = new Mesh(
    new SphereGeometry(0.196, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.48),
    hair,
  );
  hairCap.position.copy(head.position);
  for (const x of [-0.52, -0.2]) {
    const arm = new Mesh(new CylinderGeometry(0.045, 0.055, 0.48, 8), coat);
    arm.position.set(x, 1.16, 0.18);
    arm.rotation.x = Math.PI * 0.42;
    driver.add(arm);
  }
  const steeringWheel = new Mesh(new TorusGeometry(0.19, 0.035, 7, 16), dark);
  steeringWheel.position.set(-0.36, 1.14, 0.44);
  steeringWheel.rotation.x = -0.22;
  driver.add(torso, head, hairCap, steeringWheel);
  driver.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return driver;
}

function createMissionVisuals(id: VehicleId): Readonly<Record<VehicleMissionVisual, Group>> {
  const cargo = new Group();
  cargo.name = `${id}-mission-cargo`;
  const crateMaterial = createMaterial('#9a633b', 0.88, 0.02);
  const strapMaterial = createMaterial('#d5ae62', 0.62, 0.08);
  for (const [index, x] of [-0.34, 0.34].entries()) {
    const crate = new Mesh(new BoxGeometry(0.56, 0.48, 0.58), crateMaterial);
    crate.position.set(x, 1.02 + index * 0.04, -1.05);
    const strap = new Mesh(new BoxGeometry(0.08, 0.5, 0.6), strapMaterial);
    strap.position.copy(crate.position);
    cargo.add(crate, strap);
  }

  const passenger = new Group();
  passenger.name = `${id}-mission-passenger`;
  const passengerCoat = createMaterial('#9d6f9d', 0.72, 0.02);
  const passengerSkin = createMaterial('#efbd91', 0.82, 0);
  const torso = new Mesh(new CylinderGeometry(0.22, 0.28, 0.58, 10), passengerCoat);
  torso.position.set(0.35, 1.25, -0.18);
  const head = new Mesh(new CylinderGeometry(0.18, 0.2, 0.3, 10), passengerSkin);
  head.position.set(0.35, 1.65, -0.18);
  passenger.add(torso, head);

  const tow = new Group();
  tow.name = `${id}-mission-tow`;
  const ropeMaterial = createMaterial('#d0a652', 0.72, 0.12);
  const rope = new Mesh(new CylinderGeometry(0.035, 0.035, 1.9, 8), ropeMaterial);
  rope.name = `${id}-tow-rope`;
  rope.position.set(0, 0.48, -2.45);
  rope.rotation.x = Math.PI / 2;
  const disabledVehicle = new Group();
  disabledVehicle.name = `${id}-tow-vehicle`;
  disabledVehicle.position.set(0, 0, -4.15);
  const shell = new Mesh(new BoxGeometry(1.5, 0.46, 2.45), createMaterial('#7b6d63', 0.82, 0.06));
  shell.position.y = 0.52;
  disabledVehicle.add(shell);
  const wheelMaterial = createMaterial('#222729', 0.94, 0.04);
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.72, 0.72]) {
      const wheel = new Mesh(new TorusGeometry(0.27, 0.1, 7, 14), wheelMaterial);
      wheel.position.set(x, 0.38, z);
      wheel.rotation.y = Math.PI / 2;
      disabledVehicle.add(wheel);
    }
  }
  tow.add(rope, disabledVehicle);

  const visuals = { cargo, passenger, tow } as const;
  for (const group of Object.values(visuals)) {
    group.visible = false;
    group.userData.blend = 0;
    group.userData.targetBlend = 0;
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.transparent = true;
        material.opacity = 0;
      }
    });
  }
  return visuals;
}

function createVehicle(id: VehicleId): VehicleRecord {
  const root = new Group();
  root.name = `vehicle-${id}`;
  root.userData.vehicleId = id;
  root.userData.missionVisual = 'none';
  const palette = COLORS[id];
  const bodyMaterial = createMaterial(palette.body, 0.58, 0.12);
  const accentMaterial = createMaterial(palette.accent, 0.48, 0.18);
  const darkMaterial = createMaterial('#252d31', 0.48, 0.3);
  const glassMaterial = new MeshStandardMaterial({
    color: '#7197a4',
    emissive: '#1f4652',
    emissiveIntensity: 0.08,
    roughness: 0.16,
    metalness: 0.2,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  const chassis = new Mesh(new BoxGeometry(1.72, 0.43, 3.05), bodyMaterial);
  chassis.name = `${id}-body`;
  chassis.position.y = 0.58;
  const hood = new Mesh(new BoxGeometry(1.62, 0.34, 0.98), accentMaterial);
  hood.name = `${id}-hood`;
  hood.position.set(0, 0.86, 0.93);
  hood.rotation.x = -0.04;
  const cabin = new Mesh(new BoxGeometry(1.48, 0.82, 1.35), glassMaterial);
  cabin.name = `${id}-cabin`;
  cabin.position.set(0, 1.18, -0.18);
  cabin.scale.set(0.92, 1, 0.88);
  const roof = new Group();
  roof.name = `${id}-roof-frame`;
  for (const z of [-0.74, 0.36]) {
    const beam = new Mesh(new BoxGeometry(1.48, 0.14, 0.12), bodyMaterial);
    beam.position.set(0, 1.65, z);
    roof.add(beam);
  }
  for (const x of [-0.68, 0.68]) {
    const rail = new Mesh(new BoxGeometry(0.12, 0.14, 1.1), bodyMaterial);
    rail.position.set(x, 1.65, -0.19);
    roof.add(rail);
  }
  const bumperFront = new Mesh(new BoxGeometry(1.78, 0.16, 0.17), darkMaterial);
  bumperFront.position.set(0, 0.48, 1.57);
  const bumperBack = bumperFront.clone();
  bumperBack.position.z = -1.57;
  root.add(chassis, hood, cabin, roof, bumperFront, bumperBack);

  const doors: Array<{ root: Group; direction: number; side: 'left' | 'right' }> = [];
  for (const [side, x] of [
    ['left', -0.78],
    ['right', 0.78],
  ] as const) {
    const pivot = new Group();
    pivot.name = `${id}-${side}-door`;
    pivot.position.set(x, 1.08, -0.2);
    const panel = new Mesh(new BoxGeometry(0.08, 0.64, 1.08), bodyMaterial);
    panel.position.z = 0.12;
    const handle = new Mesh(new BoxGeometry(0.04, 0.06, 0.22), accentMaterial);
    handle.position.set(x < 0 ? -0.05 : 0.05, 0.08, 0.28);
    pivot.add(panel, handle);
    doors.push({ root: pivot, direction: x < 0 ? -1 : 1, side });
    root.add(pivot);
  }

  const wheelMaterial = createMaterial('#202426', 0.92, 0.08);
  const hubMaterial = createMaterial('#a1aaa6', 0.32, 0.72);
  const wheels: Mesh[] = [];
  for (const x of [-0.88, 0.88]) {
    for (const z of [-0.95, 0.95]) {
      const wheel = new Mesh(new TorusGeometry(0.32, 0.115, 8, 18), wheelMaterial);
      wheel.name = `${id}-wheel`;
      wheel.position.set(x, 0.43, z);
      wheel.rotation.y = Math.PI / 2;
      const hub = new Mesh(new CylinderGeometry(0.13, 0.13, 0.08, 12), hubMaterial);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      wheels.push(wheel);
      root.add(wheel);
    }
  }

  const headlightMaterial = new MeshStandardMaterial({
    color: '#fff2b0',
    emissive: '#ffd870',
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const tailMaterial = new MeshStandardMaterial({
    color: '#cc564d',
    emissive: '#742a27',
    emissiveIntensity: 0.5,
    roughness: 0.35,
  });
  for (const x of [-0.55, 0.55]) {
    const light = new Mesh(new BoxGeometry(0.29, 0.18, 0.08), headlightMaterial);
    light.position.set(x, 0.72, 1.58);
    const tail = new Mesh(new BoxGeometry(0.29, 0.16, 0.08), tailMaterial);
    tail.position.set(x, 0.7, -1.58);
    root.add(light, tail);
  }

  const missionVisuals = createMissionVisuals(id);
  const driver = createVehicleDriver(id);
  const driverId = TRAFFIC_ROUTES[id] ? `${id}-commuter` : null;
  driver.visible = Boolean(driverId);
  driver.userData.driverId = driverId;
  root.userData.driverId = driverId;
  root.add(missionVisuals.cargo, missionVisuals.passenger, missionVisuals.tow, driver);

  root.traverse((object) => {
    object.userData.vehicleId = id;
  });
  const start = STARTS[id];
  root.position.set(...start.position);
  root.rotation.y = start.heading;
  return {
    id,
    root,
    position: [...start.position],
    heading: start.heading,
    speed: 0,
    status: TRAFFIC_ROUTES[id] ? 'traffic' : 'parked',
    autoparkTarget: null,
    waypoints: [],
    waypointIndex: TRAFFIC_ROUTES[id] ? 1 : 0,
    trafficRoute: TRAFFIC_ROUTES[id] ?? [],
    safePosition: [...start.position],
    safeHeading: start.heading,
    stuckSeconds: 0,
    offscreenSeconds: 0,
    trafficBlockedSeconds: 0,
    trafficDirection: 1,
    laneOffset: 0,
    passingVehicleId: null,
    doors,
    doorTransition: null,
    wheels,
    missionVisuals,
    driver,
    driverId,
    reservedBy: null,
  };
}

const cloneSnapshot = (record: VehicleRecord): VehicleSnapshot => ({
  id: record.id,
  position: [...record.position],
  heading: record.heading,
  speed: record.speed,
  status: record.status,
  driverId: record.driverId,
  reservedBy: record.reservedBy,
  laneMode: record.passingVehicleId ? 'passing' : 'right',
});

export function createVehicleSystem(
  colliders: readonly TownCollider[],
  parkingSpots: readonly ParkingSpot[],
  vehicleGraph?: Readonly<NavigationGraph>,
): VehicleSystemAssembly {
  const root = new Group();
  root.name = 'vehicle-system';
  const records = (
    ['copper', 'sage', 'cream', 'navy', 'amber', 'teal', 'rose', 'slate', 'sand'] as const
  ).map(createVehicle);
  records.forEach((record) => {
    root.add(record.root);
  });
  let controlledId: VehicleId | null = null;
  let input: VehicleControlInput = { throttle: 0, steer: 0, brake: false };
  const graphNodes = new Map(vehicleGraph?.nodes.map((node) => [node.id, node]) ?? []);
  let worldTask: VehicleWorldTaskAssignment | null = null;
  let worldTaskStatus: VehicleWorldTaskStatus | null = null;
  let worldTaskWaypoints: TownVec2[] = [];
  let worldTaskWaypointIndex = 0;
  let worldTaskWorkingSeconds = 0;
  let worldTaskPreviousStatus: VehicleStatus | null = null;

  const setDriver = (record: VehicleRecord, driverId: string | null): void => {
    record.driverId = driverId;
    record.driver.visible = Boolean(driverId);
    record.driver.userData.driverId = driverId;
    record.root.userData.driverId = driverId;
  };

  const restoreDefaultDriver = (record: VehicleRecord): void => {
    setDriver(record, record.trafficRoute.length > 0 ? `${record.id}-commuter` : null);
  };

  const setMissionVisual = (record: VehicleRecord, visual: VehicleMissionVisual | 'none'): void => {
    for (const [candidate, group] of Object.entries(record.missionVisuals)) {
      group.userData.targetBlend = candidate === visual ? 1 : 0;
    }
    record.root.userData.missionVisual = visual;
  };

  const animateMissionVisuals = (record: VehicleRecord, delta: number): void => {
    for (const group of Object.values(record.missionVisuals)) {
      const current = Number(group.userData.blend ?? 0);
      const target = Number(group.userData.targetBlend ?? 0);
      const blend = current + (target - current) * Math.min(1, delta * (target > current ? 7 : 5));
      group.userData.blend = blend;
      group.visible = blend > 0.012;
      group.scale.setScalar(0.86 + blend * 0.14);
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.opacity = blend;
      });
    }
    if (record.missionVisuals.passenger.visible) {
      record.missionVisuals.passenger.rotation.z = Math.sin(record.position[0] * 0.8) * 0.025;
    }
    if (record.missionVisuals.tow.visible) {
      const towedVehicle = record.missionVisuals.tow.getObjectByName(`${record.id}-tow-vehicle`);
      if (towedVehicle) towedVehicle.rotation.y = Math.sin(record.position[2] * 0.5) * 0.055;
    }
  };

  const nearestParkingSpot = (record: VehicleRecord): ParkingSpot | null => {
    let nearest: ParkingSpot | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const availableSpots = parkingSpots.filter((spot) =>
      records
        .filter((other) => other.id !== record.id)
        .every(
          (other) =>
            Math.hypot(
              spot.position[0] - other.position[0],
              spot.position[1] - other.position[2],
            ) >= 3.1,
        ),
    );
    const candidates = availableSpots.length > 0 ? availableSpots : parkingSpots;
    for (const spot of candidates) {
      const candidate = Math.hypot(
        spot.position[0] - record.position[0],
        spot.position[1] - record.position[2],
      );
      if (candidate < nearestDistance) {
        nearest = spot;
        nearestDistance = candidate;
      }
    }
    return nearest;
  };

  const syncRecord = (record: VehicleRecord, delta: number) => {
    animateMissionVisuals(record, delta);
    record.heading = Math.atan2(Math.sin(record.heading), Math.cos(record.heading));
    record.root.position.set(...record.position);
    record.root.rotation.y = record.heading;
    record.root.userData.heading = record.heading;
    record.root.userData.laneOffset = record.laneOffset;
    record.root.userData.passingVehicleId = record.passingVehicleId ?? 'none';
    record.driver.visible = Boolean(record.driverId);
    for (const wheel of record.wheels) wheel.rotation.x -= record.speed * delta * 2.2;
  };

  const angleDelta = (from: number, to: number): number =>
    Math.atan2(Math.sin(to - from), Math.cos(to - from));

  const resetTrafficRecovery = (record: VehicleRecord): void => {
    record.trafficBlockedSeconds = 0;
    record.passingVehicleId = null;
  };

  const restoreWorldTaskVehicle = (): void => {
    if (!worldTask) return;
    const record = records.find((candidate) => candidate.id === worldTask?.vehicleId);
    if (!record) return;
    setMissionVisual(record, 'none');
    if (controlledId === record.id) return;
    record.speed = 0;
    resetTrafficRecovery(record);
    if (worldTaskPreviousStatus === 'traffic' || record.trafficRoute.length > 0) {
      record.status = 'traffic';
      restoreDefaultDriver(record);
    } else {
      beginAutopark(record);
    }
  };

  const rebuildWorldTaskRoute = (): void => {
    worldTaskWaypoints = [];
    worldTaskWaypointIndex = 0;
    if (!worldTask) return;
    const record = records.find((candidate) => candidate.id === worldTask?.vehicleId);
    if (!record) return;
    const startNode = vehicleGraph
      ? findNearestNavigationNode(vehicleGraph, [record.position[0], record.position[2]])
      : null;
    const targetNode = vehicleGraph
      ? findNearestNavigationNode(vehicleGraph, [worldTask.target[0], worldTask.target[2]])
      : null;
    const routeIds =
      vehicleGraph && startNode && targetNode
        ? findNavigationRoute(vehicleGraph, startNode.id, targetNode.id)
        : [];
    const centerline = routeIds
      .map((id) => graphNodes.get(id)?.position)
      .filter((position): position is TownVec2 => Boolean(position));
    worldTaskWaypoints = getRightHandLaneWaypoints(centerline, RIGHT_HAND_LANE_OFFSET);
    worldTaskWaypoints.push([worldTask.target[0], worldTask.target[2]]);
  };

  const updateWorldTaskStatus = (record: VehicleRecord, delta: number): void => {
    if (!worldTask || worldTask.vehicleId !== record.id) return;
    const distance = Math.hypot(
      worldTask.target[0] - record.position[0],
      worldTask.target[2] - record.position[2],
    );
    const working = distance <= 0.72 && Math.abs(record.speed) <= 0.45;
    worldTaskWorkingSeconds = working ? worldTaskWorkingSeconds + delta : 0;
    worldTaskStatus = {
      eventId: worldTask.eventId,
      stageId: worldTask.stageId,
      vehicleId: record.id,
      phase: working ? 'working' : 'traveling',
      distance,
      workingSeconds: worldTaskWorkingSeconds,
    };
  };

  const setAutoparkRoute = (record: VehicleRecord): void => {
    const target = nearestParkingSpot(record);
    record.autoparkTarget = target;
    record.waypoints = [];
    record.waypointIndex = 0;
    if (!target) return;
    const startNode = vehicleGraph
      ? findNearestNavigationNode(vehicleGraph, [record.position[0], record.position[2]])
      : null;
    const routeIds =
      vehicleGraph && startNode
        ? findNavigationRoute(vehicleGraph, startNode.id, target.roadNodeId)
        : [];
    const centerline = routeIds
      .map((id) => graphNodes.get(id)?.position)
      .filter((position): position is TownVec2 => Boolean(position));
    record.waypoints = getRightHandLaneWaypoints(centerline, RIGHT_HAND_LANE_OFFSET);
    const approachDistance = 3.2;
    const approach: TownVec2 = [
      target.position[0] - Math.sin(target.heading) * approachDistance,
      target.position[1] - Math.cos(target.heading) * approachDistance,
    ];
    const previousWaypoint = record.waypoints.at(-1);
    if (
      !previousWaypoint ||
      Math.hypot(previousWaypoint[0] - approach[0], previousWaypoint[1] - approach[1]) > 0.3
    ) {
      record.waypoints.push(approach);
    }
    record.waypoints.push(target.position);
  };

  const beginAutopark = (record: VehicleRecord, driverId?: string | null): void => {
    if (controlledId === record.id) controlledId = null;
    resetTrafficRecovery(record);
    record.status = 'autoparking';
    setDriver(record, driverId === undefined ? `${record.id}-valet` : driverId);
    record.offscreenSeconds = 0;
    setAutoparkRoute(record);
  };

  const isAtParkingSpot = (record: VehicleRecord): boolean =>
    parkingSpots.some(
      (spot) =>
        Math.hypot(spot.position[0] - record.position[0], spot.position[1] - record.position[2]) <
        1.4,
    );

  const recoverRecord = (record: VehicleRecord): void => {
    record.position = [...record.safePosition];
    record.heading = record.safeHeading;
    record.speed = 0;
    record.stuckSeconds = 0;
    resetTrafficRecovery(record);
  };

  const getAdvanceBlockers = (
    record: VehicleRecord,
    from: TownVec2,
    proposed: TownVec2,
  ): TownVec2[] => {
    const travelX = proposed[0] - from[0];
    const travelZ = proposed[1] - from[1];
    const travelLength = Math.hypot(travelX, travelZ);
    if (travelLength < 0.0001) return [];
    const directionX = travelX / travelLength;
    const directionZ = travelZ / travelLength;
    return records
      .filter((other) => other.id !== record.id)
      .filter((other) => {
        const deltaX = other.position[0] - from[0];
        const deltaZ = other.position[2] - from[1];
        const forwardDistance = deltaX * directionX + deltaZ * directionZ;
        const lateralDistance = Math.abs(deltaX * directionZ - deltaZ * directionX);
        const lateralLimit = other.id === record.passingVehicleId ? 3.4 : 2.15;
        return forwardDistance >= -0.1 && lateralDistance <= lateralLimit;
      })
      .map((other) => [other.position[0], other.position[2]]);
  };

  const followWaypoint = (
    record: VehicleRecord,
    target: TownVec2,
    desiredSpeed: number,
    delta: number,
    arrivalHeading?: number,
  ): number => {
    const deltaX = target[0] - record.position[0];
    const deltaZ = target[1] - record.position[2];
    const remaining = Math.hypot(deltaX, deltaZ);
    const targetHeading =
      arrivalHeading !== undefined && remaining <= 2.2
        ? arrivalHeading
        : remaining > 0.001
          ? Math.atan2(deltaX, deltaZ)
          : record.heading;
    const steeringDelta = angleDelta(record.heading, targetHeading);
    record.heading += Math.max(-2.2 * delta, Math.min(2.2 * delta, steeringDelta));
    const turnSpeedScale = 0.25 + Math.max(0, Math.cos(steeringDelta)) * 0.75;
    const nearTargetTurnScale =
      remaining < 1.4 ? Math.max(0, Math.min(1, (Math.cos(steeringDelta) + 0.25) / 1.25)) : 1;
    const steeringSpeed = desiredSpeed * turnSpeedScale * nearTargetTurnScale;
    record.speed += Math.max(-5.5 * delta, Math.min(3.8 * delta, steeringSpeed - record.speed));
    if (remaining <= 0.001) return remaining;
    const travel = Math.min(remaining, Math.max(0, record.speed) * delta);
    const arrivalAlignment = Math.max(0, Math.cos(angleDelta(record.heading, targetHeading)));
    const arrivalBlend =
      Math.max(0, Math.min(1, (0.9 - remaining) / 0.7)) * arrivalAlignment * 0.35;
    const forwardX = Math.sin(record.heading);
    const forwardZ = Math.cos(record.heading);
    const arrivalX = deltaX / remaining;
    const arrivalZ = deltaZ / remaining;
    const blendedX = forwardX + (arrivalX - forwardX) * arrivalBlend;
    const blendedZ = forwardZ + (arrivalZ - forwardZ) * arrivalBlend;
    const blendedLength = Math.max(0.001, Math.hypot(blendedX, blendedZ));
    const from: TownVec2 = [record.position[0], record.position[2]];
    const proposed: TownVec2 = [
      record.position[0] + (blendedX / blendedLength) * travel,
      record.position[2] + (blendedZ / blendedLength) * travel,
    ];
    const advanced = clampVehicleAdvance(
      from,
      proposed,
      getAdvanceBlockers(record, from, proposed),
      2.6,
      record.status === 'mission' ||
        record.status === 'autoparking' ||
        Boolean(record.passingVehicleId),
    );
    const actualTravel = Math.hypot(advanced[0] - from[0], advanced[1] - from[1]);
    record.position[0] = advanced[0];
    record.position[2] = advanced[1];
    if (actualTravel + 0.001 < travel) {
      record.speed = Math.min(record.speed, actualTravel / Math.max(0.001, delta));
    }
    return Math.hypot(target[0] - record.position[0], target[1] - record.position[2]);
  };

  const getPedestrianScale = (record: VehicleRecord, pedestrians: readonly NpcSnapshot[]): number =>
    getPedestrianBrakeScale(
      [record.position[0], record.position[2]],
      record.heading,
      pedestrians.map((pedestrian) => [pedestrian.position[0], pedestrian.position[2]]),
    );

  const getClearanceScale = (
    record: VehicleRecord,
    ignoredVehicleId?: string | null,
    allowParkedDetour = false,
  ): number =>
    getVehicleClearanceScale(
      [record.position[0], record.position[2]],
      record.heading,
      records
        .filter(
          (other) =>
            other.id !== record.id &&
            other.id !== ignoredVehicleId &&
            (!allowParkedDetour || other.status !== 'parked'),
        )
        .map((other) => [other.position[0], other.position[2]]),
    );

  const getIntersectionYieldScale = (record: VehicleRecord): number => {
    if (!vehicleGraph) return 1;
    const decision = getIntersectionYieldDecision(
      {
        id: record.id,
        position: [record.position[0], record.position[2]],
        heading: record.heading,
        speed: record.speed,
      },
      records
        .filter((other) => other.id !== record.id)
        .map((other) => ({
          id: other.id,
          position: [other.position[0], other.position[2]] as TownVec2,
          heading: other.heading,
          speed: other.speed,
          parked: other.status === 'parked',
          controlled: other.id === controlledId,
        })),
      vehicleGraph,
    );
    record.root.userData.intersectionId = decision.intersectionId ?? 'none';
    record.root.userData.intersectionPriority = decision.hasPriority;
    return decision.speedScale;
  };

  const getTrafficSpeed = (
    record: VehicleRecord,
    pedestrians: readonly NpcSnapshot[],
    ignoredVehicleId?: string | null,
  ): number => {
    let desiredSpeed = record.id === 'navy' ? 4.5 : 4.05;
    const forwardX = Math.sin(record.heading);
    const forwardZ = Math.cos(record.heading);
    for (const other of records) {
      if (other.id === record.id || other.id === ignoredVehicleId) continue;
      const deltaX = other.position[0] - record.position[0];
      const deltaZ = other.position[2] - record.position[2];
      const forwardDistance = deltaX * forwardX + deltaZ * forwardZ;
      const lateralDistance = Math.abs(deltaX * forwardZ - deltaZ * forwardX);
      if (forwardDistance <= 0 || forwardDistance >= 7 || lateralDistance >= 2.2) continue;
      desiredSpeed = Math.min(desiredSpeed, Math.max(0, (forwardDistance - 2.7) * 1.2));
    }
    const intersectionScale = vehicleGraph
      ? getIntersectionSpeedScale([record.position[0], record.position[2]], vehicleGraph)
      : 1;
    return (
      desiredSpeed *
      getPedestrianScale(record, pedestrians) *
      getClearanceScale(record, ignoredVehicleId) *
      intersectionScale *
      getIntersectionYieldScale(record)
    );
  };

  const separateOverlappingVehicles = (delta: number): void => {
    for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
        const left = records[leftIndex];
        const right = records[rightIndex];
        if (!left || !right) continue;
        const plannedPassingPair =
          left.passingVehicleId === right.id || right.passingVehicleId === left.id;
        const deltaX = right.position[0] - left.position[0];
        const deltaZ = right.position[2] - left.position[2];
        const centerDistance = Math.hypot(deltaX, deltaZ);
        const overlap = plannedPassingPair
          ? centerDistance < 2.68
            ? {
                axis: [
                  centerDistance > 0.001 ? deltaX / centerDistance : Math.cos(left.heading),
                  centerDistance > 0.001 ? deltaZ / centerDistance : -Math.sin(left.heading),
                ] as [number, number],
                depth: 2.68 - centerDistance,
              }
            : null
          : getOrientedVehicleOverlap(
              { position: [left.position[0], left.position[2]], heading: left.heading },
              { position: [right.position[0], right.position[2]], heading: right.heading },
            );
        if (!overlap || overlap.depth <= 0.02) continue;
        const [directionX, directionZ] = overlap.axis;
        const correction = Math.min(overlap.depth + 0.012, Math.max(0, delta) * 1.5);
        const leftParked = left.status === 'parked';
        const rightParked = right.status === 'parked';
        const leftShare = leftParked
          ? 0
          : rightParked
            ? 1
            : left.id === controlledId
              ? 0
              : right.id === controlledId
                ? 1
                : 0.5;
        const rightShare = rightParked
          ? 0
          : leftParked
            ? 1
            : right.id === controlledId
              ? 0
              : left.id === controlledId
                ? 1
                : 0.5;
        const moveLongitudinal = (
          record: VehicleRecord,
          other: VehicleRecord,
          fallbackSign: -1 | 1,
          rawX: number,
          rawZ: number,
        ): void => {
          const forwardX = Math.sin(record.heading);
          const forwardZ = Math.cos(record.heading);
          const towardOther =
            (other.position[0] - record.position[0]) * forwardX +
            (other.position[2] - record.position[2]) * forwardZ;
          const direction = Math.abs(towardOther) <= 0.06 ? fallbackSign : towardOther > 0 ? -1 : 1;
          const rawLength = Math.hypot(rawX, rawZ);
          let longitudinal = rawX * forwardX + rawZ * forwardZ;
          const lateralX = rawX - forwardX * longitudinal;
          const lateralZ = rawZ - forwardZ * longitudinal;
          const lateralLength = Math.hypot(lateralX, lateralZ);
          const lateralScale = lateralLength > 0.025 ? 0.025 / lateralLength : 1;
          if (Math.abs(longitudinal) < rawLength * 0.35) {
            longitudinal = Math.max(0, rawLength * 0.94) * direction;
          }
          const x = forwardX * longitudinal + lateralX * lateralScale;
          const z = forwardZ * longitudinal + lateralZ * lateralScale;
          const resolved = resolveCircleAgainstRects(
            [record.position[0] + x, record.position[2] + z],
            1.08,
            colliders,
          );
          record.position[0] = Math.max(
            TOWN_PLAYABLE_MIN_X,
            Math.min(TOWN_PLAYABLE_MAX_X, resolved[0]),
          );
          record.position[2] = Math.max(
            TOWN_PLAYABLE_MIN_Z,
            Math.min(TOWN_PLAYABLE_MAX_Z, resolved[1]),
          );
          record.speed *= 0.18;
          syncRecord(record, delta);
        };
        if (leftShare > 0) {
          moveLongitudinal(
            left,
            right,
            -1,
            -directionX * correction * leftShare,
            -directionZ * correction * leftShare,
          );
        }
        if (rightShare > 0) {
          moveLongitudinal(
            right,
            left,
            1,
            directionX * correction * rightShare,
            directionZ * correction * rightShare,
          );
        }
      }
    }
  };

  return {
    root,
    setControlled(id, driverId) {
      const previous = records.find((record) => record.id === controlledId);
      if (previous && previous.id !== id) {
        previous.speed = 0;
        resetTrafficRecovery(previous);
        previous.status =
          worldTask?.vehicleId === previous.id
            ? 'mission'
            : previous.trafficRoute.length > 0
              ? 'traffic'
              : 'parked';
        if (previous.status === 'traffic') restoreDefaultDriver(previous);
        else if (previous.status === 'mission')
          setDriver(previous, `${previous.id}-service-driver`);
        else setDriver(previous, null);
      }
      controlledId = id;
      for (const record of records) {
        if (record.id === id) {
          resetTrafficRecovery(record);
          record.status = 'driving';
          record.autoparkTarget = null;
          record.waypoints = [];
          record.offscreenSeconds = 0;
          setDriver(record, driverId ?? `${record.id}-player`);
        }
      }
    },
    setControlInput(nextInput) {
      input = {
        throttle: Math.max(-1, Math.min(1, nextInput.throttle)),
        steer: Math.max(-1, Math.min(1, nextInput.steer)),
        brake: nextInput.brake,
      };
    },
    playDoorTransition(id, duration, side = 'both') {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return;
      record.doorTransition = { elapsed: 0, duration: Math.max(0.3, duration), side };
    },
    reserveForResident(id, residentId) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record || record.status !== 'parked') return;
      record.reservedBy = residentId;
      record.root.userData.reservedBy = residentId;
    },
    requestAutopark(id, driverId) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return;
      beginAutopark(record, driverId);
    },
    assignWorldTask(task) {
      const changed =
        worldTask?.eventId !== task?.eventId ||
        worldTask?.stageId !== task?.stageId ||
        worldTask?.vehicleId !== task?.vehicleId;
      if (changed) {
        restoreWorldTaskVehicle();
        worldTaskWorkingSeconds = 0;
        worldTaskStatus = null;
        worldTaskPreviousStatus = null;
      }
      worldTask = task ? { ...task, target: [...task.target] } : null;
      if (!worldTask) {
        worldTaskWaypoints = [];
        worldTaskWaypointIndex = 0;
        return;
      }
      const record = records.find((candidate) => candidate.id === worldTask?.vehicleId);
      if (!record) return;
      if (changed) {
        worldTaskPreviousStatus =
          record.status === 'driving'
            ? record.trafficRoute.length > 0
              ? 'traffic'
              : 'parked'
            : record.status;
      }
      record.autoparkTarget = null;
      record.offscreenSeconds = 0;
      resetTrafficRecovery(record);
      setMissionVisual(
        record,
        worldTask.action === 'tow'
          ? 'tow'
          : worldTask.eventId.startsWith('resident-trip')
            ? 'none'
            : worldTask.eventId === 'plaza-escort'
              ? 'passenger'
              : 'cargo',
      );
      if (record.id !== controlledId) record.status = 'mission';
      if (record.id !== controlledId) {
        setDriver(
          record,
          worldTask.driverId ??
            (record.trafficRoute.length > 0
              ? `${record.id}-commuter`
              : `${record.id}-service-driver`),
        );
      }
      rebuildWorldTaskRoute();
    },
    getWorldTaskStatus: () => (worldTaskStatus ? { ...worldTaskStatus } : null),
    getNearestVehicle(position, radius) {
      let nearest: VehicleRecord | null = null;
      let nearestDistance = Math.max(0, radius);
      for (const record of records) {
        if (record.status !== 'parked' || record.reservedBy) continue;
        const candidate = Math.hypot(
          position[0] - record.position[0],
          position[2] - record.position[2],
        );
        if (candidate <= nearestDistance) {
          nearest = record;
          nearestDistance = candidate;
        }
      }
      return nearest ? cloneSnapshot(nearest) : null;
    },
    getSnapshot(id) {
      const record = records.find((candidate) => candidate.id === id);
      return record ? cloneSnapshot(record) : null;
    },
    getSnapshots: () => records.map(cloneSnapshot),
    getCameraPose(id) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return null;
      const forwardX = Math.sin(record.heading);
      const forwardZ = Math.cos(record.heading);
      return {
        position: [
          record.position[0] - forwardX * 6.6,
          record.position[1] + 3.55,
          record.position[2] - forwardZ * 6.6,
        ],
        target: [
          record.position[0] + forwardX * 4.4,
          record.position[1] + 1.05,
          record.position[2] + forwardZ * 4.4,
        ],
        fov: 42 + Math.min(8, Math.abs(record.speed) * 0.72),
      };
    },
    recover(id) {
      const record = records.find((candidate) => candidate.id === id);
      if (record) recoverRecord(record);
    },
    teleportVehicle(id, position, heading) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return;
      record.position = [...position];
      record.heading = heading;
      record.speed = 0;
      record.stuckSeconds = 0;
      resetTrafficRecovery(record);
      record.safePosition = [...position];
      record.safeHeading = heading;
      syncRecord(record, 0);
    },
    update(delta, observerPosition, pedestrians = []) {
      const safeDelta = Math.max(0, Math.min(0.1, delta));
      for (const record of records) {
        if (record.doorTransition) {
          record.doorTransition.elapsed += safeDelta;
          const progress = Math.min(
            1,
            record.doorTransition.elapsed / record.doorTransition.duration,
          );
          const open = Math.sin(progress * Math.PI) * 0.92;
          for (const door of record.doors) {
            door.root.rotation.y =
              record.doorTransition.side === 'both' || record.doorTransition.side === door.side
                ? door.direction * open
                : 0;
          }
          if (progress >= 1) record.doorTransition = null;
        }
        if (record.id === controlledId) {
          const acceleration = input.throttle >= 0 ? 7.5 : 5;
          record.speed += input.throttle * acceleration * safeDelta;
          const drag = input.brake ? 8.5 : input.throttle === 0 ? 2.2 : 0.7;
          record.speed -=
            Math.sign(record.speed) * Math.min(Math.abs(record.speed), drag * safeDelta);
          record.speed = Math.max(-4, Math.min(10.5, record.speed));
          const maximumSafeSpeed =
            10.5 * getPedestrianScale(record, pedestrians) * getClearanceScale(record);
          if (record.speed > maximumSafeSpeed) {
            record.speed = Math.max(maximumSafeSpeed, record.speed - 11 * safeDelta);
          }
          const steerScale = Math.min(1, Math.abs(record.speed) / 2.2);
          record.heading +=
            input.steer * steerScale * Math.sign(record.speed || 1) * 1.55 * safeDelta;
          record.status = 'driving';
        } else if (worldTask?.vehicleId === record.id) {
          record.status = 'mission';
          const target = worldTaskWaypoints[worldTaskWaypointIndex];
          if (target) {
            const remaining = followWaypoint(
              record,
              target,
              4.4 *
                getPedestrianScale(record, pedestrians) *
                getClearanceScale(record, null, true) *
                getIntersectionYieldScale(record),
              safeDelta,
            );
            if (remaining <= 0.3) worldTaskWaypointIndex += 1;
          } else {
            record.position[0] = worldTask.target[0];
            record.position[2] = worldTask.target[2];
            record.speed -=
              Math.sign(record.speed) * Math.min(Math.abs(record.speed), 7.5 * safeDelta);
          }
          updateWorldTaskStatus(record, safeDelta);
          syncRecord(record, safeDelta);
          continue;
        } else if (record.status === 'autoparking' && record.autoparkTarget) {
          const target = record.waypoints[record.waypointIndex] ?? record.autoparkTarget.position;
          const distanceToTarget = Math.hypot(
            target[0] - record.position[0],
            target[1] - record.position[2],
          );
          const finalApproach = record.waypointIndex >= record.waypoints.length - 1;
          const aligningAtParkingSpot = finalApproach && distanceToTarget <= 0.22;
          const parkingSpeed = aligningAtParkingSpot
            ? 0
            : finalApproach
              ? getParkingApproachSpeed(distanceToTarget)
              : 4.2;
          const remaining = followWaypoint(
            record,
            target,
            parkingSpeed *
              getPedestrianScale(record, pedestrians) *
              getClearanceScale(record, null, true) *
              getIntersectionYieldScale(record),
            safeDelta,
            aligningAtParkingSpot ? record.autoparkTarget.heading : undefined,
          );
          if (remaining <= 0.22) {
            if (finalApproach) {
              record.speed -=
                Math.sign(record.speed) * Math.min(Math.abs(record.speed), 7.5 * safeDelta);
              if (
                Math.abs(angleDelta(record.heading, record.autoparkTarget.heading)) <= 0.08 &&
                Math.abs(record.speed) <= 0.18
              ) {
                record.waypointIndex += 1;
              }
            } else {
              record.waypointIndex += 1;
            }
          }
          if (record.waypointIndex >= record.waypoints.length) {
            record.position[0] = record.autoparkTarget.position[0];
            record.position[2] = record.autoparkTarget.position[1];
            record.speed = 0;
            record.status = 'parked';
            setDriver(record, null);
            record.safePosition = [...record.position];
            record.safeHeading = record.heading;
            record.autoparkTarget = null;
            record.waypoints = [];
          }
          syncRecord(record, safeDelta);
          continue;
        } else if (record.status === 'traffic' && record.trafficRoute.length > 0) {
          const nodeId = record.trafficRoute[record.waypointIndex % record.trafficRoute.length];
          const target = nodeId ? graphNodes.get(nodeId)?.position : null;
          if (target) {
            const trafficVehicles = records
              .filter((other) => other.id !== record.id)
              .map((other) => ({
                id: other.id,
                position: [other.position[0], other.position[2]] as TownVec2,
                heading: other.heading,
                speed: other.speed,
                parked: other.status === 'parked',
              }));
            const laneDecision = getTrafficLaneDecision(
              [record.position[0], record.position[2]],
              record.heading,
              trafficVehicles,
              record.passingVehicleId,
            );
            record.passingVehicleId = laneDecision.blockerId;
            record.root.userData.laneMode = laneDecision.mode;
            const targetLaneOffset =
              laneDecision.mode === 'passing' ? -RIGHT_HAND_LANE_OFFSET : RIGHT_HAND_LANE_OFFSET;
            record.laneOffset +=
              (targetLaneOffset - record.laneOffset) * Math.min(1, safeDelta * 3.2);
            const previousIndex =
              (record.waypointIndex - record.trafficDirection + record.trafficRoute.length) %
              record.trafficRoute.length;
            const previousNodeId = record.trafficRoute[previousIndex];
            const previousTarget = previousNodeId ? graphNodes.get(previousNodeId)?.position : null;
            const nextIndex =
              (record.waypointIndex + record.trafficDirection + record.trafficRoute.length) %
              record.trafficRoute.length;
            const nextNodeId = record.trafficRoute[nextIndex];
            const nextTarget = nextNodeId ? graphNodes.get(nextNodeId)?.position : null;
            const laneTarget = previousTarget
              ? nextTarget
                ? getRightHandLaneJunctionTarget(
                    previousTarget,
                    target,
                    nextTarget,
                    record.laneOffset,
                  )
                : getRightHandLaneTarget(previousTarget, target, record.laneOffset)
              : target;
            const desiredSpeed = getTrafficSpeed(
              record,
              pedestrians,
              laneDecision.mode === 'passing' ? laneDecision.blockerId : null,
            );
            record.trafficBlockedSeconds =
              desiredSpeed < 0.15 ? Math.min(3, record.trafficBlockedSeconds + safeDelta) : 0;
            const temporaryBlocker = laneDecision.obstacleId
              ? trafficVehicles.find((vehicle) => vehicle.id === laneDecision.obstacleId)
              : null;
            if (
              record.trafficBlockedSeconds >= 3 &&
              laneDecision.mode === 'right' &&
              temporaryBlocker &&
              !temporaryBlocker.parked
            ) {
              record.passingVehicleId = temporaryBlocker.id;
              record.trafficBlockedSeconds = 0;
            }
            const remaining = followWaypoint(record, laneTarget, desiredSpeed, safeDelta);
            if (remaining <= 0.3) {
              record.waypointIndex =
                (record.waypointIndex + record.trafficDirection + record.trafficRoute.length) %
                record.trafficRoute.length;
            }
          }
        } else {
          record.speed -=
            Math.sign(record.speed) * Math.min(Math.abs(record.speed), 2.8 * safeDelta);
        }

        if (Math.abs(record.speed) > 0.001 && record.status !== 'traffic') {
          const from: TownVec2 = [record.position[0], record.position[2]];
          const nextX = record.position[0] + Math.sin(record.heading) * record.speed * safeDelta;
          const nextZ = record.position[2] + Math.cos(record.heading) * record.speed * safeDelta;
          const resolved = resolveCircleAgainstRects([nextX, nextZ], 1.08, colliders);
          const advanced = clampVehicleAdvance(
            from,
            resolved,
            getAdvanceBlockers(record, from, resolved),
            3.08,
          );
          const blockedByVehicle =
            Math.abs(advanced[0] - resolved[0]) > 0.001 ||
            Math.abs(advanced[1] - resolved[1]) > 0.001;
          record.position[0] = Math.max(
            TOWN_PLAYABLE_MIN_X,
            Math.min(TOWN_PLAYABLE_MAX_X, advanced[0]),
          );
          record.position[2] = Math.max(
            TOWN_PLAYABLE_MIN_Z,
            Math.min(TOWN_PLAYABLE_MAX_Z, advanced[1]),
          );
          if (
            blockedByVehicle ||
            Math.abs(resolved[0] - nextX) > 0.01 ||
            Math.abs(resolved[1] - nextZ) > 0.01
          ) {
            record.speed *= 0.12;
            record.stuckSeconds += safeDelta;
          } else {
            record.stuckSeconds = 0;
            record.safePosition = [...record.position];
            record.safeHeading = record.heading;
          }
        }
        if (
          record.id === controlledId &&
          Math.abs(input.throttle) > 0.4 &&
          Math.abs(record.speed) < 0.12
        ) {
          record.stuckSeconds += safeDelta;
          if (record.stuckSeconds >= 2.5) recoverRecord(record);
        }
        if (
          record.status !== 'driving' &&
          record.status !== 'traffic' &&
          Math.abs(record.speed) < 0.05
        ) {
          record.speed = 0;
          record.status = 'parked';
          setDriver(record, null);
        }
        if (
          record.status === 'parked' &&
          !isAtParkingSpot(record) &&
          observerPosition &&
          Math.hypot(
            observerPosition[0] - record.position[0],
            observerPosition[2] - record.position[2],
          ) > 18
        ) {
          record.offscreenSeconds += safeDelta;
          if (record.offscreenSeconds >= 35) beginAutopark(record);
        } else if (record.status !== 'autoparking') {
          record.offscreenSeconds = 0;
        }
        updateWorldTaskStatus(record, safeDelta);
        syncRecord(record, safeDelta);
      }
      separateOverlappingVehicles(safeDelta);
    },
    setQuality(profile) {
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.castShadow = profile.shadows;
        object.receiveShadow = profile.shadows;
      });
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
