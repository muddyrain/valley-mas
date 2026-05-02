import { Quaternion, Vector3, type Vector3 as Vector3Type } from 'three';

export type PlatformColliderShape = 'box' | 'ramp' | 'cylinder';

interface ColliderPlane {
  nx: number;
  ny: number;
  nz: number;
  constant: number;
}

export interface PlatformCollisionDebugMeta {
  category: 'platform' | 'setpiece' | 'system';
  assetId?: string;
  instanceId?: string;
}

export interface PlatformCollisionData {
  shape: PlatformColliderShape;
  center: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number, number];
  inverseRotation: [number, number, number, number];
  top: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  planes: ColliderPlane[];
  debugMeta?: PlatformCollisionDebugMeta;
  /** 设为 true 时该碰撞体被跳过（用于 blink/crumble 等隐藏平台） */
  disabled?: boolean;
}

const WORLD_POINT = new Vector3();
const LOCAL_POINT = new Vector3();
const LOCAL_NORMAL = new Vector3();
const WORLD_NORMAL = new Vector3();
const ROTATION = new Quaternion();
const INVERSE_ROTATION = new Quaternion();
const CORRECTION = new Vector3();
const LOCAL_X = new Vector3(1, 0, 0);
const LOCAL_Y = new Vector3(0, 1, 0);
const LOCAL_Z = new Vector3(0, 0, 1);
const STEP_ASSIST_MAX_HEIGHT = 0.62;
const STEP_ASSIST_MIN_HEIGHT = 0.03;
const RAMP_TOP_FLAT_RATIO = 0.36;
const CYLINDER_BOUNDS_SEGMENTS = 16;

function safeSize(value: number): number {
  return Math.max(0.001, Math.abs(value));
}

function buildBoxPlanes(halfX: number, halfY: number, halfZ: number): ColliderPlane[] {
  return [
    { nx: 1, ny: 0, nz: 0, constant: -halfX },
    { nx: -1, ny: 0, nz: 0, constant: -halfX },
    { nx: 0, ny: 1, nz: 0, constant: -halfY },
    { nx: 0, ny: -1, nz: 0, constant: -halfY },
    { nx: 0, ny: 0, nz: 1, constant: -halfZ },
    { nx: 0, ny: 0, nz: -1, constant: -halfZ },
  ];
}

function buildRampPlanes(halfX: number, halfY: number, halfZ: number): ColliderPlane[] {
  const fullDepth = Math.max(halfZ * 2, 0.001);
  const topFlatDepth = Math.max(0.001, Math.min(fullDepth * 0.7, fullDepth * RAMP_TOP_FLAT_RATIO));
  const topFlatEndZ = -halfZ + topFlatDepth;
  const slopeRun = Math.max(0.001, halfZ - topFlatEndZ);
  const slopeNz = (halfY * 2) / slopeRun;
  LOCAL_NORMAL.set(0, 1, slopeNz).normalize();
  const slopeConstant = -(LOCAL_NORMAL.y * halfY + LOCAL_NORMAL.z * topFlatEndZ);
  return [
    { nx: -1, ny: 0, nz: 0, constant: -halfX },
    { nx: 1, ny: 0, nz: 0, constant: -halfX },
    { nx: 0, ny: 0, nz: -1, constant: -halfZ },
    { nx: 0, ny: 0, nz: 1, constant: -halfZ },
    { nx: 0, ny: -1, nz: 0, constant: -halfY },
    { nx: 0, ny: 1, nz: 0, constant: -halfY },
    { nx: LOCAL_NORMAL.x, ny: LOCAL_NORMAL.y, nz: LOCAL_NORMAL.z, constant: slopeConstant },
  ];
}

function computeWorldBounds(params: {
  shape: PlatformColliderShape;
  center: [number, number, number];
  rotation: [number, number, number, number];
  halfX: number;
  halfY: number;
  halfZ: number;
}): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  const { shape, center, rotation, halfX, halfY, halfZ } = params;
  ROTATION.set(rotation[0], rotation[1], rotation[2], rotation[3]);

  const vertices: Vector3[] = [];
  if (shape === 'ramp') {
    const fullDepth = Math.max(halfZ * 2, 0.001);
    const topFlatDepth = Math.max(
      0.001,
      Math.min(fullDepth * 0.7, fullDepth * RAMP_TOP_FLAT_RATIO),
    );
    const topFlatEndZ = -halfZ + topFlatDepth;
    vertices.push(
      new Vector3(-halfX, -halfY, -halfZ),
      new Vector3(-halfX, -halfY, halfZ),
      new Vector3(halfX, -halfY, -halfZ),
      new Vector3(halfX, -halfY, halfZ),
      new Vector3(-halfX, halfY, -halfZ),
      new Vector3(halfX, halfY, -halfZ),
      new Vector3(-halfX, halfY, topFlatEndZ),
      new Vector3(halfX, halfY, topFlatEndZ),
    );
  } else if (shape === 'cylinder') {
    for (let segment = 0; segment < CYLINDER_BOUNDS_SEGMENTS; segment += 1) {
      const angle = (Math.PI * 2 * segment) / CYLINDER_BOUNDS_SEGMENTS;
      const x = Math.cos(angle) * halfX;
      const z = Math.sin(angle) * halfZ;
      vertices.push(new Vector3(x, -halfY, z), new Vector3(x, halfY, z));
    }
  } else {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          vertices.push(new Vector3(halfX * sx, halfY * sy, halfZ * sz));
        }
      }
    }
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  vertices.forEach((vertex) => {
    vertex.applyQuaternion(ROTATION);
    vertex.x += center[0];
    vertex.y += center[1];
    vertex.z += center[2];
    if (vertex.x < minX) minX = vertex.x;
    if (vertex.y < minY) minY = vertex.y;
    if (vertex.z < minZ) minZ = vertex.z;
    if (vertex.x > maxX) maxX = vertex.x;
    if (vertex.y > maxY) maxY = vertex.y;
    if (vertex.z > maxZ) maxZ = vertex.z;
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
  };
}

function pointInsideExpandedCollider(
  collider: PlatformCollisionData,
  localPoint: Vector3,
  radius: number,
): { collided: boolean; maxSignedDistance: number; normal: Vector3 } {
  let maxSignedDistance = Number.NEGATIVE_INFINITY;
  let bestNormalX = 0;
  let bestNormalY = 1;
  let bestNormalZ = 0;

  for (const plane of collider.planes) {
    const signedDistance =
      plane.nx * localPoint.x + plane.ny * localPoint.y + plane.nz * localPoint.z + plane.constant;
    if (signedDistance > radius) {
      return {
        collided: false,
        maxSignedDistance: signedDistance,
        normal: LOCAL_NORMAL.set(0, 1, 0),
      };
    }
    if (signedDistance > maxSignedDistance) {
      maxSignedDistance = signedDistance;
      bestNormalX = plane.nx;
      bestNormalY = plane.ny;
      bestNormalZ = plane.nz;
    }
  }

  return {
    collided: true,
    maxSignedDistance,
    normal: LOCAL_NORMAL.set(bestNormalX, bestNormalY, bestNormalZ),
  };
}

function isLocalPointInsideCylinderFootprint(params: {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  padding?: number;
}): boolean {
  const { x, z, halfX, halfZ, padding = 0 } = params;
  const radiusX = Math.max(0.001, halfX + padding);
  const radiusZ = Math.max(0.001, halfZ + padding);
  return (x * x) / (radiusX * radiusX) + (z * z) / (radiusZ * radiusZ) <= 1;
}

function resolveCylinderOverlap(
  collider: PlatformCollisionData,
  localPoint: Vector3,
  radius: number,
): { collided: boolean; localCorrection: Vector3; localNormal: Vector3 } {
  const halfX = collider.size[0] * 0.5;
  const halfY = collider.size[1] * 0.5;
  const halfZ = collider.size[2] * 0.5;
  const expandedX = Math.max(0.001, halfX + radius);
  const expandedY = halfY + radius;
  const expandedZ = Math.max(0.001, halfZ + radius);
  const yAbs = Math.abs(localPoint.y);
  const radial =
    (localPoint.x * localPoint.x) / (expandedX * expandedX) +
    (localPoint.z * localPoint.z) / (expandedZ * expandedZ);

  if (yAbs > expandedY || radial > 1) {
    return {
      collided: false,
      localCorrection: CORRECTION.set(0, 0, 0),
      localNormal: LOCAL_NORMAL.set(0, 1, 0),
    };
  }

  const topPenetration = expandedY - localPoint.y;
  const bottomPenetration = expandedY + localPoint.y;
  const radialDistance = Math.sqrt(Math.max(0, radial));
  const radialPenetration = (1 - radialDistance) * Math.min(expandedX, expandedZ);
  const epsilon = 0.001;

  if (topPenetration <= bottomPenetration && topPenetration <= radialPenetration) {
    return {
      collided: true,
      localCorrection: CORRECTION.set(0, topPenetration + epsilon, 0),
      localNormal: LOCAL_NORMAL.set(0, 1, 0),
    };
  }

  if (bottomPenetration <= radialPenetration) {
    return {
      collided: true,
      localCorrection: CORRECTION.set(0, -(bottomPenetration + epsilon), 0),
      localNormal: LOCAL_NORMAL.set(0, -1, 0),
    };
  }

  LOCAL_NORMAL.set(
    localPoint.x / (expandedX * expandedX),
    0,
    localPoint.z / (expandedZ * expandedZ),
  );
  if (LOCAL_NORMAL.lengthSq() < 0.000001) {
    LOCAL_NORMAL.set(1, 0, 0);
  } else {
    LOCAL_NORMAL.normalize();
  }

  return {
    collided: true,
    localCorrection: CORRECTION.copy(LOCAL_NORMAL).multiplyScalar(radialPenetration + epsilon),
    localNormal: LOCAL_NORMAL,
  };
}

function solveLandingHeightOnFace(params: {
  collider: PlatformCollisionData;
  plane: ColliderPlane;
  playerX: number;
  playerZ: number;
}): number | null {
  const { collider, plane, playerX, playerZ } = params;
  ROTATION.set(
    collider.rotation[0],
    collider.rotation[1],
    collider.rotation[2],
    collider.rotation[3],
  );
  WORLD_NORMAL.set(plane.nx, plane.ny, plane.nz).applyQuaternion(ROTATION);
  const denominator = WORLD_NORMAL.y;
  if (Math.abs(denominator) < 0.0001) return null;

  const dx = playerX - collider.center[0];
  const dz = playerZ - collider.center[2];
  const numerator = plane.constant + WORLD_NORMAL.x * dx + WORLD_NORMAL.z * dz;
  const worldY = collider.center[1] - numerator / denominator;

  WORLD_POINT.set(
    playerX - collider.center[0],
    worldY - collider.center[1],
    playerZ - collider.center[2],
  );
  INVERSE_ROTATION.set(
    collider.inverseRotation[0],
    collider.inverseRotation[1],
    collider.inverseRotation[2],
    collider.inverseRotation[3],
  );
  WORLD_POINT.applyQuaternion(INVERSE_ROTATION);

  for (const face of collider.planes) {
    const tolerance = face === plane ? 0.04 : 0.08;
    const signedDistance =
      face.nx * WORLD_POINT.x + face.ny * WORLD_POINT.y + face.nz * WORLD_POINT.z + face.constant;
    if (signedDistance > tolerance) {
      return null;
    }
  }

  return worldY;
}

function findHighestWalkableSurfaceAt(
  collider: PlatformCollisionData,
  worldX: number,
  worldZ: number,
): number | null {
  if (collider.shape === 'cylinder') {
    INVERSE_ROTATION.set(
      collider.inverseRotation[0],
      collider.inverseRotation[1],
      collider.inverseRotation[2],
      collider.inverseRotation[3],
    );
    LOCAL_POINT.set(worldX - collider.center[0], 0, worldZ - collider.center[2]).applyQuaternion(
      INVERSE_ROTATION,
    );
    if (
      !isLocalPointInsideCylinderFootprint({
        x: LOCAL_POINT.x,
        z: LOCAL_POINT.z,
        halfX: collider.size[0] * 0.5,
        halfZ: collider.size[2] * 0.5,
      })
    ) {
      return null;
    }
    return collider.maxY;
  }

  let topY = Number.NEGATIVE_INFINITY;
  ROTATION.set(
    collider.rotation[0],
    collider.rotation[1],
    collider.rotation[2],
    collider.rotation[3],
  );

  for (const plane of collider.planes) {
    WORLD_NORMAL.set(plane.nx, plane.ny, plane.nz).applyQuaternion(ROTATION);
    if (WORLD_NORMAL.y < 0.55) continue;
    const candidate = solveLandingHeightOnFace({
      collider,
      plane,
      playerX: worldX,
      playerZ: worldZ,
    });
    if (candidate == null) continue;
    if (candidate > topY) {
      topY = candidate;
    }
  }

  return Number.isFinite(topY) ? topY : null;
}

function isSphereIntersectingCollider(
  collider: PlatformCollisionData,
  centerX: number,
  centerY: number,
  centerZ: number,
  radius: number,
): boolean {
  if (
    centerX <= collider.minX - radius ||
    centerX >= collider.maxX + radius ||
    centerY <= collider.minY - radius ||
    centerY >= collider.maxY + radius ||
    centerZ <= collider.minZ - radius ||
    centerZ >= collider.maxZ + radius
  ) {
    return false;
  }

  INVERSE_ROTATION.set(
    collider.inverseRotation[0],
    collider.inverseRotation[1],
    collider.inverseRotation[2],
    collider.inverseRotation[3],
  );
  LOCAL_POINT.set(
    centerX - collider.center[0],
    centerY - collider.center[1],
    centerZ - collider.center[2],
  ).applyQuaternion(INVERSE_ROTATION);

  if (collider.shape === 'cylinder') {
    return resolveCylinderOverlap(collider, LOCAL_POINT, radius).collided;
  }

  return pointInsideExpandedCollider(collider, LOCAL_POINT, radius).collided;
}

function hasBlockingCollision(params: {
  colliders: PlatformCollisionData[];
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
}): boolean {
  const { colliders, centerX, centerY, centerZ, radius } = params;
  for (const collider of colliders) {
    if (isSphereIntersectingCollider(collider, centerX, centerY, centerZ, radius)) {
      return true;
    }
  }
  return false;
}

export function appendBoxCollider(
  colliders: PlatformCollisionData[],
  params: {
    center: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number, number];
    shape?: PlatformColliderShape;
    debugMeta?: PlatformCollisionDebugMeta;
  },
): PlatformCollisionData {
  const collider = createColliderData(params);
  colliders.push(collider);
  return collider;
}

function createColliderData(params: {
  center: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number, number];
  shape?: PlatformColliderShape;
  debugMeta?: PlatformCollisionDebugMeta;
}): PlatformCollisionData {
  const size: [number, number, number] = [
    safeSize(params.size[0]),
    safeSize(params.size[1]),
    safeSize(params.size[2]),
  ];
  const shape = params.shape ?? 'box';
  const rotation: [number, number, number, number] = params.rotation ?? [0, 0, 0, 1];
  const inverseRotation: [number, number, number, number] = [
    -rotation[0],
    -rotation[1],
    -rotation[2],
    rotation[3],
  ];
  const halfX = size[0] / 2;
  const halfY = size[1] / 2;
  const halfZ = size[2] / 2;
  const planes =
    shape === 'ramp' ? buildRampPlanes(halfX, halfY, halfZ) : buildBoxPlanes(halfX, halfY, halfZ);
  const bounds = computeWorldBounds({
    shape,
    center: params.center,
    rotation,
    halfX,
    halfY,
    halfZ,
  });

  return {
    shape,
    center: [params.center[0], params.center[1], params.center[2]],
    size,
    rotation,
    inverseRotation,
    top: bounds.maxY,
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY,
    minZ: bounds.minZ,
    maxZ: bounds.maxZ,
    planes,
    debugMeta: params.debugMeta,
  };
}

export function syncColliderData(
  collider: PlatformCollisionData,
  params: {
    center: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number, number];
    shape?: PlatformColliderShape;
  },
): void {
  const next = createColliderData({
    ...params,
    debugMeta: collider.debugMeta,
  });
  collider.shape = next.shape;
  collider.center = next.center;
  collider.size = next.size;
  collider.rotation = next.rotation;
  collider.inverseRotation = next.inverseRotation;
  collider.top = next.top;
  collider.minX = next.minX;
  collider.maxX = next.maxX;
  collider.minY = next.minY;
  collider.maxY = next.maxY;
  collider.minZ = next.minZ;
  collider.maxZ = next.maxZ;
  collider.planes = next.planes;
}

export function tryLandOnTop(params: {
  colliders: PlatformCollisionData[];
  playerPosition: Vector3Type;
  velocity: Vector3Type;
  playerRadius: number;
  landingAssist: number;
  previousBottom: number;
  stickDistance?: number;
}): boolean {
  const {
    colliders,
    playerPosition,
    velocity,
    playerRadius,
    landingAssist,
    previousBottom,
    stickDistance = 0,
  } = params;
  if (velocity.y > 0) {
    return false;
  }

  let candidateTop = Number.NEGATIVE_INFINITY;

  for (const collider of colliders) {
    if (collider.disabled) continue;
    if (
      playerPosition.x < collider.minX - landingAssist ||
      playerPosition.x > collider.maxX + landingAssist ||
      playerPosition.z < collider.minZ - landingAssist ||
      playerPosition.z > collider.maxZ + landingAssist
    ) {
      continue;
    }

    const topY = findHighestWalkableSurfaceAt(collider, playerPosition.x, playerPosition.z);
    if (topY == null) continue;
    const nextBottom = playerPosition.y - playerRadius;
    const canLand = previousBottom >= topY - 0.12 && nextBottom <= topY + 0.14;
    const canStick =
      stickDistance > 0 &&
      previousBottom >= topY - 0.28 &&
      nextBottom >= topY - stickDistance &&
      nextBottom <= topY + stickDistance;
    if (!canLand && !canStick) continue;

    if (topY > candidateTop) {
      candidateTop = topY;
    }
  }

  if (!Number.isFinite(candidateTop)) {
    return false;
  }

  playerPosition.y = candidateTop + playerRadius;
  velocity.y = 0;
  return true;
}

export function solveSolidCollisions(params: {
  colliders: PlatformCollisionData[];
  playerPosition: Vector3Type;
  velocity: Vector3Type;
  playerRadius: number;
  initiallyLanded: boolean;
  allowStepAssist?: boolean;
}): boolean {
  const {
    colliders,
    playerPosition,
    velocity,
    playerRadius,
    initiallyLanded,
    allowStepAssist = false,
  } = params;
  let landed = initiallyLanded;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    let corrected = false;

    for (const collider of colliders) {
      if (collider.disabled) continue;
      if (
        playerPosition.x <= collider.minX - playerRadius ||
        playerPosition.x >= collider.maxX + playerRadius ||
        playerPosition.y <= collider.minY - playerRadius ||
        playerPosition.y >= collider.maxY + playerRadius ||
        playerPosition.z <= collider.minZ - playerRadius ||
        playerPosition.z >= collider.maxZ + playerRadius
      ) {
        continue;
      }

      INVERSE_ROTATION.set(
        collider.inverseRotation[0],
        collider.inverseRotation[1],
        collider.inverseRotation[2],
        collider.inverseRotation[3],
      );
      LOCAL_POINT.set(
        playerPosition.x - collider.center[0],
        playerPosition.y - collider.center[1],
        playerPosition.z - collider.center[2],
      ).applyQuaternion(INVERSE_ROTATION);

      if (collider.shape === 'cylinder') {
        const overlap = resolveCylinderOverlap(collider, LOCAL_POINT, playerRadius);
        if (!overlap.collided) {
          continue;
        }

        ROTATION.set(
          collider.rotation[0],
          collider.rotation[1],
          collider.rotation[2],
          collider.rotation[3],
        );
        CORRECTION.copy(overlap.localCorrection).applyQuaternion(ROTATION);
        playerPosition.add(CORRECTION);
        WORLD_NORMAL.copy(overlap.localNormal).applyQuaternion(ROTATION).normalize();

        const normalDotVelocity =
          velocity.x * WORLD_NORMAL.x + velocity.y * WORLD_NORMAL.y + velocity.z * WORLD_NORMAL.z;
        if (normalDotVelocity < 0) {
          velocity.x -= WORLD_NORMAL.x * normalDotVelocity;
          velocity.y -= WORLD_NORMAL.y * normalDotVelocity;
          velocity.z -= WORLD_NORMAL.z * normalDotVelocity;
        }

        if (WORLD_NORMAL.y > 0.45 && velocity.y <= 0.25) {
          landed = true;
          velocity.y = Math.max(velocity.y, 0);
        }
        corrected = true;
        continue;
      }

      const overlap = pointInsideExpandedCollider(collider, LOCAL_POINT, playerRadius);
      if (!overlap.collided) {
        continue;
      }

      const overlapNormalX = overlap.normal.x;
      const overlapNormalY = overlap.normal.y;
      const overlapNormalZ = overlap.normal.z;
      ROTATION.set(
        collider.rotation[0],
        collider.rotation[1],
        collider.rotation[2],
        collider.rotation[3],
      );
      WORLD_NORMAL.set(overlapNormalX, overlapNormalY, overlapNormalZ)
        .applyQuaternion(ROTATION)
        .normalize();

      if (
        allowStepAssist &&
        landed &&
        WORLD_NORMAL.y > -0.2 &&
        WORLD_NORMAL.y < 0.45 &&
        velocity.y <= 1.2
      ) {
        const surfaceY = findHighestWalkableSurfaceAt(collider, playerPosition.x, playerPosition.z);
        if (surfaceY != null) {
          const currentBottom = playerPosition.y - playerRadius;
          const stepDelta = surfaceY - currentBottom;
          if (stepDelta >= STEP_ASSIST_MIN_HEIGHT && stepDelta <= STEP_ASSIST_MAX_HEIGHT) {
            const steppedY = playerPosition.y + stepDelta + 0.001;
            if (
              !hasBlockingCollision({
                colliders,
                centerX: playerPosition.x,
                centerY: steppedY,
                centerZ: playerPosition.z,
                radius: playerRadius,
              })
            ) {
              playerPosition.y = steppedY;
              velocity.y = Math.max(0, velocity.y);
              landed = true;
              corrected = true;
              continue;
            }
          }
        }
      }

      const epsilon = 0.001;
      const correctionDistance = playerRadius - overlap.maxSignedDistance + epsilon;
      CORRECTION.set(overlapNormalX, overlapNormalY, overlapNormalZ).multiplyScalar(
        correctionDistance,
      );
      CORRECTION.applyQuaternion(ROTATION);
      playerPosition.add(CORRECTION);

      const normalDotVelocity =
        velocity.x * WORLD_NORMAL.x + velocity.y * WORLD_NORMAL.y + velocity.z * WORLD_NORMAL.z;
      if (normalDotVelocity < 0) {
        velocity.x -= WORLD_NORMAL.x * normalDotVelocity;
        velocity.y -= WORLD_NORMAL.y * normalDotVelocity;
        velocity.z -= WORLD_NORMAL.z * normalDotVelocity;
      }

      if (WORLD_NORMAL.y > 0.45 && velocity.y <= 0.25) {
        landed = true;
        velocity.y = Math.max(velocity.y, 0);
      }
      corrected = true;
    }

    if (!corrected) break;
  }

  return landed;
}

export function getColliderUpAxis(collider: PlatformCollisionData): Vector3 {
  ROTATION.set(
    collider.rotation[0],
    collider.rotation[1],
    collider.rotation[2],
    collider.rotation[3],
  );
  return LOCAL_Y.clone().applyQuaternion(ROTATION);
}

export function getColliderForwardAxis(collider: PlatformCollisionData): Vector3 {
  ROTATION.set(
    collider.rotation[0],
    collider.rotation[1],
    collider.rotation[2],
    collider.rotation[3],
  );
  return LOCAL_X.clone().applyQuaternion(ROTATION);
}

export function getColliderRightAxis(collider: PlatformCollisionData): Vector3 {
  ROTATION.set(
    collider.rotation[0],
    collider.rotation[1],
    collider.rotation[2],
    collider.rotation[3],
  );
  return LOCAL_Z.clone().applyQuaternion(ROTATION);
}
