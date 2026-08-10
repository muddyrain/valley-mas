import {
  type BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { createRadialAlphaTexture } from './createRadialAlphaTexture';
import { disposeObject3D } from './dispose';

export interface CloudSeaAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number, delta: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getVisibleCount: () => number;
  dispose: () => void;
}

interface CloudCluster {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  yaw: number;
  phase: number;
}

interface CloudLobe {
  clusterIndex: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotation: number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function createMaterial(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    fog: true,
    roughness: 1,
    metalness: 0,
  });
}

function createLayerMeshes(
  root: Group,
  geometry: BufferGeometry,
  materials: MeshStandardMaterial[],
  lobes: CloudLobe[][],
  renderOrder: number,
): InstancedMesh[] {
  return lobes.map((layer, index) => {
    const mesh = new InstancedMesh(geometry, materials[index], layer.length);
    mesh.name = `cloud-layer-${renderOrder}-${index}`;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder + index;
    root.add(mesh);
    return mesh;
  });
}

function setVisibleClusterCount(
  meshes: InstancedMesh[],
  lobes: CloudLobe[][],
  visibleClusters: number,
): void {
  for (let layerIndex = 0; layerIndex < meshes.length; layerIndex += 1) {
    const mesh = meshes[layerIndex];
    const layer = lobes[layerIndex];
    if (!mesh || !layer) continue;
    let count = 0;
    while (count < layer.length && (layer[count]?.clusterIndex ?? Infinity) < visibleClusters) {
      count += 1;
    }
    mesh.count = count;
  }
}

function updateLayerMatrices(
  meshes: InstancedMesh[],
  lobes: CloudLobe[][],
  clusters: CloudCluster[],
  elapsed: number,
  motionScale: number,
): void {
  const dummy = new Object3D();
  for (let layerIndex = 0; layerIndex < meshes.length; layerIndex += 1) {
    const mesh = meshes[layerIndex];
    const layer = lobes[layerIndex];
    if (!mesh || !layer) continue;
    for (let index = 0; index < mesh.count; index += 1) {
      const lobe = layer[index];
      const cluster = lobe ? clusters[lobe.clusterIndex] : undefined;
      if (!lobe || !cluster) continue;
      const yaw = cluster.yaw + Math.sin(elapsed * 0.045 + cluster.phase) * 0.025 * motionScale;
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      const offsetX = lobe.offsetX * cosine - lobe.offsetZ * sine;
      const offsetZ = lobe.offsetX * sine + lobe.offsetZ * cosine;
      const bob = Math.sin(elapsed * 0.14 + cluster.phase) * 0.11 * motionScale;
      dummy.position.set(cluster.x + offsetX, cluster.y + lobe.offsetY + bob, cluster.z + offsetZ);
      dummy.rotation.set(0, yaw + lobe.rotation, Math.sin(elapsed * 0.07 + cluster.phase) * 0.018);
      dummy.scale.set(lobe.scaleX, lobe.scaleY, lobe.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

export function createCloudSea(profile: QualityProfile): CloudSeaAssembly {
  const root = new Group();
  root.name = 'cloud-sea';
  const seaRoot = new Group();
  seaRoot.position.y = -4.85;
  root.add(seaRoot);

  const random = seededRandom(20260809);
  const cloudGeometry = new SphereGeometry(1, 14, 10);
  const cloudMaterials = [
    createMaterial('#9fb5bb'),
    createMaterial('#b8cbd0'),
    createMaterial('#d5e1df'),
  ];
  const cloudClusters: CloudCluster[] = [];
  const cloudLobes: CloudLobe[][] = [[], [], []];
  const lobeLayout = [
    [-0.66, -0.12, 0.08, 0.72, 0.3, 0.64, 0],
    [0.66, -0.1, -0.04, 0.74, 0.31, 0.66, 0],
    [0, -0.16, 0.18, 0.94, 0.3, 0.7, 0],
    [-0.4, 0.16, -0.02, 0.64, 0.47, 0.58, 1],
    [0.38, 0.18, 0.02, 0.66, 0.49, 0.6, 1],
    [0, 0.3, -0.08, 0.72, 0.56, 0.64, 1],
    [-0.2, 0.5, -0.08, 0.43, 0.34, 0.39, 2],
    [0.24, 0.46, 0, 0.4, 0.32, 0.38, 2],
  ] as const;
  const cloudBands = [
    { radius: 9.2, y: 0.05, scale: 1.45, phase: 0.18 },
    { radius: 15.3, y: 0.9, scale: 1.94, phase: 0.38 },
    { radius: 22.4, y: 1.85, scale: 2.52, phase: 0.08 },
  ] as const;
  for (let clusterIndex = 0; clusterIndex < 44; clusterIndex += 1) {
    const bandIndex = clusterIndex % cloudBands.length;
    const band = cloudBands[bandIndex];
    if (!band) continue;
    const slot = Math.floor(clusterIndex / cloudBands.length);
    const angle = band.phase + ((slot * 0.61803398875) % 1) * Math.PI * 2;
    const contour = Math.sin(slot * 1.73 + bandIndex * 0.9);
    const radius = band.radius + contour * (0.3 + bandIndex * 0.16);
    const scale = band.scale * (0.94 + Math.sin(slot * 1.31 + bandIndex) * 0.07);
    const cluster: CloudCluster = {
      x: Math.cos(angle) * radius,
      y: band.y + Math.sin(slot * 1.14 + bandIndex) * 0.22,
      z: Math.sin(angle) * radius,
      scaleX: scale * 1.32,
      scaleY: scale * (0.48 + bandIndex * 0.015),
      scaleZ: scale * 0.76,
      yaw: angle + Math.PI / 2,
      phase: slot * 0.87 + bandIndex * 1.42,
    };
    cloudClusters.push(cluster);
    for (const [x, y, z, scaleX, scaleY, scaleZ, layer] of lobeLayout) {
      cloudLobes[layer].push({
        clusterIndex,
        offsetX: x * cluster.scaleX,
        offsetY: y * cluster.scaleY,
        offsetZ: z * cluster.scaleZ,
        scaleX: scaleX * cluster.scaleX * (0.97 + random() * 0.06),
        scaleY: scaleY * cluster.scaleY * (0.97 + random() * 0.06),
        scaleZ: scaleZ * cluster.scaleZ * (0.97 + random() * 0.06),
        rotation: (random() - 0.5) * 0.08,
      });
    }
  }
  const cloudMeshes = createLayerMeshes(seaRoot, cloudGeometry, cloudMaterials, cloudLobes, 0);

  const stormRoot = new Group();
  stormRoot.name = 'storm-cloud-bank';
  root.add(stormRoot);
  const stormGeometry = new SphereGeometry(1, 16, 10);
  const stormMaterials = [
    createMaterial('#2f3b43'),
    createMaterial('#4b5960'),
    createMaterial('#6d797c'),
  ];
  const stormClusters: CloudCluster[] = [];
  const stormLobes: CloudLobe[][] = [[], [], []];
  const stormLayout = [
    [-0.68, -0.25, 0.04, 0.74, 0.3, 0.72, 0],
    [0.68, -0.23, -0.04, 0.76, 0.31, 0.74, 0],
    [0, -0.28, 0.16, 0.98, 0.32, 0.8, 0],
    [-0.42, 0.08, 0.02, 0.68, 0.5, 0.65, 1],
    [0.4, 0.1, -0.03, 0.7, 0.52, 0.64, 1],
    [0, 0.26, 0.04, 0.76, 0.57, 0.68, 1],
    [-0.22, 0.5, -0.06, 0.46, 0.38, 0.44, 2],
    [0.24, 0.48, 0, 0.44, 0.36, 0.42, 2],
  ] as const;
  const stormSlots = [0, 5, 2, 8, 4, 1, 6, 3, 9, 7] as const;
  for (let clusterIndex = 0; clusterIndex < stormSlots.length; clusterIndex += 1) {
    const slot = stormSlots[clusterIndex] ?? clusterIndex;
    const angle = 0.24 + (slot / stormSlots.length) * Math.PI * 2;
    const radius = 21.5 + Math.sin(slot * 1.7) * 0.65;
    const cluster: CloudCluster = {
      x: Math.cos(angle) * radius,
      y: 7.2 + Math.sin(slot * 1.23) * 0.4,
      z: Math.sin(angle) * radius,
      scaleX: 2.64 + Math.cos(slot * 1.41) * 0.2,
      scaleY: 1.16 + Math.sin(slot * 1.17) * 0.08,
      scaleZ: 1.82 + Math.cos(slot * 1.08) * 0.14,
      yaw: angle + Math.PI / 2,
      phase: clusterIndex * 0.68,
    };
    stormClusters.push(cluster);
    for (const [x, y, z, scaleX, scaleY, scaleZ, layer] of stormLayout) {
      stormLobes[layer].push({
        clusterIndex,
        offsetX: x * cluster.scaleX,
        offsetY: y * cluster.scaleY,
        offsetZ: z * cluster.scaleZ,
        scaleX: scaleX * cluster.scaleX * (0.98 + random() * 0.04),
        scaleY: scaleY * cluster.scaleY * (0.98 + random() * 0.04),
        scaleZ: scaleZ * cluster.scaleZ * (0.98 + random() * 0.04),
        rotation: (random() - 0.5) * 0.06,
      });
    }
  }
  const stormMeshes = createLayerMeshes(stormRoot, stormGeometry, stormMaterials, stormLobes, 4);

  const cirrusRoot = new Group();
  cirrusRoot.name = 'high-cirrus-layer';
  cirrusRoot.position.y = 6.4;
  root.add(cirrusRoot);
  const cirrusTexture = createRadialAlphaTexture();
  const cirrusMaterial = new MeshBasicMaterial({
    color: '#dce9e6',
    alphaMap: cirrusTexture,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: DoubleSide,
    fog: true,
  });
  const cirrusMeshes: Mesh[] = [];
  for (let index = 0; index < 14; index += 1) {
    const angle = 0.42 + (index / 14) * Math.PI * 2;
    const radius = 12.5 + (index % 3) * 2.4;
    const cirrus = new Mesh(new PlaneGeometry(5.8 + (index % 4) * 0.7, 0.72), cirrusMaterial);
    cirrus.position.set(
      Math.cos(angle) * radius,
      Math.sin(index * 1.7) * 1.2,
      Math.sin(angle) * radius,
    );
    cirrus.rotation.set(-Math.PI / 2, 0, angle + Math.PI / 2 + Math.sin(index) * 0.18);
    cirrus.scale.y = 0.72 + (index % 3) * 0.12;
    cirrus.renderOrder = -1;
    cirrusRoot.add(cirrus);
    cirrusMeshes.push(cirrus);
  }

  let visibleCount = Math.max(14, Math.round(profile.cloudPuffs * 0.68));
  let visibleStormCount = Math.max(5, Math.ceil(profile.cloudPuffs * 0.16));
  let visibleCirrusCount = cirrusMeshes.length;
  const setQuality = (nextProfile: QualityProfile) => {
    visibleCount = Math.min(
      cloudClusters.length,
      Math.max(14, Math.round(nextProfile.cloudPuffs * 0.68)),
    );
    visibleStormCount = Math.min(
      stormClusters.length,
      Math.max(5, Math.ceil(nextProfile.cloudPuffs * 0.16)),
    );
    setVisibleClusterCount(cloudMeshes, cloudLobes, visibleCount);
    setVisibleClusterCount(stormMeshes, stormLobes, visibleStormCount);
    visibleCirrusCount =
      nextProfile.dprCap > 1.5 ? cirrusMeshes.length : nextProfile.dprCap > 1 ? 9 : 4;
    for (let index = 0; index < cirrusMeshes.length; index += 1) {
      const cirrus = cirrusMeshes[index];
      if (cirrus) cirrus.visible = index < visibleCirrusCount;
    }
  };
  setQuality(profile);

  const cloudColor = new Color();
  const cloudHighlight = new Color('#dce8e5');
  const stormColor = new Color();
  const stormShadow = new Color('#26343c');
  return {
    root,
    setQuality,
    getVisibleCount: () => visibleCount + visibleStormCount + visibleCirrusCount,
    update(signals, elapsed, delta) {
      cloudColor.setRGB(...signals.fogColor).lerp(cloudHighlight, 0.2 + signals.daylight * 0.34);
      const layerOpacity = [0.34, 0.44, 0.3] as const;
      for (let index = 0; index < cloudMaterials.length; index += 1) {
        const material = cloudMaterials[index];
        if (!material) continue;
        material.color.copy(cloudColor).offsetHSL(0, 0, (index - 1) * 0.028);
        material.opacity = (layerOpacity[index] ?? 0.34) * (0.84 + signals.cloudCover * 0.2);
      }
      seaRoot.rotation.y += signals.cloudSpeed * delta * (0.16 + signals.windStrength * 0.08);
      updateLayerMatrices(cloudMeshes, cloudLobes, cloudClusters, elapsed, signals.motionScale);
      cirrusMaterial.color.copy(cloudHighlight).lerp(cloudColor, 0.24 + signals.cloudCover * 0.22);
      cirrusMaterial.opacity =
        (0.1 + signals.cloudCover * 0.16) * (1 - signals.rain * 0.28) * signals.daylight;
      cirrusRoot.rotation.y += delta * (0.004 + signals.windStrength * 0.012) * signals.motionScale;
      cirrusRoot.position.x = Math.sin(elapsed * 0.012) * 1.2 * signals.motionScale;

      stormColor
        .setRGB(...signals.fogColor)
        .lerp(stormShadow, 0.52 + signals.rain * 0.3 + signals.snow * 0.08);
      const stormOpacity =
        (Math.max(0, signals.cloudCover - 0.22) * 0.38 + signals.rain * 0.24 + signals.snow * 0.1) *
        (0.36 + signals.stormFront * 0.64);
      for (let index = 0; index < stormMaterials.length; index += 1) {
        const material = stormMaterials[index];
        if (!material) continue;
        material.color.copy(stormColor).offsetHSL(0, 0, index * 0.045);
        material.opacity = stormOpacity * (0.96 - index * 0.2);
      }
      stormRoot.visible = stormOpacity > 0.015;
      stormRoot.position.x = 18 - signals.stormFront * 21;
      stormRoot.position.z = -12 + signals.stormFront * 9;
      stormRoot.scale.setScalar(0.78 + signals.stormFront * 0.22);
      stormRoot.rotation.y += delta * (0.018 + signals.windStrength * 0.045) * signals.motionScale;
      updateLayerMatrices(
        stormMeshes,
        stormLobes,
        stormClusters,
        elapsed * 1.18,
        signals.motionScale,
      );
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
