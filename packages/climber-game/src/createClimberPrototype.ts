import {
  AmbientLight,
  BoxGeometry,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  type Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createCharacterRig } from './characterRig';
import { createPrototypeAudio } from './prototypeAudio';
import type {
  ClimberCharacterAnimationState,
  ClimberCharacterId,
  ClimberCharacterRuntimeStatus,
  ClimberLevelDefinition,
  ClimberPrototypeController,
  ClimberRunStats,
} from './types';

interface CreateClimberPrototypeOptions {
  mount: HTMLElement;
  level: ClimberLevelDefinition;
  characterId: ClimberCharacterId;
  audioEnabled: boolean;
  onStats: (stats: ClimberRunStats) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onCharacterStatusChange?: (status: ClimberCharacterRuntimeStatus) => void;
}

interface PlatformCollisionData {
  top: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 5.4;
const SPRINT_SPEED = 8.2;
const JUMP_SPEED = 8.2;
const GRAVITY = 21;
const RESPAWN_Y = -20;
const LANDING_ASSIST = PLAYER_RADIUS * 0.95;
const DEFAULT_CAMERA_OFFSET = new Vector3(0, 4.8, 9.4);
const FLOOR_COLLIDER_SIZE = 220;
const FLOOR_COLLIDER_HEIGHT = 1;
const BOUNDARY_HALF_RANGE = 70;
const BOUNDARY_WALL_HEIGHT = 16;
const BOUNDARY_WALL_THICKNESS = 2;
const GOAL_REACH_Y_TOLERANCE = 0.18;
const GOAL_REACH_XZ_MARGIN = 0.16;
const GOAL_CELEBRATION_DURATION = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toVector3(value: [number, number, number]): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
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
    onPointerLockChange,
    onCharacterStatusChange,
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
  renderer.domElement.style.touchAction = 'none';
  mount.appendChild(renderer.domElement);

  const camera = new PerspectiveCamera(50, 1, 0.1, 260);
  camera.position.copy(startPosition).add(cameraOffset);

  const ambient = new AmbientLight('#ffffff', 0.68);
  const hemi = new HemisphereLight('#ffffff', '#dbeafe', 0.4);
  const mainLight = new DirectionalLight(sunColor, 1.15);
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
    new PlaneGeometry(220, 220),
    new MeshStandardMaterial({ color: floorColor, roughness: 0.9, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new GridHelper(160, 80, gridPrimaryColor, gridSecondaryColor);
  grid.position.y = -0.49;
  scene.add(grid);

  const platformColliders: PlatformCollisionData[] = [];
  const platformMaterials: MeshStandardMaterial[] = [];
  const boundaryWallMaterials: MeshStandardMaterial[] = [];
  const boundaryWallGeometries: BoxGeometry[] = [];
  const platformGeometry = new BoxGeometry(1, 1, 1);

  const appendBoxCollider = (params: {
    center: [number, number, number];
    size: [number, number, number];
  }) => {
    const [cx, cy, cz] = params.center;
    const [width, height, depth] = params.size;
    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;

    platformColliders.push({
      top: cy + halfH,
      minX: cx - halfW,
      maxX: cx + halfW,
      minY: cy - halfH,
      maxY: cy + halfH,
      minZ: cz - halfD,
      maxZ: cz + halfD,
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
    appendBoxCollider({
      center: [x, y, z],
      size: [width, height, depth],
    });
  });

  appendBoxCollider({
    center: [0, -1, 0],
    size: [FLOOR_COLLIDER_SIZE, FLOOR_COLLIDER_HEIGHT, FLOOR_COLLIDER_SIZE],
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
    appendBoxCollider(wallConfig);
  });

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
  scene.add(characterRig.group);

  const audio = createPrototypeAudio(audioEnabled);

  const keyState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jumpQueued: false,
  };

  const playerPosition = startPosition.clone();
  const velocity = new Vector3(0, 0, 0);
  const cameraTarget = startPosition.clone();
  const goalTarget = goalPulse.position.clone();
  const tempFollowOffset = new Vector3();
  const tempDesiredCameraPosition = new Vector3();

  let grounded = false;
  let previousGrounded = false;
  let bestHeight = startPosition.y;
  let goalReached = false;
  let goalReachedAtMs: number | null = null;
  let goalCelebrationTimer = 0;
  let rafId = 0;
  let disposed = false;
  let lastStatsAt = 0;
  const clock = new Clock();
  const progressDenominator = Math.max(0.001, maxPlatformTop - startPosition.y);

  const cameraBaseDistance = cameraOffset.length();
  let cameraYaw = Math.atan2(cameraOffset.x, cameraOffset.z);
  let cameraPitch = Math.asin(clamp(cameraOffset.y / cameraBaseDistance, -0.98, 0.98));
  let cameraZoomOffset = 0;
  let pointerLocked = false;

  const updateSize = () => {
    const width = Math.max(mount.clientWidth, 1);
    const height = Math.max(mount.clientHeight, 1);
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
  };

  function resetPlayer() {
    playerPosition.copy(startPosition);
    velocity.set(0, 0, 0);
    camera.position.copy(startPosition).add(cameraOffset);
    cameraTarget.copy(playerPosition);
    grounded = false;
    previousGrounded = false;
    bestHeight = startPosition.y;
    goalReached = false;
    goalReachedAtMs = null;
    goalCelebrationTimer = 0;
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

  function tryLandOnTop(previousBottom: number): boolean {
    let landed = false;
    for (const platform of platformColliders) {
      const withinX =
        playerPosition.x >= platform.minX - LANDING_ASSIST &&
        playerPosition.x <= platform.maxX + LANDING_ASSIST;
      if (!withinX) continue;

      const withinZ =
        playerPosition.z >= platform.minZ - LANDING_ASSIST &&
        playerPosition.z <= platform.maxZ + LANDING_ASSIST;
      if (!withinZ) continue;

      const nextBottom = playerPosition.y - PLAYER_RADIUS;
      const canLand = previousBottom >= platform.top - 0.03 && nextBottom <= platform.top + 0.09;
      if (!canLand || velocity.y > 0) continue;

      playerPosition.y = platform.top + PLAYER_RADIUS;
      velocity.y = 0;
      landed = true;
      break;
    }
    return landed;
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

  function solveSolidCollisions(initiallyLanded: boolean): boolean {
    let landed = initiallyLanded;

    for (let iteration = 0; iteration < 3; iteration += 1) {
      let corrected = false;
      for (const platform of platformColliders) {
        const expandedMinX = platform.minX - PLAYER_RADIUS;
        const expandedMaxX = platform.maxX + PLAYER_RADIUS;
        const expandedMinY = platform.minY - PLAYER_RADIUS;
        const expandedMaxY = platform.maxY + PLAYER_RADIUS;
        const expandedMinZ = platform.minZ - PLAYER_RADIUS;
        const expandedMaxZ = platform.maxZ + PLAYER_RADIUS;

        if (
          playerPosition.x <= expandedMinX ||
          playerPosition.x >= expandedMaxX ||
          playerPosition.y <= expandedMinY ||
          playerPosition.y >= expandedMaxY ||
          playerPosition.z <= expandedMinZ ||
          playerPosition.z >= expandedMaxZ
        ) {
          continue;
        }

        const distToMinX = playerPosition.x - expandedMinX;
        const distToMaxX = expandedMaxX - playerPosition.x;
        const distToMinY = playerPosition.y - expandedMinY;
        const distToMaxY = expandedMaxY - playerPosition.y;
        const distToMinZ = playerPosition.z - expandedMinZ;
        const distToMaxZ = expandedMaxZ - playerPosition.z;

        let normalX = 0;
        let normalY = 0;
        let normalZ = 0;
        let correction = distToMinX;
        normalX = -1;

        if (distToMaxX < correction) {
          correction = distToMaxX;
          normalX = 1;
          normalY = 0;
          normalZ = 0;
        }
        if (distToMinY < correction) {
          correction = distToMinY;
          normalX = 0;
          normalY = -1;
          normalZ = 0;
        }
        if (distToMaxY < correction) {
          correction = distToMaxY;
          normalX = 0;
          normalY = 1;
          normalZ = 0;
        }
        if (distToMinZ < correction) {
          correction = distToMinZ;
          normalX = 0;
          normalY = 0;
          normalZ = -1;
        }
        if (distToMaxZ < correction) {
          correction = distToMaxZ;
          normalX = 0;
          normalY = 0;
          normalZ = 1;
        }

        const epsilon = 0.0008;
        playerPosition.x += normalX * (correction + epsilon);
        playerPosition.y += normalY * (correction + epsilon);
        playerPosition.z += normalZ * (correction + epsilon);

        const normalDotVelocity =
          velocity.x * normalX + velocity.y * normalY + velocity.z * normalZ;
        if (normalDotVelocity < 0) {
          velocity.x -= normalX * normalDotVelocity;
          velocity.y -= normalY * normalDotVelocity;
          velocity.z -= normalZ * normalDotVelocity;
        }

        if (normalY > 0.5 && velocity.y <= 0.2) {
          landed = true;
          velocity.y = Math.max(velocity.y, 0);
        }
        corrected = true;
      }
      if (!corrected) break;
    }

    return landed;
  }

  function updatePlayer(delta: number) {
    const speed = keyState.sprint ? SPRINT_SPEED : WALK_SPEED;
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
    velocity.y -= GRAVITY * delta;

    if (keyState.jumpQueued && grounded) {
      velocity.y = JUMP_SPEED;
      grounded = false;
      audio.playJump();
    }
    keyState.jumpQueued = false;

    const previousBottom = playerPosition.y - PLAYER_RADIUS;
    playerPosition.addScaledVector(velocity, delta);

    const topLanded = tryLandOnTop(previousBottom);
    grounded = solveSolidCollisions(topLanded);

    if (!previousGrounded && grounded) {
      audio.playLand();
    }

    if (playerPosition.y < RESPAWN_Y) {
      playerPosition.copy(startPosition);
      velocity.set(0, 0, 0);
      grounded = false;
      previousGrounded = false;
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
    if (!grounded) {
      return 'jump';
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
  }

  function updateCamera(delta: number) {
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

    updatePlayer(delta);
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
    previousGrounded = grounded;
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
    onPointerLockChange?.(nextLocked);
    if (!nextLocked) {
      clearInputState();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!pointerLocked) return;
    const mapped = keyMap[event.code];
    if (mapped) keyState[mapped] = true;
    if (event.code === 'Space') {
      keyState.jumpQueued = true;
      event.preventDefault();
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) keyState[mapped] = false;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!pointerLocked) return;
    cameraYaw -= event.movementX * 0.0028;
    cameraPitch = clamp(cameraPitch + event.movementY * 0.0024, -0.25, 1.2);
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
    requestPointerLock: () => {
      renderer.domElement.requestPointerLock();
    },
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
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

      goalPulse.geometry.dispose();
      goalPulseMaterial.dispose();
      goalBurst.geometry.dispose();
      goalBurstMaterial.dispose();

      grid.geometry.dispose();
      disposeMaterial(grid.material);

      characterRig.dispose();
      audio.dispose();
      renderer.dispose();
    },
  };
}
