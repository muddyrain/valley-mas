import {
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  type MeshStandardMaterial,
  Object3D,
} from 'three';
import type { QualityProfile } from '../core/quality';

interface DistantIslandSpec {
  x: number;
  z: number;
  y: number;
  radius: number;
  phase: number;
  rotation: number;
}

interface ShardSpec {
  islandIndex: number;
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface InstancedDistantIslands {
  root: Group;
  setQuality: (profile: Readonly<QualityProfile>) => void;
  update: (elapsed: number, motionScale: number) => void;
  getVisibleCount: () => number;
}

const BASE_SPECS = [
  [-10.8, -6.2, -4.55, 0.68, 1.8],
  [10.6, -8.6, -4.8, 0.72, 0.4],
  [-3.7, -11.2, -5.05, 0.58, 2.9],
  [11.2, -7.4, -5.25, 0.62, 4.2],
  [-12.2, 1.8, -5.4, 0.52, 5.3],
] as const;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function createInstances(
  name: string,
  geometry: ConstructorParameters<typeof InstancedMesh>[0],
  material: MeshStandardMaterial,
  count: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  return mesh;
}

export function createInstancedDistantIslands(
  groundMaterial: MeshStandardMaterial,
  rockMaterial: MeshStandardMaterial,
  snowMaterial: MeshStandardMaterial,
  foliageMaterial: MeshStandardMaterial,
  stoneMaterial: MeshStandardMaterial,
): InstancedDistantIslands {
  const root = new Group();
  root.name = 'instanced-distant-islands';
  const random = seededRandom(741923);
  const specs: DistantIslandSpec[] = BASE_SPECS.map(([x, z, y, radius, phase]) => ({
    x,
    z,
    y,
    radius,
    phase,
    rotation: random() * 0.3,
  }));
  const shards: ShardSpec[] = [];
  for (let islandIndex = 0; islandIndex < specs.length; islandIndex += 1) {
    const spec = specs[islandIndex];
    if (!spec) continue;
    const depth = 1.5 + spec.radius;
    for (let shardIndex = 0; shardIndex < 4; shardIndex += 1) {
      const angle = (shardIndex / 4) * Math.PI * 2 + random() * 0.5;
      shards.push({
        islandIndex,
        x: Math.cos(angle) * spec.radius * (0.45 + random() * 0.2),
        y: -depth * (0.34 + random() * 0.36),
        z: Math.sin(angle) * spec.radius * (0.45 + random() * 0.2),
        scaleX: spec.radius * 0.22 * (0.7 + random() * 0.5),
        scaleY: spec.radius * 0.22 * (0.6 + random() * 0.9),
        scaleZ: spec.radius * 0.22 * (0.72 + random() * 0.45),
        rotationX: random() * Math.PI,
        rotationY: random() * Math.PI,
        rotationZ: random() * Math.PI,
      });
    }
  }

  const rocks = createInstances(
    'distant-island-rocks',
    new CylinderGeometry(0.92, 0.12, 1, 12, 3),
    rockMaterial,
    specs.length,
  );
  const caps = createInstances(
    'distant-island-caps',
    new CylinderGeometry(1, 0.92, 1, 14),
    groundMaterial,
    specs.length,
  );
  const snowCaps = createInstances(
    'distant-island-snow',
    new CylinderGeometry(0.97, 0.9, 1, 14),
    snowMaterial,
    specs.length,
  );
  const shardMeshes = createInstances(
    'distant-island-shards',
    new IcosahedronGeometry(1, 0),
    rockMaterial,
    shards.length,
  );
  const foliageMarkers = createInstances(
    'distant-island-foliage',
    new ConeGeometry(1, 1, 6),
    foliageMaterial,
    Math.ceil(specs.length / 2),
  );
  const stoneMarkers = createInstances(
    'distant-island-markers',
    new CylinderGeometry(1, 1.4, 1, 7),
    stoneMaterial,
    Math.floor(specs.length / 2),
  );
  root.add(rocks, caps, snowCaps, shardMeshes, foliageMarkers, stoneMarkers);

  let visibleCount = specs.length;
  const islandTransform = new Object3D();
  const partTransform = new Object3D();
  const matrix = new Matrix4();
  const applyPart = (
    mesh: InstancedMesh,
    instanceIndex: number,
    parentMatrix: Matrix4,
    position: readonly [number, number, number],
    rotation: readonly [number, number, number],
    scale: readonly [number, number, number],
  ) => {
    partTransform.position.set(...position);
    partTransform.rotation.set(...rotation);
    partTransform.scale.set(...scale);
    partTransform.updateMatrix();
    matrix.multiplyMatrices(parentMatrix, partTransform.matrix);
    mesh.setMatrixAt(instanceIndex, matrix);
  };

  const update = (elapsed: number, motionScale: number) => {
    let foliageIndex = 0;
    let stoneIndex = 0;
    for (let index = 0; index < visibleCount; index += 1) {
      const spec = specs[index];
      if (!spec) continue;
      const depth = 1.5 + spec.radius;
      islandTransform.position.set(
        spec.x,
        spec.y + Math.sin(elapsed * 0.28 + spec.phase) * 0.06 * motionScale,
        spec.z,
      );
      islandTransform.rotation.set(
        0,
        spec.rotation,
        Math.sin(elapsed * 0.18 + spec.phase * 1.4) * 0.006 * motionScale,
      );
      islandTransform.scale.setScalar(1);
      islandTransform.updateMatrix();

      applyPart(
        rocks,
        index,
        islandTransform.matrix,
        [0, -depth * 0.5 + 0.03, 0],
        [0, 0, 0],
        [spec.radius, depth, spec.radius],
      );
      applyPart(
        caps,
        index,
        islandTransform.matrix,
        [0, 0.15, 0],
        [0, 0, 0],
        [spec.radius, 0.3, spec.radius],
      );
      applyPart(
        snowCaps,
        index,
        islandTransform.matrix,
        [0, 0.325, 0],
        [0, 0, 0],
        [spec.radius, 0.045, spec.radius],
      );
      const markerHeight = 0.56 + spec.radius * 0.38;
      if (index % 2 === 0) {
        applyPart(
          foliageMarkers,
          foliageIndex,
          islandTransform.matrix,
          [0, 0.64, 0],
          [0, 0, 0],
          [spec.radius * 0.18, markerHeight, spec.radius * 0.18],
        );
        foliageIndex += 1;
      } else {
        applyPart(
          stoneMarkers,
          stoneIndex,
          islandTransform.matrix,
          [0, 0.64, 0],
          [0, 0, 0],
          [spec.radius * 0.1, 0.5 + spec.radius * 0.32, spec.radius * 0.1],
        );
        stoneIndex += 1;
      }
    }
    for (let index = 0; index < visibleCount * 4; index += 1) {
      const shard = shards[index];
      const spec = shard ? specs[shard.islandIndex] : undefined;
      if (!shard || !spec) continue;
      islandTransform.position.set(
        spec.x,
        spec.y + Math.sin(elapsed * 0.28 + spec.phase) * 0.06 * motionScale,
        spec.z,
      );
      islandTransform.rotation.set(
        0,
        spec.rotation,
        Math.sin(elapsed * 0.18 + spec.phase * 1.4) * 0.006 * motionScale,
      );
      islandTransform.updateMatrix();
      applyPart(
        shardMeshes,
        index,
        islandTransform.matrix,
        [shard.x, shard.y, shard.z],
        [shard.rotationX, shard.rotationY, shard.rotationZ],
        [shard.scaleX, shard.scaleY, shard.scaleZ],
      );
    }
    for (const mesh of [rocks, caps, snowCaps, shardMeshes, foliageMarkers, stoneMarkers]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    root,
    setQuality(profile) {
      visibleCount = Math.min(specs.length, profile.distantIslands);
      rocks.count = visibleCount;
      caps.count = visibleCount;
      snowCaps.count = visibleCount;
      shardMeshes.count = visibleCount * 4;
      foliageMarkers.count = Math.ceil(visibleCount / 2);
      stoneMarkers.count = Math.floor(visibleCount / 2);
    },
    update,
    getVisibleCount: () => visibleCount,
  };
}
