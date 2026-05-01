import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  FogExp2,
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
  Points,
  PointsMaterial,
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
import { PlayerController, type PlayerInputSnapshot } from './player/PlayerController';
import {
  appendBoxCollider,
  type PlatformCollisionData,
  type PlatformCollisionDebugMeta,
  solveSolidCollisions,
  tryLandOnTop,
} from './prototype/collision';
import { createGroundScene } from './prototype/groundScene';
import { createParticleSystem } from './prototype/particleSystem';
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
  /** 开启玩家状态 Debug 叠加层（显示高度/接地/速度/状态/平台ID） */
  debugPlayerStateVisible?: boolean;
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
const GROUND_STICK_VELOCITY_MAX = 1.35;
const LANDING_ANIMATION_LOCK_MS = 140;
/** 存档点未激活时静止自发光强度 */
const CHECKPOINT_IDLE_INTENSITY = 0.12;
/** 存档点激活后常亮自发光强度 */
const CHECKPOINT_ACTIVATED_INTENSITY = 0.45;
/** 存档点首次触达时的闪烁峰值强度 */
const CHECKPOINT_FLASH_PEAK = 2.2;
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
    debugPlayerStateVisible = false,
  } = options;

  if (!level.platforms.length) {
    throw new Error(`关卡 ${level.id} 未配置平台数据。`);
  }

  // ── Debug 玩家状态叠加层（HTML div，绝对定位在画布左下角）──────────────────
  let debugPlayerStateVisibleInternal = debugPlayerStateVisible;
  const debugOverlay = document.createElement('div');
  debugOverlay.style.cssText = [
    'position:absolute',
    'bottom:14px',
    'left:14px',
    'padding:8px 12px',
    'border-radius:10px',
    'background:rgba(15,23,42,0.72)',
    'color:#e2e8f0',
    'font:12px/1.6 monospace',
    'pointer-events:none',
    'white-space:pre',
    'z-index:10',
    'border:1px solid rgba(255,255,255,0.12)',
    'backdrop-filter:blur(2px)',
  ].join(';');
  debugOverlay.style.display = debugPlayerStateVisibleInternal ? 'block' : 'none';
  // mount 需要有 position 上下文
  const mountStyle = getComputedStyle(mount).position;
  if (mountStyle === 'static') mount.style.position = 'relative';
  mount.appendChild(debugOverlay);

  function updateDebugOverlay(): void {
    if (!debugPlayerStateVisibleInternal) return;
    const vXZ = Math.hypot(velocity.x, velocity.z);
    const animState = resolveAnimationState(vXZ);
    // 找出当前站立平台 ID（简单扫描最近接地碰撞体顶面）
    let platformIdText = '—';
    if (grounded) {
      const feetY = playerPosition.y - PLAYER_RADIUS;
      for (const col of platformColliders) {
        const surfaceY = col.maxY;
        if (Math.abs(feetY - surfaceY) < 0.12) {
          const inX = playerPosition.x >= col.minX - 0.1 && playerPosition.x <= col.maxX + 0.1;
          const inZ = playerPosition.z >= col.minZ - 0.1 && playerPosition.z <= col.maxZ + 0.1;
          if (inX && inZ && col.debugMeta?.instanceId) {
            platformIdText = col.debugMeta.instanceId;
            break;
          }
        }
      }
    }
    debugOverlay.textContent = [
      `高度    : ${playerPosition.y.toFixed(2)} m`,
      `接地    : ${grounded ? '✅ 是' : '❌ 否'}`,
      `速度XZ  : ${vXZ.toFixed(2)} m/s`,
      `速度Y   : ${velocity.y.toFixed(2)} m/s`,
      `状态    : ${animState}`,
      `平台ID  : ${platformIdText}`,
      `存档Y   : ${respawnPosition.y.toFixed(2)} m`,
    ].join('\n');
  }

  const scene = new Scene();
  const skyColor = level.theme?.skyColor ?? '#f8fbff';
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

  // ── 地面场景（灯光 / 地砖 / 墙壁 / 装饰）──────────────────────────────
  const groundScene = createGroundScene(scene, {
    floorSurfaceY: FLOOR_SURFACE_Y,
    floorVisualSize: FLOOR_VISUAL_SIZE,
    skyColor,
    sunColor,
  });
  const sceneryGeometries: BufferGeometry[] = [...groundScene.geometries];
  const sceneryMaterials: MeshStandardMaterial[] = [...groundScene.materials];
  const pendingDecoColliders = groundScene.pendingDecoColliders;
  const platformColliders: PlatformCollisionData[] = [];
  const platformMaterials: MeshStandardMaterial[] = [];
  const boundaryWallMaterials: MeshStandardMaterial[] = [];
  const boundaryWallGeometries: BoxGeometry[] = [];
  const platformGeometry = new BoxGeometry(1, 1, 1);
  /** 乐高凸点共享几何体（纯视觉装饰） */
  const bumpGeometry = new CylinderGeometry(0.18, 0.18, 0.14, 10);
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
    for (const g of colliderDebugGeometries) g.dispose();
    for (const g of colliderDebugEdgeGeometries) g.dispose();
    for (const m of colliderDebugMaterials) m.dispose();
    for (const m of colliderDebugLineMaterials) m.dispose();
    for (const t of colliderDebugLabelTextures) t.dispose();
    for (const m of colliderDebugLabelMaterials) m.dispose();
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
    for (const g of jumpClearanceDebugGeometries) g.dispose();
    for (const m of jumpClearanceDebugMaterials) m.dispose();
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

  /** 已激活（首次踩到）的存档点 ID 集合 */
  const activatedCheckpoints = new Set<string>();
  /** 存档点 platformId → 材质引用（首次触达时做闪烁动画） */
  const checkpointMaterialMap = new Map<string, MeshStandardMaterial>();
  /** 存档点闪烁动画队列，每帧 damp 降回静止亮度 */
  const checkpointFlashQueue = new Map<string, { intensity: number }>();

  /**
   * 弹跳板运行时数据：
   * - platformId → { mesh, boostVelocity, squishDuration, top, minX/maxX/minZ/maxZ, squishTimer }
   * squishTimer > 0 表示正在播放压缩动画，每帧递减
   */
  interface BouncyEntry {
    mesh: Mesh;
    boostVelocity: number;
    squishDuration: number;
    top: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    squishTimer: number; // ms，> 0 时播放压缩→回弹
  }
  const bouncyPlatforms = new Map<string, BouncyEntry>();

  /**
   * 不稳定平台运行时数据：
   * 状态机：idle → shaking（玩家站上后延迟晃动）→ falling（落下）→ resetting（不可见，倒计时后复原）→ idle
   */
  type UnstableState = 'idle' | 'shaking' | 'falling' | 'resetting';
  interface UnstableEntry {
    mesh: Mesh;
    collider: PlatformCollisionData;
    originY: number;
    top: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    state: UnstableState;
    timer: number; // ms
    shakeDelay: number;
    shakeDuration: number;
    fallSpeed: number; // m/s
    resetDelay: number;
  }
  const unstablePlatforms = new Map<string, UnstableEntry>();

  level.platforms.forEach((platform) => {
    const [width, height, depth] = platform.size;
    const [x, y, z] = platform.position;
    const isCheckpoint = platform.isCheckpoint === true;
    const isGoal = platform.isGoal === true;
    // 存档点用脉冲蓝色，终点用金色，其余用关卡定义颜色
    const resolvedColor = isGoal ? '#FCD34D' : isCheckpoint ? '#60A5FA' : platform.color;
    const material = new MeshStandardMaterial({
      color: new Color(resolvedColor),
      roughness: isCheckpoint ? 0.42 : 0.55,
      metalness: isCheckpoint ? 0.18 : 0.08,
      emissive: isCheckpoint ? new Color('#3b82f6') : isGoal ? new Color('#f59e0b') : new Color(0),
      emissiveIntensity: isCheckpoint ? 0.12 : isGoal ? 0.28 : 0,
    });
    const mesh = new Mesh(platformGeometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // ── 乐高凸点装饰（纯视觉，不影响碰撞）──────────────────────────────────
    // 凸点数量按平台表面格子数决定（每 1.4m 一个），最多 3×3=9 个
    const bumpMeshesForPlatform: Mesh[] = [];
    if (!isGoal) {
      const bumpMat = new MeshStandardMaterial({
        color: new Color(resolvedColor).multiplyScalar(0.88),
        roughness: 0.5,
        metalness: 0.1,
      });
      platformMaterials.push(bumpMat);
      const topY = y + height / 2 + 0.14 / 2;
      const cols = Math.min(3, Math.max(1, Math.floor(width / 1.4)));
      const rows = Math.min(3, Math.max(1, Math.floor(depth / 1.4)));
      const stepX = cols > 1 ? (width - 0.7) / (cols - 1) : 0;
      const stepZ = rows > 1 ? (depth - 0.7) / (rows - 1) : 0;
      const startX = x - (width - 0.7) / 2;
      const startZ = z - (depth - 0.7) / 2;
      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          const bx = cols > 1 ? startX + ci * stepX : x;
          const bz = rows > 1 ? startZ + ri * stepZ : z;
          const bump = new Mesh(bumpGeometry, bumpMat);
          bump.position.set(bx, topY, bz);
          bump.castShadow = false;
          bump.receiveShadow = true;
          // 记录原始坐标，供移动平台逻辑读取
          bump.userData = { bumpOriginX: bx, bumpOriginY: topY, bumpOriginZ: bz };
          scene.add(bump);
          bumpMeshesForPlatform.push(bump);
        }
      }
    }

    platformMaterials.push(material);
    if (isCheckpoint) {
      checkpointMaterialMap.set(platform.id, material);
    }
    const colliderEntry = pushCollider({
      center: [x, y, z],
      size: [width, height, depth],
      debugMeta: {
        category: 'platform',
        instanceId: platform.id,
      },
    });

    // ── 移动平台：注册 sin 往复动画 + 碰撞体同步 ──────────────────────────
    if (platform.moving && colliderEntry) {
      const mv = platform.moving;
      const omega = (2 * Math.PI) / mv.period;
      const phase = mv.phaseOffset ?? 0;
      const originX = x;
      const originY = y;
      const originZ = z;
      const capturedBumps = bumpMeshesForPlatform.slice();

      dynamicObstacleUpdaters.push((elapsed) => {
        const offset = Math.sin(omega * elapsed + phase) * mv.amplitude;
        mesh.position.set(
          mv.axis === 'x' ? originX + offset : originX,
          mv.axis === 'y' ? originY + offset : originY,
          mv.axis === 'z' ? originZ + offset : originZ,
        );
        // 凸点跟随主体
        for (const bm of capturedBumps) {
          const ud = bm.userData as {
            bumpOriginX: number;
            bumpOriginY: number;
            bumpOriginZ: number;
          };
          bm.position.set(
            mv.axis === 'x' ? ud.bumpOriginX + offset : ud.bumpOriginX,
            mv.axis === 'y' ? ud.bumpOriginY + offset : ud.bumpOriginY,
            mv.axis === 'z' ? ud.bumpOriginZ + offset : ud.bumpOriginZ,
          );
        }
        syncAxisAlignedColliderWithObjectBounds(colliderEntry, mesh);
      });
    }

    // ── 弹跳板：注册到 bouncyPlatforms，供 updatePlayer 触发 ─────────────
    if (platform.bouncy) {
      bouncyPlatforms.set(platform.id, {
        mesh,
        boostVelocity: platform.bouncy.boostVelocity,
        squishDuration: platform.bouncy.squishDuration ?? 80,
        top: y + height / 2,
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        squishTimer: 0,
      });
    }

    // ── 不稳定平台：注册到 unstablePlatforms，状态机在 renderFrame 逐帧运行 ──
    if (platform.unstable && colliderEntry) {
      const us = platform.unstable;
      unstablePlatforms.set(platform.id, {
        mesh,
        collider: colliderEntry,
        originY: y,
        top: y + height / 2,
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        state: 'idle',
        timer: 0,
        shakeDelay: us.shakeDelay ?? 500,
        shakeDuration: us.shakeDuration ?? 1000,
        fallSpeed: us.fallSpeed ?? 5,
        resetDelay: us.resetDelay ?? 2200,
      });
      // 每物理子步同步碰撞体到 mesh 实际位置（falling 时精度保证）
      dynamicObstacleUpdaters.push(() => {
        syncAxisAlignedColliderWithObjectBounds(colliderEntry, mesh);
      });
    }
  });

  pushCollider({
    center: [0, FLOOR_COLLIDER_CENTER_Y, 0],
    size: [FLOOR_COLLIDER_SIZE, FLOOR_COLLIDER_HEIGHT, FLOOR_COLLIDER_SIZE],
    debugMeta: {
      category: 'system',
      instanceId: 'floor',
    },
  });

  // 注册地面散落装饰物的碰撞体（AABB 近似）
  for (let di = 0; di < pendingDecoColliders.length; di++) {
    const dc = pendingDecoColliders[di];
    if (dc) {
      pushCollider({
        center: dc.center,
        size: dc.size,
        debugMeta: { category: 'system', instanceId: `deco_${di}` },
      });
    }
  }

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

  for (const wallConfig of boundaryWallConfigs) {
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
  }

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

  // （已在下文有一套粒子实现，避免重复声明）

  // ── 粒子系统 ─────────────────────────────────────────────────────────────
  const particles = createParticleSystem(scene);
  const { emitLandParticles, emitCheckpointParticles } = particles;

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

  const pc = new PlayerController({ startPosition, respawnY: -Infinity });
  /** 别名：与控制器内部共享同一 Vector3，无需手动同步 */
  const playerPosition = pc.position;
  /** 别名：与控制器内部共享同一 Vector3，无需手动同步 */
  const velocity = pc.velocity;
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
  let rafId = 0;
  let disposed = false;
  let lastStatsAt = 0;
  /** 当前存档重生位置（接触存档点平台时更新，默认=出生点） */
  const respawnPosition = startPosition.clone();
  /** 预先构建存档点平台列表（包含顶面 Y 坐标） */
  const checkpointPlatforms = level.platforms
    .filter((p) => p.isCheckpoint)
    .map((p) => ({
      id: p.id,
      top: p.position[1] + p.size[1] / 2,
      minX: p.position[0] - p.size[0] / 2,
      maxX: p.position[0] + p.size[0] / 2,
      minZ: p.position[2] - p.size[2] / 2,
      maxZ: p.position[2] + p.size[2] / 2,
      spawnY: p.position[1] + p.size[1] / 2 + PLAYER_RADIUS + 0.05,
    }));
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
    pc.reset();
    respawnPosition.copy(startPosition);
    // 重置存档点激活状态，材质恢复静止亮度
    activatedCheckpoints.clear();
    checkpointFlashQueue.clear();
    for (const [, mat] of checkpointMaterialMap) {
      mat.emissiveIntensity = CHECKPOINT_IDLE_INTENSITY;
    }
    // 重置不稳定平台到 idle 状态
    for (const [, up] of unstablePlatforms) {
      up.mesh.position.y = up.originY;
      up.mesh.rotation.z = 0;
      up.mesh.visible = true;
      up.top = up.originY + up.mesh.scale.y / 2;
      up.state = 'idle';
      up.timer = 0;
      syncAxisAlignedColliderWithObjectBounds(up.collider, up.mesh);
    }
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

    // previousBottom 必须在 pc.update()（内部做位移积分）之前捕获
    const previousBottom = playerPosition.y - PLAYER_RADIUS;

    const input: PlayerInputSnapshot = {
      forward: keyState.forward,
      backward: keyState.backward,
      left: keyState.left,
      right: keyState.right,
      sprint: keyState.sprint,
      jumpQueued: keyState.jumpQueued,
    };
    keyState.jumpQueued = false;

    const { jumped, landed } = pc.update(delta, cameraYaw, input, (pos, vel, wasGnd) => {
      const topLanded = tryLandOnTop({
        colliders: platformColliders,
        playerPosition: pos,
        velocity: vel,
        playerRadius: PLAYER_RADIUS,
        landingAssist: LANDING_ASSIST,
        previousBottom,
        stickDistance: wasGnd ? 0.1 : 0,
      });
      const stickyGrounded = wasGnd && vel.y > -GROUND_STICK_VELOCITY_MAX;
      return solveSolidCollisions({
        colliders: platformColliders,
        playerPosition: pos,
        velocity: vel,
        playerRadius: PLAYER_RADIUS,
        initiallyLanded: topLanded || stickyGrounded,
        allowStepAssist: wasGnd,
      });
    });

    grounded = pc.grounded;

    if (jumped) {
      audio.playJump();
    }
    if (landed) {
      landingAnimationLockMs = LANDING_ANIMATION_LOCK_MS;
      const elapsedMs = clock.getElapsedTime() * 1000;
      if (elapsedMs - lastLandAudioAtMs >= LAND_SOUND_COOLDOWN_MS) {
        audio.playLand();
        lastLandAudioAtMs = elapsedMs;
      }
      // 落地粒子：从脚底位置爆发
      emitLandParticles(
        playerPosition.x,
        playerPosition.y - PLAYER_RADIUS + 0.05,
        playerPosition.z,
      );

      // ── 弹跳板检测：落地时检查是否踩在弹跳板上 ───────────────────────────
      const feetYLand = playerPosition.y - PLAYER_RADIUS;
      for (const [, bp] of bouncyPlatforms) {
        if (
          Math.abs(feetYLand - bp.top) < 0.22 &&
          playerPosition.x >= bp.minX - 0.05 &&
          playerPosition.x <= bp.maxX + 0.05 &&
          playerPosition.z >= bp.minZ - 0.05 &&
          playerPosition.z <= bp.maxZ + 0.05
        ) {
          velocity.y = bp.boostVelocity;
          grounded = false;
          landingAnimationLockMs = 0;
          bp.squishTimer = bp.squishDuration;
          audio.playBounce();
          break;
        }
      }
    }

    // 外部重生覆盖（存档点感知，优先于控制器内部的 respawnY 逻辑）
    if (playerPosition.y < RESPAWN_Y) {
      playerPosition.copy(respawnPosition);
      velocity.set(0, 0, 0);
      grounded = false;
      landingAnimationLockMs = 0;
    }

    // ── 存档点检测：站在 isCheckpoint 平台上时更新重生点 ──────────────────────
    if (grounded) {
      const feetY = playerPosition.y - PLAYER_RADIUS;
      for (const cp of checkpointPlatforms) {
        if (
          Math.abs(feetY - cp.top) < 0.18 &&
          playerPosition.x >= cp.minX - 0.1 &&
          playerPosition.x <= cp.maxX + 0.1 &&
          playerPosition.z >= cp.minZ - 0.1 &&
          playerPosition.z <= cp.maxZ + 0.1
        ) {
          if (respawnPosition.y < cp.spawnY) {
            respawnPosition.set(playerPosition.x, cp.spawnY, playerPosition.z);
          }
          // ── 首次触达：触发闪烁，更新材质到激活态 ──────────────────────────
          if (!activatedCheckpoints.has(cp.id)) {
            activatedCheckpoints.add(cp.id);
            const mat = checkpointMaterialMap.get(cp.id);
            if (mat) {
              mat.emissiveIntensity = CHECKPOINT_FLASH_PEAK;
              checkpointFlashQueue.set(cp.id, { intensity: CHECKPOINT_FLASH_PEAK });
            }
            // 存档点激活粒子：从平台顶面中央爆发
            emitCheckpointParticles((cp.minX + cp.maxX) / 2, cp.top + 0.2, (cp.minZ + cp.maxZ) / 2);
            audio.playCheckpoint();
          }
          break;
        }
      }
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
      for (const update of dynamicObstacleUpdaters) update(stepElapsed);
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

    // ── 存档点闪烁动画：每帧 damp 降回激活态常亮强度 ──────────────────────────
    for (const [id, flash] of checkpointFlashQueue) {
      const mat = checkpointMaterialMap.get(id);
      if (!mat) {
        checkpointFlashQueue.delete(id);
        continue;
      }
      flash.intensity = MathUtils.damp(flash.intensity, CHECKPOINT_ACTIVATED_INTENSITY, 3.5, delta);
      mat.emissiveIntensity = flash.intensity;
      if (Math.abs(flash.intensity - CHECKPOINT_ACTIVATED_INTENSITY) < 0.005) {
        mat.emissiveIntensity = CHECKPOINT_ACTIVATED_INTENSITY;
        checkpointFlashQueue.delete(id);
      }
    }

    // ── 弹跳板压缩-弹出动画 ──────────────────────────────────────────────────
    for (const [, bp] of bouncyPlatforms) {
      if (bp.squishTimer > 0) {
        bp.squishTimer = Math.max(0, bp.squishTimer - delta * 1000);
        const t = bp.squishTimer / bp.squishDuration; // 1→0
        // 前半程压缩（scaleY 0.45），后半程弹回（scaleY 1.0）
        const squishY =
          t > 0.5
            ? MathUtils.lerp(0.45, 1.0, 1 - (t - 0.5) * 2) // 弹回
            : MathUtils.lerp(1.0, 0.45, 1 - t * 2); // 压缩
        bp.mesh.scale.set(1, squishY, 1);
      } else {
        // 恢复原始比例（height 在 scale 中体现）
        const origHeight = bp.mesh.scale.y;
        if (Math.abs(origHeight - 1) > 0.01) {
          bp.mesh.scale.y = MathUtils.damp(origHeight, 1, 18, delta);
        }
      }
    }

    // ── 粒子更新（位置积分 + 透明度淡出）───────────────────────────────────
    particles.update(delta);

    // ── 不稳定平台状态机（每帧运行，timer 单位 ms）──────────────────────────
    {
      const deltaMs = delta * 1000;
      const feetY = playerPosition.y - PLAYER_RADIUS;
      for (const [, up] of unstablePlatforms) {
        if (up.state === 'idle') {
          // 检测玩家是否站在本平台上
          const playerOnThis =
            grounded &&
            Math.abs(feetY - up.top) < 0.25 &&
            playerPosition.x >= up.minX - 0.12 &&
            playerPosition.x <= up.maxX + 0.12 &&
            playerPosition.z >= up.minZ - 0.12 &&
            playerPosition.z <= up.maxZ + 0.12;
          if (playerOnThis) {
            up.state = 'shaking';
            up.timer = up.shakeDelay;
          }
        } else if (up.state === 'shaking') {
          up.timer -= deltaMs;
          // 晃动幅度随剩余时间逐渐增大（timer 从 shakeDelay→0）
          const progress = 1 - Math.max(0, up.timer) / up.shakeDelay;
          const shakeAmp = progress * 0.22;
          up.mesh.rotation.z = Math.sin(timestamp * 0.03) * shakeAmp;
          if (up.timer <= 0) {
            up.mesh.rotation.z = 0;
            up.state = 'falling';
            audio.playUnstableFall();
          }
        } else if (up.state === 'falling') {
          up.mesh.position.y -= up.fallSpeed * delta;
          // 落到原始 Y - 10m 后进入重置阶段
          if (up.mesh.position.y < up.originY - 10) {
            up.state = 'resetting';
            up.timer = up.resetDelay;
            up.mesh.visible = false;
          }
        } else if (up.state === 'resetting') {
          up.timer -= deltaMs;
          if (up.timer <= 0) {
            // 复原：恢复位置、可见性、top，重置为 idle
            up.mesh.position.y = up.originY;
            up.mesh.rotation.z = 0;
            up.mesh.visible = true;
            up.top = up.originY + up.mesh.scale.y / 2;
            up.state = 'idle';
            syncAxisAlignedColliderWithObjectBounds(up.collider, up.mesh);
          }
        }
      }
    }

    renderer.render(scene, camera);
    reportStats(timestamp);
    updateDebugOverlay();
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
    setDebugPlayerStateVisible: (visible: boolean) => {
      debugPlayerStateVisibleInternal = visible;
      debugOverlay.style.display = visible ? 'block' : 'none';
      if (!visible) debugOverlay.textContent = '';
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
      if (debugOverlay.parentElement === mount) {
        mount.removeChild(debugOverlay);
      }

      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }

      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }

      platformGeometry.dispose();
      bumpGeometry.dispose();
      for (const m of platformMaterials) m.dispose();
      for (const g of boundaryWallGeometries) g.dispose();
      for (const m of boundaryWallMaterials) m.dispose();
      setPieceRuntime.dispose();

      goalPulse.geometry.dispose();
      goalPulseMaterial.dispose();
      goalBurst.geometry.dispose();
      goalBurstMaterial.dispose();
      particles.dispose();

      for (const g of sceneryGeometries) g.dispose();
      for (const m of sceneryMaterials) m.dispose();
      clearColliderDebugMeshes();
      scene.remove(colliderDebugGroup);
      clearJumpClearanceDebugMeshes();
      scene.remove(jumpClearanceDebugGroup);
      scene.remove(playerAxisLabelGroup);
      for (const t of playerAxisLabelTextures) t.dispose();
      for (const m of playerAxisLabelMaterials) m.dispose();

      characterRig.dispose();
      audio.dispose();
      renderer.dispose();
    },
  };
}
