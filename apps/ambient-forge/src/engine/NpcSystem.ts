import {
  type AnimationAction,
  AnimationMixer,
  Box3,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  LoopOnce,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
} from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {
  getCharacterRootBobScale,
  getControlledLocomotionMotion,
  getLocomotionAnimationAction,
  getLocomotionLeanTarget,
  getLocomotionTransitionEntryTime,
  getMotionPlaybackRate,
  getVehicleTransitionPose,
  getWalkPlaybackRate,
  selectNamedAnimationClip,
  stepInertialHeading,
  stepLocomotionLean,
  stepPlanarVelocity,
} from '../core/character-motion';
import {
  createNpcRuntimeState,
  createNpcSnapshot,
  getClosestNpcRoutePoint,
  getNpcCameraPose,
  type NpcActivity,
  type NpcCameraPose,
  type NpcId,
  type NpcMotion,
  type NpcReaction,
  type NpcRoute,
  type NpcRuntimeState,
  type NpcSnapshot,
  type NpcViewMode,
  stepNpcRuntime,
} from '../core/npc';
import { getRelationshipReaction } from '../core/npc-interactions';
import type { QualityLevel, QualityProfile } from '../core/quality';
import {
  createResidentRelations,
  getResidentRelation,
  getResidentRelations,
  type ResidentRelation,
  recordResidentCollaboration,
} from '../core/resident-relations';
import {
  getResidentDailyTask,
  getResidentDestinationDwellSeconds,
  getResidentDestinationSlotOffset,
  getResidentRoutineDestinationStop,
  isResidentRoutineDestination,
  planResidentRoutinePath,
  shouldResidentHoldAtDestination,
} from '../core/resident-schedule';
import type { SceneSignals } from '../core/scene-signals';
import {
  TOWN_PLAYABLE_MAX_X,
  TOWN_PLAYABLE_MAX_Z,
  TOWN_PLAYABLE_MIN_X,
  TOWN_PLAYABLE_MIN_Z,
} from '../core/town-layout';
import {
  type CrowdAgent,
  clampCrowdOffset,
  findSocialEncounter,
  getCrowdOffsetTarget,
  getCrowdTravelScale,
  getNpcRoutine,
  getSocialPairKey,
  limitCrowdOffsetStep,
  type NpcRoutine,
  pickClearestCrowdPosition,
  pickCrowdPassingPosition,
  resolveCrowdMovement,
  resolveCrowdOffsets,
  stepCrowdOffset,
} from '../core/town-life';
import {
  buildNavigationLoop,
  createDistrictRouteAssignment,
  findNavigationRoute,
  findNearestNavigationNode,
  isNavigationSegmentClear,
  type NavigationGraph,
  planNavigationStops,
  resolveCircleAgainstRects,
  resolveCircleMovement,
  resolveCircleSlideMovement,
  type TownCollider,
} from '../core/town-navigation';
import {
  getResidentCameraOcclusion,
  getResidentDetailTier,
  getResidentVisualCadence,
  isResidentBlockingChaseCamera,
  type ResidentDetailTier,
  stepResidentVisualAnimation,
} from '../core/world-detail';
import type { WorldEventAction } from '../core/world-events';
import {
  createWalkAnimationClip,
  getLocomotionVerticalMotionScale,
  getLocomotionVerticalRange,
  stabilizeLocomotionVerticalMotion,
} from './character-animation';
import { disposeObject3D } from './dispose';

export interface NpcSystemAssembly {
  root: Group;
  update: (
    signals: SceneSignals,
    elapsed: number,
    delta: number,
    timeOfDay?: number,
    observerPosition?: readonly [number, number, number],
  ) => void;
  setQuality: (profile: QualityProfile) => void;
  setSelected: (id: NpcId | null) => void;
  getSnapshots: () => readonly NpcSnapshot[];
  getCameraPose: (id: NpcId, mode: Exclude<NpcViewMode, 'orbit'>) => NpcCameraPose | null;
  setControlled: (id: NpcId | null) => void;
  recover: (id: NpcId) => void;
  setControlInput: (input: NpcControlInput) => void;
  setVehicleObstacles: (obstacles: readonly NpcVehicleObstacle[]) => void;
  setResidentVisible: (id: NpcId, visible: boolean) => void;
  assignWorldTask: (task: NpcWorldTaskAssignment | null) => void;
  getWorldTaskStatus: () => NpcWorldTaskStatus | null;
  setWorldParticipation: (participation: NpcWorldParticipation | null) => void;
  triggerVehicleHorn: (
    position: readonly [number, number, number],
    forward: readonly [number, number, number],
  ) => readonly NpcId[];
  recordCollaboration: (residentId: NpcId, partnerId: NpcId, collaborationId: string) => void;
  getRelations: () => readonly ResidentRelation[];
  getNearestResident: (sourceId: NpcId, radius: number) => NpcSnapshot | null;
  triggerResidentInteraction: (sourceId: NpcId, residentId: NpcId) => NpcReaction | null;
  playVehicleTransition: (
    id: NpcId,
    phase: Extract<NpcMotion, 'entering' | 'exiting'>,
    target: readonly [number, number, number],
    forward: readonly [number, number, number],
    duration: number,
    waypoints?: readonly (readonly [number, number, number])[],
  ) => void;
  teleportResident: (
    id: NpcId,
    position: readonly [number, number, number],
    forward: readonly [number, number, number],
  ) => void;
  dispose: () => void;
}

export interface NpcControlInput {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
}

export interface NpcWorldTaskAssignment {
  eventId: string;
  stageId?: string;
  residentId: NpcId;
  label: string;
  action: WorldEventAction;
  target: readonly [number, number, number];
  ignoreVehicleId?: string;
}

export interface NpcWorldTaskStatus {
  eventId: string;
  stageId?: string;
  residentId: NpcId;
  phase: 'traveling' | 'working';
  distance: number;
  workingSeconds: number;
}

export interface NpcWorldParticipation {
  residentId: NpcId;
  label: string;
  action: WorldEventAction;
}

export interface NpcSystemOptions {
  colliders?: readonly TownCollider[];
  pedestrianGraph?: Readonly<NavigationGraph>;
}

export interface NpcVehicleObstacle {
  id: string;
  position: readonly [number, number, number];
  heading: number;
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
  socialMarker: Group;
  taskProps: Partial<Record<WorldEventAction, Group>>;
  proceduralVisuals: Group[];
}

interface NpcRecord {
  baseRoute: NpcRoute;
  route: NpcRoute;
  state: NpcRuntimeState;
  snapshot: NpcSnapshot;
  rig: CharacterRig;
  bob: (elapsed: number, motionScale: number) => number;
  verticalOffset: number;
  verticalVelocity: number;
  recovering: boolean;
  externalMixer: AnimationMixer | null;
  externalActions: Partial<Record<'idle' | 'walk' | 'run' | 'jump', AnimationAction>>;
  externalAction: 'idle' | 'walk' | 'run' | 'jump' | null;
  externalCharacter: Group | null;
  externalAnimationDelta: number;
  motion: NpcMotion;
  vaulting: boolean;
  interaction: {
    phase: Extract<NpcMotion, 'entering' | 'exiting'>;
    elapsed: number;
    duration: number;
    path: [number, number, number][];
    target: [number, number, number];
    forward: [number, number, number];
  } | null;
  safePosition: [number, number, number];
  safeForward: [number, number, number];
  routine: NpcRoutine;
  socialRemaining: number;
  socialCooldown: number;
  socialPartner: NpcId | null;
  reaction: NpcReaction;
  reactionRemaining: number;
  reactionCooldown: number;
  reactionSource: [number, number] | null;
  reactionPartner: NpcId | null;
  crowdOffset: [number, number];
  planarVelocity: [number, number];
  visualHeading: number;
  visualTurnVelocity: number;
  locomotionLean: [number, number];
  locomotionBlend: number;
  cameraOccluded: boolean;
  detailTier: ResidentDetailTier;
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

const MAX_CROWD_OFFSET = 0.92;
const SOCIAL_PAIR_COOLDOWN_SECONDS = 48;

const ROUTES: Readonly<Record<NpcId, NpcRoute>> = Object.freeze({
  traveler: {
    speed: 1.4,
    nodes: [
      { position: [-4.6, 0.22, -4.8], activity: 'observing', waitSeconds: 2.4 },
      { position: [0, 0.22, -5.1] },
      { position: [4.7, 0.22, -4.2], activity: 'idle', waitSeconds: 1.8 },
      { position: [5.1, 0.22, 0] },
      { position: [4.4, 0.22, 4.8], activity: 'observing', waitSeconds: 2.1 },
      { position: [0, 0.22, 5.1] },
      { position: [-4.6, 0.22, 4.3], activity: 'idle', waitSeconds: 1.4 },
      { position: [-5.1, 0.22, 0] },
    ],
  },
  mechanic: {
    speed: 1.25,
    nodes: [
      { position: [-17.2, 0.22, 2.7], activity: 'working', waitSeconds: 2.8 },
      { position: [-21, 0.22, 2.8], activity: 'observing', waitSeconds: 1.8 },
      { position: [-24.5, 0.22, 1.8] },
      { position: [-24.2, 0.22, -2.4], activity: 'working', waitSeconds: 3.2 },
      { position: [-18.2, 0.22, -2.8] },
    ],
  },
  gardener: {
    speed: 1.15,
    nodes: [
      { position: [16.5, 0.22, 3.5], activity: 'observing', waitSeconds: 1.6 },
      { position: [19, 0.22, 3.8] },
      { position: [21, 0.22, 3.9], activity: 'working', waitSeconds: 3.4 },
      { position: [24.6, 0.22, 4.2] },
      { position: [25.2, 0.22, 8.2], activity: 'observing', waitSeconds: 2.2 },
      { position: [16.1, 0.22, 9.5], activity: 'working', waitSeconds: 3.4 },
    ],
  },
  baker: {
    speed: 1.18,
    nodes: [
      { position: [-5.2, 0.22, 11.2], activity: 'working', waitSeconds: 2.6 },
      { position: [-8.2, 0.22, 9.9] },
      { position: [-7.2, 0.22, 6.2], activity: 'observing', waitSeconds: 1.4 },
      { position: [-2.6, 0.22, 5.7] },
      { position: [0, 0.22, 10.4], activity: 'idle', waitSeconds: 1.2 },
    ],
  },
  courier: {
    speed: 1.58,
    nodes: [
      { position: [-6.7, 0.22, -6.1] },
      { position: [0, 0.22, -10.4], activity: 'idle', waitSeconds: 0.8 },
      { position: [6.8, 0.22, -6.1] },
      { position: [14.5, 0.22, -2.8] },
      { position: [14.5, 0.22, 2.8] },
      { position: [6.8, 0.22, 6.1] },
      { position: [0, 0.22, 10.4] },
      { position: [-6.8, 0.22, 6.1] },
      { position: [-14.5, 0.22, 2.8] },
      { position: [-14.5, 0.22, -2.8] },
    ],
  },
  student: {
    speed: 1.34,
    nodes: [
      { position: [5.5, 0.22, -11.4], activity: 'idle', waitSeconds: 2 },
      { position: [0, 0.22, -10.4] },
      { position: [3.4, 0.22, -5.7], activity: 'observing', waitSeconds: 1.6 },
      { position: [6.2, 0.22, -6.1] },
    ],
  },
  harborhand: {
    speed: 1.28,
    nodes: [
      { position: [-21.2, 0.22, -3.1], activity: 'working', waitSeconds: 2.4 },
      { position: [-17.2, 0.22, -2.9] },
      { position: [-16.2, 0.22, 2.8] },
      { position: [-20.5, 0.22, 2.8], activity: 'working', waitSeconds: 2.1 },
      { position: [-24.8, 0.22, 2.4], activity: 'observing', waitSeconds: 1.6 },
    ],
  },
  florist: {
    speed: 1.16,
    nodes: [
      { position: [16.2, 0.22, 3.2], activity: 'working', waitSeconds: 2.2 },
      { position: [20.5, 0.22, 3.5] },
      { position: [25.4, 0.22, 4.1], activity: 'observing', waitSeconds: 1.8 },
      { position: [25.3, 0.22, 10.8] },
      { position: [16.1, 0.22, 10.8], activity: 'working', waitSeconds: 2.5 },
    ],
  },
  photographer: {
    speed: 1.22,
    nodes: [
      { position: [-4.25, 0.22, -4.15], activity: 'observing', waitSeconds: 2.7 },
      { position: [-2.6, 0.22, -5] },
      { position: [4.7, 0.22, -2.3], activity: 'observing', waitSeconds: 2.3 },
      { position: [4.8, 0.22, 2.1] },
      { position: [2.5, 0.22, 5], activity: 'observing', waitSeconds: 2.5 },
      { position: [-4.8, 0.22, 2.2] },
    ],
  },
  retiree: {
    speed: 0.94,
    nodes: [
      { position: [-5.1, 0.22, 0], activity: 'observing', waitSeconds: 2.2 },
      { position: [-4.7, 0.22, 4.7] },
      { position: [0, 0.22, 5.2], activity: 'idle', waitSeconds: 3.4 },
      { position: [4.7, 0.22, 4.7] },
      { position: [5.1, 0.22, 0], activity: 'observing', waitSeconds: 2 },
    ],
  },
  barista: {
    speed: 1.3,
    nodes: [
      { position: [5.5, 0.22, 11.4], activity: 'working', waitSeconds: 2.4 },
      { position: [1.8, 0.22, 10.4] },
      { position: [5.8, 0.22, 6.2], activity: 'idle', waitSeconds: 1.4 },
      { position: [8.2, 0.22, 9.8] },
    ],
  },
  ranger: {
    speed: 1.48,
    nodes: [
      { position: [-10, 0.22, -10.8] },
      { position: [10, 0.22, -10.8], activity: 'observing', waitSeconds: 1.2 },
      { position: [14.6, 0.22, -4.2] },
      { position: [14.6, 0.22, 4.2] },
      { position: [10, 0.22, 10.8], activity: 'observing', waitSeconds: 1.2 },
      { position: [-10, 0.22, 10.8] },
      { position: [-14.6, 0.22, 4.2] },
      { position: [-14.6, 0.22, -4.2] },
    ],
  },
  shopkeeper: {
    speed: 1.08,
    nodes: [
      { position: [-7, 0.22, -35.6], activity: 'working', waitSeconds: 3.2 },
      { position: [0, 0.22, -47], activity: 'observing', waitSeconds: 2 },
      { position: [7, 0.22, -58.4], activity: 'idle', waitSeconds: 2.4 },
    ],
  },
  nurse: {
    speed: 1.28,
    nodes: [
      { position: [46, 0.22, -35.6], activity: 'working', waitSeconds: 3 },
      { position: [50, 0.22, -47], activity: 'observing', waitSeconds: 1.8 },
      { position: [57, 0.22, -35.6], activity: 'working', waitSeconds: 2.6 },
    ],
  },
  teacher: {
    speed: 1.24,
    nodes: [
      { position: [57, 0.22, -58.4], activity: 'working', waitSeconds: 3.4 },
      { position: [50, 0.22, -47], activity: 'idle', waitSeconds: 1.8 },
      { position: [46, 0.22, -58.4], activity: 'observing', waitSeconds: 2.2 },
    ],
  },
  fisher: {
    speed: 1.2,
    nodes: [
      { position: [-40, 0.22, -17.7], activity: 'working', waitSeconds: 3.1 },
      { position: [-44, 0.22, 0], activity: 'idle', waitSeconds: 1.7 },
      { position: [-48, 0.22, -17.7], activity: 'observing', waitSeconds: 2.2 },
    ],
  },
  groundskeeper: {
    speed: 1.18,
    nodes: [
      { position: [46, 0.22, 35.6], activity: 'working', waitSeconds: 3.2 },
      { position: [50, 0.22, 47], activity: 'observing', waitSeconds: 2 },
      { position: [46, 0.22, 58.4], activity: 'working', waitSeconds: 2.8 },
    ],
  },
  musician: {
    speed: 1.22,
    nodes: [
      { position: [0, 0.22, 43], activity: 'working', waitSeconds: 3.5 },
      { position: [0, 0.22, 5.1], activity: 'observing', waitSeconds: 1.6 },
      { position: [5.2, 0.22, 4.8], activity: 'idle', waitSeconds: 2.1 },
    ],
  },
});

const ROUTE_STOP_IDS: Readonly<Record<NpcId, readonly string[]>> = Object.freeze({
  traveler: ['south-riverside-square', 'square-s', 'square-e', 'square-n', 'square-w'],
  mechanic: ['workshop', 'harbor', 'west-cross-out'],
  gardener: ['garden', 'greenhouse', 'east-district-square', 'east-cross-out'],
  baker: ['bakery', 'south-cross-out', 'square-s'],
  courier: ['town-hall', 'east-library', 'bakery'],
  student: ['blue-home', 'north-cross-out', 'square-n'],
  harborhand: ['workshop', 'harbor', 'west-cross-out'],
  florist: ['east-district-square', 'garden', 'greenhouse', 'east-cross-out'],
  photographer: ['east-district-square', 'square-n', 'square-s', 'square-e'],
  retiree: ['square-w', 'square-s', 'square-e'],
  barista: ['sage-home', 'south-cross-out', 'square-s'],
  ranger: ['town-hall', 'workshop', 'east-clinic'],
  shopkeeper: ['north-bookshop', 'north-old-town-square', 'north-apartments'],
  nurse: ['hillside-clinic', 'northeast-hillside-square', 'hillside-civic-hall'],
  teacher: ['hillside-school', 'northeast-hillside-square', 'hillside-observatory'],
  fisher: ['west-coast-fish-market', 'west-coast-square', 'west-coast-ferry-terminal'],
  groundskeeper: ['garden-nursery', 'southeast-garden-square', 'garden-workshop'],
  musician: ['south-riverside-square', 'square-s', 'square-e'],
});

const DISTRICT_ROAMING_RESIDENTS: readonly NpcId[] = [
  'traveler',
  'courier',
  'photographer',
  'ranger',
];

const WORKING_RESIDENTS = new Set<NpcId>([
  'mechanic',
  'gardener',
  'baker',
  'courier',
  'harborhand',
  'florist',
  'barista',
  'shopkeeper',
  'nurse',
  'teacher',
  'fisher',
  'groundskeeper',
  'musician',
]);

const INITIAL_ROUTE_PROGRESS: Readonly<Record<NpcId, number>> = Object.freeze({
  traveler: 0,
  mechanic: 0.18,
  gardener: 0.21,
  baker: 0.36,
  courier: 0.42,
  student: 0.58,
  harborhand: 0.68,
  florist: 0,
  photographer: 0,
  retiree: 0.7,
  barista: 0.64,
  ranger: 0.12,
  shopkeeper: 0.28,
  nurse: 0.34,
  teacher: 0.72,
  fisher: 0.36,
  groundskeeper: 0.63,
  musician: 0,
});

function createNpcRoutes(
  pedestrianGraph?: Readonly<NavigationGraph>,
): Readonly<Record<NpcId, NpcRoute>> {
  if (!pedestrianGraph) return ROUTES;
  return Object.fromEntries(
    (Object.keys(ROUTES) as NpcId[]).map((id, residentIndex) => {
      const fallback = ROUTES[id];
      const roamingIndex = DISTRICT_ROAMING_RESIDENTS.indexOf(id);
      const stopIds = planNavigationStops(
        pedestrianGraph,
        ROUTE_STOP_IDS[id],
        roamingIndex >= 0 ? 'districts' : 'local',
        roamingIndex >= 0
          ? createDistrictRouteAssignment(roamingIndex, DISTRICT_ROAMING_RESIDENTS.length)
          : undefined,
      );
      const navigationNodes = buildNavigationLoop(pedestrianGraph, stopIds);
      if (navigationNodes.length < 2) return [id, fallback];
      const nodes = navigationNodes.map((node, index) => {
        const fallbackNode = fallback.nodes[index % fallback.nodes.length];
        const isActivityStop = stopIds.includes(node.id);
        const laneX = ((residentIndex % 4) - 1.5) * 0.16;
        const laneZ = ((Math.floor(residentIndex / 4) % 3) - 1) * 0.16;
        return {
          position: [node.position[0] + laneX, 0.22, node.position[1] + laneZ] as const,
          stopId: node.id,
          activity: isActivityStop
            ? WORKING_RESIDENTS.has(id)
              ? 'working'
              : fallbackNode?.activity === 'idle'
                ? 'idle'
                : 'observing'
            : undefined,
          waitSeconds: isActivityStop
            ? Math.max(fallbackNode?.waitSeconds ?? 0, 2.6 + ((residentIndex + index) % 3) * 0.55)
            : undefined,
        };
      });
      return [id, { speed: fallback.speed, nodes }];
    }),
  ) as Record<NpcId, NpcRoute>;
}

function createResidentRoutineRoute(
  record: Readonly<NpcRecord>,
  routine: NpcRoutine,
  pedestrianGraph: Readonly<NavigationGraph>,
): NpcRoute | null {
  const path = planResidentRoutinePath(pedestrianGraph, record.rig.id, routine, [
    record.state.position[0],
    record.state.position[2],
  ]);
  if (path.length === 0) return null;
  const graphNodes = new Map(pedestrianGraph.nodes.map((node) => [node.id, node]));
  const destinationStopId = getResidentRoutineDestinationStop(record.rig.id, routine);
  const nodes: NpcRoute['nodes'][number][] = [
    {
      position: [...record.state.position],
    },
  ];
  for (const nodeId of path) {
    const node = graphNodes.get(nodeId);
    if (!node) continue;
    const isDestination = nodeId === destinationStopId;
    const destinationOffset = isDestination
      ? getResidentDestinationSlotOffset(record.rig.id, routine)
      : ([0, 0] as const);
    nodes.push({
      position: [
        node.position[0] + destinationOffset[0],
        0.22,
        node.position[1] + destinationOffset[1],
      ],
      stopId: node.id,
      activity: isDestination
        ? WORKING_RESIDENTS.has(record.rig.id)
          ? 'working'
          : 'observing'
        : undefined,
      waitSeconds: isDestination ? 0.1 : undefined,
    });
  }
  return nodes.length >= 2 ? { speed: record.baseRoute.speed, nodes } : null;
}

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
  baker: {
    coat: '#a86f58',
    coatAccent: '#e7c785',
    trousers: '#4c4140',
    hair: '#5a382e',
    skin: '#d19a76',
    leather: '#654535',
    metal: '#9ca4a2',
  },
  courier: {
    coat: '#4d7794',
    coatAccent: '#d58b48',
    trousers: '#344958',
    hair: '#312c2b',
    skin: '#bd8268',
    leather: '#4f382d',
    metal: '#9ba6ad',
  },
  student: {
    coat: '#8c6d98',
    coatAccent: '#d8b4d2',
    trousers: '#454155',
    hair: '#46332f',
    skin: '#d6a47f',
    leather: '#64463a',
    metal: '#a0a8aa',
  },
  harborhand: {
    coat: '#5c6d72',
    coatAccent: '#d6a253',
    trousers: '#333f45',
    hair: '#2f2927',
    skin: '#a96f56',
    leather: '#493128',
    metal: '#88979a',
  },
  florist: {
    coat: '#8a7762',
    coatAccent: '#db8e9c',
    trousers: '#4b5247',
    hair: '#684838',
    skin: '#d4a17f',
    leather: '#72503a',
    metal: '#9da8a2',
  },
  photographer: {
    coat: '#4c575f',
    coatAccent: '#d6bc68',
    trousers: '#343a40',
    hair: '#282625',
    skin: '#c58d6e',
    leather: '#49352e',
    metal: '#9da8ad',
  },
  retiree: {
    coat: '#778078',
    coatAccent: '#b9a981',
    trousers: '#4c504c',
    hair: '#9c9991',
    skin: '#b98268',
    leather: '#665042',
    metal: '#a4aaa7',
  },
  barista: {
    coat: '#78564b',
    coatAccent: '#d9a86e',
    trousers: '#403b38',
    hair: '#3e2b26',
    skin: '#ce9876',
    leather: '#573b2e',
    metal: '#9da5a3',
  },
  ranger: {
    coat: '#536d54',
    coatAccent: '#bd8d4c',
    trousers: '#3b493d',
    hair: '#47352b',
    skin: '#c28a69',
    leather: '#5a402e',
    metal: '#939e98',
  },
  shopkeeper: {
    coat: '#846b55',
    coatAccent: '#d6b56d',
    trousers: '#49413c',
    hair: '#554037',
    skin: '#cc9574',
    leather: '#674534',
    metal: '#a39b8e',
  },
  nurse: {
    coat: '#78949b',
    coatAccent: '#d9e1d6',
    trousers: '#495b62',
    hair: '#3d312f',
    skin: '#d5a17e',
    leather: '#66534a',
    metal: '#a8b4b4',
  },
  teacher: {
    coat: '#756f91',
    coatAccent: '#d1b97d',
    trousers: '#444356',
    hair: '#342f31',
    skin: '#bd846a',
    leather: '#564038',
    metal: '#9da4ad',
  },
  fisher: {
    coat: '#527486',
    coatAccent: '#d18d58',
    trousers: '#344650',
    hair: '#413633',
    skin: '#b87d63',
    leather: '#50372c',
    metal: '#899ca3',
  },
  groundskeeper: {
    coat: '#6f875d',
    coatAccent: '#d4aa66',
    trousers: '#46523f',
    hair: '#594032',
    skin: '#ce9976',
    leather: '#654735',
    metal: '#96a49c',
  },
  musician: {
    coat: '#8a5969',
    coatAccent: '#d7b36f',
    trousers: '#493c47',
    hair: '#342c30',
    skin: '#c68c6c',
    leather: '#5d3e32',
    metal: '#a3a0a7',
  },
});

const EXTERNAL_SKINS: Readonly<Record<NpcId, string>> = Object.freeze({
  traveler: 'skaterFemaleA.png',
  mechanic: 'criminalMaleA.png',
  gardener: 'skaterMaleA.png',
  baker: 'skaterFemaleA.png',
  courier: 'skaterMaleA.png',
  student: 'skaterFemaleA.png',
  harborhand: 'criminalMaleA.png',
  florist: 'skaterFemaleA.png',
  photographer: 'skaterMaleA.png',
  retiree: 'criminalMaleA.png',
  barista: 'skaterFemaleA.png',
  ranger: 'skaterMaleA.png',
  shopkeeper: 'criminalMaleA.png',
  nurse: 'skaterFemaleA.png',
  teacher: 'skaterMaleA.png',
  fisher: 'criminalMaleA.png',
  groundskeeper: 'skaterFemaleA.png',
  musician: 'skaterMaleA.png',
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

function createTaskProps(id: NpcId): Partial<Record<WorldEventAction, Group>> {
  const props: Partial<Record<WorldEventAction, Group>> = {};
  const wood = createMaterial('#a8784e', 0.84);
  const accent = createMaterial('#e8bc68', 0.58, 0.08);
  const metal = createMaterial('#718181', 0.34, 0.56);
  const water = createMaterial('#6ba9bd', 0.28, 0.12);
  const add = (action: WorldEventAction, ...objects: Mesh[]) => {
    const group = new Group();
    group.name = `${id}-task-${action}`;
    group.visible = false;
    group.add(...objects);
    props[action] = group;
  };

  for (const action of ['carry', 'deliver', 'receive'] as const) {
    const parcel = new Mesh(new BoxGeometry(0.38, 0.3, 0.32), wood);
    parcel.position.set(0, 1.02, 0.34);
    const ribbon = new Mesh(new BoxGeometry(0.08, 0.32, 0.34), accent);
    ribbon.position.copy(parcel.position);
    add(action, parcel, ribbon);
  }
  const wrenchBar = new Mesh(new BoxGeometry(0.08, 0.48, 0.07), metal);
  wrenchBar.position.set(0.28, 0.88, 0.28);
  wrenchBar.rotation.z = 0.58;
  const wrenchHead = new Mesh(new TorusGeometry(0.09, 0.025, 6, 12), metal);
  wrenchHead.position.set(0.42, 1.08, 0.28);
  add('repair', wrenchBar, wrenchHead);

  const canBody = new Mesh(new CylinderGeometry(0.15, 0.18, 0.3, 10), water);
  canBody.position.set(0.24, 0.88, 0.3);
  const canSpout = new Mesh(new CylinderGeometry(0.035, 0.05, 0.38, 8), water);
  canSpout.position.set(0.46, 0.93, 0.3);
  canSpout.rotation.z = Math.PI / 2.8;
  add('water', canBody, canSpout);

  const signPole = new Mesh(new CylinderGeometry(0.025, 0.03, 0.58, 8), metal);
  signPole.position.set(0.3, 1.12, 0.25);
  const arrow = new Mesh(new ConeGeometry(0.12, 0.28, 3), accent);
  arrow.position.set(0.3, 1.46, 0.25);
  arrow.rotation.z = -Math.PI / 2;
  add('guide', signPole, arrow);
  return props;
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

  const socialMarker = new Group();
  socialMarker.name = `${id}-social-marker`;
  socialMarker.visible = false;
  const socialMaterial = new MeshStandardMaterial({
    color: '#fff2bd',
    emissive: '#e3a94c',
    emissiveIntensity: 0.72,
    roughness: 0.34,
  });
  for (let index = 0; index < 3; index += 1) {
    const dot = new Mesh(new SphereGeometry(0.055 - index * 0.009, 8, 6), socialMaterial);
    dot.position.set(0.08 + index * 0.11, 1.88 + index * 0.11, 0);
    socialMarker.add(dot);
  }
  root.add(socialMarker);

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

  const taskProps = createTaskProps(id);
  Object.values(taskProps).forEach((prop) => {
    if (prop) root.add(prop);
  });

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
    socialMarker,
    taskProps,
    proceduralVisuals: [torso, head, leftArm, rightArm, leftLeg, rightLeg],
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
  motion: NpcMotion,
  taskAction: WorldEventAction | null,
  gaitPhase: number,
  elapsed: number,
  motionScale: number,
  locomotionBlend: number,
  applyProceduralRootBob: boolean,
): void {
  const walking = activity === 'walking' || locomotionBlend > 0.03;
  const swing = walking ? Math.sin(gaitPhase) * 0.58 * motionScale * locomotionBlend : 0;
  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  rig.leftArm.rotation.x = -swing * 0.72;
  rig.rightArm.rotation.x = swing * 0.72;
  rig.leftArm.rotation.z = 0;
  rig.rightArm.rotation.z = 0;
  rig.torso.rotation.z = walking
    ? Math.sin(gaitPhase * 0.5) * 0.025 * motionScale * locomotionBlend
    : 0;
  if (applyProceduralRootBob && walking) {
    rig.root.position.y += Math.abs(Math.sin(gaitPhase)) * 0.035 * motionScale * locomotionBlend;
  }
  rig.head.rotation.y =
    activity === 'observing'
      ? Math.sin(elapsed * 0.72 + (rig.id === 'traveler' ? 0 : 1.4)) * 0.38 * motionScale
      : 0;

  if (activity === 'working') {
    const work = Math.sin(elapsed * 3.2) * 0.36 * motionScale;
    if (taskAction === 'carry' || taskAction === 'deliver' || taskAction === 'receive') {
      rig.rightArm.rotation.x = -1.08 + work * 0.12;
      rig.leftArm.rotation.x = -1.08 - work * 0.12;
      rig.rightArm.rotation.z = -0.18;
      rig.leftArm.rotation.z = 0.18;
      rig.torso.rotation.x = 0.05;
    } else if (taskAction === 'repair') {
      rig.rightArm.rotation.x = -0.84 + work * 0.7;
      rig.leftArm.rotation.x = -0.52 - work * 0.24;
      rig.torso.rotation.x = 0.24 + Math.max(0, work) * 0.08;
    } else if (taskAction === 'water') {
      rig.rightArm.rotation.x = -1.18 + work * 0.18;
      rig.rightArm.rotation.z = -0.24;
      rig.leftArm.rotation.x = -0.48;
      rig.torso.rotation.x = 0.12;
    } else if (taskAction === 'guide') {
      rig.rightArm.rotation.x = -1.32;
      rig.rightArm.rotation.z = 0.42 + Math.sin(elapsed * 2.8) * 0.16 * motionScale;
      rig.leftArm.rotation.x = -0.18;
      rig.torso.rotation.x = 0;
    } else {
      rig.rightArm.rotation.x = -0.72 + work;
      rig.leftArm.rotation.x = -0.34 - work * 0.4;
      rig.torso.rotation.x = 0.08 + Math.max(0, work) * 0.06;
    }
  } else {
    rig.torso.rotation.x = 0;
  }
  if (motion === 'greet') {
    rig.rightArm.rotation.x = -1.18;
    rig.rightArm.rotation.z = 0.35 + Math.sin(elapsed * 7.2) * 0.24 * motionScale;
    rig.head.rotation.y = Math.sin(elapsed * 2.4) * 0.12 * motionScale;
  } else if (activity !== 'working') {
    rig.rightArm.rotation.z = 0;
  }
}

function animateTaskProps(
  rig: CharacterRig,
  action: WorldEventAction | null,
  working: boolean,
  elapsed: number,
  motionScale: number,
  delta: number,
): void {
  for (const [candidate, prop] of Object.entries(rig.taskProps)) {
    if (!prop) continue;
    const target = working && candidate === action ? 1 : 0;
    const current = Number(prop.userData.taskBlend ?? 0);
    const blend = current + (target - current) * Math.min(1, delta * (target > current ? 7 : 5));
    prop.userData.taskBlend = blend;
    prop.visible = blend > 0.012;
    prop.scale.setScalar(0.82 + blend * 0.18);
    prop.position.set(0, 0, 0);
    prop.rotation.set(0, 0, 0);
  }
  if (!working || !action) return;
  const active = rig.taskProps[action];
  if (!active) return;
  if (action === 'repair') {
    active.rotation.z = Math.sin(elapsed * 4.8) * 0.16 * motionScale;
    active.position.y = -0.08;
  } else if (action === 'water') {
    active.rotation.z = -0.18 + Math.sin(elapsed * 2.4) * 0.07 * motionScale;
  } else if (action === 'guide') {
    active.rotation.y = Math.sin(elapsed * 1.6) * 0.18 * motionScale;
  } else {
    active.position.y = Math.sin(elapsed * 2.6) * 0.025 * motionScale;
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

function switchExternalAction(record: NpcRecord, action: 'idle' | 'walk' | 'run' | 'jump'): void {
  if (record.externalAction === action) return;
  const next = record.externalActions[action];
  if (!next) return;
  const previous = record.externalAction ? record.externalActions[record.externalAction] : null;
  const fadeSeconds = action === 'jump' || record.externalAction === 'jump' ? 0.12 : 0.24;
  const entryTime = getLocomotionTransitionEntryTime(
    record.externalAction,
    action,
    previous?.time ?? 0,
    previous?.getClip().duration ?? 0,
    next.getClip().duration,
    record.state.gaitPhase,
  );
  next.reset();
  next.time = entryTime;
  next.fadeIn(fadeSeconds).play();
  previous?.fadeOut(fadeSeconds);
  record.externalAction = action;
}

function sampleInteractionPath(
  path: readonly (readonly [number, number, number])[],
  progress: number,
  fallbackForward: readonly [number, number, number],
): { position: [number, number, number]; forward: [number, number, number] } {
  const firstPoint = path[0] ?? ([0, 0.22, 0] as const);
  const points = path.length >= 2 ? path : [firstPoint, firstPoint];
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return Math.hypot(point[0] - previous[0], point[2] - previous[2]);
  });
  const totalLength = lengths.reduce((total, length) => total + length, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * totalLength;
  for (let index = 0; index < lengths.length; index += 1) {
    const from = points[index] ?? firstPoint;
    const to = points[index + 1] ?? from;
    const segmentLength = lengths[index] ?? 0;
    if (remaining > segmentLength && index < lengths.length - 1) {
      remaining -= segmentLength;
      continue;
    }
    const amount = segmentLength > 0 ? Math.min(1, remaining / segmentLength) : 1;
    const directionX = to[0] - from[0];
    const directionZ = to[2] - from[2];
    const directionLength = Math.hypot(directionX, directionZ);
    return {
      position: [
        from[0] + (to[0] - from[0]) * amount,
        from[1] + (to[1] - from[1]) * amount,
        from[2] + (to[2] - from[2]) * amount,
      ],
      forward:
        directionLength > 0.0001
          ? [directionX / directionLength, 0, directionZ / directionLength]
          : [...fallbackForward],
    };
  }
  return { position: [...(points.at(-1) ?? firstPoint)], forward: [...fallbackForward] };
}

async function loadExternalCharacters(records: NpcRecord[], root: Group): Promise<void> {
  root.userData.residentAssets = 'loading';
  const basePath = `${import.meta.env.BASE_URL}models/kenney-protagonists/`;
  const loader = new FBXLoader();
  const textureLoader = new TextureLoader();
  try {
    const [base, idleSource, runSource, jumpSource] = await Promise.all([
      loader.loadAsync(`${basePath}characterMedium.fbx`),
      loader.loadAsync(`${basePath}idle.fbx`),
      loader.loadAsync(`${basePath}run.fbx`),
      loader.loadAsync(`${basePath}jump.fbx`),
    ]);
    const idleClip = selectNamedAnimationClip(idleSource.animations, 'idle');
    const rawRunClip = selectNamedAnimationClip(runSource.animations, 'run');
    const jumpClip = selectNamedAnimationClip(jumpSource.animations, 'jump');
    if (!idleClip || !rawRunClip || !jumpClip) throw new Error('角色动画资源不完整');
    const runClip = stabilizeLocomotionVerticalMotion(
      rawRunClip,
      getLocomotionVerticalMotionScale('run'),
    );
    const walkClip = stabilizeLocomotionVerticalMotion(
      createWalkAnimationClip(rawRunClip, idleClip),
      getLocomotionVerticalMotionScale('walk'),
    );
    const clips = { idle: idleClip, walk: walkClip, run: runClip, jump: jumpClip };
    root.userData.residentAnimationClips = [
      clips.idle.name,
      clips.walk.name,
      clips.run.name,
      clips.jump.name,
    ].join('|');
    root.userData.residentAnimationVerticalRange = [
      `walk:${getLocomotionVerticalRange(clips.walk).toFixed(4)}`,
      `run:${getLocomotionVerticalRange(clips.run).toFixed(4)}`,
    ].join('|');

    const textures = new Map(
      await Promise.all(
        [...new Set(Object.values(EXTERNAL_SKINS))].map(async (fileName) => {
          const texture = await textureLoader.loadAsync(`${basePath}${fileName}`);
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 16;
          texture.magFilter = LinearFilter;
          texture.minFilter = LinearMipmapLinearFilter;
          texture.generateMipmaps = true;
          texture.needsUpdate = true;
          return [fileName, texture] as const;
        }),
      ),
    );

    await Promise.all(
      records.map(async (record) => {
        const character = cloneSkeleton(base) as Group;
        character.name = `${record.rig.id}-external-character`;
        const texture = textures.get(EXTERNAL_SKINS[record.rig.id]);
        if (!texture) throw new Error('角色贴图资源不完整');
        character.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const sourceMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          const clonedMaterials = sourceMaterials.map(
            (source) =>
              new MeshStandardMaterial({
                map: texture,
                color: '#ffffff',
                roughness: 0.64,
                metalness: 0.015,
                alphaTest: Math.max(0.08, source.alphaTest),
                side: source.side,
              }),
          );
          object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
          object.castShadow = true;
          object.receiveShadow = true;
          object.userData.npcId = record.rig.id;
        });
        character.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(character);
        const height = Math.max(0.001, bounds.max.y - bounds.min.y);
        const scale = 1.78 / height;
        character.scale.setScalar(scale);
        character.position.y = -bounds.min.y * scale;
        record.rig.proceduralVisuals.forEach((child) => {
          child.visible = false;
        });
        record.rig.root.add(character);
        record.externalCharacter = character;
        const mixer = new AnimationMixer(character);
        const jumpAction = mixer.clipAction(clips.jump);
        record.externalMixer = mixer;
        record.externalActions = {
          idle: mixer.clipAction(clips.idle),
          walk: mixer.clipAction(clips.walk),
          run: mixer.clipAction(clips.run),
          jump: jumpAction,
        };
        jumpAction.setLoop(LoopOnce, 1);
        jumpAction.clampWhenFinished = true;
        switchExternalAction(record, 'idle');
      }),
    );
    root.userData.residentTextureDetail = '1024px-anisotropic-16x';
    root.userData.residentAssets = 'ready';
  } catch {
    root.userData.residentAssets = 'fallback';
    root.userData.residentAnimationClips = 'fallback';
  }
}

export function createNpcSystem(
  profile: QualityProfile,
  options: Readonly<NpcSystemOptions> = {},
): NpcSystemAssembly {
  const root = new Group();
  root.name = 'npc-system';
  const routes = createNpcRoutes(options.pedestrianGraph);
  root.userData.navigationMode = options.pedestrianGraph ? 'pedestrian-graph' : 'fallback-routes';
  root.userData.obstacleAvoidance = options.colliders?.length ? 'slide-detour' : 'none';
  root.userData.routePlanning = options.pedestrianGraph
    ? 'profession+distributed-districts+activity-pauses'
    : 'fallback-routes';
  const npcIds = Object.keys(routes) as NpcId[];
  const records: NpcRecord[] = npcIds.map((id, index) => {
    const initialRouteProgress = INITIAL_ROUTE_PROGRESS[id];
    const state = createNpcRuntimeState(id, routes[id], initialRouteProgress);
    const visualHeading = Math.atan2(state.forward[0], state.forward[2]);
    const record: NpcRecord = {
      baseRoute: routes[id],
      route: routes[id],
      state,
      snapshot: createNpcSnapshot(state),
      rig: createCharacter(id),
      bob: (elapsed, motionScale) =>
        Math.sin(elapsed * (0.18 + (index % 4) * 0.07) + index * 0.83) *
        (0.045 + (index % 3) * 0.01) *
        motionScale,
      verticalOffset: 0,
      verticalVelocity: 0,
      recovering: false,
      externalMixer: null,
      externalActions: {},
      externalAction: null,
      externalCharacter: null,
      externalAnimationDelta: 0,
      motion: 'walk',
      vaulting: false,
      interaction: null,
      safePosition: [...state.position],
      safeForward: [...state.forward],
      routine: 'work',
      socialRemaining: 0,
      socialCooldown: 0,
      socialPartner: null,
      reaction: 'none',
      reactionRemaining: 0,
      reactionCooldown: 0,
      reactionSource: null,
      reactionPartner: null,
      crowdOffset: [0, 0],
      planarVelocity: [0, 0],
      visualHeading,
      visualTurnVelocity: 0,
      locomotionLean: [0, 0],
      locomotionBlend: 0,
      cameraOccluded: false,
      detailTier: id === 'traveler' ? 'hero' : 'near',
    };
    record.rig.root.userData.initialRouteProgress = initialRouteProgress.toFixed(3);
    return record;
  });
  root.userData.initialRouteSpread = 'normalized-distance';
  let controlledId: NpcId | null = null;
  let vehicleColliders: TownCollider[] = [];
  let controlInput: NpcControlInput = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
  };
  let jumpConsumed = false;
  let worldTask: NpcWorldTaskAssignment | null = null;
  let worldTaskStatus: NpcWorldTaskStatus | null = null;
  let worldTaskWorkingSeconds = 0;
  let worldParticipation: NpcWorldParticipation | null = null;
  const socialPairCooldowns = new Map<string, number>();
  let worldTaskWaypoints: [number, number, number][] = [];
  let worldTaskWaypointIndex = 0;
  let relations = createResidentRelations();
  let qualityLevel: QualityLevel =
    profile.dprCap > 1.5 ? 'high' : profile.dprCap > 1 ? 'medium' : 'low';
  let detailDecorationsEnabled = profile.dprCap > 1;
  let visualFrame = 0;

  const rebuildWorldTaskRoute = () => {
    worldTaskWaypoints = [];
    worldTaskWaypointIndex = 0;
    if (!worldTask) return;
    const record = records.find((candidate) => candidate.rig.id === worldTask?.residentId);
    const graph = options.pedestrianGraph;
    if (record && graph) {
      const colliders = options.colliders ?? [];
      const findReachableNode = (position: readonly [number, number]) => {
        const reachable = graph.nodes
          .filter((node) => isNavigationSegmentClear(position, node.position, 0.42, colliders))
          .sort(
            (left, right) =>
              Math.hypot(left.position[0] - position[0], left.position[1] - position[1]) -
              Math.hypot(right.position[0] - position[0], right.position[1] - position[1]),
          );
        return reachable[0] ?? findNearestNavigationNode(graph, position);
      };
      const currentPosition: readonly [number, number] = [
        record.state.position[0],
        record.state.position[2],
      ];
      const taskPosition: readonly [number, number] = [worldTask.target[0], worldTask.target[2]];
      const start = findReachableNode(currentPosition);
      const target = findReachableNode(taskPosition);
      if (start && target) {
        const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
        worldTaskWaypoints = findNavigationRoute(graph, start.id, target.id)
          .flatMap((id) => {
            const node = nodes.get(id);
            return node ? ([[node.position[0], 0.22, node.position[1]]] as const) : [];
          })
          .map((position) => [...position]);
        if (
          worldTaskWaypoints[0] &&
          Math.hypot(
            worldTaskWaypoints[0][0] - currentPosition[0],
            worldTaskWaypoints[0][2] - currentPosition[1],
          ) <= 0.2
        ) {
          worldTaskWaypoints.shift();
        }
      }
    }
    const last = worldTaskWaypoints.at(-1);
    if (!last || Math.hypot(last[0] - worldTask.target[0], last[2] - worldTask.target[2]) > 0.12) {
      worldTaskWaypoints.push([...worldTask.target]);
    }
  };

  for (const record of records) {
    record.rig.root.position.set(...record.state.position);
    record.rig.root.rotation.y = record.visualHeading;
    record.rig.root.userData.motionSpeed = 0;
    record.rig.root.userData.previousMotionSpeed = 0;
    root.add(record.rig.root);
  }
  if (typeof window !== 'undefined') void loadExternalCharacters(records, root);

  const setQuality = (nextProfile: QualityProfile) => {
    qualityLevel = nextProfile.dprCap > 1.5 ? 'high' : nextProfile.dprCap > 1 ? 'medium' : 'low';
    detailDecorationsEnabled = nextProfile.dprCap > 1;
    for (const record of records) {
      record.rig.highDetail.visible =
        detailDecorationsEnabled && (record.detailTier === 'hero' || record.detailTier === 'near');
    }
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
    setControlled(id) {
      const releasedId = controlledId;
      if (controlledId && controlledId !== id) {
        const released = records.find((record) => record.rig.id === controlledId);
        if (released) released.recovering = true;
      }
      controlledId = id;
      if (id) {
        const controlled = records.find((record) => record.rig.id === id);
        if (controlled) {
          controlled.socialRemaining = 0;
          controlled.socialPartner = null;
          controlled.reaction = 'none';
          controlled.reactionRemaining = 0;
          controlled.reactionSource = null;
          controlled.reactionPartner = null;
          controlled.crowdOffset = [0, 0];
          controlled.rig.socialMarker.visible = false;
        }
        for (const record of records) {
          if (record.rig.id === id || record.reaction !== 'celebrate') continue;
          record.reaction = 'none';
          record.reactionRemaining = 0;
          record.reactionCooldown = 0;
          record.reactionSource = null;
          record.reactionPartner = null;
        }
      }
      if (releasedId && releasedId === worldTask?.residentId && releasedId !== id) {
        rebuildWorldTaskRoute();
      }
      if (!id) jumpConsumed = false;
    },
    setControlInput(input) {
      controlInput = {
        moveX: Math.max(-1, Math.min(1, input.moveX)),
        moveZ: Math.max(-1, Math.min(1, input.moveZ)),
        sprint: input.sprint,
        jump: input.jump,
      };
      if (!input.jump) jumpConsumed = false;
    },
    setVehicleObstacles(obstacles) {
      const halfWidth = 0.94;
      const halfLength = 1.6;
      vehicleColliders = obstacles.map((obstacle) => {
        const forwardX = Math.sin(obstacle.heading);
        const forwardZ = Math.cos(obstacle.heading);
        const rightX = Math.cos(obstacle.heading);
        const rightZ = -Math.sin(obstacle.heading);
        return {
          id: `vehicle-${obstacle.id}`,
          center: [obstacle.position[0], obstacle.position[2]],
          halfSize: [
            Math.abs(rightX) * halfWidth + Math.abs(forwardX) * halfLength,
            Math.abs(rightZ) * halfWidth + Math.abs(forwardZ) * halfLength,
          ],
          height: 1.8,
          vaultable: false,
        };
      });
      root.userData.dynamicVehicleColliders = vehicleColliders.length;
    },
    assignWorldTask(task) {
      const previousTask = worldTask;
      if (
        worldTask?.eventId !== task?.eventId ||
        worldTask?.stageId !== task?.stageId ||
        worldTask?.residentId !== task?.residentId
      ) {
        worldTaskWorkingSeconds = 0;
        worldTaskStatus = null;
      }
      worldTask = task
        ? {
            ...task,
            target: [...task.target],
          }
        : null;
      if (previousTask && !worldTask) {
        const released = records.find((record) => record.rig.id === previousTask.residentId);
        if (released && released.rig.id !== controlledId) released.recovering = true;
      }
      rebuildWorldTaskRoute();
    },
    getWorldTaskStatus: () => (worldTaskStatus ? { ...worldTaskStatus } : null),
    setWorldParticipation(participation) {
      worldParticipation = participation ? { ...participation } : null;
    },
    triggerVehicleHorn(position, forward) {
      const reacted: NpcId[] = [];
      for (const record of records) {
        if (
          record.rig.id === controlledId ||
          !record.rig.root.visible ||
          Boolean(record.interaction) ||
          worldTask?.residentId === record.rig.id ||
          worldParticipation?.residentId === record.rig.id
        ) {
          continue;
        }
        const offsetX = record.state.position[0] - position[0];
        const offsetZ = record.state.position[2] - position[2];
        const distance = Math.hypot(offsetX, offsetZ);
        if (distance < 0.25 || distance > 6.2) continue;
        const ahead = (offsetX * forward[0] + offsetZ * forward[2]) / distance;
        if (ahead < -0.15) continue;
        record.socialRemaining = 0;
        record.socialPartner = null;
        record.reaction = 'yield';
        record.reactionRemaining = 1.55;
        record.reactionCooldown = 4.5;
        record.reactionSource = [position[0], position[2]];
        record.reactionPartner = null;
        reacted.push(record.rig.id);
      }
      return reacted;
    },
    recordCollaboration(residentId, partnerId, collaborationId) {
      const next = recordResidentCollaboration(relations, {
        residentId,
        partnerId,
        collaborationId,
      });
      if (next === relations) return;
      relations = next;
      const left = records.find((record) => record.rig.id === residentId);
      const right = records.find((record) => record.rig.id === partnerId);
      for (const [record, partner] of [
        [left, right],
        [right, left],
      ] as const) {
        if (!record) continue;
        record.reaction = 'celebrate';
        record.reactionRemaining = 1.8;
        record.reactionCooldown = 5;
        record.reactionSource = partner
          ? [partner.state.position[0], partner.state.position[2]]
          : null;
        record.reactionPartner = partner?.rig.id ?? null;
      }
    },
    getRelations: () => getResidentRelations(relations),
    getNearestResident(sourceId, radius) {
      const source = records.find((record) => record.rig.id === sourceId);
      if (!source) return null;
      let nearest: NpcRecord | null = null;
      let nearestDistance = Math.max(0, radius);
      for (const record of records) {
        if (
          record.rig.id === sourceId ||
          !record.rig.root.visible ||
          Boolean(record.interaction) ||
          worldTask?.residentId === record.rig.id ||
          worldParticipation?.residentId === record.rig.id
        ) {
          continue;
        }
        const distance = Math.hypot(
          record.state.position[0] - source.state.position[0],
          record.state.position[2] - source.state.position[2],
        );
        if (distance > nearestDistance) continue;
        nearest = record;
        nearestDistance = distance;
      }
      return nearest
        ? {
            ...nearest.snapshot,
            position: [...nearest.snapshot.position],
            forward: [...nearest.snapshot.forward],
          }
        : null;
    },
    triggerResidentInteraction(sourceId, residentId) {
      const source = records.find((record) => record.rig.id === sourceId);
      const resident = records.find((record) => record.rig.id === residentId);
      if (!source || !resident || !resident.rig.root.visible) return null;
      const distance = Math.hypot(
        resident.state.position[0] - source.state.position[0],
        resident.state.position[2] - source.state.position[2],
      );
      if (distance > 2.6) return null;
      const relation = getResidentRelation(relations, sourceId, residentId);
      const reaction = getRelationshipReaction(relation);
      resident.socialRemaining = 0;
      resident.socialPartner = null;
      resident.reaction = reaction;
      resident.reactionRemaining =
        reaction === 'follow' ? 7.5 : reaction === 'approach' ? 2.6 : 1.65;
      resident.reactionCooldown = reaction === 'follow' ? 10 : 6;
      resident.reactionSource = [source.state.position[0], source.state.position[2]];
      resident.reactionPartner = sourceId;
      return reaction;
    },
    recover(id) {
      const record = records.find((candidate) => candidate.rig.id === id);
      if (!record) return;
      record.verticalOffset = 0;
      record.verticalVelocity = 0;
      record.planarVelocity = [0, 0];
      record.locomotionLean = [0, 0];
      record.locomotionBlend = 0;
      record.crowdOffset = [0, 0];
      record.interaction = null;
      record.state = {
        ...record.state,
        position: [...record.safePosition],
        forward: [...record.safeForward],
        activity: 'idle',
        activityRemaining: 0,
      };
      record.motion = 'idle';
      record.visualHeading = Math.atan2(record.state.forward[0], record.state.forward[2]);
      record.visualTurnVelocity = 0;
      record.snapshot = createNpcSnapshot(record.state, record.motion);
      record.rig.root.position.set(...record.snapshot.position);
    },
    setResidentVisible(id, visible) {
      const record = records.find((candidate) => candidate.rig.id === id);
      if (!record) return;
      record.rig.root.visible = visible;
      if (!visible) {
        record.planarVelocity = [0, 0];
        record.visualTurnVelocity = 0;
        record.crowdOffset = [0, 0];
        record.state.activity = 'idle';
        record.state.activityRemaining = 0;
        record.motion = 'driving';
        record.snapshot = {
          ...record.snapshot,
          activity: 'idle',
          motion: 'driving',
          position: [...record.state.position],
          forward: [...record.state.forward],
        };
      }
    },
    playVehicleTransition(id, phase, target, forward, duration, waypoints = []) {
      const record = records.find((candidate) => candidate.rig.id === id);
      if (!record) return;
      record.verticalOffset = 0;
      record.verticalVelocity = 0;
      record.planarVelocity = [0, 0];
      record.locomotionLean = [0, 0];
      record.visualTurnVelocity = 0;
      record.crowdOffset = [0, 0];
      record.interaction = {
        phase,
        elapsed: 0,
        duration: Math.max(0.1, duration),
        path: [
          [...record.state.position],
          ...waypoints.map((waypoint) => [...waypoint] as [number, number, number]),
          [...target],
        ],
        target: [...target],
        forward: [...forward],
      };
      record.motion = phase;
    },
    teleportResident(id, position, forward) {
      const record = records.find((candidate) => candidate.rig.id === id);
      if (!record) return;
      record.state = {
        ...record.state,
        position: [...position],
        forward: [...forward],
        activity: 'idle',
        activityRemaining: 0,
      };
      record.planarVelocity = [0, 0];
      record.locomotionLean = [0, 0];
      record.locomotionBlend = 0;
      record.crowdOffset = [0, 0];
      record.visualHeading = Math.atan2(forward[0], forward[2]);
      record.visualTurnVelocity = 0;
      record.snapshot = createNpcSnapshot(record.state);
      record.rig.root.position.set(...position);
      const resolved = resolveCircleAgainstRects(
        [position[0], position[2]],
        0.42,
        options.colliders ?? [],
      );
      if (
        position[1] >= 0 &&
        position[0] >= TOWN_PLAYABLE_MIN_X &&
        position[0] <= TOWN_PLAYABLE_MAX_X &&
        position[2] >= TOWN_PLAYABLE_MIN_Z &&
        position[2] <= TOWN_PLAYABLE_MAX_Z &&
        Math.abs(resolved[0] - position[0]) < 0.01 &&
        Math.abs(resolved[1] - position[2]) < 0.01
      ) {
        record.safePosition = [...position];
        record.safeForward = [...forward];
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
      if (!record) return null;
      return getNpcCameraPose(
        {
          ...record.snapshot,
          position: [
            record.snapshot.position[0],
            record.state.position[1] + record.verticalOffset,
            record.snapshot.position[2],
          ],
          forward: [...record.snapshot.forward],
        },
        mode,
      );
    },
    update(signals, elapsed, delta, timeOfDay = 12, observerPosition) {
      visualFrame += 1;
      const detailTierCounts: Record<ResidentDetailTier, number> = {
        hero: 0,
        near: 0,
        mid: 0,
        far: 0,
      };
      const ignoredVehicleId = worldTask?.ignoreVehicleId ?? null;
      root.userData.ignoredVehicleCollider = ignoredVehicleId ?? 'none';
      const movementColliders = [
        ...(options.colliders ?? []),
        ...vehicleColliders.filter(
          (collider) => !ignoredVehicleId || collider.id !== `vehicle-${ignoredVehicleId}`,
        ),
      ];
      root.userData.controlledCollision = 'clear';
      const routine = getNpcRoutine(timeOfDay);
      for (const [pairKey, remaining] of socialPairCooldowns) {
        const nextRemaining = remaining - delta;
        if (nextRemaining <= 0) socialPairCooldowns.delete(pairKey);
        else socialPairCooldowns.set(pairKey, nextRemaining);
      }
      for (const record of records) {
        const previousRoutine = record.routine;
        record.routine = routine;
        if (
          previousRoutine !== routine &&
          record.rig.id !== controlledId &&
          worldTask?.residentId !== record.rig.id &&
          worldParticipation?.residentId !== record.rig.id
        ) {
          const plannedSchedule =
            (routine === 'commute' || routine === 'leisure') && options.pedestrianGraph
              ? createResidentRoutineRoute(record, routine, options.pedestrianGraph)
              : null;
          if (plannedSchedule) {
            record.route = plannedSchedule;
            record.state = {
              ...record.state,
              segmentIndex: 0,
              segmentProgress: 0,
              activity: 'walking',
              activityRemaining: 0,
            };
            record.recovering = false;
          } else if (
            routine === 'work' &&
            !shouldResidentHoldAtDestination(record.rig.id, routine)
          ) {
            record.route = record.baseRoute;
            record.state.activity = 'idle';
            record.state.activityRemaining = 0;
            record.recovering = true;
          } else {
            if (routine !== 'work') record.route = record.baseRoute;
            const currentStopId = record.route.nodes[record.state.segmentIndex]?.stopId;
            if (
              shouldResidentHoldAtDestination(record.rig.id, routine) &&
              isResidentRoutineDestination(record.rig.id, routine, currentStopId)
            ) {
              record.state.activityRemaining = Number.POSITIVE_INFINITY;
            } else {
              record.state.activity = 'walking';
              record.state.activityRemaining = 0;
            }
          }
        }
        record.socialCooldown = Math.max(0, record.socialCooldown - delta);
        record.reactionCooldown = Math.max(0, record.reactionCooldown - delta);
      }
      const controlled = controlledId
        ? records.find((record) => record.rig.id === controlledId)
        : null;
      if (controlled && routine !== 'rest') {
        for (const record of records) {
          if (
            record.rig.id === controlledId ||
            !record.rig.root.visible ||
            record.reactionRemaining > 0 ||
            record.reactionCooldown > 0 ||
            record.socialRemaining > 0 ||
            worldTask?.residentId === record.rig.id ||
            worldParticipation?.residentId === record.rig.id ||
            Boolean(record.interaction)
          ) {
            continue;
          }
          const distance = Math.hypot(
            record.state.position[0] - controlled.state.position[0],
            record.state.position[2] - controlled.state.position[2],
          );
          if (distance > 2.35) continue;
          const relation = getResidentRelation(relations, controlled.rig.id, record.rig.id);
          record.reaction = getRelationshipReaction(relation);
          record.reactionRemaining =
            record.reaction === 'follow' ? 7.5 : record.reaction === 'approach' ? 2.6 : 1.5;
          record.reactionCooldown = record.reaction === 'follow' ? 10 : 7;
          record.reactionSource = [controlled.state.position[0], controlled.state.position[2]];
          record.reactionPartner = controlled.rig.id;
        }
      }
      if (routine !== 'rest') {
        const socialCandidates = records.map((record) => ({
          id: record.rig.id,
          position: [
            record.state.position[0] + record.crowdOffset[0],
            record.state.position[2] + record.crowdOffset[1],
          ] as const,
          controlled: record.rig.id === controlledId,
          unavailable:
            record.state.activity === 'walking' ||
            record.socialRemaining > 0 ||
            record.socialCooldown > 0 ||
            record.reactionRemaining > 0 ||
            worldTask?.residentId === record.rig.id ||
            worldParticipation?.residentId === record.rig.id ||
            Boolean(record.interaction) ||
            !record.rig.root.visible,
        }));
        const scheduled = new Set<string>();
        const blockedSocialPairs = new Set(socialPairCooldowns.keys());
        let encounter = findSocialEncounter(socialCandidates, 1.25, blockedSocialPairs);
        while (encounter) {
          const [leftId, rightId] = encounter;
          const left = records.find((record) => record.rig.id === leftId);
          const right = records.find((record) => record.rig.id === rightId);
          if (left && right) {
            left.socialRemaining = 1.8;
            right.socialRemaining = 1.8;
            left.socialCooldown = 8;
            right.socialCooldown = 8;
            left.socialPartner = right.rig.id;
            right.socialPartner = left.rig.id;
            const pairKey = getSocialPairKey(left.rig.id, right.rig.id);
            socialPairCooldowns.set(pairKey, SOCIAL_PAIR_COOLDOWN_SECONDS);
            blockedSocialPairs.add(pairKey);
          }
          scheduled.add(leftId);
          scheduled.add(rightId);
          encounter = findSocialEncounter(
            socialCandidates.map((candidate) => ({
              ...candidate,
              unavailable: candidate.unavailable || scheduled.has(candidate.id),
            })),
            1.25,
            blockedSocialPairs,
          );
        }
      }
      const crowdAgents: CrowdAgent[] = records
        .filter((record) => record.rig.root.visible)
        .map((record) => ({
          id: record.rig.id,
          position: [
            record.state.position[0] + record.crowdOffset[0],
            record.state.position[2] + record.crowdOffset[1],
          ] as [number, number],
          controlled: record.rig.id === controlledId || Boolean(record.interaction),
          forward: [record.state.forward[0], record.state.forward[2]] as [number, number],
          moving:
            record.state.activity === 'walking' ||
            record.motion === 'run' ||
            record.motion === 'jump' ||
            record.motion === 'vault',
        }));
      const crowdOffsets = resolveCrowdOffsets(crowdAgents);
      const crowdTravelScales = new Map<string, number>();
      const crowdAvoidanceDebug: string[] = [];
      for (const record of records) {
        const previousPosition: [number, number] = [
          record.state.position[0] + record.crowdOffset[0],
          record.state.position[2] + record.crowdOffset[1],
        ];
        record.rig.root.userData.interactionProgress = 0;
        record.rig.root.userData.interactionTravelProgress = 0;
        record.rig.root.userData.interactionCrouch = 0;
        if (record.interaction) {
          const interaction = record.interaction;
          interaction.elapsed += delta;
          const progress = Math.min(1, interaction.elapsed / interaction.duration);
          const pose = getVehicleTransitionPose(interaction.phase, progress);
          const eased = pose.travelProgress;
          const pathSample = sampleInteractionPath(interaction.path, eased, interaction.forward);
          record.state.position = [
            pathSample.position[0],
            pathSample.position[1] - pose.crouch * 0.08,
            pathSample.position[2],
          ];
          record.state.forward = eased >= 0.995 ? [...interaction.forward] : pathSample.forward;
          record.state.activity = progress < 1 ? 'walking' : 'idle';
          record.motion = progress < 1 ? interaction.phase : 'idle';
          record.rig.root.userData.interactionProgress = progress;
          record.rig.root.userData.interactionTravelProgress = pose.travelProgress;
          record.rig.root.userData.interactionCrouch = pose.crouch;
          if (progress >= 1) record.interaction = null;
        } else if (!record.rig.root.visible) {
          record.planarVelocity = stepPlanarVelocity(record.planarVelocity, [0, 0], delta);
          record.crowdOffset = [0, 0];
          record.state.activity = 'idle';
          record.state.activityRemaining = 0;
          record.motion = 'driving';
          record.socialRemaining = 0;
          record.socialPartner = null;
          record.reaction = 'none';
          record.reactionRemaining = 0;
          record.reactionSource = null;
          record.reactionPartner = null;
        } else if (worldParticipation?.residentId === record.rig.id) {
          record.planarVelocity = stepPlanarVelocity(record.planarVelocity, [0, 0], delta);
          record.state.activity = 'working';
          record.state.activityRemaining = 0;
          record.motion = 'idle';
          record.recovering = false;
        } else if (record.rig.id === controlledId) {
          const magnitude = Math.hypot(controlInput.moveX, controlInput.moveZ);
          const normalizedX = magnitude > 1 ? controlInput.moveX / magnitude : controlInput.moveX;
          const normalizedZ = magnitude > 1 ? controlInput.moveZ / magnitude : controlInput.moveZ;
          const speed = controlInput.sprint ? 5.4 : 3.05;
          record.planarVelocity = stepPlanarVelocity(
            record.planarVelocity,
            [normalizedX * speed, normalizedZ * speed],
            delta,
          );
          const travelX = record.planarVelocity[0] * delta;
          const travelZ = record.planarVelocity[1] * delta;
          const proposed: [number, number] = [
            record.state.position[0] + travelX,
            record.state.position[2] + travelZ,
          ];
          const vaultableAhead = controlInput.jump
            ? (options.colliders ?? []).find(
                (collider) =>
                  collider.vaultable &&
                  Math.abs(proposed[0] - collider.center[0]) < collider.halfSize[0] + 0.48 &&
                  Math.abs(proposed[1] - collider.center[1]) < collider.halfSize[1] + 0.48,
              )
            : null;
          const ignoredVaultables = controlInput.jump
            ? movementColliders.filter((collider) => !collider.vaultable)
            : movementColliders;
          const resolved = resolveCircleSlideMovement(
            [record.state.position[0], record.state.position[2]],
            proposed,
            0.42,
            ignoredVaultables,
          );
          const moved = Math.hypot(
            resolved[0] - record.state.position[0],
            resolved[1] - record.state.position[2],
          );
          const intendedTravel = Math.hypot(travelX, travelZ);
          const blockedByCollision = intendedTravel > 0.001 && moved < intendedTravel * 0.72;
          if (blockedByCollision && magnitude > 0.0001) {
            const movementHeading = Math.atan2(normalizedX, normalizedZ);
            record.state.forward = [Math.sin(movementHeading), 0, Math.cos(movementHeading)];
          } else if (moved > 0.0001) {
            const movementHeading = Math.atan2(
              resolved[0] - record.state.position[0],
              resolved[1] - record.state.position[2],
            );
            record.state.forward = [Math.sin(movementHeading), 0, Math.cos(movementHeading)];
          }
          if (moved > 0.0001) {
            record.state.gaitPhase = (record.state.gaitPhase + moved * 5.4) % (Math.PI * 2);
          }
          if (blockedByCollision) {
            root.userData.controlledCollision = 'blocked';
          }
          record.state.position = [
            Math.max(TOWN_PLAYABLE_MIN_X, Math.min(TOWN_PLAYABLE_MAX_X, resolved[0])),
            0.22,
            Math.max(TOWN_PLAYABLE_MIN_Z, Math.min(TOWN_PLAYABLE_MAX_Z, resolved[1])),
          ];
          record.state.activity = moved > 0.001 ? 'walking' : 'idle';
          record.motion = getControlledLocomotionMotion(
            record.motion,
            moved > 0.001,
            controlInput.sprint,
            Math.hypot(...record.planarVelocity),
          );
          record.state.activityRemaining = 0;
          record.recovering = false;
          if (controlInput.jump && !jumpConsumed && record.verticalOffset <= 0.001) {
            record.vaulting = Boolean(vaultableAhead);
            record.verticalVelocity = record.vaulting ? 4.35 : 5.15;
            record.motion = record.vaulting ? 'vault' : 'jump';
            jumpConsumed = true;
          }
        } else if (worldTask?.residentId === record.rig.id) {
          let taskTarget = worldTaskWaypoints[worldTaskWaypointIndex] ?? worldTask.target;
          let waypointDistance = Math.hypot(
            taskTarget[0] - record.state.position[0],
            taskTarget[2] - record.state.position[2],
          );
          if (waypointDistance <= 0.2 && worldTaskWaypointIndex < worldTaskWaypoints.length - 1) {
            worldTaskWaypointIndex += 1;
            taskTarget = worldTaskWaypoints[worldTaskWaypointIndex] ?? worldTask.target;
            waypointDistance = Math.hypot(
              taskTarget[0] - record.state.position[0],
              taskTarget[2] - record.state.position[2],
            );
          }
          const finalDistance = Math.hypot(
            worldTask.target[0] - record.state.position[0],
            worldTask.target[2] - record.state.position[2],
          );
          const atFinalWaypoint = worldTaskWaypointIndex >= worldTaskWaypoints.length - 1;
          if (!atFinalWaypoint || waypointDistance > 0.18) {
            const distance = Math.max(0.001, waypointDistance);
            const travel = Math.min(distance, record.route.speed * 1.08 * delta);
            const directionX = (taskTarget[0] - record.state.position[0]) / distance;
            const directionZ = (taskTarget[2] - record.state.position[2]) / distance;
            const proposed: [number, number] = [
              record.state.position[0] + directionX * travel,
              record.state.position[2] + directionZ * travel,
            ];
            const resolved = resolveCircleMovement(
              [record.state.position[0], record.state.position[2]],
              proposed,
              0.42,
              movementColliders,
            );
            const moved = Math.hypot(
              resolved[0] - record.state.position[0],
              resolved[1] - record.state.position[2],
            );
            record.state.position = [resolved[0], 0.22, resolved[1]];
            if (moved > 0.001) {
              record.state.forward = [directionX, 0, directionZ];
              record.state.gaitPhase = (record.state.gaitPhase + moved * 5.4) % (Math.PI * 2);
            }
            record.state.activity = moved > 0.001 ? 'walking' : 'idle';
            record.motion = moved > 0.001 ? 'walk' : 'idle';
            worldTaskStatus = {
              eventId: worldTask.eventId,
              stageId: worldTask.stageId,
              residentId: record.rig.id,
              phase: 'traveling',
              distance: finalDistance,
              workingSeconds: worldTaskWorkingSeconds,
            };
          } else {
            worldTaskWorkingSeconds += delta;
            record.state.activity = 'working';
            record.state.activityRemaining = 0;
            record.motion = 'idle';
            worldTaskStatus = {
              eventId: worldTask.eventId,
              stageId: worldTask.stageId,
              residentId: record.rig.id,
              phase: 'working',
              distance: finalDistance,
              workingSeconds: worldTaskWorkingSeconds,
            };
          }
          record.recovering = false;
        } else if (record.reactionRemaining > 0) {
          record.reactionRemaining = Math.max(0, record.reactionRemaining - delta);
          const reactionPartner = record.reactionPartner
            ? records.find((candidate) => candidate.rig.id === record.reactionPartner)
            : null;
          if (reactionPartner) {
            record.reactionSource = [
              reactionPartner.state.position[0],
              reactionPartner.state.position[2],
            ];
          }
          record.state.activity = 'idle';
          record.motion =
            record.reaction === 'wave' || record.reaction === 'celebrate' ? 'greet' : 'idle';
          if (record.reactionSource) {
            const sourceX = record.reactionSource[0] - record.state.position[0];
            const sourceZ = record.reactionSource[1] - record.state.position[2];
            const length = Math.max(0.001, Math.hypot(sourceX, sourceZ));
            if (record.reaction === 'yield') {
              const previousReactionPosition: [number, number] = [
                record.state.position[0],
                record.state.position[2],
              ];
              const proposed: [number, number] = [
                record.state.position[0] - (sourceX / length) * delta * 1.3,
                record.state.position[2] - (sourceZ / length) * delta * 1.3,
              ];
              const resolved = resolveCircleMovement(
                [record.state.position[0], record.state.position[2]],
                proposed,
                0.42,
                movementColliders,
              );
              record.state.position = [resolved[0], 0.22, resolved[1]];
              record.state.forward = [-sourceX / length, 0, -sourceZ / length];
              record.state.gaitPhase =
                (record.state.gaitPhase +
                  Math.hypot(
                    resolved[0] - previousReactionPosition[0],
                    resolved[1] - previousReactionPosition[1],
                  ) *
                    5.4) %
                (Math.PI * 2);
              record.state.activity = 'walking';
              record.state.activityRemaining = 0;
              record.motion = 'walk';
            } else if (record.reaction === 'approach' || record.reaction === 'follow') {
              const desiredDistance = record.reaction === 'follow' ? 1.6 : 1.05;
              if (length > desiredDistance) {
                const previousReactionPosition: [number, number] = [
                  record.state.position[0],
                  record.state.position[2],
                ];
                const travel = Math.min(
                  length - desiredDistance,
                  delta * (record.reaction === 'follow' ? 1.55 : 1.2),
                );
                const proposed: [number, number] = [
                  record.state.position[0] + (sourceX / length) * travel,
                  record.state.position[2] + (sourceZ / length) * travel,
                ];
                const resolved = resolveCircleMovement(
                  [record.state.position[0], record.state.position[2]],
                  proposed,
                  0.42,
                  movementColliders,
                );
                record.state.position = [resolved[0], 0.22, resolved[1]];
                record.state.forward = [sourceX / length, 0, sourceZ / length];
                record.state.gaitPhase =
                  (record.state.gaitPhase +
                    Math.hypot(
                      resolved[0] - previousReactionPosition[0],
                      resolved[1] - previousReactionPosition[1],
                    ) *
                      5.4) %
                  (Math.PI * 2);
                record.state.activity = 'walking';
                record.state.activityRemaining = 0;
                record.motion = 'walk';
              } else {
                record.state.forward = [sourceX / length, 0, sourceZ / length];
              }
            } else {
              record.state.forward = [sourceX / length, 0, sourceZ / length];
            }
          }
          if (record.reactionRemaining <= 0) {
            const shouldRecoverRoute =
              record.reaction === 'yield' ||
              record.reaction === 'approach' ||
              record.reaction === 'follow';
            record.reaction = 'none';
            record.reactionSource = null;
            record.reactionPartner = null;
            record.motion = 'idle';
            if (shouldRecoverRoute) record.recovering = true;
          }
        } else if (record.socialRemaining > 0) {
          record.socialRemaining = Math.max(0, record.socialRemaining - delta);
          record.state.activity = 'idle';
          record.motion = record.socialRemaining > 0 ? 'greet' : 'idle';
          const partner = records.find((candidate) => candidate.rig.id === record.socialPartner);
          if (partner) {
            const directionX = partner.state.position[0] - record.state.position[0];
            const directionZ = partner.state.position[2] - record.state.position[2];
            const length = Math.max(0.001, Math.hypot(directionX, directionZ));
            record.state.forward = [directionX / length, 0, directionZ / length];
          }
          if (record.socialRemaining <= 0) record.socialPartner = null;
        } else if (routine === 'rest') {
          const homeStopId = getResidentRoutineDestinationStop(record.rig.id, routine);
          const target =
            record.route.nodes.find((node) => node.stopId === homeStopId)?.position ??
            record.route.nodes[0]?.position ??
            record.state.position;
          const distance = Math.hypot(
            target[0] - record.state.position[0],
            target[2] - record.state.position[2],
          );
          if (distance > 0.08) {
            const travel = Math.min(distance, record.route.speed * 0.72 * delta);
            const directionX = (target[0] - record.state.position[0]) / distance;
            const directionZ = (target[2] - record.state.position[2]) / distance;
            const resolved = resolveCircleMovement(
              [record.state.position[0], record.state.position[2]],
              [
                record.state.position[0] + directionX * travel,
                record.state.position[2] + directionZ * travel,
              ],
              0.42,
              movementColliders,
            );
            const movedX = resolved[0] - record.state.position[0];
            const movedZ = resolved[1] - record.state.position[2];
            const moved = Math.max(0.001, Math.hypot(movedX, movedZ));
            record.state.position = [resolved[0], 0.22, resolved[1]];
            record.state.forward = [movedX / moved, 0, movedZ / moved];
            record.state.activity = 'walking';
            record.motion = 'walk';
          } else {
            record.state.position = [...target];
            record.state.activity = 'idle';
            record.motion = 'idle';
          }
        } else if (record.recovering) {
          const routePoint = getClosestNpcRoutePoint(
            record.route,
            record.state.position,
            record.state.segmentIndex,
          );
          const target = routePoint.position;
          if (routePoint.distance < 0.08) {
            record.recovering = false;
            record.state.segmentIndex = routePoint.segmentIndex;
            record.state.segmentProgress = routePoint.segmentProgress;
            record.state.position = [...routePoint.position];
            record.state.forward = [...routePoint.forward];
            record.state.activity = 'walking';
            record.state.activityRemaining = 0;
            record.motion = 'walk';
          } else {
            const travel = Math.min(routePoint.distance, record.route.speed * delta);
            const directionX = (target[0] - record.state.position[0]) / routePoint.distance;
            const directionZ = (target[2] - record.state.position[2]) / routePoint.distance;
            const resolved = resolveCircleMovement(
              [record.state.position[0], record.state.position[2]],
              [
                record.state.position[0] + directionX * travel,
                record.state.position[2] + directionZ * travel,
              ],
              0.42,
              movementColliders,
            );
            const movedX = resolved[0] - record.state.position[0];
            const movedZ = resolved[1] - record.state.position[2];
            const moved = Math.hypot(movedX, movedZ);
            record.state.position = [resolved[0], 0.22, resolved[1]];
            if (moved > 0.001) {
              record.state.forward = [movedX / moved, 0, movedZ / moved];
              record.state.gaitPhase = (record.state.gaitPhase + moved * 5.4) % (Math.PI * 2);
            }
            record.state.activity = moved > 0.001 ? 'walking' : 'idle';
            record.motion = moved > 0.001 ? 'walk' : 'idle';
          }
        } else {
          const beforeStep: [number, number] = [record.state.position[0], record.state.position[2]];
          const stateBeforeStep = record.state;
          const wasWalking = record.state.activity === 'walking';
          const crowdTravelScale = getCrowdTravelScale(record.rig.id, crowdAgents);
          crowdTravelScales.set(record.rig.id, crowdTravelScale);
          const routeDelta = delta * crowdTravelScale;
          record.state = stepNpcRuntime(
            stateBeforeStep,
            record.route,
            { rain: signals.rain, snow: signals.snow, daylight: signals.daylight },
            routeDelta,
          );
          const rawRequestedMovement: [number, number] = [
            record.state.position[0] - beforeStep[0],
            record.state.position[2] - beforeStep[1],
          ];
          const rawRequestedDistance = Math.hypot(...rawRequestedMovement);
          const maximumRequestedDistance = Math.max(0, record.route.speed * routeDelta * 1.05);
          const requestedScale =
            rawRequestedDistance > maximumRequestedDistance && rawRequestedDistance > 0.001
              ? maximumRequestedDistance / rawRequestedDistance
              : 1;
          const requestedMovement: [number, number] = [
            rawRequestedMovement[0] * requestedScale,
            rawRequestedMovement[1] * requestedScale,
          ];
          const requestedDistance = Math.hypot(...requestedMovement);
          const obstacleResolved = resolveCircleMovement(
            beforeStep,
            [beforeStep[0] + requestedMovement[0], beforeStep[1] + requestedMovement[1]],
            0.42,
            movementColliders,
          );
          const crowdResolved = resolveCrowdMovement(
            record.rig.id,
            [beforeStep[0] + record.crowdOffset[0], beforeStep[1] + record.crowdOffset[1]],
            [
              obstacleResolved[0] + record.crowdOffset[0],
              obstacleResolved[1] + record.crowdOffset[1],
            ],
            crowdAgents,
            0.84,
            Math.hypot(obstacleResolved[0] - beforeStep[0], obstacleResolved[1] - beforeStep[1]) *
              1.5,
          );
          const resolved = resolveCircleMovement(
            beforeStep,
            [crowdResolved[0] - record.crowdOffset[0], crowdResolved[1] - record.crowdOffset[1]],
            0.42,
            movementColliders,
          );
          const movedX = resolved[0] - beforeStep[0];
          const movedZ = resolved[1] - beforeStep[1];
          const moved = Math.hypot(movedX, movedZ);
          if (record.route !== record.baseRoute && requestedDistance > 0.001 && routeDelta > 0) {
            const forwardProgress = Math.max(
              0,
              Math.min(
                1,
                (movedX * requestedMovement[0] + movedZ * requestedMovement[1]) /
                  (requestedDistance * requestedDistance),
              ),
            );
            if (forwardProgress < 0.995) {
              record.state = stepNpcRuntime(
                stateBeforeStep,
                record.route,
                { rain: signals.rain, snow: signals.snow, daylight: signals.daylight },
                routeDelta * forwardProgress,
              );
            }
          }
          if (wasWalking && record.state.activity !== 'walking') {
            record.state.activityRemaining = getResidentDestinationDwellSeconds(
              record.rig.id,
              routine,
              record.state.activityRemaining,
              record.route.nodes[record.state.segmentIndex]?.stopId,
            );
          }
          record.state.position = [resolved[0], record.state.position[1], resolved[1]];
          if (moved > 0.001) record.state.forward = [movedX / moved, 0, movedZ / moved];
          record.motion = record.state.activity === 'walking' && moved > 0.001 ? 'walk' : 'idle';
        }
        const rawCrowdAvoidance = crowdOffsets[record.rig.id] ?? [0, 0];
        let crowdAvoidance: [number, number] = rawCrowdAvoidance;
        if (
          record.rig.id !== controlledId &&
          !record.interaction &&
          Math.hypot(...rawCrowdAvoidance) > 0.001
        ) {
          const basePosition: [number, number] = [
            record.state.position[0],
            record.state.position[2],
          ];
          const candidates: [[number, number], [number, number]] = [
            resolveCircleAgainstRects(
              [basePosition[0] + rawCrowdAvoidance[0], basePosition[1] + rawCrowdAvoidance[1]],
              0.42,
              movementColliders,
            ),
            resolveCircleAgainstRects(
              [basePosition[0] - rawCrowdAvoidance[0], basePosition[1] - rawCrowdAvoidance[1]],
              0.42,
              movementColliders,
            ),
          ];
          const otherPositions = crowdAgents
            .filter((agent) => agent.id !== record.rig.id)
            .map((agent) => agent.position);
          const sidePosition =
            record.route === record.baseRoute
              ? pickClearestCrowdPosition(
                  candidates,
                  otherPositions,
                  rawCrowdAvoidance[0] * record.crowdOffset[0] +
                    rawCrowdAvoidance[1] * record.crowdOffset[1] >=
                    0
                    ? 0
                    : 1,
                  0.12,
                )
              : pickCrowdPassingPosition(
                  candidates,
                  basePosition,
                  Math.hypot(...rawCrowdAvoidance),
                  otherPositions,
                  0.12,
                );
          const selected = pickClearestCrowdPosition(
            [sidePosition, basePosition],
            otherPositions,
            0,
            0.12,
          );
          crowdAvoidance = [selected[0] - basePosition[0], selected[1] - basePosition[1]];
        }
        const crowdTarget = getCrowdOffsetTarget(
          record.crowdOffset,
          crowdAvoidance,
          record.state.activity === 'walking' ||
            record.motion === 'run' ||
            record.motion === 'jump' ||
            record.motion === 'vault' ||
            worldTask?.residentId === record.rig.id ||
            worldParticipation?.residentId === record.rig.id,
        );
        const requiresImmediateCrowdClearance = crowdAgents.some((agent) => {
          if (agent.id === record.rig.id) return false;
          const distance = Math.hypot(
            agent.position[0] - record.state.position[0],
            agent.position[1] - record.state.position[2],
          );
          return distance < 0.84 && (Boolean(agent.controlled) || elapsed <= 0.1);
        });
        crowdAvoidanceDebug.push(
          `${record.rig.id}:${rawCrowdAvoidance[0].toFixed(3)},${rawCrowdAvoidance[1].toFixed(3)}>${crowdAvoidance[0].toFixed(3)},${crowdAvoidance[1].toFixed(3)}`,
        );
        if (record.rig.id === controlledId || record.interaction) {
          record.crowdOffset = [0, 0];
        } else {
          record.crowdOffset = limitCrowdOffsetStep(
            record.crowdOffset,
            clampCrowdOffset(
              stepCrowdOffset(record.crowdOffset, crowdTarget, delta),
              MAX_CROWD_OFFSET,
            ),
            requiresImmediateCrowdClearance ? MAX_CROWD_OFFSET : Math.max(0, delta) * 1.2,
          );
        }
        if (record.rig.id !== controlledId && !record.interaction) {
          const separated = resolveCircleAgainstRects(
            [
              record.state.position[0] + record.crowdOffset[0],
              record.state.position[2] + record.crowdOffset[1],
            ],
            0.42,
            movementColliders,
          );
          record.crowdOffset = clampCrowdOffset(
            [separated[0] - record.state.position[0], separated[1] - record.state.position[2]],
            MAX_CROWD_OFFSET,
          );
        }
        let actualPosition: [number, number] = [
          record.state.position[0] + record.crowdOffset[0],
          record.state.position[2] + record.crowdOffset[1],
        ];
        if (record.rig.id !== controlledId && !record.interaction) {
          let obstacleSeparated: [number, number] = actualPosition;
          for (let pass = 0; pass < 6; pass += 1) {
            const residentSeparated = resolveCrowdMovement(
              record.rig.id,
              previousPosition,
              obstacleSeparated,
              crowdAgents,
            );
            obstacleSeparated = resolveCircleAgainstRects(
              residentSeparated,
              0.42,
              movementColliders,
            );
          }
          record.crowdOffset = limitCrowdOffsetStep(
            record.crowdOffset,
            clampCrowdOffset(
              [
                obstacleSeparated[0] - record.state.position[0],
                obstacleSeparated[1] - record.state.position[2],
              ],
              MAX_CROWD_OFFSET,
            ),
            requiresImmediateCrowdClearance ? MAX_CROWD_OFFSET : Math.max(0, delta) * 1.2,
          );
          actualPosition = [
            record.state.position[0] + record.crowdOffset[0],
            record.state.position[2] + record.crowdOffset[1],
          ];
        }
        const crowdAgent = crowdAgents.find((agent) => agent.id === record.rig.id);
        if (crowdAgent) {
          crowdAgent.position = actualPosition;
          crowdAgent.forward = [record.state.forward[0], record.state.forward[2]];
          crowdAgent.moving =
            record.state.activity === 'walking' ||
            record.motion === 'run' ||
            record.motion === 'jump' ||
            record.motion === 'vault';
        }
        const actualVelocity: [number, number] =
          delta > 0
            ? [
                (actualPosition[0] - previousPosition[0]) / delta,
                (actualPosition[1] - previousPosition[1]) / delta,
              ]
            : [0, 0];
        if (record.rig.id === controlledId || record.interaction) {
          record.planarVelocity = actualVelocity;
        } else {
          record.planarVelocity = stepPlanarVelocity(
            record.planarVelocity,
            actualVelocity,
            delta,
            10,
            10,
          );
        }
        const motionSpeed = Math.hypot(...record.planarVelocity);
        const usesLocomotion =
          record.motion === 'walk' ||
          record.motion === 'run' ||
          record.motion === 'entering' ||
          record.motion === 'exiting';
        const targetBlend = usesLocomotion ? Math.min(1, motionSpeed / 3.05) : 0;
        record.locomotionBlend += (targetBlend - record.locomotionBlend) * Math.min(1, delta * 7.5);
        record.verticalVelocity -= 12.8 * delta;
        record.verticalOffset = Math.max(
          0,
          record.verticalOffset + record.verticalVelocity * delta,
        );
        if (record.verticalOffset === 0 && record.verticalVelocity < 0) {
          record.verticalVelocity = 0;
          record.vaulting = false;
          if (record.motion === 'jump' || record.motion === 'vault') {
            record.motion =
              record.rig.id === controlledId
                ? getControlledLocomotionMotion(
                    record.motion,
                    record.state.activity === 'walking',
                    controlInput.sprint,
                    motionSpeed,
                  )
                : record.state.activity === 'walking'
                  ? 'walk'
                  : 'idle';
          }
        } else if (record.verticalOffset > 0.02) {
          record.motion = record.vaulting ? 'vault' : 'jump';
        }
        const baseBob = record.bob(elapsed, signals.motionScale);
        const dailyTask = getResidentDailyTask(record.rig.id, record.routine);
        const taskAction =
          worldParticipation?.residentId === record.rig.id
            ? worldParticipation.action
            : worldTask?.residentId === record.rig.id
              ? worldTask.action
              : null;
        const taskLabel =
          worldParticipation?.residentId === record.rig.id
            ? worldParticipation.label
            : worldTask?.residentId === record.rig.id
              ? worldTask.label
              : dailyTask.label;
        record.snapshot = createNpcSnapshot(
          record.state,
          record.motion,
          record.routine,
          record.socialPartner,
          taskLabel,
          taskAction,
          record.reaction,
        );
        record.snapshot.position[0] += record.crowdOffset[0];
        record.snapshot.position[2] += record.crowdOffset[1];
        const observerDistance = observerPosition
          ? Math.hypot(
              observerPosition[0] - record.snapshot.position[0],
              observerPosition[2] - record.snapshot.position[2],
            )
          : 0;
        record.detailTier = getResidentDetailTier(observerDistance, {
          controlled: record.rig.id === controlledId,
          quality: qualityLevel,
        });
        record.cameraOccluded = observerPosition
          ? getResidentCameraOcclusion(
              record.cameraOccluded,
              observerDistance,
              record.rig.id === controlledId,
              Boolean(
                controlled &&
                  record.rig.id !== controlledId &&
                  isResidentBlockingChaseCamera(
                    [observerPosition[0], observerPosition[2]],
                    [controlled.snapshot.position[0], controlled.snapshot.position[2]],
                    [record.snapshot.position[0], record.snapshot.position[2]],
                    record.cameraOccluded,
                  ),
              ),
            )
          : false;
        detailTierCounts[record.detailTier] += 1;
        record.rig.root.userData.detailTier = record.detailTier;
        record.rig.root.userData.cameraOccluded = record.cameraOccluded;
        record.rig.root.userData.visualCadence = getResidentVisualCadence(record.detailTier);
        const useExternalCharacter = Boolean(
          record.rig.root.visible &&
            !record.cameraOccluded &&
            record.externalCharacter &&
            record.detailTier !== 'far',
        );
        if (record.externalCharacter) record.externalCharacter.visible = useExternalCharacter;
        for (const visual of record.rig.proceduralVisuals) {
          visual.visible = !record.cameraOccluded && !useExternalCharacter;
        }
        const stableContact =
          record.verticalOffset <= 0.001 &&
          (record.snapshot.activity === 'working' || record.motion === 'idle');
        record.snapshot.position[1] +=
          baseBob * getCharacterRootBobScale(useExternalCharacter, stableContact) +
          record.verticalOffset;
        record.rig.root.position.set(...record.snapshot.position);
        const targetHeading = Math.atan2(record.snapshot.forward[0], record.snapshot.forward[2]);
        const headingDelta = Math.atan2(
          Math.sin(targetHeading - record.visualHeading),
          Math.cos(targetHeading - record.visualHeading),
        );
        const locomotionAction = getLocomotionAnimationAction(record.motion, motionSpeed);
        const locomotionLeanTarget = record.interaction
          ? ([0, 0] as const)
          : getLocomotionLeanTarget(locomotionAction, motionSpeed, headingDelta);
        record.locomotionLean = stepLocomotionLean(
          record.locomotionLean,
          locomotionLeanTarget,
          delta,
        );
        const visualTurn = stepInertialHeading(
          {
            heading: record.visualHeading,
            angularVelocity: record.visualTurnVelocity,
          },
          targetHeading,
          delta,
        );
        record.visualHeading = visualTurn.heading;
        record.visualTurnVelocity = visualTurn.angularVelocity;
        record.rig.root.rotation.y = record.visualHeading;
        record.rig.highDetail.visible =
          !record.cameraOccluded &&
          detailDecorationsEnabled &&
          (record.detailTier === 'hero' || record.detailTier === 'near');
        record.rig.root.userData.previousMotionSpeed = record.rig.root.userData.motionSpeed ?? 0;
        record.rig.root.userData.motionSpeed = motionSpeed;
        record.rig.root.userData.motionBlend = record.locomotionBlend;
        record.rig.root.userData.motionLeanForward = record.locomotionLean[0];
        record.rig.root.userData.motionLeanTurn = record.locomotionLean[1];
        record.rig.root.userData.motionTurnVelocity = record.visualTurnVelocity;
        record.rig.root.userData.verticalOffset = record.verticalOffset;
        record.rig.root.userData.task = taskLabel;
        record.rig.root.userData.taskAction = taskAction ?? 'none';
        record.rig.root.userData.reaction = record.reaction;
        record.rig.root.userData.groundContact = stableContact ? 'stable' : 'moving';
        if (
          record.rig.id === controlledId &&
          record.verticalOffset <= 0.001 &&
          !record.interaction
        ) {
          record.safePosition = [...record.state.position];
          record.safeForward = [...record.state.forward];
        }
        animateRig(
          record.rig,
          record.snapshot.activity,
          record.motion,
          taskAction,
          record.snapshot.gaitPhase,
          elapsed,
          signals.motionScale,
          record.locomotionBlend,
          !useExternalCharacter,
        );
        if (
          !useExternalCharacter &&
          record.snapshot.activity !== 'working' &&
          record.motion !== 'greet'
        ) {
          record.rig.torso.rotation.x += record.locomotionLean[0] * 0.72;
          record.rig.torso.rotation.z -= record.locomotionLean[1] * 0.72;
        }
        if (record.reaction === 'nod') {
          record.rig.head.rotation.x = Math.sin(elapsed * 5.2) * 0.12 * signals.motionScale;
        }
        animateTaskProps(
          record.rig,
          taskAction,
          record.snapshot.activity === 'working',
          elapsed,
          signals.motionScale,
          delta,
        );
        if (record.cameraOccluded) {
          for (const prop of Object.values(record.rig.taskProps)) {
            if (prop) prop.visible = false;
          }
        }
        if (record.externalCharacter?.visible) {
          const interactionCrouch = Number(record.rig.root.userData.interactionCrouch ?? 0);
          record.externalCharacter.rotation.x = record.locomotionLean[0];
          record.externalCharacter.rotation.z = -record.locomotionLean[1];
          if (
            (record.motion === 'entering' || record.motion === 'exiting') &&
            interactionCrouch > 0
          ) {
            record.externalCharacter.rotation.x = interactionCrouch * 0.16;
            record.externalCharacter.rotation.z = 0;
          } else if (record.motion === 'greet') {
            record.externalCharacter.rotation.z =
              Math.sin(elapsed * 4.8) * 0.035 * signals.motionScale;
          } else if (taskAction === 'repair') {
            record.externalCharacter.rotation.z =
              Math.sin(elapsed * 4.1) * 0.045 * signals.motionScale;
          } else if (taskAction === 'guide') {
            record.externalCharacter.rotation.z =
              Math.sin(elapsed * 2.2) * 0.025 * signals.motionScale;
          }
          if (record.reaction === 'nod') {
            record.externalCharacter.rotation.x = Math.sin(elapsed * 5.2) * 0.025;
          }
          if (record.snapshot.activity === 'working' && taskAction) {
            record.externalCharacter.rotation.x =
              taskAction === 'repair' ? 0.16 : taskAction === 'water' ? 0.08 : 0.03;
          }
        }
        const visualAnimation = stepResidentVisualAnimation(
          record.externalAnimationDelta,
          delta,
          visualFrame,
          getResidentVisualCadence(record.detailTier),
          Boolean(record.externalMixer && record.externalCharacter?.visible),
        );
        record.externalAnimationDelta = visualAnimation.accumulatedDelta;
        if (
          record.externalMixer &&
          record.externalCharacter?.visible &&
          visualAnimation.updateDelta > 0
        ) {
          const interactionTravelProgress = Number(
            record.rig.root.userData.interactionTravelProgress ?? 0,
          );
          const transitionMoving =
            (record.motion === 'entering' && interactionTravelProgress < 0.995) ||
            (record.motion === 'exiting' && interactionTravelProgress > 0.005);
          const action = getLocomotionAnimationAction(
            transitionMoving ? 'entering' : record.motion,
            motionSpeed,
          );
          switchExternalAction(record, action);
          record.externalActions.walk?.setEffectiveTimeScale(
            record.motion === 'entering' || record.motion === 'exiting'
              ? 0.62
              : getWalkPlaybackRate(motionSpeed),
          );
          record.externalActions.run?.setEffectiveTimeScale(getMotionPlaybackRate(motionSpeed));
          record.externalMixer.update(visualAnimation.updateDelta);
        }
        record.rig.marker.rotation.z = elapsed * 0.34;
        record.rig.socialMarker.visible =
          !record.cameraOccluded &&
          (record.socialRemaining > 0 ||
            record.reaction === 'nod' ||
            record.reaction === 'wave' ||
            record.reaction === 'approach' ||
            record.reaction === 'follow' ||
            record.reaction === 'celebrate');
        record.rig.socialMarker.rotation.y = -record.rig.root.rotation.y;
        record.rig.coatMaterial.roughness = 0.82 - signals.wetness * 0.24;
        record.rig.snowMaterial.opacity = signals.snowCover * 0.82;
        record.rig.snowLayer.visible = !record.cameraOccluded && signals.snowCover > 0.01;
      }
      for (let separationPass = 0; separationPass < 3; separationPass += 1) {
        const finalOffsets = resolveCrowdOffsets(
          records
            .filter((record) => record.rig.root.visible)
            .map((record) => ({
              id: record.rig.id,
              position: [record.snapshot.position[0], record.snapshot.position[2]],
              controlled: record.rig.id === controlledId || Boolean(record.interaction),
              forward: [record.state.forward[0], record.state.forward[2]],
              moving:
                record.state.activity === 'walking' ||
                record.motion === 'run' ||
                record.motion === 'jump' ||
                record.motion === 'vault',
            })),
          0.84,
          0.84,
        );
        let moved = false;
        for (const record of records) {
          if (record.rig.id === controlledId || record.interaction || !record.rig.root.visible) {
            continue;
          }
          const offset = finalOffsets[record.rig.id] ?? [0, 0];
          if (Math.hypot(...offset) < 0.001) continue;
          const candidates: [[number, number], [number, number]] = [
            resolveCircleAgainstRects(
              [record.snapshot.position[0] + offset[0], record.snapshot.position[2] + offset[1]],
              0.42,
              movementColliders,
            ),
            resolveCircleAgainstRects(
              [record.snapshot.position[0] - offset[0], record.snapshot.position[2] - offset[1]],
              0.42,
              movementColliders,
            ),
          ];
          const separated = pickClearestCrowdPosition(
            candidates,
            records
              .filter((other) => other !== record && other.rig.root.visible)
              .map((other) => [other.snapshot.position[0], other.snapshot.position[2]]),
            offset[0] * record.crowdOffset[0] + offset[1] * record.crowdOffset[1] >= 0 ? 0 : 1,
            0.12,
          );
          const deltaX = separated[0] - record.snapshot.position[0];
          const deltaZ = separated[1] - record.snapshot.position[2];
          const previousX = record.snapshot.position[0];
          const previousZ = record.snapshot.position[2];
          record.crowdOffset = limitCrowdOffsetStep(
            record.crowdOffset,
            clampCrowdOffset(
              [record.crowdOffset[0] + deltaX, record.crowdOffset[1] + deltaZ],
              MAX_CROWD_OFFSET,
            ),
            Math.max(0, delta) * 0.45,
          );
          const boundedX = record.state.position[0] + record.crowdOffset[0];
          const boundedZ = record.state.position[2] + record.crowdOffset[1];
          record.snapshot.position[0] = boundedX;
          record.snapshot.position[2] = boundedZ;
          record.rig.root.position.x = boundedX;
          record.rig.root.position.z = boundedZ;
          moved ||= Math.hypot(boundedX - previousX, boundedZ - previousZ) > 0.001;
        }
        if (!moved) break;
      }
      root.userData.detailTierCounts = (['hero', 'near', 'mid', 'far'] as const)
        .map((tier) => `${tier}:${detailTierCounts[tier]}`)
        .join('|');
      root.userData.npcBasePositions = records
        .map(
          (record) =>
            `${record.rig.id}:${record.state.position[0].toFixed(3)},${record.state.position[2].toFixed(3)}`,
        )
        .join('|');
      root.userData.npcCrowdOffsets = records
        .map(
          (record) =>
            `${record.rig.id}:${record.crowdOffset[0].toFixed(3)},${record.crowdOffset[1].toFixed(3)}`,
        )
        .join('|');
      root.userData.residentScheduleRoutes = records
        .map(
          (record) =>
            `${record.rig.id}:${record.routine}:${getResidentRoutineDestinationStop(record.rig.id, record.routine)}:${record.route === record.baseRoute ? 'patrol' : 'direct'}:${record.route.nodes.length}`,
        )
        .join('|');
      root.userData.npcAnimationStates = records
        .map(
          (record) =>
            `${record.rig.id}:${record.externalAction ?? 'none'}:${(record.externalMixer?.time ?? 0).toFixed(3)}`,
        )
        .join('|');
      root.userData.npcMotionStates = records
        .map(
          (record) =>
            `${record.rig.id}:${record.visualHeading.toFixed(3)}:${record.visualTurnVelocity.toFixed(3)}:${record.motion}`,
        )
        .join('|');
      root.userData.npcRouteStates = records
        .map(
          (record) =>
            `${record.rig.id}:${record.state.activity}:${record.state.segmentIndex}:${record.state.segmentProgress.toFixed(3)}:${record.state.forward[0].toFixed(3)},${record.state.forward[2].toFixed(3)}`,
        )
        .join('|');
      root.userData.npcCrowdAvoidance = crowdAvoidanceDebug.join('|');
      root.userData.npcCrowdTravelScales = records
        .map(
          (record) => `${record.rig.id}:${(crowdTravelScales.get(record.rig.id) ?? 1).toFixed(3)}`,
        )
        .join('|');
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
