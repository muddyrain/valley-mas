import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  Color,
  Euler,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  RepeatWrapping,
  type Scene,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CLIMBER_GRAVITY,
  CLIMBER_JUMP_SPEED,
  CLIMBER_SPRINT_SPEED,
  CLIMBER_WALK_SPEED,
} from '../climberPhysics';
import { getClimberSetPieceAsset } from '../setpieceCatalog';
import type { ClimberSetPieceColliderShape, ClimberSetPieceDefinition } from '../types';

interface SetPieceRuntimeOptions {
  scene: Scene;
  setPieces: ClimberSetPieceDefinition[] | undefined;
  reachabilityStart?: {
    id: string;
    center: [number, number, number];
    size: [number, number, number];
  };
  appendCollider: (params: {
    center: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number, number];
    shape?: ClimberSetPieceColliderShape;
    debugMeta?: {
      category: 'platform' | 'setpiece' | 'system';
      assetId?: string;
      instanceId?: string;
    };
  }) => {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

interface DisposableSetPieceResources {
  geometries: BufferGeometry[];
  materials: Material[];
}

export interface LocalBoundsData {
  center: [number, number, number];
  size: [number, number, number];
}

interface ReachabilityNode {
  id: string;
  collider: {
    center: [number, number, number];
    size: [number, number, number];
  };
}

export interface ResolvedColliderData {
  center: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number, number];
  shape: ClimberSetPieceColliderShape;
}

const RAMP_TOP_FLAT_RATIO = 0.36;

function isProceduralSetPieceAsset(assetId: ClimberSetPieceDefinition['assetId']): boolean {
  return assetId === 'ramp_wedge';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveLinkGapXZ(
  prev: ReachabilityNode['collider'],
  next: ReachabilityNode['collider'],
): number {
  const dx = Math.abs(next.center[0] - prev.center[0]) - (prev.size[0] * 0.5 + next.size[0] * 0.5);
  const dz = Math.abs(next.center[2] - prev.center[2]) - (prev.size[2] * 0.5 + next.size[2] * 0.5);
  return Math.hypot(Math.max(0, dx), Math.max(0, dz));
}

function estimateAirtimeToHeight(deltaY: number): number | null {
  const discriminant = CLIMBER_JUMP_SPEED ** 2 - 2 * CLIMBER_GRAVITY * deltaY;
  if (discriminant < 0) return null;
  return (CLIMBER_JUMP_SPEED + Math.sqrt(discriminant)) / CLIMBER_GRAVITY;
}

function reportReachability(nodes: ReachabilityNode[]): void {
  if (typeof window === 'undefined') return;
  if (!/localhost|127\.0\.0\.1/.test(window.location.hostname)) return;
  if (nodes.length < 2) return;

  const lines: string[] = [];
  let riskCount = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    const prev = nodes[index - 1];
    const next = nodes[index];
    const prevTop = prev.collider.center[1] + prev.collider.size[1] * 0.5;
    const nextTop = next.collider.center[1] + next.collider.size[1] * 0.5;
    const deltaY = nextTop - prevTop;
    const gapXZ = resolveLinkGapXZ(prev.collider, next.collider);
    const airtime = estimateAirtimeToHeight(deltaY);

    let status = 'ok';
    let walkRange = 0;
    let sprintRange = 0;
    if (airtime == null) {
      status = 'too-high';
      riskCount += 1;
    } else {
      walkRange = CLIMBER_WALK_SPEED * airtime;
      sprintRange = CLIMBER_SPRINT_SPEED * airtime;
      if (gapXZ > sprintRange + 0.12) {
        status = 'too-far';
        riskCount += 1;
      } else if (gapXZ > walkRange + 0.12) {
        status = 'sprint-required';
      } else if (gapXZ > walkRange * 0.88 || deltaY > 1.6) {
        status = 'tight';
      }
    }

    const line = `[${index.toString().padStart(2, '0')}] ${prev.id} -> ${next.id} | dy=${deltaY.toFixed(
      2,
    )}m gap=${gapXZ.toFixed(2)}m walk=${walkRange.toFixed(2)}m sprint=${sprintRange.toFixed(2)}m status=${status}`;
    lines.push(line);
    if (status === 'too-high' || status === 'too-far') {
      console.warn('[climber-game][reachability]', line);
    }
  }

  console.groupCollapsed(
    `[climber-game] 可达性报告: ${nodes.length - 1} 跳 (${riskCount} 条高风险)`,
  );
  lines.forEach((line) => {
    console.info(line);
  });
  console.groupEnd();
}

function colorToCss(color: Color): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function mixColor(base: Color, tint: Color, ratio: number): Color {
  return base.clone().lerp(tint, ratio);
}

function createSurfaceTexture(
  preset: ClimberSetPieceDefinition['surfacePreset'],
  baseColor: string,
): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const base = new Color(baseColor);
  const dark = mixColor(base, new Color('#111827'), 0.36);
  const light = mixColor(base, new Color('#ffffff'), 0.28);

  ctx.fillStyle = colorToCss(base);
  ctx.fillRect(0, 0, 256, 256);

  if (preset === 'wood') {
    ctx.strokeStyle = colorToCss(dark);
    ctx.lineWidth = 3;
    for (let y = 10; y < 256; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + ((y / 22) % 2 === 0 ? 3 : -3));
      ctx.stroke();
    }
  } else if (preset === 'hazard') {
    ctx.fillStyle = '#111111';
    for (let x = -180; x < 320; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 18, 0);
      ctx.lineTo(x + 122, 256);
      ctx.lineTo(x + 104, 256);
      ctx.closePath();
      ctx.fill();
    }
  } else if (preset === 'container') {
    ctx.strokeStyle = colorToCss(light);
    ctx.lineWidth = 6;
    for (let x = 20; x < 256; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = colorToCss(dark);
    ctx.lineWidth = 3;
    for (let x = 34; x < 256; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
  } else if (preset === 'metal') {
    ctx.fillStyle = colorToCss(light);
    for (let i = 0; i < 180; i += 1) {
      const y = (i * 17) % 256;
      const alpha = 0.05 + (i % 5) * 0.015;
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, y, 256, 1);
    }
    ctx.globalAlpha = 1;
  } else if (preset === 'grass' || preset === 'leaf') {
    for (let i = 0; i < 360; i += 1) {
      const x = (i * 23) % 256;
      const y = (i * 47) % 256;
      const tone = i % 2 === 0 ? light : dark;
      ctx.fillStyle = colorToCss(tone);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, y, 2, 8);
    }
    ctx.globalAlpha = 1;
  } else if (preset === 'asphalt') {
    const speckLight = mixColor(base, new Color('#9ca3af'), 0.42);
    const speckDark = mixColor(base, new Color('#111827'), 0.34);
    for (let i = 0; i < 620; i += 1) {
      const x = (i * 19) % 256;
      const y = (i * 43) % 256;
      const tone = i % 3 === 0 ? speckLight : speckDark;
      ctx.fillStyle = colorToCss(tone);
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(245, 245, 220, 0.7)';
    for (let x = 14; x < 256; x += 44) {
      ctx.fillRect(x, 123, 22, 10);
    }
  } else if (preset === 'cloud') {
    const puff = mixColor(base, new Color('#ffffff'), 0.6);
    const shade = mixColor(base, new Color('#dce8f6'), 0.55);
    for (let i = 0; i < 48; i += 1) {
      const x = (i * 53) % 256;
      const y = (i * 37) % 256;
      const r = 10 + (i % 6) * 4;
      ctx.fillStyle = colorToCss(i % 3 === 0 ? shade : puff);
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    for (let i = 0; i < 520; i += 1) {
      const x = (i * 37) % 256;
      const y = (i * 91) % 256;
      const radius = (i % 3) + 1;
      const tone = i % 2 === 0 ? light : dark;
      ctx.fillStyle = colorToCss(tone);
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function applySurfacePresetMaterial(
  material: MeshStandardMaterial,
  resolvedColor: string,
  resolvedPreset: ClimberSetPieceDefinition['surfacePreset'],
  texture?: CanvasTexture,
): void {
  material.color.set(resolvedColor);
  if (texture) {
    material.map = texture;
  }
  if (resolvedPreset === 'metal') {
    material.roughness = 0.42;
    material.metalness = 0.22;
  } else if (resolvedPreset === 'container') {
    material.roughness = 0.58;
    material.metalness = 0.14;
  } else if (resolvedPreset === 'hazard') {
    material.roughness = 0.48;
    material.metalness = 0.1;
  } else if (resolvedPreset === 'asphalt') {
    material.roughness = 0.9;
    material.metalness = 0.02;
  } else if (resolvedPreset === 'cloud') {
    material.roughness = 0.96;
    material.metalness = 0;
  } else {
    material.roughness = 0.72;
    material.metalness = 0.06;
  }
  material.needsUpdate = true;
}

function hasMaterialTexture(material: MeshStandardMaterial): boolean {
  return Boolean(
    material.map ||
      material.normalMap ||
      material.roughnessMap ||
      material.metalnessMap ||
      material.emissiveMap ||
      material.aoMap ||
      material.alphaMap ||
      material.bumpMap ||
      material.displacementMap,
  );
}

function createProceduralRampInstance(params: {
  size: [number, number, number];
  resolvedColor: string;
  resolvedPreset: ClimberSetPieceDefinition['surfacePreset'];
  texture?: CanvasTexture;
}): {
  root: Group;
  dispose: () => void;
} {
  const [width, height, depth] = params.size;
  const halfW = width / 2;
  const halfD = depth / 2;
  const lowY = 0;
  const highY = height;
  const topFlatDepth = Math.max(0.001, Math.min(depth * 0.7, depth * RAMP_TOP_FLAT_RATIO));
  const topFlatEndZ = -halfD + topFlatDepth;

  const geometry = new BufferGeometry();
  const positions = [
    -halfW,
    lowY,
    -halfD,
    halfW,
    lowY,
    -halfD,
    -halfW,
    lowY,
    halfD,
    halfW,
    lowY,
    halfD,
    -halfW,
    highY,
    -halfD,
    halfW,
    highY,
    -halfD,
    -halfW,
    highY,
    topFlatEndZ,
    halfW,
    highY,
    topFlatEndZ,
  ];
  const indices = [
    0, 1, 3, 0, 3, 2, 0, 4, 5, 0, 5, 1, 4, 6, 7, 4, 7, 5, 6, 2, 3, 6, 3, 7, 0, 2, 6, 0, 6, 4, 1, 5,
    7, 1, 7, 3,
  ];
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({ color: params.resolvedColor });
  applySurfacePresetMaterial(material, params.resolvedColor, params.resolvedPreset, params.texture);

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const root = new Group();
  root.add(mesh);

  return {
    root,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

function cloneWithUniqueResources(template: Group): {
  root: Group;
  dispose: () => void;
} {
  const cloned = template.clone(true);
  const resources: DisposableSetPieceResources = {
    geometries: [],
    materials: [],
  };

  cloned.traverse((node) => {
    const mesh = node as Object3D & {
      isMesh?: boolean;
      geometry?: BufferGeometry;
      material?: Material | Material[];
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const nextGeometry = mesh.geometry.clone();
    mesh.geometry = nextGeometry;
    resources.geometries.push(nextGeometry);

    if (Array.isArray(mesh.material)) {
      const nextMaterials = mesh.material.map((item) => item.clone());
      mesh.material = nextMaterials;
      resources.materials.push(...nextMaterials);
      return;
    }

    const nextMaterial = mesh.material.clone();
    mesh.material = nextMaterial;
    resources.materials.push(nextMaterial);
  });

  return {
    root: cloned,
    dispose: () => {
      resources.geometries.forEach((geometry) => geometry.dispose());
      resources.materials.forEach((material) => material.dispose());
    },
  };
}

export function readSetPieceLocalBounds(root: Group): LocalBoundsData | null {
  root.updateWorldMatrix(true, true);
  let bestBox: Box3 | null = null;
  let bestFootprint = 0;

  root.traverse((node) => {
    const mesh = node as Object3D & {
      isMesh?: boolean;
      geometry?: BufferGeometry;
      matrixWorld?: { elements?: number[] };
    };
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) return;
    const worldBox = mesh.geometry.boundingBox.clone().applyMatrix4((node as Object3D).matrixWorld);
    if (worldBox.isEmpty()) return;

    const size = new Vector3();
    worldBox.getSize(size);
    const footprint = size.x * size.z;
    if (!Number.isFinite(footprint) || footprint <= 0) return;
    if (footprint > bestFootprint) {
      bestFootprint = footprint;
      bestBox = worldBox;
    }
  });

  const box = bestBox ?? new Box3().setFromObject(root);
  if (box.isEmpty()) return null;
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
    return null;
  }
  return {
    center: [center.x, center.y, center.z],
    size: [Math.max(0.001, size.x), Math.max(0.001, size.y), Math.max(0.001, size.z)],
  };
}

export function resolveSetPieceColliderData(
  definition: ClimberSetPieceDefinition,
  localBounds: LocalBoundsData | null,
): ResolvedColliderData {
  const asset = getClimberSetPieceAsset(definition.assetId);
  const [px, py, pz] = definition.position;
  const scaleTuple: [number, number, number] = definition.scale ?? [1, 1, 1];
  const rotationTuple: [number, number, number] = definition.rotation ?? [0, 0, 0];
  const colliderLocalRotationTuple: [number, number, number] = definition.colliderLocalRotation ??
    asset.colliderLocalRotation ?? [0, 0, 0];
  const useAssetDefaultCollider = asset.colliderShape === 'ramp';
  const boundsSize = useAssetDefaultCollider
    ? asset.colliderSize
    : (localBounds?.size ?? asset.colliderSize);
  const boundsCenter = useAssetDefaultCollider
    ? asset.colliderOffset
    : (localBounds?.center ?? asset.colliderOffset);
  const colliderSize = definition.colliderSize ?? boundsSize;
  const colliderOffset = definition.colliderOffset ?? boundsCenter;
  const colliderShape = definition.colliderShape ?? asset.colliderShape ?? 'box';
  const colliderInset = clamp(definition.colliderInset ?? 1, 0.45, 1);
  const adjustedColliderSize: [number, number, number] = [
    colliderSize[0] * colliderInset,
    colliderSize[1],
    colliderSize[2] * colliderInset,
  ];
  const scaledColliderSize: [number, number, number] = [
    Math.max(0.001, adjustedColliderSize[0] * Math.abs(scaleTuple[0])),
    Math.max(0.001, adjustedColliderSize[1] * Math.abs(scaleTuple[1])),
    Math.max(0.001, adjustedColliderSize[2] * Math.abs(scaleTuple[2])),
  ];
  const rotation = new Euler(rotationTuple[0], rotationTuple[1], rotationTuple[2], 'XYZ');
  const colliderLocalRotation = new Euler(
    colliderLocalRotationTuple[0],
    colliderLocalRotationTuple[1],
    colliderLocalRotationTuple[2],
    'XYZ',
  );
  const modelQuaternion = new Quaternion().setFromEuler(rotation);
  const localColliderQuaternion = new Quaternion().setFromEuler(colliderLocalRotation);
  const quaternion = modelQuaternion.clone().multiply(localColliderQuaternion);
  const localCenter = new Vector3(
    colliderOffset[0] * scaleTuple[0],
    colliderOffset[1] * scaleTuple[1],
    colliderOffset[2] * scaleTuple[2],
  ).applyQuaternion(modelQuaternion);

  return {
    center: [px + localCenter.x, py + localCenter.y, pz + localCenter.z],
    size: scaledColliderSize,
    rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    shape: colliderShape,
  };
}

export function createSetPieceRuntime(options: SetPieceRuntimeOptions): {
  dispose: () => void;
} {
  const { scene, appendCollider, reachabilityStart } = options;
  const setPieces = options.setPieces ?? [];
  if (!setPieces.length) {
    return { dispose: () => undefined };
  }

  const loader = new GLTFLoader();
  const templateMap = new Map<string, Group>();
  const localBoundsMap = new Map<string, LocalBoundsData>();
  const textureCache = new Map<string, CanvasTexture>();
  const spawnedRoots: Group[] = [];
  const spawnedDisposers: Array<() => void> = [];
  let disposed = false;

  const loadTask = Promise.all(
    Array.from(new Set(setPieces.map((item) => item.assetId)))
      .filter((assetId) => !isProceduralSetPieceAsset(assetId))
      .map(async (assetId) => {
        const asset = getClimberSetPieceAsset(assetId);
        const gltf = await loader.loadAsync(asset.url);
        if (disposed) return;
        const sceneRoot = gltf.scene as Group;
        templateMap.set(assetId, sceneRoot);
        const localBounds = readSetPieceLocalBounds(sceneRoot);
        if (localBounds) {
          localBoundsMap.set(assetId, localBounds);
        }
      }),
  )
    .then(() => {
      if (disposed) return;
      const reachabilityNodes: ReachabilityNode[] = [];
      if (reachabilityStart) {
        reachabilityNodes.push({
          id: reachabilityStart.id,
          collider: {
            center: reachabilityStart.center,
            size: reachabilityStart.size,
          },
        });
      }
      setPieces.forEach((definition) => {
        const asset = getClimberSetPieceAsset(definition.assetId);
        const resolvedColor = definition.color ?? asset.baseColor;
        const resolvedPreset = definition.surfacePreset ?? asset.surfacePreset;
        const shouldApplySurface =
          !asset.preserveMaterial || isProceduralSetPieceAsset(definition.assetId);
        let texture: CanvasTexture | undefined;
        if (shouldApplySurface) {
          const textureCacheKey = `${resolvedPreset}:${resolvedColor}`;
          texture = textureCache.get(textureCacheKey);
          if (!texture) {
            texture = createSurfaceTexture(resolvedPreset, resolvedColor) ?? undefined;
            if (texture) {
              textureCache.set(textureCacheKey, texture);
            }
          }
        }

        let instance: Group;
        let disposeInstance: () => void;
        if (isProceduralSetPieceAsset(definition.assetId)) {
          const procedural = createProceduralRampInstance({
            size: definition.colliderSize ?? asset.colliderSize,
            resolvedColor,
            resolvedPreset,
            texture,
          });
          instance = procedural.root;
          disposeInstance = procedural.dispose;
        } else {
          const template = templateMap.get(definition.assetId);
          if (!template) return;
          const cloned = cloneWithUniqueResources(template);
          instance = cloned.root;
          disposeInstance = cloned.dispose;

          if (!asset.preserveMaterial) {
            instance.traverse((node) => {
              const mesh = node as Object3D & {
                isMesh?: boolean;
                material?: Material | Material[];
              };
              if (!mesh.isMesh || !mesh.material) return;
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((item) => {
                const standard = item as MeshStandardMaterial;
                if (!standard || !standard.isMeshStandardMaterial) return;
                if (hasMaterialTexture(standard)) return;
                applySurfacePresetMaterial(standard, resolvedColor, resolvedPreset, texture);
              });
            });
          }
        }

        instance.position.set(
          definition.position[0],
          definition.position[1],
          definition.position[2],
        );
        if (definition.rotation) {
          instance.rotation.set(
            definition.rotation[0],
            definition.rotation[1],
            definition.rotation[2],
          );
        }
        if (definition.scale) {
          instance.scale.set(definition.scale[0], definition.scale[1], definition.scale[2]);
        }
        if (definition.solid !== false) {
          const localBounds = localBoundsMap.get(definition.assetId) ?? null;
          const collider = resolveSetPieceColliderData(definition, localBounds);
          const worldBounds = appendCollider({
            ...collider,
            debugMeta: {
              category: 'setpiece',
              assetId: definition.assetId,
              instanceId: definition.id,
            },
          });
          const center: [number, number, number] = [
            (worldBounds.minX + worldBounds.maxX) * 0.5,
            (worldBounds.minY + worldBounds.maxY) * 0.5,
            (worldBounds.minZ + worldBounds.maxZ) * 0.5,
          ];
          const size: [number, number, number] = [
            Math.max(0.001, worldBounds.maxX - worldBounds.minX),
            Math.max(0.001, worldBounds.maxY - worldBounds.minY),
            Math.max(0.001, worldBounds.maxZ - worldBounds.minZ),
          ];
          reachabilityNodes.push({
            id: definition.id,
            collider: {
              center,
              size,
            },
          });
        }

        scene.add(instance);
        spawnedRoots.push(instance);
        spawnedDisposers.push(disposeInstance);
      });
      reportReachability(reachabilityNodes);
    })
    .catch((error) => {
      if (
        typeof window !== 'undefined' &&
        /localhost|127\.0\.0\.1/.test(window.location.hostname)
      ) {
        console.warn('[climber-game] setpiece load failed', error);
      }
      return undefined;
    });

  return {
    dispose: () => {
      disposed = true;
      void loadTask.finally(() => {
        spawnedRoots.forEach((root) => {
          root.parent?.remove(root);
        });
        spawnedDisposers.forEach((dispose) => dispose());
        textureCache.forEach((texture) => texture.dispose());
        textureCache.clear();
      });
    },
  };
}
