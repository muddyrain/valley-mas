import {
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  type MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';

export interface InstancedTreeSpec {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
}

export interface InstancedTreeBatch {
  root: Group;
  setQuality: (profile: Readonly<QualityProfile>) => void;
  update: (signals: Readonly<SceneSignals>, elapsed: number) => void;
}

interface TreePart {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}

const LEAF_PARTS = [
  { position: [-0.38, 1.52, 0.04], rotation: [0.008, -0.266, 0.014], scale: [0.68, 0.7072, 0.639] },
  { position: [0.34, 1.58, 0.08], rotation: [0.032, 0.238, 0.028], scale: [0.64, 0.666, 0.602] },
  { position: [0, 1.92, -0.08], rotation: [0.168, 0, -0.028], scale: [0.73, 0.759, 0.686] },
  { position: [-0.08, 1.38, 0.38], rotation: [-0.048, -0.056, 0.133], scale: [0.55, 0.572, 0.517] },
  { position: [0.08, 1.46, -0.42], rotation: [-0.016, 0.056, -0.147], scale: [0.58, 0.603, 0.545] },
  { position: [0.02, 1.62, 0.02], rotation: [0.048, 0.014, 0.007], scale: [0.72, 0.749, 0.677] },
] as const satisfies readonly TreePart[];

const SNOW_PARTS = [
  { position: [-0.3, 2, 0.04], rotation: [0, 0.5, 0], scale: [0.46, 0.101, 0.386] },
  { position: [0.3, 2.04, 0.06], rotation: [0, 1.1, 0], scale: [0.43, 0.095, 0.361] },
  { position: [0, 2.38, -0.08], rotation: [0, 1.8, 0], scale: [0.5, 0.11, 0.42] },
] as const satisfies readonly TreePart[];

function createDynamicInstances(
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

export function createInstancedTreeBatch(
  specs: readonly InstancedTreeSpec[],
  trunkMaterial: MeshStandardMaterial,
  leafMaterials: readonly MeshStandardMaterial[],
  snowMaterial: MeshStandardMaterial,
): InstancedTreeBatch {
  const root = new Group();
  root.name = 'instanced-tree-batch';
  const trunks = createDynamicInstances(
    'tree-trunks',
    new CylinderGeometry(0.095, 0.19, 1.48, 8),
    trunkMaterial,
    specs.length,
  );
  const branches = createDynamicInstances(
    'tree-branches',
    new CylinderGeometry(0.035, 0.07, 0.64, 7),
    trunkMaterial,
    specs.length * 2,
  );
  const leafGeometry = new IcosahedronGeometry(1, 1);
  const leafMeshes = LEAF_PARTS.map((_, index) =>
    createDynamicInstances(
      `tree-leaves-${index}`,
      leafGeometry,
      leafMaterials[index % leafMaterials.length] ?? leafMaterials[0] ?? trunkMaterial,
      specs.length,
    ),
  );
  const snowGeometry = new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const snowMeshes = SNOW_PARTS.map((_, index) =>
    createDynamicInstances(`tree-snow-${index}`, snowGeometry, snowMaterial, specs.length),
  );
  root.add(trunks, branches, ...leafMeshes, ...snowMeshes);

  const treeTransform = new Object3D();
  const partTransform = new Object3D();
  const instanceMatrix = new Matrix4();
  const applyPart = (
    mesh: InstancedMesh,
    instanceIndex: number,
    treeMatrix: Matrix4,
    part: TreePart,
  ) => {
    partTransform.position.set(...part.position);
    partTransform.rotation.set(...part.rotation);
    partTransform.scale.set(...part.scale);
    partTransform.updateMatrix();
    instanceMatrix.multiplyMatrices(treeMatrix, partTransform.matrix);
    mesh.setMatrixAt(instanceIndex, instanceMatrix);
  };

  const update = (signals: Readonly<SceneSignals>, elapsed: number) => {
    for (let treeIndex = 0; treeIndex < specs.length; treeIndex += 1) {
      const spec = specs[treeIndex];
      if (!spec) continue;
      const gust =
        signals.windStrength * 0.055 +
        Math.sin(elapsed * (1.18 + signals.windStrength * 1.4) + spec.phase) * signals.plantSway;
      treeTransform.position.set(spec.x, spec.y, spec.z);
      treeTransform.rotation.set(
        Math.cos(elapsed * 0.82 + spec.phase * 0.7) * signals.plantSway * 0.28,
        0,
        -gust,
      );
      treeTransform.scale.setScalar(spec.scale);
      treeTransform.updateMatrix();

      applyPart(trunks, treeIndex, treeTransform.matrix, {
        position: [0, 0.74, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      });
      for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
        const direction = branchIndex === 0 ? -1 : 1;
        applyPart(branches, treeIndex * 2 + branchIndex, treeTransform.matrix, {
          position: [direction * 0.19, 1.18, 0.02],
          rotation: [direction * 0.12, 0, direction * -0.82],
          scale: [1, 1, 1],
        });
      }
      for (let partIndex = 0; partIndex < LEAF_PARTS.length; partIndex += 1) {
        const mesh = leafMeshes[partIndex];
        const part = LEAF_PARTS[partIndex];
        if (mesh && part) applyPart(mesh, treeIndex, treeTransform.matrix, part);
      }
      for (let partIndex = 0; partIndex < SNOW_PARTS.length; partIndex += 1) {
        const mesh = snowMeshes[partIndex];
        const part = SNOW_PARTS[partIndex];
        if (mesh && part) applyPart(mesh, treeIndex, treeTransform.matrix, part);
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    branches.instanceMatrix.needsUpdate = true;
    for (const mesh of [...leafMeshes, ...snowMeshes]) mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    root,
    setQuality(profile) {
      branches.visible = profile.treeLeafClusters > 3;
      for (let index = 0; index < leafMeshes.length; index += 1) {
        const mesh = leafMeshes[index];
        if (mesh) mesh.visible = index < profile.treeLeafClusters;
      }
      for (let index = 0; index < snowMeshes.length; index += 1) {
        const mesh = snowMeshes[index];
        if (mesh) mesh.visible = index < Math.max(2, Math.ceil(profile.treeLeafClusters / 2));
      }
    },
    update,
  };
}
