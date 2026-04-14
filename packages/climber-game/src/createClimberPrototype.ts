import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  HemisphereLight,
  Line,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  type Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createCharacterRig } from './characterRig';
import {
  CLIMBER_GRAVITY,
  CLIMBER_JUMP_SPEED,
  CLIMBER_SPRINT_SPEED,
  CLIMBER_WALK_SPEED,
} from './climberPhysics';
import {
  appendBoxCollider,
  type PlatformCollisionData,
  type PlatformCollisionDebugMeta,
  solveSolidCollisions,
  tryLandOnTop,
} from './prototype/collision';
import { createSetPieceRuntime } from './prototype/setPieceRuntime';
import { createPrototypeAudio } from './prototypeAudio';
import type {
  ClimberCharacterAnimationDebugSnapshot,
  ClimberCharacterAnimationState,
  ClimberCharacterId,
  ClimberCharacterRuntimeStatus,
  ClimberJumpClearanceIssue,
  ClimberJumpClearanceReport,
  ClimberLevelDefinition,
  ClimberPrototypeController,
  ClimberRunStats,
  ClimberSetPieceAssetId,
} from './types';

interface CreateClimberPrototypeOptions {
  mount: HTMLElement;
  level: ClimberLevelDefinition;
  characterId: ClimberCharacterId;
  audioEnabled: boolean;
  debugCollidersVisible?: boolean;
  debugInstanceLabelsVisible?: boolean;
  debugJumpClearanceVisible?: boolean;
  debugCharacterAnimationVisible?: boolean;
  characterAutoFootCalibrationEnabled?: boolean;
  debugColliderFocusAssetId?: ClimberSetPieceAssetId | null;
  onStats: (stats: ClimberRunStats) => void;
  onJumpClearanceReport?: (report: ClimberJumpClearanceReport) => void;
  onCharacterAnimationDebug?: (snapshot: ClimberCharacterAnimationDebugSnapshot) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onCharacterStatusChange?: (status: ClimberCharacterRuntimeStatus) => void;
}

const PLAYER_RADIUS = 0.42;
const RESPAWN_Y = -20;
const LANDING_ASSIST = PLAYER_RADIUS * 0.95;
const DEFAULT_CAMERA_OFFSET = new Vector3(0, 4.8, 9.4);
const FLOOR_COLLIDER_SIZE = 220;
const FLOOR_COLLIDER_HEIGHT = 1;
const FLOOR_SURFACE_Y = -0.5;
const FLOOR_COLLIDER_CENTER_Y = FLOOR_SURFACE_Y - FLOOR_COLLIDER_HEIGHT * 0.5;
const BOUNDARY_HALF_RANGE = 70;
const FLOOR_VISUAL_SIZE = FLOOR_COLLIDER_SIZE;
const BOUNDARY_WALL_HEIGHT = 16;
const BOUNDARY_WALL_THICKNESS = 2;
const GOAL_REACH_Y_TOLERANCE = 0.18;
const GOAL_REACH_XZ_MARGIN = 0.16;
const GOAL_CELEBRATION_DURATION = 1.25;
const MAX_MOUSE_DELTA = 48;
const POINTER_LOCK_INPUT_COOLDOWN_MS = 120;
const MOUSE_FILTER_ALPHA = 0.42;
const CAMERA_YAW_SPEED_LIMIT = 8.4;
const CAMERA_PITCH_SPEED_LIMIT = 5.2;
const LAND_SOUND_COOLDOWN_MS = 180;
const MIN_JUMP_INTERVAL_MS = 220;
const MIN_GROUNDED_BEFORE_JUMP_MS = 45;
const GROUND_STICK_VELOCITY_MAX = 1.35;
const LANDING_ANIMATION_LOCK_MS = 140;
const RAMP_TOP_FLAT_RATIO = 0.36;
const DEFAULT_MIN_PLAYABLE_SURFACE_SIZE = 1.36;
const DEFAULT_SMALL_PIECE_CLUSTER_RADIUS = 2.8;
const DEFAULT_MAX_NEARBY_SMALL_PIECES = 2;
const DEFAULT_MIN_JUMP_HEADROOM = 1.08;
const JUMP_PATH_SAMPLE_STEPS = 14;
const JUMP_CLEARANCE_RADIUS = PLAYER_RADIUS * 0.92;
const JUMP_ROUTE_SIDE_PADDING = PLAYER_RADIUS * 1.65;
const JUMP_ROUTE_BASE_HEIGHT_PADDING = 0.3;
const JUMP_ROUTE_ARC_BASE = 1.35;
const JUMP_ROUTE_ARC_MAX = 4.6;
const SPAWN_BLOCKER_CHECK_RADIUS = 7.2;
const SPAWN_BLOCKER_CHECK_HEIGHT = 3.4;
const EARLY_ROUTE_CHECK_LINKS = 3;
const DYNAMIC_HAZARD_COLLIDER_MIN_SIZE = 0.6;

interface JumpRouteNode {
  id: string;
  collider: PlatformCollisionData;
}

interface JumpClearanceSegment {
  linkId: string;
  sourceId: string;
  targetId: string;
  source: [number, number, number];
  target: [number, number, number];
  status: 'safe' | 'tight' | 'blocked';
}

interface JumpClearanceBlocker {
  issueId: string;
  center: [number, number, number];
  size: [number, number, number];
  severity: ClimberJumpClearanceIssue['severity'];
}

interface JumpClearanceAnalysis {
  report: ClimberJumpClearanceReport;
  segments: JumpClearanceSegment[];
  blockers: JumpClearanceBlocker[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toVector3(value: [number, number, number]): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

function lerpNumber(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

function intersectsExpandedAabb(params: {
  point: Vector3;
  radius: number;
  collider: PlatformCollisionData;
}): boolean {
  const { point, radius, collider } = params;
  return !(
    point.x < collider.minX - radius ||
    point.x > collider.maxX + radius ||
    point.y < collider.minY - radius ||
    point.y > collider.maxY + radius ||
    point.z < collider.minZ - radius ||
    point.z > collider.maxZ + radius
  );
}

function createRampDebugGeometry(width: number, height: number, depth: number): BufferGeometry {
  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;
  const topFlatDepth = Math.max(0.001, Math.min(depth * 0.7, depth * RAMP_TOP_FLAT_RATIO));
  const topFlatEndZ = -halfD + topFlatDepth;
  const positions = [
    -halfW,
    -halfH,
    -halfD,
    halfW,
    -halfH,
    -halfD,
    -halfW,
    -halfH,
    halfD,
    halfW,
    -halfH,
    halfD,
    -halfW,
    halfH,
    -halfD,
    halfW,
    halfH,
    -halfD,
    -halfW,
    halfH,
    topFlatEndZ,
    halfW,
    halfH,
    topFlatEndZ,
  ];
  const indices = [
    0, 1, 3, 0, 3, 2, 0, 4, 5, 0, 5, 1, 4, 6, 7, 4, 7, 5, 6, 2, 3, 6, 3, 7, 0, 2, 6, 0, 6, 4, 1, 5,
    7, 1, 7, 3,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

export function createClimberPrototype(
  options: CreateClimberPrototypeOptions,
): ClimberPrototypeController {
  const {
    mount,
    onStats,
    level,
    characterId,
    audioEnabled,
    debugCollidersVisible = false,
    debugInstanceLabelsVisible = false,
    debugJumpClearanceVisible = false,
    debugCharacterAnimationVisible = false,
    characterAutoFootCalibrationEnabled = true,
    debugColliderFocusAssetId = null,
    onPointerLockChange,
    onCharacterStatusChange,
    onJumpClearanceReport,
    onCharacterAnimationDebug,
  } = options;

  if (!level.platforms.length) {
    throw new Error(`关卡 ${level.id} 未配置平台数据。`);
  }

  const scene = new Scene();
  const skyColor = level.theme?.skyColor ?? '#f8fbff';
  const floorColor = level.theme?.floorColor ?? '#f8fafc';
  const gridPrimaryColor = level.theme?.gridPrimaryColor ?? '#cbd5e1';
  const gridSecondaryColor = level.theme?.gridSecondaryColor ?? '#e2e8f0';
  const sunColor = level.theme?.sunColor ?? '#fff9e6';
  scene.background = new Color(skyColor);

  const startPosition = toVector3(level.startPosition);
  const cameraOffset = level.cameraOffset
    ? toVector3(level.cameraOffset)
    : DEFAULT_CAMERA_OFFSET.clone();
  const maxPlatformTop = Math.max(
    ...level.platforms.map((platform) => platform.position[1] + platform.size[1] / 2),
  );

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  mount.appendChild(renderer.domElement);

  const camera = new PerspectiveCamera(50, 1, 0.1, 260);
  camera.position.copy(startPosition).add(cameraOffset);

  const ambient = new AmbientLight('#ffffff', 0.46);
  const hemi = new HemisphereLight('#ffffff', '#dbeafe', 0.26);
  const mainLight = new DirectionalLight(sunColor, 1.05);
  mainLight.position.set(11, 20, 8);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 80;
  mainLight.shadow.camera.left = -28;
  mainLight.shadow.camera.right = 28;
  mainLight.shadow.camera.top = 28;
  mainLight.shadow.camera.bottom = -28;
  scene.add(ambient);
  scene.add(hemi);
  scene.add(mainLight);

  const floor = new Mesh(
    new PlaneGeometry(FLOOR_VISUAL_SIZE, FLOOR_VISUAL_SIZE),
    new MeshStandardMaterial({ color: floorColor, roughness: 0.9, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_SURFACE_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new GridHelper(FLOOR_VISUAL_SIZE, 110, gridPrimaryColor, gridSecondaryColor);
  grid.position.y = FLOOR_SURFACE_Y + 0.01;
  const gridMaterial = grid.material as Material | Material[];
  if (Array.isArray(gridMaterial)) {
    gridMaterial.forEach((material) => {
      const anyMaterial = material as Material & { opacity?: number; transparent?: boolean };
      anyMaterial.transparent = true;
      anyMaterial.opacity = 0.12;
    });
  }
  grid.visible = false;
  scene.add(grid);

  const sceneryMaterials: MeshStandardMaterial[] = [];
  const sceneryGeometries: BufferGeometry[] = [];

  const groundBaseOverlayGeometry = new PlaneGeometry(1, 1);
  const groundBaseOverlayMaterial = new MeshStandardMaterial({
    color: '#8f989f',
    roughness: 0.88,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  sceneryGeometries.push(groundBaseOverlayGeometry);
  sceneryMaterials.push(groundBaseOverlayMaterial);
  const groundBaseOverlay = new Mesh(groundBaseOverlayGeometry, groundBaseOverlayMaterial);
  groundBaseOverlay.rotation.x = -Math.PI / 2;
  groundBaseOverlay.position.set(0, FLOOR_SURFACE_Y, 0);
  groundBaseOverlay.scale.set(FLOOR_VISUAL_SIZE, FLOOR_VISUAL_SIZE, 1);
  groundBaseOverlay.receiveShadow = true;
  groundBaseOverlay.castShadow = false;
  scene.add(groundBaseOverlay);

  // 地面采用“整面基础覆盖 + 土地区薄层贴面”，确保全图有地表模型且不发生层间冲突。
  const soilOverlayGeometry = new PlaneGeometry(1, 1);
  const soilOverlayMaterial = new MeshStandardMaterial({
    color: '#8b6a48',
    roughness: 0.96,
    metalness: 0.01,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  sceneryGeometries.push(soilOverlayGeometry);
  sceneryMaterials.push(soilOverlayMaterial);
  const soilOverlayConfigs: Array<{
    size: [number, number];
    position: [number, number, number];
    yaw?: number;
  }> = [
    { size: [112, 58], position: [0, FLOOR_SURFACE_Y, -56], yaw: 0.01 },
    { size: [112, 58], position: [0, FLOOR_SURFACE_Y, 56], yaw: -0.01 },
    { size: [58, 112], position: [-56, FLOOR_SURFACE_Y, 0], yaw: -0.02 },
    { size: [58, 112], position: [56, FLOOR_SURFACE_Y, 0], yaw: 0.02 },
    { size: [64, 64], position: [0, FLOOR_SURFACE_Y, 0], yaw: 0 },
  ];
  soilOverlayConfigs.forEach((item) => {
    const mesh = new Mesh(soilOverlayGeometry, soilOverlayMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(item.position[0], item.position[1], item.position[2]);
    mesh.scale.set(item.size[0], item.size[1], 1);
    if (item.yaw) {
      mesh.rotation.y = item.yaw;
    }
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    scene.add(mesh);
  });

  const platformColliders: PlatformCollisionData[] = [];
  const platformMaterials: MeshStandardMaterial[] = [];
  const boundaryWallMaterials: MeshStandardMaterial[] = [];
  const boundaryWallGeometries: BoxGeometry[] = [];
  const platformGeometry = new BoxGeometry(1, 1, 1);
  const colliderDebugGroup = new Group();
  const colliderDebugGeometries: BufferGeometry[] = [];
  const colliderDebugEdgeGeometries: EdgesGeometry[] = [];
  const colliderDebugMaterials: MeshBasicMaterial[] = [];
  const colliderDebugLineMaterials: LineBasicMaterial[] = [];
  const colliderDebugLabelTextures: CanvasTexture[] = [];
  const colliderDebugLabelMaterials: SpriteMaterial[] = [];
  const playerAxisLabelTextures: CanvasTexture[] = [];
  const playerAxisLabelMaterials: SpriteMaterial[] = [];
  const colliderDebugQuaternion = new Quaternion();
  let colliderDebugDirty = true;
  let debugInstanceLabelsVisibleInternal = debugInstanceLabelsVisible;
  let colliderDebugFocusAssetId: ClimberSetPieceAssetId | null = debugColliderFocusAssetId;
  colliderDebugGroup.visible = debugCollidersVisible;
  scene.add(colliderDebugGroup);
  const playerAxisLabelGroup = new Group();
  playerAxisLabelGroup.visible = debugInstanceLabelsVisibleInternal;
  scene.add(playerAxisLabelGroup);

  const jumpClearanceDebugGroup = new Group();
  const jumpClearanceDebugGeometries: BufferGeometry[] = [];
  const jumpClearanceDebugMaterials: Material[] = [];
  jumpClearanceDebugGroup.visible = debugJumpClearanceVisible;
  scene.add(jumpClearanceDebugGroup);
  const jumpRouteSample = new Vector3();
  const designRules = level.designRules ?? {};
  const minPlayableSurfaceSize = Math.max(
    0.6,
    designRules.minPlayableSurfaceSize ?? DEFAULT_MIN_PLAYABLE_SURFACE_SIZE,
  );
  const smallPieceClusterRadius = Math.max(
    0.8,
    designRules.smallPieceClusterRadius ?? DEFAULT_SMALL_PIECE_CLUSTER_RADIUS,
  );
  const maxNearbySmallPieces = Math.max(
    1,
    Math.floor(designRules.maxNearbySmallPieces ?? DEFAULT_MAX_NEARBY_SMALL_PIECES),
  );
  const minJumpHeadroom = Math.max(0.45, designRules.minJumpHeadroom ?? DEFAULT_MIN_JUMP_HEADROOM);
  let lastJumpClearanceAnalysis: JumpClearanceAnalysis = {
    report: {
      generatedAt: Date.now(),
      checkedLinks: 0,
      earlyRouteCheckedLinks: 0,
      highRiskCount: 0,
      earlyRouteHighRiskCount: 0,
      mediumRiskCount: 0,
      smallPieceCount: 0,
      denseSmallPieceClusterCount: 0,
      spawnBlockerCount: 0,
      spawnZoneClear: true,
      routeRegressionPassed: true,
      issues: [],
    },
    segments: [],
    blockers: [],
  };
  let jumpClearanceRecomputeTimer = 0;

  const clearColliderDebugMeshes = () => {
    while (colliderDebugGroup.children.length) {
      colliderDebugGroup.remove(colliderDebugGroup.children[0]);
    }
    colliderDebugGeometries.forEach((geometry) => geometry.dispose());
    colliderDebugEdgeGeometries.forEach((geometry) => geometry.dispose());
    colliderDebugMaterials.forEach((material) => material.dispose());
    colliderDebugLineMaterials.forEach((material) => material.dispose());
    colliderDebugLabelTextures.forEach((texture) => texture.dispose());
    colliderDebugLabelMaterials.forEach((material) => material.dispose());
    colliderDebugGeometries.length = 0;
    colliderDebugEdgeGeometries.length = 0;
    colliderDebugMaterials.length = 0;
    colliderDebugLineMaterials.length = 0;
    colliderDebugLabelTextures.length = 0;
    colliderDebugLabelMaterials.length = 0;
  };

  const createDebugIdLabelSprite = (text: string): Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.52);
    }
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new Sprite(material);
    sprite.scale.set(1.85, 0.46, 1);
    sprite.renderOrder = 122;
    colliderDebugLabelTextures.push(texture);
    colliderDebugLabelMaterials.push(material);
    return sprite;
  };

  const createPlayerAxisLabelSprite = (text: string): Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 56;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.72)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.52);
    }
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new Sprite(material);
    sprite.scale.set(1.3, 0.38, 1);
    sprite.renderOrder = 122;
    playerAxisLabelTextures.push(texture);
    playerAxisLabelMaterials.push(material);
    return sprite;
  };

  const playerAxisLabelDefs: Array<{ text: string; offset: [number, number, number] }> = [
    { text: '+X', offset: [2.3, 1.25, 0] },
    { text: '-X', offset: [-2.3, 1.25, 0] },
    { text: '+Y', offset: [0, 3.1, 0] },
    { text: '-Y', offset: [0, 0.1, 0] },
    { text: '+Z', offset: [0, 1.25, 2.3] },
    { text: '-Z', offset: [0, 1.25, -2.3] },
  ];
  playerAxisLabelDefs.forEach((def) => {
    const sprite = createPlayerAxisLabelSprite(def.text);
    sprite.position.set(def.offset[0], def.offset[1], def.offset[2]);
    playerAxisLabelGroup.add(sprite);
  });

  const rebuildColliderDebugMeshes = () => {
    clearColliderDebugMeshes();
    const focusedColliders =
      colliderDebugFocusAssetId == null
        ? platformColliders
        : platformColliders.filter(
            (collider) =>
              collider.debugMeta?.category === 'setpiece' &&
              collider.debugMeta.assetId === colliderDebugFocusAssetId,
          );
    const collidersForDebug =
      focusedColliders.length > 0 || colliderDebugFocusAssetId == null
        ? focusedColliders
        : platformColliders;
    if (!focusedColliders.length && colliderDebugFocusAssetId != null) {
      colliderDebugFocusAssetId = null;
    }

    if (!collidersForDebug.length) {
      colliderDebugDirty = false;
      return;
    }

    collidersForDebug.forEach((collider) => {
      const width = Math.max(0.001, collider.size[0]);
      const height = Math.max(0.001, collider.size[1]);
      const depth = Math.max(0.001, collider.size[2]);
      const geometry =
        collider.shape === 'ramp'
          ? createRampDebugGeometry(width, height, depth)
          : new BoxGeometry(width, height, depth);
      const fillColor = new Color('#64748b');
      const edgeColor = new Color('#94a3b8');
      const inFocusedMode = colliderDebugFocusAssetId != null;
      const material = new MeshBasicMaterial({
        color: fillColor,
        transparent: true,
        opacity: inFocusedMode ? 0.14 : 0.08,
        depthTest: true,
        depthWrite: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(collider.center[0], collider.center[1], collider.center[2]);
      mesh.renderOrder = 120;
      colliderDebugQuaternion.set(
        collider.rotation[0],
        collider.rotation[1],
        collider.rotation[2],
        collider.rotation[3],
      );
      mesh.quaternion.copy(colliderDebugQuaternion);
      colliderDebugGroup.add(mesh);
      colliderDebugGeometries.push(geometry);
      colliderDebugMaterials.push(material);

      const edgeGeometry = new EdgesGeometry(geometry);
      const lineMaterial = new LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: inFocusedMode ? 0.46 : 0.28,
        depthTest: true,
        depthWrite: false,
      });
      const edgeLines = new LineSegments(edgeGeometry, lineMaterial);
      edgeLines.position.copy(mesh.position);
      edgeLines.quaternion.copy(mesh.quaternion);
      edgeLines.renderOrder = 121;
      colliderDebugGroup.add(edgeLines);
      colliderDebugEdgeGeometries.push(edgeGeometry);
      colliderDebugLineMaterials.push(lineMaterial);

      const instanceId = collider.debugMeta?.instanceId;
      if (
        debugInstanceLabelsVisibleInternal &&
        instanceId &&
        instanceId !== 'floor' &&
        instanceId !== 'boundary-wall'
      ) {
        const label = createDebugIdLabelSprite(instanceId);
        label.position.set(
          collider.center[0],
          collider.maxY + Math.max(0.35, collider.size[1] * 0.2),
          collider.center[2],
        );
        colliderDebugGroup.add(label);
      }
    });
    colliderDebugDirty = false;
  };

  const clearJumpClearanceDebugMeshes = () => {
    while (jumpClearanceDebugGroup.children.length) {
      jumpClearanceDebugGroup.remove(jumpClearanceDebugGroup.children[0]);
    }
    jumpClearanceDebugGeometries.forEach((geometry) => geometry.dispose());
    jumpClearanceDebugMaterials.forEach((material) => material.dispose());
    jumpClearanceDebugGeometries.length = 0;
    jumpClearanceDebugMaterials.length = 0;
  };

  const rebuildJumpClearanceDebugMeshes = (analysis: JumpClearanceAnalysis) => {
    clearJumpClearanceDebugMeshes();

    analysis.segments.forEach((segment) => {
      const color =
        segment.status === 'blocked'
          ? '#ef4444'
          : segment.status === 'tight'
            ? '#f59e0b'
            : '#22c55e';
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
          [
            segment.source[0],
            segment.source[1],
            segment.source[2],
            segment.target[0],
            segment.target[1],
            segment.target[2],
          ],
          3,
        ),
      );
      const material = new LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const line = new Line(geometry, material);
      line.renderOrder = 132;
      jumpClearanceDebugGroup.add(line);
      jumpClearanceDebugGeometries.push(geometry);
      jumpClearanceDebugMaterials.push(material);
    });

    analysis.blockers.forEach((blocker) => {
      const geometry = new BoxGeometry(
        Math.max(0.001, blocker.size[0]),
        Math.max(0.001, blocker.size[1]),
        Math.max(0.001, blocker.size[2]),
      );
      const material = new MeshBasicMaterial({
        color: blocker.severity === 'high' ? '#ef4444' : '#f59e0b',
        transparent: true,
        opacity: blocker.severity === 'high' ? 0.16 : 0.12,
        depthWrite: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(blocker.center[0], blocker.center[1], blocker.center[2]);
      mesh.renderOrder = 131;
      jumpClearanceDebugGroup.add(mesh);
      jumpClearanceDebugGeometries.push(geometry);
      jumpClearanceDebugMaterials.push(material);
    });
  };

  const getColliderByInstance = (
    category: PlatformCollisionDebugMeta['category'],
    instanceId: string,
  ): PlatformCollisionData | null => {
    const hit =
      platformColliders.find(
        (collider) =>
          collider.debugMeta?.category === category && collider.debugMeta.instanceId === instanceId,
      ) ?? null;
    return hit;
  };

  const buildJumpRouteNodes = (): JumpRouteNode[] => {
    const routeRefs: Array<{ category: PlatformCollisionDebugMeta['category']; id: string }> = [];
    const startPlatformId = level.platforms[0]?.id;
    const goalPlatformId = level.platforms[level.platforms.length - 1]?.id;
    if (startPlatformId) {
      routeRefs.push({ category: 'platform', id: startPlatformId });
    }
    (level.setPieces ?? []).forEach((piece) => {
      if (piece.solid === false) return;
      routeRefs.push({ category: 'setpiece', id: piece.id });
    });
    if (goalPlatformId && goalPlatformId !== startPlatformId) {
      routeRefs.push({ category: 'platform', id: goalPlatformId });
    }

    const nodes: JumpRouteNode[] = [];
    routeRefs.forEach((ref) => {
      const collider = getColliderByInstance(ref.category, ref.id);
      if (!collider) return;
      const last = nodes[nodes.length - 1];
      if (last?.id === ref.id) return;
      nodes.push({
        id: ref.id,
        collider,
      });
    });
    return nodes;
  };

  const analyzeJumpClearance = (): JumpClearanceAnalysis => {
    const nodes = buildJumpRouteNodes();
    const candidateSetPieceColliders = platformColliders.filter(
      (collider) => collider.debugMeta?.category === 'setpiece',
    );
    const issues: ClimberJumpClearanceIssue[] = [];
    const blockers: JumpClearanceBlocker[] = [];
    const segments: JumpClearanceSegment[] = [];

    for (let index = 1; index < nodes.length; index += 1) {
      const source = nodes[index - 1];
      const target = nodes[index];
      const linkId = `${source.id}=>${target.id}`;
      const sourceCenterX = source.collider.center[0];
      const sourceCenterZ = source.collider.center[2];
      const targetCenterX = target.collider.center[0];
      const targetCenterZ = target.collider.center[2];
      const sourceTop = source.collider.maxY;
      const targetTop = target.collider.maxY;
      const apexBoost = clamp(
        JUMP_ROUTE_ARC_BASE + (targetTop - sourceTop) * 0.32,
        JUMP_ROUTE_ARC_BASE,
        JUMP_ROUTE_ARC_MAX,
      );
      const sourceY = sourceTop + PLAYER_RADIUS + 0.02;
      const targetY = targetTop + PLAYER_RADIUS + 0.02;
      let status: JumpClearanceSegment['status'] = 'safe';

      const routeMinX = Math.min(sourceCenterX, targetCenterX) - JUMP_ROUTE_SIDE_PADDING;
      const routeMaxX = Math.max(sourceCenterX, targetCenterX) + JUMP_ROUTE_SIDE_PADDING;
      const routeMinZ = Math.min(sourceCenterZ, targetCenterZ) - JUMP_ROUTE_SIDE_PADDING;
      const routeMaxZ = Math.max(sourceCenterZ, targetCenterZ) + JUMP_ROUTE_SIDE_PADDING;
      const routeMinY = Math.min(sourceY, targetY) + JUMP_ROUTE_BASE_HEIGHT_PADDING;
      const routeMaxY = Math.max(sourceY, targetY) + apexBoost + minJumpHeadroom;

      candidateSetPieceColliders.forEach((blockerCollider) => {
        const blockerId = blockerCollider.debugMeta?.instanceId;
        if (!blockerId) return;
        if (blockerId === source.id || blockerId === target.id) return;
        if (
          blockerCollider.maxX < routeMinX ||
          blockerCollider.minX > routeMaxX ||
          blockerCollider.maxY < routeMinY ||
          blockerCollider.minY > routeMaxY ||
          blockerCollider.maxZ < routeMinZ ||
          blockerCollider.minZ > routeMaxZ
        ) {
          return;
        }

        let blocked = false;
        let tight = false;
        for (let sampleStep = 1; sampleStep < JUMP_PATH_SAMPLE_STEPS; sampleStep += 1) {
          const ratio = sampleStep / JUMP_PATH_SAMPLE_STEPS;
          jumpRouteSample.set(
            lerpNumber(sourceCenterX, targetCenterX, ratio),
            lerpNumber(sourceY, targetY, ratio) + 4 * apexBoost * ratio * (1 - ratio),
            lerpNumber(sourceCenterZ, targetCenterZ, ratio),
          );
          if (
            intersectsExpandedAabb({
              point: jumpRouteSample,
              radius: JUMP_CLEARANCE_RADIUS,
              collider: blockerCollider,
            })
          ) {
            blocked = true;
            break;
          }
          const expectedHeadTop = jumpRouteSample.y + PLAYER_RADIUS + minJumpHeadroom;
          if (
            blockerCollider.minY <= expectedHeadTop &&
            blockerCollider.maxY >= jumpRouteSample.y + PLAYER_RADIUS * 0.3
          ) {
            tight = true;
          }
        }

        if (!blocked && !tight) return;
        const severity: ClimberJumpClearanceIssue['severity'] = blocked ? 'high' : 'medium';
        const issueId = `${linkId}::${blockerId}::${severity}`;
        if (issues.some((issue) => issue.id === issueId)) return;
        issues.push({
          id: issueId,
          severity,
          linkId,
          sourceId: source.id,
          targetId: target.id,
          blockerId,
          blockerAssetId: blockerCollider.debugMeta?.assetId,
          reason: blocked ? '跳跃路径被模型碰撞体直接阻塞' : '跳跃路径头顶净空不足，存在顶头风险',
        });
        blockers.push({
          issueId,
          center: [
            (blockerCollider.minX + blockerCollider.maxX) * 0.5,
            (blockerCollider.minY + blockerCollider.maxY) * 0.5,
            (blockerCollider.minZ + blockerCollider.maxZ) * 0.5,
          ],
          size: [
            Math.max(0.001, blockerCollider.maxX - blockerCollider.minX),
            Math.max(0.001, blockerCollider.maxY - blockerCollider.minY),
            Math.max(0.001, blockerCollider.maxZ - blockerCollider.minZ),
          ],
          severity,
        });
        status = blocked ? 'blocked' : status === 'safe' ? 'tight' : status;
      });

      segments.push({
        linkId,
        sourceId: source.id,
        targetId: target.id,
        source: [sourceCenterX, sourceY, sourceCenterZ],
        target: [targetCenterX, targetY, targetCenterZ],
        status,
      });
    }

    const smallSetPieceColliders = candidateSetPieceColliders.filter((collider) => {
      const footprint = Math.min(collider.size[0], collider.size[2]);
      return footprint < minPlayableSurfaceSize;
    });
    const denseSmallPieceClusters = new Set<string>();
    smallSetPieceColliders.forEach((candidate, index) => {
      let nearbyCount = 0;
      for (let peerIndex = 0; peerIndex < smallSetPieceColliders.length; peerIndex += 1) {
        if (peerIndex === index) continue;
        const peer = smallSetPieceColliders[peerIndex];
        const dx = peer.center[0] - candidate.center[0];
        const dz = peer.center[2] - candidate.center[2];
        if (Math.hypot(dx, dz) <= smallPieceClusterRadius) {
          nearbyCount += 1;
        }
      }
      if (nearbyCount > maxNearbySmallPieces) {
        denseSmallPieceClusters.add(candidate.debugMeta?.instanceId ?? `small:${index}`);
      }
    });

    const report: ClimberJumpClearanceReport = {
      generatedAt: Date.now(),
      checkedLinks: Math.max(0, nodes.length - 1),
      earlyRouteCheckedLinks: 0,
      highRiskCount: issues.filter((issue) => issue.severity === 'high').length,
      earlyRouteHighRiskCount: 0,
      mediumRiskCount: issues.filter((issue) => issue.severity === 'medium').length,
      smallPieceCount: smallSetPieceColliders.length,
      denseSmallPieceClusterCount: denseSmallPieceClusters.size,
      spawnBlockerCount: 0,
      spawnZoneClear: true,
      routeRegressionPassed: true,
      issues,
    };

    const earlyRouteLinkIds = new Set(
      segments.slice(0, EARLY_ROUTE_CHECK_LINKS).map((segment) => segment.linkId),
    );
    report.earlyRouteCheckedLinks = Math.min(EARLY_ROUTE_CHECK_LINKS, segments.length);
    report.earlyRouteHighRiskCount = issues.filter(
      (issue) => issue.severity === 'high' && earlyRouteLinkIds.has(issue.linkId),
    ).length;

    const spawnBlockerCandidates = platformColliders.filter((collider) => {
      const meta = collider.debugMeta;
      if (!meta) return false;
      if (meta.category === 'platform') return false;
      if (
        meta.category === 'system' &&
        (meta.instanceId === 'floor' || meta.instanceId === 'boundary-wall')
      ) {
        return false;
      }
      const dx = Math.max(collider.minX - startPosition.x, 0, startPosition.x - collider.maxX);
      const dz = Math.max(collider.minZ - startPosition.z, 0, startPosition.z - collider.maxZ);
      const distanceXZ = Math.hypot(dx, dz);
      if (distanceXZ > SPAWN_BLOCKER_CHECK_RADIUS) return false;
      if (collider.maxY < startPosition.y + 0.2) return false;
      if (collider.minY > startPosition.y + SPAWN_BLOCKER_CHECK_HEIGHT) return false;
      return true;
    });

    report.spawnBlockerCount = spawnBlockerCandidates.length;
    report.spawnZoneClear = spawnBlockerCandidates.length === 0;

    spawnBlockerCandidates.forEach((collider, index) => {
      const blockerId = collider.debugMeta?.instanceId ?? `spawn-blocker-${index + 1}`;
      const issueId = `spawn-zone::${blockerId}`;
      if (!issues.some((issue) => issue.id === issueId)) {
        issues.push({
          id: issueId,
          severity: 'high',
          linkId: 'spawn-zone',
          sourceId: 'spawn',
          targetId: nodes[0]?.id ?? 'start',
          blockerId,
          blockerAssetId: collider.debugMeta?.assetId,
          reason: '出生区附近检测到阻挡碰撞体，可能影响起步与前3段节奏',
        });
      }
      blockers.push({
        issueId,
        center: [
          (collider.minX + collider.maxX) * 0.5,
          (collider.minY + collider.maxY) * 0.5,
          (collider.minZ + collider.maxZ) * 0.5,
        ],
        size: [
          Math.max(0.001, collider.maxX - collider.minX),
          Math.max(0.001, collider.maxY - collider.minY),
          Math.max(0.001, collider.maxZ - collider.minZ),
        ],
        severity: 'high',
      });
    });

    report.highRiskCount = issues.filter((issue) => issue.severity === 'high').length;
    report.routeRegressionPassed =
      report.spawnZoneClear && report.earlyRouteHighRiskCount === 0 && report.highRiskCount === 0;

    return {
      report,
      segments,
      blockers,
    };
  };

  const rebuildJumpClearanceAnalysis = () => {
    const analysis = analyzeJumpClearance();
    lastJumpClearanceAnalysis = analysis;
    onJumpClearanceReport?.(analysis.report);
    if (jumpClearanceDebugGroup.visible) {
      rebuildJumpClearanceDebugMeshes(analysis);
    }
  };

  const scheduleJumpClearanceRebuild = () => {
    if (jumpClearanceRecomputeTimer) {
      window.clearTimeout(jumpClearanceRecomputeTimer);
    }
    jumpClearanceRecomputeTimer = window.setTimeout(() => {
      jumpClearanceRecomputeTimer = 0;
      rebuildJumpClearanceAnalysis();
    }, 80);
  };

  const pushCollider = (params: {
    center: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number, number];
    shape?: 'box' | 'ramp';
    debugMeta?: PlatformCollisionDebugMeta;
  }) => {
    const appended = appendBoxCollider(platformColliders, params);
    colliderDebugDirty = true;
    scheduleJumpClearanceRebuild();
    if (colliderDebugGroup.visible) {
      rebuildColliderDebugMeshes();
    }
    return appended;
  };

  const syncAxisAlignedColliderWithObjectBounds = (
    collider: PlatformCollisionData,
    object: Mesh,
  ) => {
    object.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const center = new Vector3();
    const size = new Vector3();
    bounds.getCenter(center);
    bounds.getSize(size);
    const halfX = Math.max(DYNAMIC_HAZARD_COLLIDER_MIN_SIZE * 0.5, size.x * 0.5);
    const halfY = Math.max(DYNAMIC_HAZARD_COLLIDER_MIN_SIZE * 0.5, size.y * 0.5);
    const halfZ = Math.max(DYNAMIC_HAZARD_COLLIDER_MIN_SIZE * 0.5, size.z * 0.5);
    collider.shape = 'box';
    collider.center = [center.x, center.y, center.z];
    collider.size = [halfX * 2, halfY * 2, halfZ * 2];
    collider.rotation = [0, 0, 0, 1];
    collider.inverseRotation = [0, 0, 0, 1];
    collider.top = center.y + halfY;
    collider.minX = center.x - halfX;
    collider.maxX = center.x + halfX;
    collider.minY = center.y - halfY;
    collider.maxY = center.y + halfY;
    collider.minZ = center.z - halfZ;
    collider.maxZ = center.z + halfZ;
    collider.planes = [
      { nx: 1, ny: 0, nz: 0, constant: -halfX },
      { nx: -1, ny: 0, nz: 0, constant: -halfX },
      { nx: 0, ny: 1, nz: 0, constant: -halfY },
      { nx: 0, ny: -1, nz: 0, constant: -halfY },
      { nx: 0, ny: 0, nz: 1, constant: -halfZ },
      { nx: 0, ny: 0, nz: -1, constant: -halfZ },
    ];
  };

  const dynamicObstacleUpdaters: Array<(elapsed: number) => void> = [];

  const pushColliderFromObjectBounds = (
    object: Group | Mesh,
    debugMeta: PlatformCollisionDebugMeta,
    options?: {
      insetXZ?: number;
      insetY?: number;
      minSize?: [number, number, number];
    },
  ) => {
    object.updateWorldMatrix(true, true);
    const worldBounds = new Box3().setFromObject(object);
    if (worldBounds.isEmpty()) return null;
    const center = new Vector3();
    const size = new Vector3();
    worldBounds.getCenter(center);
    worldBounds.getSize(size);
    const insetXZ = MathUtils.clamp(options?.insetXZ ?? 1, 0.45, 1);
    const insetY = MathUtils.clamp(options?.insetY ?? 1, 0.45, 1);
    const minSize = options?.minSize ?? [0.25, 0.2, 0.25];
    return pushCollider({
      center: [center.x, center.y, center.z],
      size: [
        Math.max(minSize[0], size.x * insetXZ),
        Math.max(minSize[1], size.y * insetY),
        Math.max(minSize[2], size.z * insetXZ),
      ],
      debugMeta,
    });
  };

  const createGroundScenery = () => {
    const treeTrunkGeometry = new CylinderGeometry(0.9, 1.15, 15.5, 10);
    const treeLeafLargeGeometry = new ConeGeometry(4.9, 8.6, 9);
    const treeLeafMediumGeometry = new ConeGeometry(3.9, 7.2, 9);
    const treeLeafTopGeometry = new ConeGeometry(2.8, 5.2, 8);
    const rockLargeGeometry = new DodecahedronGeometry(3.3, 0);
    const rockMediumGeometry = new DodecahedronGeometry(2.2, 0);
    const grassBladeGeometry = new ConeGeometry(0.44, 1.95, 6);
    const flowerCoreGeometry = new SphereGeometry(0.22, 10, 8);
    const flowerPetalGeometry = new SphereGeometry(0.16, 8, 6);
    sceneryGeometries.push(
      treeTrunkGeometry,
      treeLeafLargeGeometry,
      treeLeafMediumGeometry,
      treeLeafTopGeometry,
      rockLargeGeometry,
      rockMediumGeometry,
      grassBladeGeometry,
      flowerCoreGeometry,
      flowerPetalGeometry,
    );

    const treeTrunkMaterial = new MeshStandardMaterial({
      color: '#6b4a2d',
      roughness: 0.88,
      metalness: 0.02,
    });
    const treeLeafMaterial = new MeshStandardMaterial({
      color: '#3f8a45',
      roughness: 0.9,
      metalness: 0.01,
    });
    const rockMaterial = new MeshStandardMaterial({
      color: '#707a84',
      roughness: 0.94,
      metalness: 0.03,
    });
    const grassMaterial = new MeshStandardMaterial({
      color: '#57a85c',
      roughness: 0.9,
      metalness: 0.01,
    });
    const flowerCoreMaterial = new MeshStandardMaterial({
      color: '#fcd34d',
      roughness: 0.75,
      metalness: 0.05,
    });
    const flowerPetalMaterial = new MeshStandardMaterial({
      color: '#f472b6',
      roughness: 0.82,
      metalness: 0.03,
    });
    sceneryMaterials.push(
      treeTrunkMaterial,
      treeLeafMaterial,
      rockMaterial,
      grassMaterial,
      flowerCoreMaterial,
      flowerPetalMaterial,
    );

    const treeConfigs: Array<{
      id: string;
      position: [number, number, number];
      scale: number;
      yaw: number;
    }> = [
      { id: 'ground-tree-01', position: [-52, 0, -42], scale: 1.24, yaw: 0.22 },
      { id: 'ground-tree-02', position: [54, 0, -38], scale: 1.18, yaw: -0.16 },
      { id: 'ground-tree-03', position: [-56, 0, 28], scale: 1.34, yaw: 0.38 },
      { id: 'ground-tree-04', position: [52, 0, 34], scale: 1.28, yaw: -0.28 },
      { id: 'ground-tree-05', position: [-42, 0, 50], scale: 1.16, yaw: 0.14 },
      { id: 'ground-tree-06', position: [40, 0, -52], scale: 1.12, yaw: -0.32 },
      { id: 'ground-tree-07', position: [-58, 0, -8], scale: 1.22, yaw: 0.3 },
      { id: 'ground-tree-08', position: [58, 0, 8], scale: 1.18, yaw: -0.26 },
      { id: 'ground-tree-09', position: [-20, 0, 56], scale: 1.2, yaw: 0.18 },
      { id: 'ground-tree-10', position: [22, 0, -56], scale: 1.18, yaw: -0.2 },
      { id: 'ground-tree-11', position: [-6, 0, 58], scale: 1.14, yaw: 0.1 },
      { id: 'ground-tree-12', position: [6, 0, -58], scale: 1.14, yaw: -0.1 },
    ];

    treeConfigs.forEach((treeConfig) => {
      const tree = new Group();
      tree.position.set(treeConfig.position[0], treeConfig.position[1], treeConfig.position[2]);
      tree.rotation.y = treeConfig.yaw;
      tree.scale.setScalar(treeConfig.scale);

      const trunk = new Mesh(treeTrunkGeometry, treeTrunkMaterial);
      trunk.position.y = 7.75;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const leafBottom = new Mesh(treeLeafLargeGeometry, treeLeafMaterial);
      leafBottom.position.y = 13.4;
      leafBottom.castShadow = true;
      leafBottom.receiveShadow = true;
      tree.add(leafBottom);

      const leafMiddle = new Mesh(treeLeafMediumGeometry, treeLeafMaterial);
      leafMiddle.position.y = 17.2;
      leafMiddle.castShadow = true;
      leafMiddle.receiveShadow = true;
      tree.add(leafMiddle);

      const leafTop = new Mesh(treeLeafTopGeometry, treeLeafMaterial);
      leafTop.position.y = 20.6;
      leafTop.castShadow = true;
      leafTop.receiveShadow = true;
      tree.add(leafTop);

      scene.add(tree);
      pushColliderFromObjectBounds(
        trunk,
        {
          category: 'system',
          instanceId: `${treeConfig.id}-trunk`,
        },
        { insetXZ: 0.92, insetY: 0.98, minSize: [0.6, 1.4, 0.6] },
      );
      pushColliderFromObjectBounds(
        leafBottom,
        {
          category: 'system',
          instanceId: `${treeConfig.id}-leaf-bottom`,
        },
        { insetXZ: 0.84, insetY: 0.82, minSize: [0.9, 0.9, 0.9] },
      );
      pushColliderFromObjectBounds(
        leafMiddle,
        {
          category: 'system',
          instanceId: `${treeConfig.id}-leaf-middle`,
        },
        { insetXZ: 0.82, insetY: 0.8, minSize: [0.8, 0.8, 0.8] },
      );
      pushColliderFromObjectBounds(
        leafTop,
        {
          category: 'system',
          instanceId: `${treeConfig.id}-leaf-top`,
        },
        { insetXZ: 0.8, insetY: 0.78, minSize: [0.7, 0.7, 0.7] },
      );
    });

    const rockConfigs: Array<{
      id: string;
      position: [number, number, number];
      scale: [number, number, number];
      yaw: number;
      large?: boolean;
    }> = [
      {
        id: 'ground-rock-01',
        position: [-46, 1.7, -22],
        scale: [1.3, 1.05, 1.15],
        yaw: 0.2,
        large: true,
      },
      {
        id: 'ground-rock-02',
        position: [44, 1.6, -20],
        scale: [1.2, 0.98, 1.1],
        yaw: -0.3,
        large: true,
      },
      { id: 'ground-rock-03', position: [-34, 1.4, 40], scale: [1.05, 0.9, 0.98], yaw: 0.4 },
      { id: 'ground-rock-04', position: [38, 1.3, 42], scale: [1.12, 0.86, 1], yaw: -0.24 },
      { id: 'ground-rock-05', position: [50, 1.2, 10], scale: [0.92, 0.84, 0.9], yaw: 0.18 },
      { id: 'ground-rock-06', position: [-50, 1.2, 8], scale: [0.9, 0.8, 0.86], yaw: -0.18 },
      { id: 'ground-rock-07', position: [-57, 1.4, -26], scale: [1.06, 0.9, 0.96], yaw: 0.28 },
      { id: 'ground-rock-08', position: [56, 1.45, 26], scale: [1.08, 0.9, 0.98], yaw: -0.22 },
      { id: 'ground-rock-09', position: [-22, 1.3, 54], scale: [0.96, 0.82, 0.92], yaw: 0.36 },
      { id: 'ground-rock-10', position: [24, 1.3, -54], scale: [0.98, 0.84, 0.94], yaw: -0.3 },
      { id: 'ground-rock-11', position: [58, 1.2, -8], scale: [0.9, 0.78, 0.86], yaw: 0.14 },
      { id: 'ground-rock-12', position: [-58, 1.2, 8], scale: [0.92, 0.8, 0.88], yaw: -0.16 },
    ];

    rockConfigs.forEach((rockConfig) => {
      const geometry = rockConfig.large ? rockLargeGeometry : rockMediumGeometry;
      const mesh = new Mesh(geometry, rockMaterial);
      mesh.position.set(rockConfig.position[0], rockConfig.position[1], rockConfig.position[2]);
      mesh.rotation.set(0.08, rockConfig.yaw, -0.03);
      mesh.scale.set(rockConfig.scale[0], rockConfig.scale[1], rockConfig.scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      pushColliderFromObjectBounds(
        mesh,
        {
          category: 'system',
          instanceId: rockConfig.id,
        },
        { insetXZ: 0.9, insetY: 0.9, minSize: [0.8, 0.6, 0.8] },
      );
    });

    const grassClusterCenters: Array<[number, number, number]> = [
      [-30, -0.04, -44],
      [34, -0.04, -46],
      [-44, -0.04, 36],
      [42, -0.04, 38],
      [54, -0.04, 2],
      [-54, -0.04, -2],
      [-58, -0.04, -30],
      [58, -0.04, 30],
      [-18, -0.04, 54],
      [20, -0.04, -54],
      [0, -0.04, 58],
      [0, -0.04, -58],
    ];
    grassClusterCenters.forEach((center, clusterIndex) => {
      for (let bladeIndex = 0; bladeIndex < 9; bladeIndex += 1) {
        const angle = (Math.PI * 2 * bladeIndex) / 9;
        const radius = 1 + ((bladeIndex + clusterIndex) % 3) * 0.42;
        const blade = new Mesh(grassBladeGeometry, grassMaterial);
        blade.position.set(
          center[0] + Math.cos(angle) * radius,
          center[1] + 0.98,
          center[2] + Math.sin(angle) * radius,
        );
        blade.rotation.y = angle * 0.6;
        blade.scale.set(
          0.9 + ((bladeIndex + 2) % 4) * 0.12,
          1.02 + ((bladeIndex + 1) % 3) * 0.16,
          0.9 + (bladeIndex % 2) * 0.18,
        );
        blade.castShadow = true;
        blade.receiveShadow = true;
        scene.add(blade);
      }

      const flowerCore = new Mesh(flowerCoreGeometry, flowerCoreMaterial);
      flowerCore.position.set(center[0], center[1] + 1.82, center[2]);
      flowerCore.castShadow = true;
      flowerCore.receiveShadow = true;
      scene.add(flowerCore);
      for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
        const petalAngle = (Math.PI * 2 * petalIndex) / 5;
        const petal = new Mesh(flowerPetalGeometry, flowerPetalMaterial);
        petal.position.set(
          center[0] + Math.cos(petalAngle) * 0.36,
          center[1] + 1.82,
          center[2] + Math.sin(petalAngle) * 0.36,
        );
        petal.castShadow = true;
        petal.receiveShadow = true;
        scene.add(petal);
      }
      pushCollider({
        center: [center[0], 0.4, center[2]],
        size: [2.2, 0.8, 2.2],
        debugMeta: {
          category: 'system',
          instanceId: `ground-grass-cluster-${(clusterIndex + 1).toString().padStart(2, '0')}`,
        },
      });
    });

    const themeZoneBaseGeometry = new PlaneGeometry(1, 1);
    const containerZoneMaterial = new MeshStandardMaterial({
      color: '#c9733b',
      roughness: 0.9,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const woodZoneMaterial = new MeshStandardMaterial({
      color: '#8b5a3c',
      roughness: 0.92,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const pipeZoneMaterial = new MeshStandardMaterial({
      color: '#5b7288',
      roughness: 0.84,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const farmZoneMaterial = new MeshStandardMaterial({
      color: '#6a8f4d',
      roughness: 0.9,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    sceneryGeometries.push(themeZoneBaseGeometry);
    sceneryMaterials.push(
      containerZoneMaterial,
      woodZoneMaterial,
      pipeZoneMaterial,
      farmZoneMaterial,
    );
    const themeZoneConfigs: Array<{
      zoneId: 'container' | 'wood' | 'pipe' | 'farm';
      center: [number, number, number];
      size: [number, number];
      yaw?: number;
      material: MeshStandardMaterial;
    }> = [
      {
        zoneId: 'container',
        center: [-42, FLOOR_SURFACE_Y, -8],
        size: [26, 20],
        yaw: 0.08,
        material: containerZoneMaterial,
      },
      {
        zoneId: 'wood',
        center: [42, FLOOR_SURFACE_Y, -8],
        size: [24, 18],
        yaw: -0.06,
        material: woodZoneMaterial,
      },
      {
        zoneId: 'pipe',
        center: [-42, FLOOR_SURFACE_Y, 34],
        size: [24, 18],
        yaw: 0.04,
        material: pipeZoneMaterial,
      },
      {
        zoneId: 'farm',
        center: [42, FLOOR_SURFACE_Y, 34],
        size: [26, 20],
        yaw: -0.05,
        material: farmZoneMaterial,
      },
    ];
    themeZoneConfigs.forEach((zone) => {
      const mesh = new Mesh(themeZoneBaseGeometry, zone.material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.center[0], zone.center[1], zone.center[2]);
      mesh.scale.set(zone.size[0], zone.size[1], 1);
      if (zone.yaw) mesh.rotation.y = zone.yaw;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      scene.add(mesh);
    });

    const themedPropGeometry = new BoxGeometry(1, 1, 1);
    const themedPipeGeometry = new CylinderGeometry(0.48, 0.48, 4.6, 12);
    sceneryGeometries.push(themedPropGeometry, themedPipeGeometry);
    themeZoneConfigs.forEach((zone, zoneIndex) => {
      for (let i = 0; i < 4; i += 1) {
        const offsetX = (i - 1.5) * 4.2;
        const offsetZ = zone.zoneId === 'container' || zone.zoneId === 'wood' ? 3.2 : -3.2;
        const x = zone.center[0] + offsetX;
        const z = zone.center[2] + offsetZ + (i % 2 === 0 ? 1.2 : -1.2);
        if (zone.zoneId === 'pipe') {
          const pipe = new Mesh(themedPipeGeometry, pipeZoneMaterial);
          pipe.position.set(x, -0.08, z);
          pipe.rotation.z = Math.PI * 0.5;
          pipe.rotation.y = zone.yaw ?? 0;
          pipe.castShadow = true;
          pipe.receiveShadow = true;
          scene.add(pipe);
        } else {
          const prop = new Mesh(themedPropGeometry, zone.material);
          const height = zone.zoneId === 'container' ? 2.2 : zone.zoneId === 'wood' ? 0.5 : 1.1;
          prop.position.set(x, FLOOR_SURFACE_Y + height * 0.5, z);
          prop.scale.set(
            zone.zoneId === 'farm' ? 1.1 : zone.zoneId === 'wood' ? 3.2 : 2.4,
            height,
            zone.zoneId === 'wood' ? 0.55 : 1.2,
          );
          prop.rotation.y = (zone.yaw ?? 0) + (zoneIndex % 2 === 0 ? 0.1 : -0.08);
          prop.castShadow = true;
          prop.receiveShadow = true;
          scene.add(prop);
        }
      }
    });
  };

  const createDynamicHazards = () => {
    const ropeGeometry = new CylinderGeometry(0.08, 0.08, 1, 10);
    const bobGeometry = new SphereGeometry(0.74, 12, 10);
    const anchorGeometry = new SphereGeometry(0.18, 8, 6);
    const ropeMaterial = new MeshStandardMaterial({
      color: '#5a6570',
      roughness: 0.86,
      metalness: 0.16,
    });
    const bobMaterial = new MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.74,
      metalness: 0.12,
    });
    const anchorMaterial = new MeshStandardMaterial({
      color: '#9aa6b2',
      roughness: 0.8,
      metalness: 0.08,
    });
    sceneryGeometries.push(ropeGeometry, bobGeometry, anchorGeometry);
    sceneryMaterials.push(ropeMaterial, bobMaterial, anchorMaterial);

    const pendulumConfigs: Array<{
      id: string;
      pivot: [number, number, number];
      length: number;
      amplitude: number;
      speed: number;
      phase: number;
    }> = [
      {
        id: 'hazard-pendulum-01',
        pivot: [19.2, 34.6, -0.8],
        length: 6.2,
        amplitude: 0.48,
        speed: 1.45,
        phase: 0,
      },
      {
        id: 'hazard-pendulum-02',
        pivot: [33.8, 56.8, -14.4],
        length: 5.7,
        amplitude: 0.52,
        speed: 1.68,
        phase: 1.3,
      },
    ];

    pendulumConfigs.forEach((config) => {
      const pivotGroup = new Group();
      pivotGroup.position.set(config.pivot[0], config.pivot[1], config.pivot[2]);
      scene.add(pivotGroup);

      const anchor = new Mesh(anchorGeometry, anchorMaterial);
      anchor.castShadow = true;
      anchor.receiveShadow = true;
      pivotGroup.add(anchor);

      const rope = new Mesh(ropeGeometry, ropeMaterial);
      rope.position.y = -config.length * 0.5;
      rope.scale.set(1, config.length, 1);
      rope.castShadow = true;
      rope.receiveShadow = true;
      pivotGroup.add(rope);

      const bob = new Mesh(bobGeometry, bobMaterial);
      bob.position.y = -config.length;
      bob.castShadow = true;
      bob.receiveShadow = true;
      pivotGroup.add(bob);

      const hazardCollider = pushCollider({
        center: [config.pivot[0], config.pivot[1] - config.length, config.pivot[2]],
        size: [1.5, 1.5, 1.5],
        debugMeta: {
          category: 'system',
          instanceId: config.id,
        },
      });

      dynamicObstacleUpdaters.push((elapsed) => {
        const angle = Math.sin(elapsed * config.speed + config.phase) * config.amplitude;
        pivotGroup.rotation.z = angle;
        syncAxisAlignedColliderWithObjectBounds(hazardCollider, bob);
      });
    });
  };

  level.platforms.forEach((platform) => {
    const [width, height, depth] = platform.size;
    const [x, y, z] = platform.position;
    const material = new MeshStandardMaterial({
      color: new Color(platform.color),
      roughness: 0.55,
      metalness: 0.08,
    });
    const mesh = new Mesh(platformGeometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    platformMaterials.push(material);
    pushCollider({
      center: [x, y, z],
      size: [width, height, depth],
      debugMeta: {
        category: 'platform',
        instanceId: platform.id,
      },
    });
  });

  pushCollider({
    center: [0, FLOOR_COLLIDER_CENTER_Y, 0],
    size: [FLOOR_COLLIDER_SIZE, FLOOR_COLLIDER_HEIGHT, FLOOR_COLLIDER_SIZE],
    debugMeta: {
      category: 'system',
      instanceId: 'floor',
    },
  });

  const wallY = BOUNDARY_WALL_HEIGHT / 2 - 0.5;
  const boundaryWallConfigs: Array<{
    center: [number, number, number];
    size: [number, number, number];
  }> = [
    {
      center: [0, wallY, BOUNDARY_HALF_RANGE + BOUNDARY_WALL_THICKNESS / 2],
      size: [
        BOUNDARY_HALF_RANGE * 2 + BOUNDARY_WALL_THICKNESS * 2,
        BOUNDARY_WALL_HEIGHT,
        BOUNDARY_WALL_THICKNESS,
      ],
    },
    {
      center: [0, wallY, -(BOUNDARY_HALF_RANGE + BOUNDARY_WALL_THICKNESS / 2)],
      size: [
        BOUNDARY_HALF_RANGE * 2 + BOUNDARY_WALL_THICKNESS * 2,
        BOUNDARY_WALL_HEIGHT,
        BOUNDARY_WALL_THICKNESS,
      ],
    },
    {
      center: [BOUNDARY_HALF_RANGE + BOUNDARY_WALL_THICKNESS / 2, wallY, 0],
      size: [BOUNDARY_WALL_THICKNESS, BOUNDARY_WALL_HEIGHT, BOUNDARY_HALF_RANGE * 2],
    },
    {
      center: [-(BOUNDARY_HALF_RANGE + BOUNDARY_WALL_THICKNESS / 2), wallY, 0],
      size: [BOUNDARY_WALL_THICKNESS, BOUNDARY_WALL_HEIGHT, BOUNDARY_HALF_RANGE * 2],
    },
  ];

  boundaryWallConfigs.forEach((wallConfig) => {
    const wallMaterial = new MeshStandardMaterial({
      color: '#93c5fd',
      roughness: 0.45,
      metalness: 0.06,
      transparent: true,
      opacity: 0.2,
    });
    const wallGeometry = new BoxGeometry(1, 1, 1);
    const wallMesh = new Mesh(wallGeometry, wallMaterial);
    wallMesh.position.set(wallConfig.center[0], wallConfig.center[1], wallConfig.center[2]);
    wallMesh.scale.set(wallConfig.size[0], wallConfig.size[1], wallConfig.size[2]);
    wallMesh.castShadow = false;
    wallMesh.receiveShadow = false;
    scene.add(wallMesh);

    boundaryWallMaterials.push(wallMaterial);
    boundaryWallGeometries.push(wallGeometry);
    pushCollider({
      ...wallConfig,
      debugMeta: {
        category: 'system',
        instanceId: 'boundary-wall',
      },
    });
  });

  createGroundScenery();
  createDynamicHazards();
  const setPieceRuntime = createSetPieceRuntime({
    scene,
    setPieces: level.setPieces,
    reachabilityStart: {
      id: level.platforms[0]?.id ?? 'start',
      center: [
        level.platforms[0]?.position[0] ?? 0,
        level.platforms[0]?.position[1] ?? 0,
        level.platforms[0]?.position[2] ?? 0,
      ],
      size: [
        level.platforms[0]?.size[0] ?? FLOOR_COLLIDER_SIZE,
        level.platforms[0]?.size[1] ?? FLOOR_COLLIDER_HEIGHT,
        level.platforms[0]?.size[2] ?? FLOOR_COLLIDER_SIZE,
      ],
    },
    appendCollider: (params) => pushCollider(params),
  });

  if (colliderDebugGroup.visible && colliderDebugDirty) {
    rebuildColliderDebugMeshes();
  }

  const goalPlatform = level.platforms[level.platforms.length - 1];
  const goalTop = goalPlatform.position[1] + goalPlatform.size[1] / 2;
  const goalPulseMaterial = new MeshStandardMaterial({
    color: '#fbbf24',
    roughness: 0.3,
    metalness: 0.55,
    emissive: '#f59e0b',
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.58,
  });
  const goalPulse = new Mesh(new TorusGeometry(1.3, 0.14, 20, 48), goalPulseMaterial);
  goalPulse.rotation.x = Math.PI / 2;
  goalPulse.position.set(goalPlatform.position[0], goalTop + 0.75, goalPlatform.position[2]);
  goalPulse.castShadow = true;
  scene.add(goalPulse);

  const goalBurstMaterial = new MeshStandardMaterial({
    color: '#fde68a',
    roughness: 0.24,
    metalness: 0.42,
    emissive: '#f59e0b',
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0,
  });
  const goalBurst = new Mesh(new TorusGeometry(0.96, 0.1, 16, 42), goalBurstMaterial);
  goalBurst.rotation.x = Math.PI / 2;
  goalBurst.position.copy(goalPulse.position);
  goalBurst.visible = false;
  scene.add(goalBurst);

  const characterRig = createCharacterRig(characterId, {
    onRuntimeStatusChange: onCharacterStatusChange,
  });
  characterRig.setAutoFootCalibrationEnabled(characterAutoFootCalibrationEnabled);
  scene.add(characterRig.group);

  const audio = createPrototypeAudio(audioEnabled);

  const keyState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jumpQueued: false,
    jumpHeld: false,
  };

  const playerPosition = startPosition.clone();
  const velocity = new Vector3(0, 0, 0);
  const cameraTarget = startPosition.clone();
  const goalTarget = goalPulse.position.clone();
  const tempFollowOffset = new Vector3();
  const tempDesiredCameraPosition = new Vector3();

  let grounded = false;
  let bestHeight = startPosition.y;
  let goalReached = false;
  let goalReachedAtMs: number | null = null;
  let goalCelebrationTimer = 0;
  let landingAnimationLockMs = 0;
  let debugCharacterAnimationVisibleInternal = debugCharacterAnimationVisible;
  let lastLandAudioAtMs = -10000;
  let lastJumpAtMs = -10000;
  let lastGroundedAtMs = -10000;
  let rafId = 0;
  let disposed = false;
  let lastStatsAt = 0;
  const clock = new Clock();
  const progressDenominator = Math.max(0.001, maxPlatformTop - startPosition.y);

  const cameraBaseDistance = cameraOffset.length();
  let cameraYaw = Math.atan2(cameraOffset.x, cameraOffset.z);
  let cameraPitch = Math.asin(clamp(cameraOffset.y / cameraBaseDistance, -0.98, 0.98));
  let targetCameraYaw = cameraYaw;
  let targetCameraPitch = cameraPitch;
  let cameraZoomOffset = 0;
  let pointerLocked = false;
  let ignoreMouseMoveUntil = 0;
  let filteredMouseDeltaX = 0;
  let filteredMouseDeltaY = 0;

  const updateSize = () => {
    const width = Math.min(Math.max(mount.clientWidth, 1), 4096);
    const height = Math.min(Math.max(mount.clientHeight, 1), 2160);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(updateSize);
  resizeObserver.observe(mount);
  updateSize();

  const clearInputState = () => {
    keyState.forward = false;
    keyState.backward = false;
    keyState.left = false;
    keyState.right = false;
    keyState.sprint = false;
    keyState.jumpQueued = false;
    keyState.jumpHeld = false;
  };

  function resetPlayer() {
    playerPosition.copy(startPosition);
    velocity.set(0, 0, 0);
    camera.position.copy(startPosition).add(cameraOffset);
    cameraYaw = Math.atan2(cameraOffset.x, cameraOffset.z);
    cameraPitch = Math.asin(clamp(cameraOffset.y / cameraBaseDistance, -0.98, 0.98));
    targetCameraYaw = cameraYaw;
    targetCameraPitch = cameraPitch;
    filteredMouseDeltaX = 0;
    filteredMouseDeltaY = 0;
    ignoreMouseMoveUntil = 0;
    cameraTarget.copy(playerPosition);
    grounded = false;
    bestHeight = startPosition.y;
    goalReached = false;
    goalReachedAtMs = null;
    goalCelebrationTimer = 0;
    landingAnimationLockMs = 0;
    lastLandAudioAtMs = -10000;
    lastJumpAtMs = -10000;
    lastGroundedAtMs = -10000;
    goalBurst.visible = false;
    goalBurst.scale.setScalar(1);
    goalBurstMaterial.opacity = 0;
    clock.start();
    lastStatsAt = 0;
    onStats({
      elapsedMs: 0,
      currentHeight: startPosition.y,
      bestHeight: startPosition.y,
      progress: 0,
      goalReached: false,
      goalReachedAtMs: null,
    });
  }

  function isOnGoalPlatform(): boolean {
    const feetY = playerPosition.y - PLAYER_RADIUS;
    const withinX =
      Math.abs(playerPosition.x - goalPlatform.position[0]) <=
      goalPlatform.size[0] / 2 + GOAL_REACH_XZ_MARGIN;
    if (!withinX) return false;

    const withinZ =
      Math.abs(playerPosition.z - goalPlatform.position[2]) <=
      goalPlatform.size[2] / 2 + GOAL_REACH_XZ_MARGIN;
    if (!withinZ) return false;

    return Math.abs(feetY - goalTop) <= GOAL_REACH_Y_TOLERANCE;
  }

  function updatePlayer(delta: number) {
    if (landingAnimationLockMs > 0) {
      landingAnimationLockMs = Math.max(0, landingAnimationLockMs - delta * 1000);
    }
    const elapsedMs = clock.getElapsedTime() * 1000;
    const wasGrounded = grounded;
    const speed = keyState.sprint ? CLIMBER_SPRINT_SPEED : CLIMBER_WALK_SPEED;
    const inputForward = Number(keyState.forward) - Number(keyState.backward);
    const inputStrafe = Number(keyState.right) - Number(keyState.left);
    const inputMagnitude = Math.hypot(inputForward, inputStrafe);
    const normalizedForward = inputMagnitude > 0 ? inputForward / inputMagnitude : 0;
    const normalizedStrafe = inputMagnitude > 0 ? inputStrafe / inputMagnitude : 0;

    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    const moveX = forwardX * normalizedForward + rightX * normalizedStrafe;
    const moveZ = forwardZ * normalizedForward + rightZ * normalizedStrafe;

    const targetVX = moveX * speed;
    const targetVZ = moveZ * speed;
    const responsiveness = grounded ? 16 : 7;

    velocity.x = MathUtils.damp(
      velocity.x,
      inputMagnitude === 0 ? 0 : targetVX,
      responsiveness,
      delta,
    );
    velocity.z = MathUtils.damp(
      velocity.z,
      inputMagnitude === 0 ? 0 : targetVZ,
      responsiveness,
      delta,
    );
    velocity.y -= CLIMBER_GRAVITY * delta;

    const canJumpByInterval = elapsedMs - lastJumpAtMs >= MIN_JUMP_INTERVAL_MS;
    const groundedDurationMs = elapsedMs - lastGroundedAtMs;
    const canJumpAfterGrounded = groundedDurationMs >= MIN_GROUNDED_BEFORE_JUMP_MS;
    if (
      keyState.jumpQueued &&
      grounded &&
      canJumpByInterval &&
      canJumpAfterGrounded &&
      velocity.y <= 0.18
    ) {
      velocity.y = CLIMBER_JUMP_SPEED;
      grounded = false;
      lastJumpAtMs = elapsedMs;
      audio.playJump();
    }
    keyState.jumpQueued = false;

    const previousBottom = playerPosition.y - PLAYER_RADIUS;
    playerPosition.addScaledVector(velocity, delta);

    const topLanded = tryLandOnTop({
      colliders: platformColliders,
      playerPosition,
      velocity,
      playerRadius: PLAYER_RADIUS,
      landingAssist: LANDING_ASSIST,
      previousBottom,
      stickDistance: wasGrounded ? 0.1 : 0,
    });
    const stickyGrounded = wasGrounded && velocity.y > -GROUND_STICK_VELOCITY_MAX;
    grounded = solveSolidCollisions({
      colliders: platformColliders,
      playerPosition,
      velocity,
      playerRadius: PLAYER_RADIUS,
      initiallyLanded: topLanded || stickyGrounded,
      allowStepAssist: wasGrounded,
    });
    if (!wasGrounded && grounded) {
      lastGroundedAtMs = elapsedMs;
      landingAnimationLockMs = LANDING_ANIMATION_LOCK_MS;
    }

    if (!wasGrounded && grounded && elapsedMs - lastLandAudioAtMs >= LAND_SOUND_COOLDOWN_MS) {
      audio.playLand();
      lastLandAudioAtMs = elapsedMs;
    }

    if (playerPosition.y < RESPAWN_Y) {
      playerPosition.copy(startPosition);
      velocity.set(0, 0, 0);
      grounded = false;
      landingAnimationLockMs = 0;
    }

    if (playerPosition.y > bestHeight) {
      bestHeight = playerPosition.y;
    }

    if (!goalReached && grounded && isOnGoalPlatform()) {
      goalReached = true;
      goalReachedAtMs = clock.getElapsedTime() * 1000;
      goalCelebrationTimer = GOAL_CELEBRATION_DURATION;
      audio.playGoal();
    }
  }

  function resolveAnimationState(horizontalSpeed: number): ClimberCharacterAnimationState {
    if (landingAnimationLockMs > 0) {
      return 'land';
    }
    if (!grounded) {
      return velocity.y > 0.45 ? 'jump' : 'fall';
    }
    if (horizontalSpeed > 0.65) {
      return 'run';
    }
    return 'idle';
  }

  function updateCharacter(delta: number, elapsed: number) {
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const state = resolveAnimationState(horizontalSpeed);
    characterRig.setState(state);
    characterRig.setGrounded(grounded);
    characterRig.setLandingLockMs(landingAnimationLockMs);
    characterRig.update({
      delta,
      elapsed,
      horizontalSpeed,
      verticalSpeed: velocity.y,
    });

    characterRig.group.position.copy(playerPosition);
    if (horizontalSpeed > 0.02) {
      characterRig.group.rotation.y = Math.atan2(velocity.x, velocity.z);
    }

    if (debugCharacterAnimationVisibleInternal) {
      onCharacterAnimationDebug?.(characterRig.getDebugSnapshot());
    }
  }

  function updateCamera(delta: number) {
    if (!Number.isFinite(cameraYaw) || !Number.isFinite(cameraPitch)) {
      cameraYaw = Math.atan2(cameraOffset.x, cameraOffset.z);
      cameraPitch = Math.asin(clamp(cameraOffset.y / cameraBaseDistance, -0.98, 0.98));
      targetCameraYaw = cameraYaw;
      targetCameraPitch = cameraPitch;
    }
    const yawDelta = targetCameraYaw - cameraYaw;
    const pitchDelta = targetCameraPitch - cameraPitch;
    const yawStep = clamp(
      yawDelta,
      -CAMERA_YAW_SPEED_LIMIT * delta,
      CAMERA_YAW_SPEED_LIMIT * delta,
    );
    const pitchStep = clamp(
      pitchDelta,
      -CAMERA_PITCH_SPEED_LIMIT * delta,
      CAMERA_PITCH_SPEED_LIMIT * delta,
    );
    cameraYaw += yawStep;
    cameraPitch += pitchStep;
    cameraTarget.copy(playerPosition);
    const distanceToGoal = playerPosition.distanceTo(goalTarget);
    const approach = clamp((24 - distanceToGoal) / 24, 0, 1);

    const adjustedDistance = clamp(cameraBaseDistance + cameraZoomOffset - approach * 1.2, 4.8, 18);
    const adjustedPitch = clamp(cameraPitch + approach * 0.03, -0.1, 1.2);
    const horizontalDistance = Math.cos(adjustedPitch) * adjustedDistance;

    tempFollowOffset.set(
      Math.sin(cameraYaw) * horizontalDistance,
      Math.sin(adjustedPitch) * adjustedDistance,
      Math.cos(cameraYaw) * horizontalDistance,
    );
    tempDesiredCameraPosition.copy(cameraTarget).add(tempFollowOffset);

    camera.position.lerp(tempDesiredCameraPosition, 1 - Math.exp(-8 * delta));
    camera.lookAt(cameraTarget.x, cameraTarget.y + 0.45, cameraTarget.z);
  }

  function reportStats(timestamp: number) {
    if (timestamp - lastStatsAt < 110) return;
    lastStatsAt = timestamp;
    const elapsedMs = goalReachedAtMs ?? clock.getElapsedTime() * 1000;
    onStats({
      elapsedMs,
      currentHeight: playerPosition.y,
      bestHeight,
      progress: goalReached ? 1 : clamp((bestHeight - startPosition.y) / progressDenominator, 0, 1),
      goalReached,
      goalReachedAtMs,
    });
  }

  function renderFrame(timestamp: number) {
    if (disposed) return;
    const delta = Math.min(clock.getDelta(), 0.033);
    const frameElapsed = clock.getElapsedTime();
    const simulationSteps = Math.max(1, Math.min(4, Math.ceil(delta / 0.012)));
    const simulationDelta = delta / simulationSteps;

    for (let step = 0; step < simulationSteps; step += 1) {
      const stepElapsed = frameElapsed + simulationDelta * step;
      dynamicObstacleUpdaters.forEach((update) => update(stepElapsed));
      updatePlayer(simulationDelta);
    }
    playerAxisLabelGroup.position.copy(playerPosition);
    updateCharacter(delta, clock.getElapsedTime());
    updateCamera(delta);

    if (goalReached) {
      goalPulse.rotation.z += delta * 1.9;
      goalPulseMaterial.emissiveIntensity = MathUtils.damp(
        goalPulseMaterial.emissiveIntensity,
        0.9,
        8,
        delta,
      );
      goalPulseMaterial.opacity = 0.58 + (Math.sin(timestamp * 0.006) + 1) * 0.1;
    } else {
      goalPulse.rotation.z += delta * 0.6;
      goalPulseMaterial.emissiveIntensity = MathUtils.damp(
        goalPulseMaterial.emissiveIntensity,
        0.22,
        6,
        delta,
      );
      goalPulseMaterial.opacity = 0.46 + (Math.sin(timestamp * 0.003) + 1) * 0.13;
    }

    if (goalCelebrationTimer > 0) {
      goalCelebrationTimer = Math.max(0, goalCelebrationTimer - delta);
      const progress = 1 - goalCelebrationTimer / GOAL_CELEBRATION_DURATION;
      goalBurst.visible = true;
      const burstScale = 1 + progress * 4.2;
      goalBurst.scale.setScalar(burstScale);
      goalBurst.rotation.z += delta * 9;
      goalBurstMaterial.opacity = (1 - progress) * 0.88;
    } else {
      goalBurst.visible = false;
      goalBurstMaterial.opacity = 0;
      goalBurst.scale.setScalar(1);
    }

    renderer.render(scene, camera);
    reportStats(timestamp);
    rafId = window.requestAnimationFrame(renderFrame);
  }

  const keyMap: Record<string, keyof typeof keyState | undefined> = {
    KeyW: 'forward',
    ArrowUp: 'forward',
    KeyS: 'backward',
    ArrowDown: 'backward',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
  };

  const handlePointerLockChange = () => {
    const nextLocked = document.pointerLockElement === renderer.domElement;
    if (nextLocked === pointerLocked) return;
    pointerLocked = nextLocked;
    if (nextLocked) {
      ignoreMouseMoveUntil = performance.now() + POINTER_LOCK_INPUT_COOLDOWN_MS;
      targetCameraYaw = cameraYaw;
      targetCameraPitch = cameraPitch;
      filteredMouseDeltaX = 0;
      filteredMouseDeltaY = 0;
    }
    onPointerLockChange?.(nextLocked);
    if (!nextLocked) {
      filteredMouseDeltaX = 0;
      filteredMouseDeltaY = 0;
      clearInputState();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!pointerLocked) return;
    if (event.code === 'KeyP') {
      event.preventDefault();
      document.exitPointerLock();
      return;
    }
    const mapped = keyMap[event.code];
    if (mapped) keyState[mapped] = true;
    if (event.code === 'Space') {
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      if (!keyState.jumpHeld) {
        keyState.jumpQueued = true;
      }
      keyState.jumpHeld = true;
      event.preventDefault();
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) keyState[mapped] = false;
    if (event.code === 'Space') {
      keyState.jumpHeld = false;
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!pointerLocked) return;
    if (performance.now() < ignoreMouseMoveUntil) {
      return;
    }
    if (!Number.isFinite(event.movementX) || !Number.isFinite(event.movementY)) return;
    if (Math.abs(event.movementX) > 180 || Math.abs(event.movementY) > 180) return;
    const rawDeltaX = clamp(event.movementX, -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
    const rawDeltaY = clamp(event.movementY, -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
    filteredMouseDeltaX = MathUtils.lerp(filteredMouseDeltaX, rawDeltaX, MOUSE_FILTER_ALPHA);
    filteredMouseDeltaY = MathUtils.lerp(filteredMouseDeltaY, rawDeltaY, MOUSE_FILTER_ALPHA);
    targetCameraYaw -= filteredMouseDeltaX * 0.00255;
    targetCameraPitch = clamp(targetCameraPitch + filteredMouseDeltaY * 0.0022, -0.25, 1.2);
  };

  const handleWheel = (event: WheelEvent) => {
    if (!pointerLocked) return;
    event.preventDefault();
    cameraZoomOffset = clamp(cameraZoomOffset + Math.sign(event.deltaY) * 0.7, -4.5, 8);
  };

  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('mousemove', handleMouseMove);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
  onPointerLockChange?.(false);

  resetPlayer();
  clock.start();
  rafId = window.requestAnimationFrame(renderFrame);

  return {
    reset: () => {
      resetPlayer();
    },
    setAudioEnabled: (enabled: boolean) => {
      audio.setEnabled(enabled);
    },
    setDebugCollidersVisible: (visible: boolean) => {
      colliderDebugGroup.visible = visible;
      if (visible && colliderDebugDirty) {
        rebuildColliderDebugMeshes();
      }
    },
    setDebugInstanceLabelsVisible: (visible: boolean) => {
      if (debugInstanceLabelsVisibleInternal === visible) return;
      debugInstanceLabelsVisibleInternal = visible;
      playerAxisLabelGroup.visible = visible;
      colliderDebugDirty = true;
      if (colliderDebugGroup.visible) {
        rebuildColliderDebugMeshes();
      }
    },
    setDebugJumpClearanceVisible: (visible: boolean) => {
      jumpClearanceDebugGroup.visible = visible;
      if (visible) {
        rebuildJumpClearanceDebugMeshes(lastJumpClearanceAnalysis);
      }
    },
    setDebugColliderFocusAssetId: (assetId: ClimberSetPieceAssetId | null) => {
      if (colliderDebugFocusAssetId === assetId) return;
      colliderDebugFocusAssetId = assetId;
      colliderDebugDirty = true;
      if (colliderDebugGroup.visible) {
        rebuildColliderDebugMeshes();
      }
    },
    setDebugCharacterAnimationVisible: (visible: boolean) => {
      debugCharacterAnimationVisibleInternal = visible;
      if (visible) {
        onCharacterAnimationDebug?.(characterRig.getDebugSnapshot());
      }
    },
    setCharacterAutoFootCalibrationEnabled: (enabled: boolean) => {
      characterRig.setAutoFootCalibrationEnabled(enabled);
      if (debugCharacterAnimationVisibleInternal) {
        onCharacterAnimationDebug?.(characterRig.getDebugSnapshot());
      }
    },
    requestPointerLock: () => {
      renderer.domElement.requestPointerLock();
    },
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      if (jumpClearanceRecomputeTimer) {
        window.clearTimeout(jumpClearanceRecomputeTimer);
        jumpClearanceRecomputeTimer = 0;
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      resizeObserver.disconnect();

      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }

      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }

      floor.geometry.dispose();
      disposeMaterial(floor.material);

      platformGeometry.dispose();
      platformMaterials.forEach((material) => material.dispose());
      boundaryWallGeometries.forEach((geometry) => geometry.dispose());
      boundaryWallMaterials.forEach((material) => material.dispose());
      setPieceRuntime.dispose();

      goalPulse.geometry.dispose();
      goalPulseMaterial.dispose();
      goalBurst.geometry.dispose();
      goalBurstMaterial.dispose();

      grid.geometry.dispose();
      disposeMaterial(grid.material);
      sceneryGeometries.forEach((geometry) => geometry.dispose());
      sceneryMaterials.forEach((material) => material.dispose());
      clearColliderDebugMeshes();
      scene.remove(colliderDebugGroup);
      clearJumpClearanceDebugMeshes();
      scene.remove(jumpClearanceDebugGroup);
      scene.remove(playerAxisLabelGroup);
      playerAxisLabelTextures.forEach((texture) => texture.dispose());
      playerAxisLabelMaterials.forEach((material) => material.dispose());

      characterRig.dispose();
      audio.dispose();
      renderer.dispose();
    },
  };
}
