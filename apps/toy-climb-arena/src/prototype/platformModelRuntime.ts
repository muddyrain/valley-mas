import {
  Box3,
  type BufferGeometry,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
  Quaternion,
  type Scene,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ToyPlatformModelAssetDefinition } from '../platformModelAssets';
import type {
  PlatformColliderShape,
  PlatformCollisionData,
  PlatformCollisionDebugMeta,
} from './collision';
import { syncColliderData } from './collision';

interface PlatformModelRuntimeOptions {
  scene: Scene;
}

interface AttachPlatformModelOptions {
  asset: ToyPlatformModelAssetDefinition;
  size: [number, number, number];
  position: [number, number, number];
  visualObjects: Object3D[];
  appendCollider: (params: {
    center: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number, number];
    shape?: PlatformColliderShape;
    debugMeta?: PlatformCollisionDebugMeta;
  }) => PlatformCollisionData;
  debugMeta: PlatformCollisionDebugMeta;
  onCollidersReady?: (colliders: PlatformCollisionData[], bounds: Box3) => void;
}

interface TemplateRecord {
  root: Group;
  bounds: Box3;
}

interface ColliderBinding {
  mesh: Mesh;
  collider: PlatformCollisionData;
  shape: PlatformColliderShape;
}

const WORLD_POSITION = new Vector3();
const WORLD_SCALE = new Vector3();
const WORLD_QUATERNION = new Quaternion();
const LOCAL_BOUNDS_CENTER = new Vector3();
const LOCAL_BOUNDS_SIZE = new Vector3();

function rememberVisualOrigin(object: Object3D): void {
  object.userData = {
    ...object.userData,
    bumpOriginX: object.position.x,
    bumpOriginY: object.position.y,
    bumpOriginZ: object.position.z,
    bumpOriginRotationY: object.rotation.y,
    bumpOriginRotationZ: object.rotation.z,
    bumpOriginScaleX: object.scale.x,
    bumpOriginScaleY: object.scale.y,
    bumpOriginScaleZ: object.scale.z,
  };
}

function setShadowFlags(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Object3D & {
      isMesh?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function disposeRootResources(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((node) => {
    const mesh = node as Object3D & {
      isMesh?: boolean;
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (!mesh.isMesh) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) materials.add(material);
    } else if (mesh.material) {
      materials.add(mesh.material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function fitModelToPlatform(
  root: Group,
  bounds: Box3,
  size: [number, number, number],
  position: [number, number, number],
): void {
  const boundsSize = new Vector3();
  const boundsCenter = new Vector3();
  bounds.getSize(boundsSize);
  bounds.getCenter(boundsCenter);

  const scaleX = size[0] / Math.max(boundsSize.x, 0.001);
  const scaleY = size[1] / Math.max(boundsSize.y, 0.001);
  const scaleZ = size[2] / Math.max(boundsSize.z, 0.001);
  root.scale.set(scaleX, scaleY, scaleZ);
  root.position.set(
    position[0] - boundsCenter.x * scaleX,
    position[1] - boundsCenter.y * scaleY,
    position[2] - boundsCenter.z * scaleZ,
  );
  rememberVisualOrigin(root);
}

function cloneTemplateRoot(template: TemplateRecord, name: string): Group {
  const root = template.root.clone(true);
  root.name = name;
  setShadowFlags(root);
  return root;
}

function resolveCollisionShape(mesh: Object3D): PlatformColliderShape | null {
  const rawShape = mesh.userData?.collisionShape;
  if (rawShape === 'none') return null;
  if (rawShape === 'cylinder') return 'cylinder';
  if (rawShape === 'ramp') return 'ramp';
  return 'box';
}

function syncColliderWithMesh(binding: ColliderBinding): void {
  const { mesh, collider, shape } = binding;
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const localBounds = geometry.boundingBox;
  if (!localBounds) return;

  mesh.updateWorldMatrix(true, false);
  mesh.matrixWorld.decompose(WORLD_POSITION, WORLD_QUATERNION, WORLD_SCALE);
  localBounds.getCenter(LOCAL_BOUNDS_CENTER);
  localBounds.getSize(LOCAL_BOUNDS_SIZE);
  const center = LOCAL_BOUNDS_CENTER.clone().applyMatrix4(mesh.matrixWorld);
  const size: [number, number, number] = [
    Math.max(0.001, Math.abs(LOCAL_BOUNDS_SIZE.x * WORLD_SCALE.x)),
    Math.max(0.001, Math.abs(LOCAL_BOUNDS_SIZE.y * WORLD_SCALE.y)),
    Math.max(0.001, Math.abs(LOCAL_BOUNDS_SIZE.z * WORLD_SCALE.z)),
  ];

  syncColliderData(collider, {
    center: [center.x, center.y, center.z],
    size,
    rotation: [WORLD_QUATERNION.x, WORLD_QUATERNION.y, WORLD_QUATERNION.z, WORLD_QUATERNION.w],
    shape,
  });
}

function createModelColliders(params: {
  root: Group;
  debugMeta: PlatformCollisionDebugMeta;
  appendCollider: AttachPlatformModelOptions['appendCollider'];
}): PlatformCollisionData[] {
  const colliders: PlatformCollisionData[] = [];
  const bindings: ColliderBinding[] = [];

  params.root.updateWorldMatrix(true, true);
  params.root.traverse((node) => {
    const mesh = node as Mesh & { isMesh?: boolean };
    if (!mesh.isMesh || !mesh.geometry) return;
    const shape = resolveCollisionShape(mesh);
    if (!shape) return;

    const collider = params.appendCollider({
      center: [0, 0, 0],
      size: [0.001, 0.001, 0.001],
      shape,
      debugMeta: params.debugMeta,
    });
    const binding = { mesh, collider, shape };
    syncColliderWithMesh(binding);
    bindings.push(binding);
    colliders.push(collider);
  });

  params.root.userData.platformColliderBindings = bindings;
  return colliders;
}

export function createPlatformModelRuntime(options: PlatformModelRuntimeOptions): {
  attachPlatformModel: (attachOptions: AttachPlatformModelOptions) => void;
  syncColliders: () => void;
  dispose: () => void;
} {
  const loader = new GLTFLoader();
  const templates = new Map<string, Promise<TemplateRecord>>();
  const attachedRoots = new Set<Group>();
  const colliderBindings = new Set<ColliderBinding>();
  let disposed = false;

  const loadTemplate = (asset: ToyPlatformModelAssetDefinition): Promise<TemplateRecord> => {
    const existing = templates.get(asset.id);
    if (existing) return existing;

    const promise = loader.loadAsync(asset.url).then((gltf) => {
      const root = gltf.scene;
      setShadowFlags(root);
      root.updateWorldMatrix(true, true);
      const bounds = new Box3().setFromObject(root);
      if (bounds.isEmpty()) {
        throw new Error(`Toy platform model ${asset.id} has empty bounds.`);
      }
      return { root, bounds };
    });
    templates.set(asset.id, promise);
    return promise;
  };

  const attachPlatformModel = (attachOptions: AttachPlatformModelOptions): void => {
    void loadTemplate(attachOptions.asset)
      .then((template) => {
        if (disposed) return;
        const root = cloneTemplateRoot(template, `${attachOptions.asset.id}_instance`);
        fitModelToPlatform(root, template.bounds, attachOptions.size, attachOptions.position);
        options.scene.add(root);
        attachedRoots.add(root);
        attachOptions.visualObjects.push(root);
        const colliders = createModelColliders({
          root,
          debugMeta: attachOptions.debugMeta,
          appendCollider: attachOptions.appendCollider,
        });
        const bindings = (root.userData.platformColliderBindings ?? []) as ColliderBinding[];
        for (const binding of bindings) colliderBindings.add(binding);
        root.updateWorldMatrix(true, true);
        attachOptions.onCollidersReady?.(colliders, new Box3().setFromObject(root));
      })
      .catch((error) => {
        console.warn('[toy-climb] platform model load failed', attachOptions.asset.id, error);
      });
  };

  return {
    attachPlatformModel,
    syncColliders: () => {
      for (const binding of colliderBindings) {
        syncColliderWithMesh(binding);
      }
    },
    dispose: () => {
      disposed = true;
      for (const root of attachedRoots) {
        root.parent?.remove(root);
      }
      attachedRoots.clear();
      colliderBindings.clear();
      for (const promise of templates.values()) {
        void promise.then((template) => disposeRootResources(template.root));
      }
      templates.clear();
    },
  };
}
