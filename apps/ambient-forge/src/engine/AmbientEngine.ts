import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  type AdaptiveQualityState,
  createAdaptiveQualityState,
  setAdaptiveQualityPreference,
  stepAdaptiveQuality,
} from '../core/adaptive-quality';
import { type AmbientInputs, clampAmbientInputs, type WeatherMode } from '../core/ambient-inputs';
import { clipCameraAgainstColliders } from '../core/camera-collision';
import {
  type CameraOrbitState,
  DEFAULT_CAMERA_ORBIT,
  orbitCameraPosition,
  stepAnchoredChasePose,
  stepChaseOrbitAngle,
} from '../core/camera-orbit';
import {
  advanceCameraTour,
  CAMERA_VIEW_PRESETS,
  type CameraTourState,
  type CameraViewId,
  DEFAULT_CAMERA_TOUR_STATE,
  getCameraTransitionEase,
  getCameraTransitionProgress,
} from '../core/camera-tour';
import {
  DEFAULT_NPC_CAMERA_STATE,
  NPC_PROFILES,
  type NpcCameraState,
  type NpcId,
  type NpcSnapshot,
  type NpcViewMode,
} from '../core/npc';
import { createNpcConversation, type NpcInteractionHudState } from '../core/npc-interactions';
import { getPhotoFilterStyle, type PhotoFilter } from '../core/photo-mode';
import {
  createWorldControlState,
  getCameraRelativeResidentMovement,
  getClosestVehicleDoorPose,
  getResidentMovementBasis,
  getVehicleDriverDoorApproach,
  getVehicleDriverDoorPose,
  PLAYER_RESIDENT_ID,
  PLAYER_SPAWN_FORWARD,
  PLAYER_SPAWN_POSITION,
  transitionWorldControl,
  type WorldControlEvent,
  type WorldControlState,
} from '../core/playable-world';
import { getQualityProfile, type QualityLevel, type QualityProfile } from '../core/quality';
import { shouldResizeRendererForQuality } from '../core/quality-runtime';
import {
  createResidentMobilityState,
  type ResidentMobilityState,
  type ResidentTripPlan,
  stepResidentMobility,
} from '../core/resident-mobility';
import { getResidentScheduleTime } from '../core/resident-schedule';
import { deriveSceneSignals } from '../core/scene-signals';
import {
  appendTownJournalEntry,
  createTownJournalState,
  type TownJournalEntryInput,
  type TownJournalState,
} from '../core/town-journal';
import {
  scaleTownVec3,
  TOWN_PLAYABLE_MAX_X,
  TOWN_PLAYABLE_MAX_Z,
  TOWN_PLAYABLE_MIN_X,
  TOWN_PLAYABLE_MIN_Z,
} from '../core/town-layout';
import {
  createSurfaceAccumulation,
  getWeatherTargets,
  type SurfaceAccumulation,
  stepSurfaceAccumulation,
  stepWeatherTransition,
  type WeatherTargets,
} from '../core/weather';
import {
  createWeatherLifecycleState,
  stepWeatherLifecycle,
  type ThunderEvent,
  type WeatherLifecycleState,
} from '../core/weather-lifecycle';
import { getWorldPopulationBudget } from '../core/world-detail';
import { type ArchipelagoAssembly, createArchipelago } from './createArchipelago';
import { type CloudSeaAssembly, createCloudSea } from './createCloudSea';
import { createGroundTown, type GroundTownAssembly } from './createGroundTown';
import { createIsland, type IslandAssembly } from './createIsland';
import { createLifestyleIslands, type LifestyleIslandsAssembly } from './createLifestyleIslands';
import { createSky, type SkyAssembly } from './createSky';
import { createWorldExpansion, type WorldExpansionAssembly } from './createWorldExpansion';
import { createThreeDepthOfFieldBackend, LazyDepthOfFieldPipeline } from './DepthOfFieldPipeline';
import { releaseRenderer } from './dispose';
import { createNpcSystem, type NpcSystemAssembly } from './NpcSystem';
import { createVehicleSystem, type VehicleSystemAssembly } from './VehicleSystem';
import { WeatherSystem } from './WeatherSystem';
import { createWorldDebugSystem, type WorldDebugSystemAssembly } from './WorldDebugSystem';

export interface AmbientDebugStats {
  fps: number;
  dpr: number;
  particleCount: number;
  weather: WeatherMode;
  audioLow: number;
  audioMid: number;
  audioHigh: number;
  cameraView: CameraViewId;
  autoTour: boolean;
  npcView: NpcViewMode;
  quality: QualityLevel;
  preferredQuality: QualityLevel;
  controlMode: WorldControlState['mode'];
  residentCount: number;
  vehicleCount: number;
  controlledMotion: string;
}

export interface AmbientEngineOptions {
  mount: HTMLElement;
  debug?: boolean;
  quality: QualityLevel;
  getInputs: () => AmbientInputs;
  onStats?: (stats: AmbientDebugStats) => void;
  onCameraState?: (state: CameraTourState) => void;
  onNpcCameraState?: (state: NpcCameraState) => void;
  onWorldControlState?: (state: WorldControlState) => void;
  onNpcInteractionState?: (state: NpcInteractionHudState) => void;
  onTownJournalState?: (state: TownJournalState) => void;
  onThunder?: (event: ThunderEvent) => void;
}

export interface AmbientSceneState {
  coordinateSystem: string;
  camera: {
    view: CameraViewId;
    autoTour: boolean;
    mode: NpcViewMode;
    npcId: NpcId | null;
    position: [number, number, number];
    target: [number, number, number];
    targetGoal: [number, number, number];
    distance: number;
  };
  residents: readonly NpcSnapshot[];
  vehicles: ReturnType<VehicleSystemAssembly['getSnapshots']>;
  npcInteraction: NpcInteractionHudState;
  journal: TownJournalState;
  relations: ReturnType<NpcSystemAssembly['getRelations']>;
  control: WorldControlState;
  weather: WeatherMode;
  quality: QualityLevel;
  preferredQuality: QualityLevel;
  surface: SurfaceAccumulation;
  lifecycle: Pick<WeatherLifecycleState, 'stormFront' | 'stormEnergy' | 'lightningFlash'>;
  photo: {
    enabled: boolean;
    depthOfField: boolean;
  };
  navigation: {
    colliders: number;
    pedestrianNodes: number;
    vehicleNodes: number;
  };
}

interface ActiveCameraTransition {
  startedAt: number;
  duration: number;
  fromOrbit: CameraOrbitState;
  toOrbit: CameraOrbitState;
  fromTarget: Vector3;
  toTarget: Vector3;
}

interface PendingVehicleEntry {
  residentId: NpcId;
  vehicleId: NonNullable<WorldControlState['vehicleId']>;
  doorOpensAt: number;
  doorStarted: boolean;
  completeAt: number;
}

const RESIDENT_TRIP_PLANS: readonly ResidentTripPlan[] = [
  {
    id: 'courier-riverside-run',
    residentId: 'courier',
    vehicleId: 'copper',
    label: '前往河岸市场送件',
    vehicleTarget: scaleTownVec3([5.8, 0.38, 37.2]),
    finalTarget: scaleTownVec3([6, 0.22, 31.5]),
    dwellSeconds: 9,
  },
  {
    id: 'gardener-hillside-run',
    residentId: 'gardener',
    vehicleId: 'sage',
    label: '给山地诊所送绿植',
    vehicleTarget: scaleTownVec3([45.2, 0.38, -39.2]),
    finalTarget: scaleTownVec3([46, 0.22, -35.6]),
    dwellSeconds: 11,
  },
];

const continuousKeys = [
  'timeOfDay',
  'weatherIntensity',
  'wind',
  'audioLow',
  'audioMid',
  'audioHigh',
  'pointerX',
  'pointerY',
] as const;

export class AmbientEngine {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 120);
  private readonly renderer: WebGLRenderer;
  private readonly depthOfField: LazyDepthOfFieldPipeline;
  private readonly hemisphere = new HemisphereLight('#aac6cf', '#32382e', 1);
  private readonly sunLight = new DirectionalLight('#ffe0ad', 1.2);
  private readonly rimLight = new DirectionalLight('#83a8c6', 0.42);
  private readonly island: IslandAssembly;
  private readonly archipelago: ArchipelagoAssembly;
  private readonly worldExpansion: WorldExpansionAssembly;
  private readonly lifestyleIslands: LifestyleIslandsAssembly;
  private readonly town: GroundTownAssembly;
  private readonly npcs: NpcSystemAssembly;
  private readonly vehicles: VehicleSystemAssembly;
  private readonly worldDebug: WorldDebugSystemAssembly | null;
  private readonly sky: SkyAssembly;
  private readonly clouds: CloudSeaAssembly;
  private readonly weather: WeatherSystem;
  private readonly resizeObserver: ResizeObserver;
  private readonly cameraTarget = new Vector3(...CAMERA_VIEW_PRESETS.overview.target);
  private readonly cameraTargetGoal = new Vector3(...CAMERA_VIEW_PRESETS.overview.target);
  private readonly cameraLookTarget = new Vector3(...CAMERA_VIEW_PRESETS.overview.target);
  private readonly orbitLookTarget = new Vector3(0, 0, 0);
  private readonly desiredCameraPosition = new Vector3();
  private readonly desiredCameraTarget = new Vector3();
  private readonly handlePointerDown: (event: PointerEvent) => void;
  private readonly handlePointerMove: (event: PointerEvent) => void;
  private readonly handlePointerUp: (event: PointerEvent) => void;
  private readonly handlePointerLeave: () => void;
  private readonly handleWheel: (event: WheelEvent) => void;
  private readonly handleDoubleClick: () => void;
  private readonly handleKeyDown: (event: KeyboardEvent) => void;
  private readonly handleKeyUp: (event: KeyboardEvent) => void;
  private readonly handleVisibilityChange: () => void;
  private smoothedInputs: AmbientInputs;
  private weatherTransition: WeatherTargets;
  private surfaceAccumulation = createSurfaceAccumulation();
  private weatherLifecycle = createWeatherLifecycleState();
  private pointerX = 0;
  private pointerY = 0;
  private orbitTarget: CameraOrbitState = { ...DEFAULT_CAMERA_ORBIT };
  private orbitCurrent: CameraOrbitState = { ...DEFAULT_CAMERA_ORBIT };
  private orbitPointerId: number | null = null;
  private orbitPointerX = 0;
  private orbitPointerY = 0;
  private cameraTourState: CameraTourState = { ...DEFAULT_CAMERA_TOUR_STATE };
  private npcCameraState: NpcCameraState = { ...DEFAULT_NPC_CAMERA_STATE };
  private worldControlState: WorldControlState = createWorldControlState();
  private pendingVehicleEntry: PendingVehicleEntry | null = null;
  private controlTransitionEndsAt = 0;
  private npcInteractionState: NpcInteractionHudState = { current: null };
  private npcInteractionEndsAt = 0;
  private townJournal = createTownJournalState();
  private residentMobility: ResidentMobilityState = createResidentMobilityState(
    RESIDENT_TRIP_PLANS,
    6,
  );
  private readonly pressedKeys = new Set<string>();
  private residentMovementBasis: [number, number] | null = null;
  private chaseYaw = 0;
  private chasePitch = 0;
  private chaseYawTarget = 0;
  private chasePitchTarget = 0;
  private chaseDistance = 1;
  private readonly chaseAnchor = new Vector3();
  private chaseAnchorReady = false;
  private cameraTransition: ActiveCameraTransition | null = null;
  private rafId: number | null = null;
  private disposed = false;
  private lastFrame = performance.now();
  private elapsed = 0;
  private lastStatsAt = 0;
  private fpsAverage = 60;
  private preferredQuality: QualityLevel;
  private quality: QualityLevel;
  private profile: QualityProfile;
  private adaptiveQuality: AdaptiveQualityState;
  private photoMode = false;
  private photoDepthOfField = false;
  private paused = false;

  constructor(private readonly options: AmbientEngineOptions) {
    this.preferredQuality = options.quality;
    this.quality = options.quality;
    this.profile = getQualityProfile(options.quality);
    this.adaptiveQuality = createAdaptiveQualityState(options.quality);
    this.renderer = new WebGLRenderer({
      antialias: this.profile.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.domElement.className = 'ambient-canvas';
    this.renderer.domElement.setAttribute('aria-label', '可步行与驾驶的溪谷镇第三人称场景');
    options.mount.appendChild(this.renderer.domElement);
    this.depthOfField = new LazyDepthOfFieldPipeline(() =>
      createThreeDepthOfFieldBackend(this.renderer, this.scene, this.camera),
    );
    this.renderer.domElement.dataset.quality = this.quality;
    this.renderer.domElement.dataset.preferredQuality = this.preferredQuality;
    this.renderer.domElement.dataset.postprocessing = 'idle';
    this.renderer.domElement.dataset.postprocessingScale = '0.5';
    this.renderer.domElement.dataset.gameplayMode = 'fixed-player';
    this.renderer.domElement.dataset.worldEvent = 'disabled';
    this.renderer.domElement.dataset.paused = 'false';

    this.camera.far = 180;
    this.camera.position.set(28, 24, 36);
    this.camera.lookAt(this.cameraTarget);
    this.scene.background = new Color('#09131c');
    this.scene.fog = new FogExp2('#82979a', 0.004);
    this.scene.add(this.hemisphere, this.sunLight, this.rimLight);
    this.sunLight.position.set(-8, 14, 10);
    this.rimLight.position.set(12, 7, -10);
    this.sunLight.castShadow = this.profile.shadows;
    this.configureShadow(this.profile);

    this.sky = createSky(this.profile);
    this.clouds = createCloudSea(this.profile);
    this.island = createIsland(this.profile);
    this.island.root.userData.cameraView = 'overview';
    this.archipelago = createArchipelago(this.profile);
    this.worldExpansion = createWorldExpansion(this.profile);
    this.lifestyleIslands = createLifestyleIslands(this.profile);
    this.town = createGroundTown();
    this.npcs = createNpcSystem(this.profile, {
      colliders: this.town.colliders,
      pedestrianGraph: this.town.pedestrianGraph,
    });
    this.vehicles = createVehicleSystem(
      this.town.colliders,
      this.town.parkingSpots,
      this.town.vehicleGraph,
    );
    this.npcCameraState = { npcId: PLAYER_RESIDENT_ID, mode: 'follow' };
    this.npcs.setControlled(PLAYER_RESIDENT_ID);
    this.npcs.setSelected(PLAYER_RESIDENT_ID);
    this.npcs.teleportResident(PLAYER_RESIDENT_ID, PLAYER_SPAWN_POSITION, PLAYER_SPAWN_FORWARD);
    const initialPlayerCamera = this.npcs.getCameraPose(PLAYER_RESIDENT_ID, 'follow');
    if (initialPlayerCamera) {
      this.camera.position.set(...initialPlayerCamera.position);
      this.cameraLookTarget.set(...initialPlayerCamera.target);
      this.camera.lookAt(this.cameraLookTarget);
    }
    this.worldDebug = options.debug
      ? createWorldDebugSystem(
          this.town.colliders,
          this.town.pedestrianGraph,
          this.town.vehicleGraph,
        )
      : null;
    this.vehicles.setQuality(this.profile);
    this.town.setQuality(this.profile);
    this.island.root.visible = false;
    this.archipelago.root.visible = false;
    this.worldExpansion.root.visible = false;
    this.lifestyleIslands.root.visible = false;
    this.weather = new WeatherSystem(this.scene, this.profile);
    this.scene.add(
      this.sky.root,
      this.clouds.root,
      this.island.root,
      this.archipelago.root,
      this.worldExpansion.root,
      this.lifestyleIslands.root,
      this.town.root,
      this.npcs.root,
      this.vehicles.root,
    );
    if (this.worldDebug) this.scene.add(this.worldDebug.root);
    this.renderer.domElement.dataset.debugWorld = this.worldDebug ? 'visible' : 'hidden';

    this.smoothedInputs = clampAmbientInputs(options.getInputs());
    this.weatherTransition = getWeatherTargets(
      this.smoothedInputs.weather,
      this.smoothedInputs.weatherIntensity,
    );
    const canvas = this.renderer.domElement;
    this.handlePointerDown = (event) => {
      if (event.button !== 0 || this.paused) return;
      event.preventDefault();
      this.orbitPointerId = event.pointerId;
      this.orbitPointerX = event.clientX;
      this.orbitPointerY = event.clientY;
      this.pointerX = 0;
      this.pointerY = 0;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-orbiting');
    };
    this.handlePointerMove = (event) => {
      if (event.pointerId === this.orbitPointerId) {
        const deltaX = event.clientX - this.orbitPointerX;
        const deltaY = event.clientY - this.orbitPointerY;
        this.orbitPointerX = event.clientX;
        this.orbitPointerY = event.clientY;
        this.chaseYawTarget = MathUtils.clamp(this.chaseYawTarget - deltaX * 0.006, -1.25, 1.25);
        this.chasePitchTarget = MathUtils.clamp(
          this.chasePitchTarget + deltaY * 0.004,
          -0.32,
          0.48,
        );
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.pointerX = MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      this.pointerY = MathUtils.clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
    };
    this.handlePointerUp = (event) => {
      if (event.pointerId !== this.orbitPointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      this.orbitPointerId = null;
      canvas.classList.remove('is-orbiting');
    };
    this.handlePointerLeave = () => {
      if (this.orbitPointerId !== null) return;
      this.pointerX = 0;
      this.pointerY = 0;
    };
    this.handleWheel = (event) => {
      event.preventDefault();
      if (this.paused) return;
      this.chaseDistance = MathUtils.clamp(
        this.chaseDistance + Math.sign(event.deltaY) * 0.08,
        0.78,
        1.34,
      );
    };
    this.handleDoubleClick = () => undefined;
    this.handleKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (this.paused) return;
      const key = event.key.toLowerCase();
      this.pressedKeys.add(key);
      if (['w', 'a', 's', 'd', ' ', 'shift', 'e', 'f', 'h', 'r'].includes(key)) {
        event.preventDefault();
      }
      if (key === 'e' && !event.repeat) this.interactWithResident();
      if (key === 'f' && !event.repeat) this.toggleVehicleControl();
      if (key === 'h' && !event.repeat) this.honkVehicle();
      if (key === 'r' && !event.repeat) this.recoverControlledEntity();
    };
    this.handleKeyUp = (event) => {
      this.pressedKeys.delete(event.key.toLowerCase());
    };
    this.handleVisibilityChange = () => {
      if (document.hidden) this.stop();
      else {
        this.lastFrame = performance.now();
        this.start();
      }
    };
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('dblclick', this.handleDoubleClick);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.mount);
    this.resize();
    this.options.onCameraState?.({ ...this.cameraTourState });
    this.options.onNpcCameraState?.({ ...this.npcCameraState });
    this.options.onWorldControlState?.({ ...this.worldControlState });
    this.emitNpcInteractionState();
    this.appendTownJournal({
      kind: 'control',
      title: '溪谷镇开始新的一天',
      detail: '本局小镇已经醒来',
      time: this.getJournalClock(),
    });
    this.start();
  }

  private emitCameraState(): void {
    this.options.onCameraState?.({ ...this.cameraTourState });
  }

  private emitNpcCameraState(): void {
    this.options.onNpcCameraState?.({ ...this.npcCameraState });
  }

  private emitWorldControlState(): void {
    this.options.onWorldControlState?.({ ...this.worldControlState });
  }

  private emitNpcInteractionState(): void {
    this.options.onNpcInteractionState?.(this.getNpcInteractionState());
  }

  private clearNpcInteraction(): void {
    if (!this.npcInteractionState.current) return;
    this.npcInteractionState = { current: null };
    this.npcInteractionEndsAt = 0;
    this.emitNpcInteractionState();
  }

  private getJournalClock(): string {
    const normalized = ((this.smoothedInputs.timeOfDay % 24) + 24) % 24;
    const hour = Math.floor(normalized);
    const minute = Math.floor((normalized - hour) * 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private appendTownJournal(input: Readonly<TownJournalEntryInput>): void {
    this.townJournal = appendTownJournalEntry(this.townJournal, input);
    this.options.onTownJournalState?.(this.getTownJournalState());
  }

  private updateResidentMobility(delta: number): void {
    const plan = this.residentMobility.plans[this.residentMobility.activePlanIndex];
    if (!plan) return;
    const resident = this.npcs.getSnapshots().find((candidate) => candidate.id === plan.residentId);
    const residentName = resident ? resident.name : '居民';
    const vehicle = this.vehicles.getSnapshot(plan.vehicleId);
    const npcTask = this.npcs.getWorldTaskStatus();
    const vehicleTask = this.vehicles.getWorldTaskStatus();
    const step = stepResidentMobility(
      this.residentMobility,
      {
        vehicleAvailable: Boolean(
          vehicle &&
            vehicle.status === 'parked' &&
            !vehicle.driverId &&
            (!vehicle.reservedBy || vehicle.reservedBy === plan.residentId),
        ),
        npcAtVehicle:
          npcTask?.eventId === `resident-trip:${plan.id}:walk-to-vehicle` &&
          npcTask.phase === 'working',
        vehicleAtDestination:
          vehicleTask?.eventId === `resident-trip:${plan.id}` && vehicleTask.phase === 'working',
        vehicleParked: vehicle?.status === 'parked',
        npcAtDestination:
          npcTask?.eventId === `resident-trip:${plan.id}:walk-to-destination` &&
          npcTask.phase === 'working',
      },
      delta,
    );
    this.residentMobility = step.state;
    this.npcs.root.userData.mobilityPhase = step.state.phase;
    this.npcs.root.userData.mobilityPlan = plan.id;

    for (const effect of step.effects) {
      const activePlan = effect.plan;
      if (effect.type === 'reserve-vehicle') {
        this.vehicles.reserveForResident(activePlan.vehicleId, activePlan.residentId);
      } else if (effect.type === 'walk-to-vehicle') {
        const targetVehicle = this.vehicles.getSnapshot(activePlan.vehicleId);
        if (!targetVehicle) continue;
        const door = getClosestVehicleDoorPose(
          targetVehicle.position,
          targetVehicle.heading,
          resident?.position ?? targetVehicle.position,
        );
        this.npcs.assignWorldTask({
          eventId: `resident-trip:${activePlan.id}:walk-to-vehicle`,
          stageId: 'walk-to-vehicle',
          residentId: activePlan.residentId,
          label: '前往停车位取车',
          action: 'drive',
          target: door.pose.outside,
          ignoreVehicleId: activePlan.vehicleId,
        });
      } else if (effect.type === 'enter-vehicle') {
        const targetVehicle = this.vehicles.getSnapshot(activePlan.vehicleId);
        if (!targetVehicle) continue;
        const activeResident = this.npcs
          .getSnapshots()
          .find((candidate) => candidate.id === activePlan.residentId);
        const door = getClosestVehicleDoorPose(
          targetVehicle.position,
          targetVehicle.heading,
          activeResident?.position ?? targetVehicle.position,
        );
        this.npcs.assignWorldTask(null);
        this.npcs.playVehicleTransition(
          activePlan.residentId,
          'entering',
          door.pose.outside,
          door.pose.enterForward,
          0.72,
        );
        this.vehicles.playDoorTransition(activePlan.vehicleId, 0.72, door.side);
      } else if (effect.type === 'begin-drive') {
        this.npcs.setResidentVisible(activePlan.residentId, false);
        this.vehicles.assignWorldTask({
          eventId: `resident-trip:${activePlan.id}`,
          stageId: 'drive',
          vehicleId: activePlan.vehicleId,
          driverId: activePlan.residentId,
          label: activePlan.label,
          action: 'drive',
          target: activePlan.vehicleTarget,
        });
        this.appendTownJournal({
          kind: 'vehicle',
          title: `${residentName}驾车出发`,
          detail: activePlan.label,
          time: this.getJournalClock(),
        });
      } else if (effect.type === 'begin-parking') {
        this.vehicles.assignWorldTask(null);
        this.vehicles.requestAutopark(activePlan.vehicleId, activePlan.residentId);
      } else if (effect.type === 'exit-vehicle') {
        const parkedVehicle = this.vehicles.getSnapshot(activePlan.vehicleId);
        if (!parkedVehicle) continue;
        const door = getVehicleDriverDoorPose(parkedVehicle.position, parkedVehicle.heading);
        this.npcs.teleportResident(activePlan.residentId, door.inside, door.exitForward);
        this.npcs.setResidentVisible(activePlan.residentId, true);
        this.npcs.playVehicleTransition(
          activePlan.residentId,
          'exiting',
          door.outside,
          door.exitForward,
          0.62,
        );
        this.vehicles.playDoorTransition(activePlan.vehicleId, 0.62, 'left');
      } else if (effect.type === 'walk-to-destination') {
        this.npcs.assignWorldTask({
          eventId: `resident-trip:${activePlan.id}:walk-to-destination`,
          stageId: 'last-mile',
          residentId: activePlan.residentId,
          label: activePlan.label,
          action: 'deliver',
          target: activePlan.finalTarget,
        });
      } else if (effect.type === 'finish-trip') {
        this.appendTownJournal({
          kind: 'vehicle',
          title: `${residentName}抵达目的地`,
          detail: activePlan.label,
          time: this.getJournalClock(),
        });
      } else if (effect.type === 'release-vehicle') {
        this.npcs.assignWorldTask(null);
        this.vehicles.reserveForResident(activePlan.vehicleId, null);
      }
    }
  }

  private recordControlJournal(
    previous: Readonly<WorldControlState>,
    current: Readonly<WorldControlState>,
  ): void {
    if (
      previous.mode === current.mode &&
      previous.residentId === current.residentId &&
      previous.vehicleId === current.vehicleId
    ) {
      return;
    }
    const residentId = current.residentId ?? previous.residentId;
    const resident = NPC_PROFILES.find((profile) => profile.id === residentId);
    const vehicleNames = {
      copper: '铜雀小车',
      sage: '苔绿旅行车',
      cream: '奶油小车',
      navy: '深海通勤车',
      amber: '琥珀出租车',
      teal: '青瓷通勤车',
      rose: '蔷薇小车',
      slate: '岩灰旅行车',
      sand: '沙丘小车',
    } as const;
    const vehicleId = current.vehicleId ?? previous.vehicleId;
    const vehicleName = vehicleId ? vehicleNames[vehicleId] : null;
    const residentName = resident ? resident.name : '居民';
    const resolvedVehicleName = vehicleName || '车辆';
    if (previous.mode === 'resident' && current.mode === 'vehicle') {
      this.appendTownJournal({
        kind: 'vehicle',
        title: `${residentName}上车`,
        detail: `开始驾驶${resolvedVehicleName}`,
        time: this.getJournalClock(),
      });
    } else if (previous.mode === 'vehicle' && current.mode === 'resident') {
      this.appendTownJournal({
        kind: 'vehicle',
        title: `${residentName}下车`,
        detail: `${resolvedVehicleName}停在原地`,
        time: this.getJournalClock(),
      });
    }
  }

  private interactWithResident(): boolean {
    if (this.worldControlState.mode !== 'resident' || !this.worldControlState.residentId) {
      return false;
    }
    const sourceId = this.worldControlState.residentId;
    const resident = this.npcs.getNearestResident(sourceId, 2.6);
    if (!resident) return false;
    const relation =
      this.npcs
        .getRelations()
        .find(
          (candidate) =>
            candidate.residents.includes(sourceId) && candidate.residents.includes(resident.id),
        ) ?? null;
    const conversation = createNpcConversation({
      npcId: resident.id,
      npcName: resident.name,
      role: resident.role,
      task: resident.task,
      routine: resident.routine,
      weather: this.smoothedInputs.weather,
      timeOfDay: this.smoothedInputs.timeOfDay,
      relation: relation ? { familiarity: relation.familiarity, label: relation.label } : null,
    });
    if (!this.npcs.triggerResidentInteraction(sourceId, resident.id)) return false;
    this.npcInteractionState = { current: conversation };
    this.npcInteractionEndsAt = this.elapsed + conversation.duration;
    this.emitNpcInteractionState();
    this.appendTownJournal({
      kind: 'conversation',
      title: `与${conversation.npcName}聊了几句`,
      detail: `${conversation.relationLabel} · ${conversation.role}`,
      time: this.getJournalClock(),
    });
    return true;
  }

  private applyWorldControlEvent(event: WorldControlEvent): void {
    const previousState = { ...this.worldControlState };
    const transition = transitionWorldControl(this.worldControlState, event);
    this.worldControlState = transition.state;
    if (
      previousState.mode !== transition.state.mode ||
      previousState.residentId !== transition.state.residentId ||
      previousState.vehicleId !== transition.state.vehicleId
    ) {
      this.clearNpcInteraction();
    }

    if (transition.state.mode === 'resident' && transition.state.residentId) {
      this.npcs.setResidentVisible(transition.state.residentId, true);
      this.npcs.setControlled(transition.state.residentId);
      this.vehicles.setControlled(null);
    } else if (
      transition.state.mode === 'vehicle' &&
      transition.state.residentId &&
      transition.state.vehicleId
    ) {
      this.npcs.setControlled(null);
      this.npcs.setResidentVisible(transition.state.residentId, false);
      this.vehicles.setControlled(transition.state.vehicleId, transition.state.residentId);
    } else {
      this.npcs.setControlled(null);
      this.vehicles.setControlled(null);
    }

    this.npcCameraState = transition.state.residentId
      ? { npcId: transition.state.residentId, mode: 'follow' }
      : { npcId: PLAYER_RESIDENT_ID, mode: 'follow' };
    this.npcs.setSelected(transition.state.residentId);
    this.chaseYaw = 0;
    this.chasePitch = 0;
    this.chaseYawTarget = 0;
    this.chasePitchTarget = 0;
    this.chaseAnchorReady = false;
    this.residentMovementBasis = null;
    this.emitNpcCameraState();
    this.emitWorldControlState();
    this.recordControlJournal(previousState, transition.state);
  }

  private toggleVehicleControl(): void {
    if (this.pendingVehicleEntry) return;
    if (this.worldControlState.mode === 'resident' && this.worldControlState.residentId) {
      const resident = this.npcs
        .getSnapshots()
        .find((candidate) => candidate.id === this.worldControlState.residentId);
      if (!resident) return;
      const vehicle = this.vehicles.getNearestVehicle(resident.position, 5);
      if (!vehicle) return;
      const approach = getVehicleDriverDoorApproach(
        vehicle.position,
        vehicle.heading,
        resident.position,
      );
      const path = [resident.position, ...approach.waypoints, approach.pose.outside];
      const pathLength = path.slice(1).reduce((total, point, index) => {
        const previous = path[index] ?? point;
        return total + Math.hypot(point[0] - previous[0], point[2] - previous[2]);
      }, 0);
      const duration = Math.min(3.4, Math.max(0.72, pathLength / 2.8 + 0.35));
      this.npcs.playVehicleTransition(
        resident.id,
        'entering',
        approach.pose.outside,
        approach.pose.enterForward,
        duration,
        approach.waypoints,
      );
      this.pendingVehicleEntry = {
        residentId: resident.id,
        vehicleId: vehicle.id,
        doorOpensAt: this.elapsed + duration - 0.72,
        doorStarted: false,
        completeAt: this.elapsed + duration,
      };
      this.renderer.domElement.dataset.controlTransition = 'entering';
      return;
    }
    if (
      this.worldControlState.mode === 'vehicle' &&
      this.worldControlState.vehicleId &&
      this.worldControlState.residentId
    ) {
      const vehicle = this.vehicles.getSnapshot(this.worldControlState.vehicleId);
      const residentId = this.worldControlState.residentId;
      this.applyWorldControlEvent({ type: 'exit-vehicle' });
      if (!vehicle) return;
      const doorPose = getVehicleDriverDoorPose(vehicle.position, vehicle.heading);
      this.npcs.teleportResident(residentId, doorPose.inside, doorPose.exitForward);
      this.npcs.playVehicleTransition(
        residentId,
        'exiting',
        doorPose.outside,
        doorPose.exitForward,
        0.58,
      );
      this.vehicles.playDoorTransition(vehicle.id, 0.58, 'left');
      this.renderer.domElement.dataset.controlTransition = 'exiting';
      this.controlTransitionEndsAt = this.elapsed + 0.58;
    }
  }

  private finishPendingVehicleEntry(): void {
    if (!this.pendingVehicleEntry) return;
    if (
      !this.pendingVehicleEntry.doorStarted &&
      this.elapsed >= this.pendingVehicleEntry.doorOpensAt
    ) {
      this.pendingVehicleEntry.doorStarted = true;
      this.vehicles.playDoorTransition(this.pendingVehicleEntry.vehicleId, 0.72, 'left');
    }
    if (this.elapsed < this.pendingVehicleEntry.completeAt) return;
    const pending = this.pendingVehicleEntry;
    this.pendingVehicleEntry = null;
    this.renderer.domElement.dataset.controlTransition = 'idle';
    if (
      this.worldControlState.mode === 'resident' &&
      this.worldControlState.residentId === pending.residentId
    ) {
      this.applyWorldControlEvent({ type: 'enter-vehicle', vehicleId: pending.vehicleId });
    }
  }

  private recoverControlledEntity(): void {
    if (this.worldControlState.mode === 'resident' && this.worldControlState.residentId) {
      this.npcs.recover(this.worldControlState.residentId);
    } else if (this.worldControlState.mode === 'vehicle' && this.worldControlState.vehicleId) {
      this.vehicles.recover(this.worldControlState.vehicleId);
    }
  }

  private honkVehicle(): void {
    if (this.worldControlState.mode !== 'vehicle' || !this.worldControlState.vehicleId) return;
    const vehicle = this.vehicles.getSnapshot(this.worldControlState.vehicleId);
    if (!vehicle) return;
    const reacted = this.npcs.triggerVehicleHorn(vehicle.position, [
      Math.sin(vehicle.heading),
      0,
      Math.cos(vehicle.heading),
    ]);
    this.renderer.domElement.dataset.hornReaction = reacted.join(',') || 'none';
    if (reacted.length === 0) return;
    this.appendTownJournal({
      kind: 'vehicle',
      title: '车辆鸣笛提醒',
      detail: `${reacted.length} 位居民主动让行`,
      time: this.getJournalClock(),
    });
  }

  private updatePlayableControls(): void {
    if (this.worldControlState.mode === 'resident') {
      let forwardX = this.cameraLookTarget.x - this.camera.position.x;
      let forwardZ = this.cameraLookTarget.z - this.camera.position.z;
      const forwardLength = Math.max(0.001, Math.hypot(forwardX, forwardZ));
      forwardX /= forwardLength;
      forwardZ /= forwardLength;
      const side = (this.pressedKeys.has('d') ? 1 : 0) - (this.pressedKeys.has('a') ? 1 : 0);
      const forward = (this.pressedKeys.has('w') ? 1 : 0) - (this.pressedKeys.has('s') ? 1 : 0);
      this.residentMovementBasis = getResidentMovementBasis(
        this.residentMovementBasis,
        [forwardX, forwardZ],
        forward !== 0 || side !== 0,
        this.orbitPointerId !== null,
      );
      const [moveX, moveZ] = getCameraRelativeResidentMovement(
        this.residentMovementBasis ?? [forwardX, forwardZ],
        forward,
        side,
      );
      this.npcs.setControlInput({
        moveX,
        moveZ,
        sprint: this.pressedKeys.has('shift'),
        jump: this.pressedKeys.has(' '),
      });
      this.vehicles.setControlInput({ throttle: 0, steer: 0, brake: false });
      return;
    }
    if (this.worldControlState.mode === 'vehicle') {
      this.residentMovementBasis = null;
      this.npcs.setControlInput({ moveX: 0, moveZ: 0, sprint: false, jump: false });
      this.vehicles.setControlInput({
        throttle: (this.pressedKeys.has('w') ? 1 : 0) - (this.pressedKeys.has('s') ? 1 : 0),
        steer: (this.pressedKeys.has('a') ? 1 : 0) - (this.pressedKeys.has('d') ? 1 : 0),
        brake: this.pressedKeys.has(' '),
      });
      return;
    }
  }

  private orbitChasePose(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
  ): void {
    const offsetX = position[0] - target[0];
    const offsetZ = position[2] - target[2];
    const cosine = Math.cos(this.chaseYaw);
    const sine = Math.sin(this.chaseYaw);
    this.desiredCameraPosition.set(
      target[0] + (offsetX * cosine - offsetZ * sine) * this.chaseDistance,
      target[1] + (position[1] - target[1]) * this.chaseDistance + this.chasePitch * 4.8,
      target[2] + (offsetX * sine + offsetZ * cosine) * this.chaseDistance,
    );
    this.desiredCameraTarget.set(...target);
  }

  private stepChaseAnchor(anchor: readonly [number, number, number]): [number, number, number] {
    const translation: [number, number, number] = this.chaseAnchorReady
      ? [
          anchor[0] - this.chaseAnchor.x,
          anchor[1] - this.chaseAnchor.y,
          anchor[2] - this.chaseAnchor.z,
        ]
      : [0, 0, 0];
    this.chaseAnchor.set(...anchor);
    this.chaseAnchorReady = true;
    return translation;
  }

  private clipChaseCamera(): void {
    const clipped = clipCameraAgainstColliders(
      [this.desiredCameraTarget.x, this.desiredCameraTarget.y, this.desiredCameraTarget.z],
      [this.desiredCameraPosition.x, this.desiredCameraPosition.y, this.desiredCameraPosition.z],
      this.town.colliders,
    );
    this.desiredCameraPosition.set(...clipped);
  }

  private applyCameraView(view: CameraViewId): void {
    const preset = CAMERA_VIEW_PRESETS[view];
    this.orbitTarget = { ...preset.orbit };
    this.cameraTargetGoal.set(...preset.target);
    this.cameraTransition = {
      startedAt: performance.now(),
      duration: 1_200,
      fromOrbit: { ...this.orbitCurrent },
      toOrbit: { ...preset.orbit },
      fromTarget: this.cameraTarget.clone(),
      toTarget: this.cameraTargetGoal.clone(),
    };
    this.pointerX = 0;
    this.pointerY = 0;
  }

  private configureShadow(profile: QualityProfile): void {
    this.sunLight.shadow.mapSize.set(profile.shadowMapSize || 512, profile.shadowMapSize || 512);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 90;
    this.sunLight.shadow.camera.left = TOWN_PLAYABLE_MIN_X - 8;
    this.sunLight.shadow.camera.right = TOWN_PLAYABLE_MAX_X + 8;
    this.sunLight.shadow.camera.top = TOWN_PLAYABLE_MAX_Z + 8;
    this.sunLight.shadow.camera.bottom = TOWN_PLAYABLE_MIN_Z - 8;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.035;
  }

  private resize(): void {
    const width = Math.max(1, this.options.mount.clientWidth);
    const height = Math.max(1, this.options.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dprCap));
    this.renderer.setSize(width, height, false);
    this.depthOfField.resize(
      width,
      height,
      Math.min(window.devicePixelRatio || 1, this.profile.dprCap),
    );
  }

  private start(): void {
    if (this.disposed || this.rafId !== null || document.hidden) return;
    this.rafId = window.requestAnimationFrame(this.renderFrame);
  }

  private stop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private readonly renderFrame = (timestamp: number): void => {
    this.rafId = null;
    if (this.disposed || document.hidden) return;
    const delta = Math.min(0.05, Math.max(0.001, (timestamp - this.lastFrame) / 1000));
    this.lastFrame = timestamp;
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      this.start();
      return;
    }
    this.elapsed += delta;
    if (this.npcInteractionState.current && this.elapsed >= this.npcInteractionEndsAt) {
      this.clearNpcInteraction();
    }
    const raw = clampAmbientInputs({
      ...this.options.getInputs(),
      pointerX: this.pointerX,
      pointerY: this.pointerY,
    });
    const smoothing = 1 - Math.exp(-delta * 3.2);
    for (const key of continuousKeys) {
      this.smoothedInputs[key] += (raw[key] - this.smoothedInputs[key]) * smoothing;
    }
    this.smoothedInputs.weather = raw.weather;
    this.smoothedInputs.reducedMotion = raw.reducedMotion;
    this.weatherTransition = stepWeatherTransition(
      this.weatherTransition,
      getWeatherTargets(raw.weather, raw.weatherIntensity),
      delta,
      1.1,
    );
    const lifecycleStep = stepWeatherLifecycle(
      this.weatherLifecycle,
      this.weatherTransition,
      raw.wind,
      delta,
    );
    this.weatherLifecycle = lifecycleStep.state;
    if (lifecycleStep.thunder) this.options.onThunder?.(lifecycleStep.thunder);
    this.surfaceAccumulation = stepSurfaceAccumulation(
      this.surfaceAccumulation,
      this.weatherTransition,
      delta,
    );
    const signals = deriveSceneSignals(
      this.smoothedInputs,
      this.weatherTransition,
      this.surfaceAccumulation,
      this.weatherLifecycle,
    );

    const nextTourState = advanceCameraTour(this.cameraTourState, delta);
    if (nextTourState.view !== this.cameraTourState.view) {
      this.cameraTourState = nextTourState;
      this.applyCameraView(nextTourState.view);
      this.emitCameraState();
    } else {
      this.cameraTourState = nextTourState;
    }

    this.sky.update(signals, this.smoothedInputs.timeOfDay);
    this.clouds.update(signals, this.elapsed, delta);
    this.updatePlayableControls();
    this.town.update(signals, this.elapsed);
    this.npcs.setVehicleObstacles(
      this.vehicles.getSnapshots().map((vehicle) => ({
        id: vehicle.id,
        position: vehicle.position,
        heading: vehicle.heading,
      })),
    );
    const residentScheduleTime = getResidentScheduleTime(
      raw.timeOfDay,
      this.smoothedInputs.timeOfDay,
    );
    this.npcs.update(signals, this.elapsed, delta, residentScheduleTime, [
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
    ]);
    const controlledResidentRoot = this.worldControlState.residentId
      ? this.npcs.root.getObjectByName(`npc-${this.worldControlState.residentId}`)
      : null;
    this.renderer.domElement.dataset.controlledMotionSpeed = Number(
      controlledResidentRoot?.userData.motionSpeed ?? 0,
    ).toFixed(2);
    this.renderer.domElement.dataset.controlledMotionBlend = Number(
      controlledResidentRoot?.userData.motionBlend ?? 0,
    ).toFixed(2);
    this.renderer.domElement.dataset.controlledMotionLean = [
      Number(controlledResidentRoot?.userData.motionLeanForward ?? 0).toFixed(3),
      Number(controlledResidentRoot?.userData.motionLeanTurn ?? 0).toFixed(3),
    ].join(',');
    this.renderer.domElement.dataset.controlledMotionTurnVelocity = Number(
      controlledResidentRoot?.userData.motionTurnVelocity ?? 0,
    ).toFixed(3);
    this.finishPendingVehicleEntry();
    if (
      !this.pendingVehicleEntry &&
      this.controlTransitionEndsAt > 0 &&
      this.elapsed >= this.controlTransitionEndsAt
    ) {
      this.controlTransitionEndsAt = 0;
      this.renderer.domElement.dataset.controlTransition = 'idle';
    }
    const pedestrians = this.npcs
      .getSnapshots()
      .filter(
        (npc) =>
          this.worldControlState.mode !== 'vehicle' || npc.id !== this.worldControlState.residentId,
      );
    this.vehicles.update(
      delta,
      [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      pedestrians,
    );
    this.updateResidentMobility(delta);
    this.renderer.domElement.dataset.controlledVehicleSpeed = Math.abs(
      this.worldControlState.vehicleId
        ? (this.vehicles.getSnapshot(this.worldControlState.vehicleId)?.speed ?? 0)
        : 0,
    ).toFixed(2);
    this.weather.update(signals, this.elapsed, delta);
    this.hemisphere.intensity = 0.18 + signals.ambientLight * 1.08;
    this.hemisphere.color.setRGB(...signals.horizonColor);
    this.hemisphere.groundColor.setRGB(0.12, 0.16, 0.14);
    this.sunLight.intensity = signals.sunLight * 1.35;
    this.sunLight.color.setRGB(...signals.sunColor);
    this.rimLight.intensity = 0.16 + signals.daylight * 0.34;
    this.rimLight.color.copy(this.hemisphere.color).lerp(this.sunLight.color, 0.18);

    if (this.cameraTransition) {
      const transition = this.cameraTransition;
      const progress = getCameraTransitionProgress(
        transition.startedAt,
        timestamp,
        transition.duration,
      );
      const eased = 1 - (1 - progress) ** 3;
      const azimuthDelta = Math.atan2(
        Math.sin(transition.toOrbit.azimuth - transition.fromOrbit.azimuth),
        Math.cos(transition.toOrbit.azimuth - transition.fromOrbit.azimuth),
      );
      this.orbitCurrent.azimuth = transition.fromOrbit.azimuth + azimuthDelta * eased;
      this.orbitCurrent.polar =
        transition.fromOrbit.polar +
        (transition.toOrbit.polar - transition.fromOrbit.polar) * eased;
      this.orbitCurrent.distance =
        transition.fromOrbit.distance +
        (transition.toOrbit.distance - transition.fromOrbit.distance) * eased;
      this.cameraTarget.lerpVectors(transition.fromTarget, transition.toTarget, eased);
      if (progress >= 1) this.cameraTransition = null;
    } else {
      const orbitEase = getCameraTransitionEase(delta, 10);
      const azimuthDelta = Math.atan2(
        Math.sin(this.orbitTarget.azimuth - this.orbitCurrent.azimuth),
        Math.cos(this.orbitTarget.azimuth - this.orbitCurrent.azimuth),
      );
      this.orbitCurrent.azimuth += azimuthDelta * orbitEase;
      this.orbitCurrent.polar += (this.orbitTarget.polar - this.orbitCurrent.polar) * orbitEase;
      this.orbitCurrent.distance +=
        (this.orbitTarget.distance - this.orbitCurrent.distance) * orbitEase;
      const targetEase = getCameraTransitionEase(delta, 8);
      this.cameraTarget.lerp(this.cameraTargetGoal, targetEase);
    }
    this.orbitLookTarget.set(
      this.cameraTarget.x + signals.pointerX * 0.12,
      this.cameraTarget.y + signals.pointerY * 0.08,
      this.cameraTarget.z,
    );
    const orbitCamera = orbitCameraPosition(this.orbitCurrent, [
      this.orbitLookTarget.x,
      this.orbitLookTarget.y,
      this.orbitLookTarget.z,
    ]);
    this.desiredCameraPosition.set(...orbitCamera);
    this.desiredCameraTarget.copy(this.orbitLookTarget);
    let targetFov = 34;
    if (this.worldControlState.mode === 'vehicle' && this.orbitPointerId === null) {
      const returnEase = 1 - Math.exp(-delta * 0.9);
      this.chaseYawTarget += (0 - this.chaseYawTarget) * returnEase;
      this.chasePitchTarget += (0 - this.chasePitchTarget) * returnEase;
    }
    this.chaseYaw = stepChaseOrbitAngle(this.chaseYaw, this.chaseYawTarget, delta, 11);
    this.chasePitch = stepChaseOrbitAngle(this.chasePitch, this.chasePitchTarget, delta, 11);
    const vehicleSnapshot = this.worldControlState.vehicleId
      ? this.vehicles.getSnapshot(this.worldControlState.vehicleId)
      : null;
    const vehiclePose = vehicleSnapshot ? this.vehicles.getCameraPose(vehicleSnapshot.id) : null;
    const npcSnapshot =
      this.worldControlState.mode === 'resident' && this.npcCameraState.npcId
        ? this.npcs.getSnapshots().find((candidate) => candidate.id === this.npcCameraState.npcId)
        : null;
    const npcPose =
      npcSnapshot && this.npcCameraState.npcId
        ? this.npcs.getCameraPose(this.npcCameraState.npcId, 'follow')
        : null;
    if (vehiclePose && vehicleSnapshot) {
      this.orbitChasePose(vehiclePose.position, vehiclePose.target);
      this.clipChaseCamera();
      targetFov = vehiclePose.fov;
      const followEase = getCameraTransitionEase(delta, 7.4);
      const pose = stepAnchoredChasePose(
        {
          position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
          target: [this.cameraLookTarget.x, this.cameraLookTarget.y, this.cameraLookTarget.z],
        },
        {
          position: [
            this.desiredCameraPosition.x,
            this.desiredCameraPosition.y,
            this.desiredCameraPosition.z,
          ],
          target: [
            this.desiredCameraTarget.x,
            this.desiredCameraTarget.y,
            this.desiredCameraTarget.z,
          ],
        },
        followEase,
        this.stepChaseAnchor(vehicleSnapshot.position),
      );
      this.camera.position.set(...pose.position);
      this.cameraLookTarget.set(...pose.target);
    } else if (npcPose && npcSnapshot) {
      this.orbitChasePose(npcPose.position, npcPose.target);
      this.clipChaseCamera();
      targetFov = npcPose.fov;
      const followEase = getCameraTransitionEase(delta, signals.motionScale < 0.5 ? 12 : 6.8);
      const pose = stepAnchoredChasePose(
        {
          position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
          target: [this.cameraLookTarget.x, this.cameraLookTarget.y, this.cameraLookTarget.z],
        },
        {
          position: [
            this.desiredCameraPosition.x,
            this.desiredCameraPosition.y,
            this.desiredCameraPosition.z,
          ],
          target: [
            this.desiredCameraTarget.x,
            this.desiredCameraTarget.y,
            this.desiredCameraTarget.z,
          ],
        },
        followEase,
        this.stepChaseAnchor(npcSnapshot.position),
      );
      this.camera.position.set(...pose.position);
      this.cameraLookTarget.set(...pose.target);
    } else {
      this.chaseAnchorReady = false;
      this.camera.position.copy(this.desiredCameraPosition);
      this.cameraLookTarget.copy(this.desiredCameraTarget);
    }
    const fovEase = getCameraTransitionEase(delta, 7);
    const nextFov = this.camera.fov + (targetFov - this.camera.fov) * fovEase;
    if (Math.abs(nextFov - this.camera.fov) > 0.001) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.cameraLookTarget);
    if (
      !this.photoMode ||
      !this.photoDepthOfField ||
      !this.depthOfField.render(this.camera.position.distanceTo(this.cameraLookTarget))
    ) {
      this.renderer.render(this.scene, this.camera);
    }

    const frameFps = 1 / delta;
    this.fpsAverage += (frameFps - this.fpsAverage) * 0.06;
    const nextAdaptiveQuality = stepAdaptiveQuality(this.adaptiveQuality, this.fpsAverage, delta);
    if (nextAdaptiveQuality.effective !== this.adaptiveQuality.effective) {
      this.applyQuality(nextAdaptiveQuality.effective);
    }
    this.adaptiveQuality = nextAdaptiveQuality;
    if (this.options.onStats && timestamp - this.lastStatsAt >= 500) {
      this.lastStatsAt = timestamp;
      this.renderer.domElement.dataset.fps = String(Math.round(this.fpsAverage));
      this.renderer.domElement.dataset.cameraView = this.cameraTourState.view;
      this.renderer.domElement.dataset.npcView = this.npcCameraState.mode;
      this.renderer.domElement.dataset.npcId = this.npcCameraState.npcId ?? '';
      this.renderer.domElement.dataset.controlMode = this.worldControlState.mode;
      this.renderer.domElement.dataset.vehicleId = this.worldControlState.vehicleId ?? '';
      this.renderer.domElement.dataset.residentAssets = String(
        this.npcs.root.userData.residentAssets ?? 'procedural',
      );
      this.renderer.domElement.dataset.residentAnimationClips = String(
        this.npcs.root.userData.residentAnimationClips ?? 'procedural',
      );
      this.renderer.domElement.dataset.residentAnimationVerticalRange = String(
        this.npcs.root.userData.residentAnimationVerticalRange ?? 'procedural',
      );
      this.renderer.domElement.dataset.residentTextureDetail = String(
        this.npcs.root.userData.residentTextureDetail ?? 'procedural',
      );
      this.renderer.domElement.dataset.npcNavigation = String(
        this.npcs.root.userData.navigationMode ?? 'fallback-routes',
      );
      this.renderer.domElement.dataset.npcObstacleAvoidance = String(
        this.npcs.root.userData.obstacleAvoidance ?? 'none',
      );
      this.renderer.domElement.dataset.controlledCollision = String(
        this.npcs.root.userData.controlledCollision ?? 'clear',
      );
      this.renderer.domElement.dataset.dynamicVehicleColliders = String(
        this.npcs.root.userData.dynamicVehicleColliders ?? 0,
      );
      this.renderer.domElement.dataset.npcRoutePlanning = String(
        this.npcs.root.userData.routePlanning ?? 'fallback-routes',
      );
      this.renderer.domElement.dataset.npcDetailTiers = String(
        this.npcs.root.userData.detailTierCounts ?? 'hero:1|near:0|mid:0|far:0',
      );
      this.renderer.domElement.dataset.npcBasePositions = String(
        this.npcs.root.userData.npcBasePositions ?? '',
      );
      this.renderer.domElement.dataset.npcCrowdOffsets = String(
        this.npcs.root.userData.npcCrowdOffsets ?? '',
      );
      this.renderer.domElement.dataset.npcAnimationStates = String(
        this.npcs.root.userData.npcAnimationStates ?? '',
      );
      this.renderer.domElement.dataset.npcMotionStates = String(
        this.npcs.root.userData.npcMotionStates ?? '',
      );
      this.renderer.domElement.dataset.residentMobility = `${this.residentMobility.plans[this.residentMobility.activePlanIndex]?.id ?? 'none'}:${this.residentMobility.phase}`;
      const populationBudget = getWorldPopulationBudget(this.quality);
      this.renderer.domElement.dataset.virtualPopulation = `${populationBudget.virtualResidents}:${populationBudget.virtualVehicles}`;
      this.renderer.domElement.dataset.activePopulationBudget = `${populationBudget.activeResidents}:${populationBudget.activeVehicles}`;
      this.renderer.domElement.dataset.townDistricts = String(
        this.town.root.userData.districtCount ?? 1,
      );
      this.renderer.domElement.dataset.townColliders = String(this.town.colliders.length);
      this.renderer.domElement.dataset.townPedestrianNodes = String(
        this.town.pedestrianGraph.nodes.length,
      );
      this.renderer.domElement.dataset.townVehicleNodes = String(
        this.town.vehicleGraph.nodes.length,
      );
      this.renderer.domElement.dataset.npcPositions = this.npcs
        .getSnapshots()
        .map((npc) => {
          const motionSpeed = Number(
            this.npcs.root.getObjectByName(`npc-${npc.id}`)?.userData.motionSpeed ?? 0,
          );
          return `${npc.id}:${npc.position.map((value) => value.toFixed(2)).join(',')}:${npc.motion}:${npc.routine}:${npc.socialPartner ?? '-'}:${motionSpeed.toFixed(2)}`;
        })
        .join('|');
      this.renderer.domElement.dataset.residentTasks = this.npcs
        .getSnapshots()
        .map(
          (npc) => `${npc.id}:${npc.routine}:${npc.task}:${npc.taskAction ?? '-'}:${npc.reaction}`,
        )
        .join('|');
      this.renderer.domElement.dataset.residentScheduleRoutes = String(
        this.npcs.root.userData.residentScheduleRoutes ?? '',
      );
      this.renderer.domElement.dataset.residentScheduleTime = residentScheduleTime.toFixed(3);
      this.renderer.domElement.dataset.residentRelations = this.npcs
        .getRelations()
        .map(
          (relation) =>
            `${relation.residents.join('+')}:${relation.familiarity}:${relation.collaborations}`,
        )
        .join('|');
      this.renderer.domElement.dataset.townJournal = this.townJournal.entries
        .map((entry) => `${entry.id}:${entry.kind}`)
        .join('|');
      this.renderer.domElement.dataset.npcInteraction = this.npcInteractionState.current
        ? `${this.npcInteractionState.current.npcId}:${this.npcInteractionState.current.gesture}:${this.npcInteractionState.current.relationLabel}`
        : 'none';
      const townActivity = this.town.getActivitySnapshot();
      this.renderer.domElement.dataset.townActivities = [
        townActivity.craneRotation,
        townActivity.cargoHeight,
        townActivity.plantGrowth,
        townActivity.lampIntensity,
      ]
        .map((value) => value.toFixed(3))
        .join(',');
      this.renderer.domElement.dataset.vehiclePositions = this.vehicles
        .getSnapshots()
        .map(
          (vehicle) =>
            `${vehicle.id}:${vehicle.position.map((value) => value.toFixed(2)).join(',')}:${vehicle.status}:${vehicle.speed.toFixed(2)}:${vehicle.driverId ?? '-'}:${vehicle.laneMode}:${this.vehicles.root.getObjectByName(`vehicle-${vehicle.id}`)?.userData.missionVisual ?? 'none'}`,
        )
        .join('|');
      this.renderer.domElement.dataset.vehicleDynamics = this.vehicles
        .getSnapshots()
        .map((vehicle) => {
          const root = this.vehicles.root.getObjectByName(`vehicle-${vehicle.id}`);
          return `${vehicle.id}:${vehicle.heading.toFixed(3)}:${Number(root?.userData.laneOffset ?? 0).toFixed(3)}:${String(root?.userData.passingVehicleId ?? 'none')}`;
        })
        .join('|');
      this.renderer.domElement.dataset.cameraTarget = [
        this.cameraLookTarget.x,
        this.cameraLookTarget.y,
        this.cameraLookTarget.z,
      ]
        .map((value) => value.toFixed(2))
        .join(',');
      this.renderer.domElement.dataset.cameraPosition = [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ]
        .map((value) => value.toFixed(2))
        .join(',');
      this.renderer.domElement.dataset.surfaceWetness = this.surfaceAccumulation.wetness.toFixed(3);
      this.renderer.domElement.dataset.snowCover = this.surfaceAccumulation.snowCover.toFixed(3);
      this.renderer.domElement.dataset.puddleDepth =
        this.surfaceAccumulation.puddleDepth.toFixed(3);
      this.renderer.domElement.dataset.iceCover = this.surfaceAccumulation.iceCover.toFixed(3);
      this.renderer.domElement.dataset.meltwaterFlow =
        this.surfaceAccumulation.meltwaterFlow.toFixed(3);
      this.renderer.domElement.dataset.stormFront = this.weatherLifecycle.stormFront.toFixed(3);
      const residentSnapshots = this.npcs.getSnapshots();
      this.options.onStats({
        fps: Math.round(this.fpsAverage),
        dpr: this.renderer.getPixelRatio(),
        particleCount:
          this.weather.getParticleCount() +
          this.island.getEffectCount() +
          this.archipelago.getEffectCount() +
          this.worldExpansion.getEffectCount() +
          this.lifestyleIslands.getEffectCount() +
          this.npcs.getSnapshots().length +
          this.clouds.getVisibleCount(),
        weather: raw.weather,
        audioLow: raw.audioLow,
        audioMid: raw.audioMid,
        audioHigh: raw.audioHigh,
        cameraView: this.cameraTourState.view,
        autoTour: this.cameraTourState.enabled,
        npcView: this.npcCameraState.mode,
        quality: this.quality,
        preferredQuality: this.preferredQuality,
        controlMode: this.worldControlState.mode,
        residentCount: residentSnapshots.length,
        vehicleCount: this.vehicles.getSnapshots().length,
        controlledMotion:
          residentSnapshots.find((npc) => npc.id === this.worldControlState.residentId)?.motion ??
          'idle',
      });
    }
    this.start();
  };

  private applyQuality(quality: QualityLevel): void {
    if (quality === this.quality) return;
    const startedAt = performance.now();
    this.quality = quality;
    this.profile = getQualityProfile(quality);
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.sunLight.castShadow = this.profile.shadows;
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null;
    this.configureShadow(this.profile);
    this.sky.setQuality(this.profile);
    this.clouds.setQuality(this.profile);
    this.island.setQuality(this.profile);
    this.archipelago.setQuality(this.profile);
    this.worldExpansion.setQuality(this.profile);
    this.lifestyleIslands.setQuality(this.profile);
    this.town.setQuality(this.profile);
    this.npcs.setQuality(this.profile);
    this.vehicles.setQuality(this.profile);
    this.weather.setQuality(this.profile);
    if (
      shouldResizeRendererForQuality(
        this.renderer.getPixelRatio(),
        window.devicePixelRatio || 1,
        this.profile,
      )
    ) {
      this.resize();
    }
    this.renderer.domElement.dataset.quality = quality;
    this.renderer.domElement.dataset.qualitySwitchMs = (performance.now() - startedAt).toFixed(1);
  }

  setQuality(quality: QualityLevel): void {
    if (quality === this.preferredQuality && this.quality === quality) return;
    this.preferredQuality = quality;
    this.adaptiveQuality = setAdaptiveQualityPreference(this.adaptiveQuality, quality);
    this.renderer.domElement.dataset.preferredQuality = quality;
    this.applyQuality(quality);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.pressedKeys.clear();
    this.residentMovementBasis = null;
    this.npcs.setControlInput({ moveX: 0, moveZ: 0, sprint: false, jump: false });
    this.vehicles.setControlInput({ throttle: 0, steer: 0, brake: paused });
    this.renderer.domElement.dataset.paused = paused ? 'true' : 'false';
    this.lastFrame = performance.now();
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setPhotoMode(enabled: boolean, depthOfField: boolean): void {
    this.photoMode = enabled;
    this.photoDepthOfField = enabled && depthOfField;
    this.renderer.domElement.dataset.photoMode = enabled ? 'true' : 'false';
    this.renderer.domElement.dataset.postprocessing = this.photoDepthOfField ? 'loading' : 'idle';
    void this.depthOfField
      .setEnabled(this.photoDepthOfField)
      .then(() => {
        if (this.disposed) return;
        this.renderer.domElement.dataset.postprocessing = this.photoDepthOfField ? 'ready' : 'idle';
      })
      .catch(() => {
        if (this.disposed) return;
        this.renderer.domElement.dataset.postprocessing = 'unavailable';
      });
  }

  async capturePhoto(filter: PhotoFilter): Promise<Blob | null> {
    if (
      !this.photoMode ||
      !this.photoDepthOfField ||
      !this.depthOfField.render(this.camera.position.distanceTo(this.cameraLookTarget))
    ) {
      this.renderer.render(this.scene, this.camera);
    }
    const source = this.renderer.domElement;
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext('2d');
    if (!context) return null;
    context.filter = getPhotoFilterStyle(filter);
    context.drawImage(source, 0, 0, output.width, output.height);
    return await new Promise((resolve) => output.toBlob(resolve, 'image/png', 1));
  }

  getCameraTourState(): CameraTourState {
    return { ...this.cameraTourState };
  }

  getNpcCameraState(): NpcCameraState {
    return { ...this.npcCameraState };
  }

  getWorldControlState(): WorldControlState {
    return { ...this.worldControlState };
  }

  getNpcInteractionState(): NpcInteractionHudState {
    return {
      current: this.npcInteractionState.current ? { ...this.npcInteractionState.current } : null,
    };
  }

  getSceneState(): AmbientSceneState {
    return {
      coordinateSystem: '+X 向右，+Y 向上，+Z 朝默认镜头；单位为 Three.js 世界单位',
      camera: {
        view: this.cameraTourState.view,
        autoTour: this.cameraTourState.enabled,
        mode: this.npcCameraState.mode,
        npcId: this.npcCameraState.npcId,
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        target: [this.cameraLookTarget.x, this.cameraLookTarget.y, this.cameraLookTarget.z],
        targetGoal: [this.cameraTargetGoal.x, this.cameraTargetGoal.y, this.cameraTargetGoal.z],
        distance: this.orbitCurrent.distance,
      },
      residents: this.npcs.getSnapshots(),
      vehicles: this.vehicles.getSnapshots(),
      npcInteraction: this.getNpcInteractionState(),
      journal: this.getTownJournalState(),
      relations: this.npcs.getRelations(),
      control: { ...this.worldControlState },
      weather: this.smoothedInputs.weather,
      quality: this.quality,
      preferredQuality: this.preferredQuality,
      surface: { ...this.surfaceAccumulation },
      lifecycle: {
        stormFront: this.weatherLifecycle.stormFront,
        stormEnergy: this.weatherLifecycle.stormEnergy,
        lightningFlash: this.weatherLifecycle.lightningFlash,
      },
      photo: {
        enabled: this.photoMode,
        depthOfField: this.photoDepthOfField,
      },
      navigation: {
        colliders: this.town.colliders.length,
        pedestrianNodes: this.town.pedestrianGraph.nodes.length,
        vehicleNodes: this.town.vehicleGraph.nodes.length,
      },
    };
  }

  getTownJournalState(): TownJournalState {
    return {
      nextId: this.townJournal.nextId,
      entries: this.townJournal.entries.map((entry) => ({ ...entry })),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerUp);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('dblclick', this.handleDoubleClick);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.weather.dispose();
    this.sky.dispose();
    this.clouds.dispose();
    this.island.dispose();
    this.archipelago.dispose();
    this.worldExpansion.dispose();
    this.lifestyleIslands.dispose();
    this.town.dispose();
    this.npcs.dispose();
    this.vehicles.dispose();
    this.worldDebug?.dispose();
    this.depthOfField.dispose();
    this.scene.clear();
    releaseRenderer(this.renderer);
    this.renderer.domElement.remove();
  }
}
