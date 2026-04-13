import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHARACTER_MODEL_URLS } from './characterAssets';
import { CLIMBER_CHARACTER_OPTIONS } from './characterRig';
import { CLIMBER_LEVELS } from './climberLevels';
import { createClimberPrototype } from './createClimberPrototype';
import { readSetPieceLocalBounds, resolveSetPieceColliderData } from './prototype/setPieceRuntime';
import { getAllClimberSetPieceAssets, getClimberSetPieceAsset } from './setpieceCatalog';
import type {
  ClimberCharacterId,
  ClimberCharacterRuntimeStatus,
  ClimberPrototypeController,
  ClimberRunStats,
  ClimberSetPieceAssetId,
  ClimberSetPieceDefinition,
} from './types';

const CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: '980px',
  margin: '0 auto',
  padding: '28px 18px 56px',
  display: 'grid',
  gap: '18px',
};

const PANEL_STYLE: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--theme-shell-border) 82%, transparent)',
  borderRadius: 26,
  background:
    'linear-gradient(150deg, rgba(255,255,255,0.96), color-mix(in srgb, var(--theme-primary-soft) 78%, white) 58%, rgba(255,255,255,0.94) 100%)',
  boxShadow: '0 18px 48px rgba(var(--theme-primary-rgb), 0.12)',
};

const GAME_VIEWPORT_STYLE: CSSProperties = {
  width: '100%',
  height: 'min(62vh, 560px)',
  minHeight: 380,
  borderRadius: 22,
  overflow: 'hidden',
  border: '1px solid color-mix(in srgb, var(--theme-shell-border) 78%, transparent)',
  background: '#f8fbff',
};

const TAG_STYLE: CSSProperties = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--theme-shell-border) 76%, white)',
  background: 'rgba(255,255,255,0.84)',
  padding: '6px 10px',
  color: '#334155',
  fontSize: 12,
  lineHeight: 1.2,
};

const GAME_SHELL_STYLE: CSSProperties = {
  position: 'relative',
  borderRadius: 22,
  overflow: 'hidden',
};

const HUD_LAYER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  padding: 14,
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: 10,
  pointerEvents: 'none',
};

const HUD_TOP_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
};

const HUD_PANEL_STYLE: CSSProperties = {
  display: 'grid',
  gap: 6,
  maxWidth: 360,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.24)',
  background: 'linear-gradient(140deg, rgba(15,23,42,0.58), rgba(15,23,42,0.38))',
  color: '#e2e8f0',
  boxShadow: '0 8px 24px rgba(2,6,23,0.25)',
  backdropFilter: 'blur(3px)',
};

const HUD_META_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  fontSize: 12,
  lineHeight: 1.25,
  color: '#cbd5e1',
};

const HUD_PROGRESS_TRACK_STYLE: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: 'rgba(148,163,184,0.32)',
  overflow: 'hidden',
};

const HUD_BOTTOM_ROW_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
};

const GOAL_BANNER_STYLE: CSSProperties = {
  alignSelf: 'center',
  justifySelf: 'center',
  pointerEvents: 'none',
  minWidth: 280,
  maxWidth: 'min(88%, 520px)',
  padding: '14px 18px',
  borderRadius: 16,
  border: '1px solid rgba(251,191,36,0.45)',
  background:
    'linear-gradient(160deg, rgba(15,23,42,0.76), rgba(30,41,59,0.62), rgba(15,23,42,0.76))',
  boxShadow: '0 12px 38px rgba(15,23,42,0.35)',
  textAlign: 'center',
  color: '#f8fafc',
};

const ENTER_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background:
    'linear-gradient(160deg, rgba(15,23,42,0.58), rgba(15,23,42,0.44), rgba(15,23,42,0.56))',
  color: '#fff',
  textAlign: 'center',
  backdropFilter: 'blur(2px)',
  padding: 16,
};

const PAUSE_MENU_PANEL_STYLE: CSSProperties = {
  width: 'min(92%, 560px)',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.24)',
  background: 'linear-gradient(160deg, rgba(15,23,42,0.86), rgba(30,41,59,0.78))',
  boxShadow: '0 20px 56px rgba(2,6,23,0.48)',
  padding: '18px 16px',
  display: 'grid',
  gap: 12,
  pointerEvents: 'auto',
};

const MENU_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const MENU_LABEL_STYLE: CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  color: '#cbd5e1',
  marginBottom: 6,
};

const MENU_SELECT_STYLE: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.55)',
  background: 'rgba(15,23,42,0.45)',
  color: '#f8fafc',
  padding: '10px 12px',
  fontSize: 13,
};

const MENU_BUTTON_PRIMARY_STYLE: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-primary-deep))',
};

const MENU_BUTTON_SECONDARY_STYLE: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.62)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#e2e8f0',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'rgba(15,23,42,0.42)',
};

const MODEL_EXHIBITION_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  background: 'linear-gradient(160deg, rgba(2,6,23,0.52), rgba(2,6,23,0.42), rgba(2,6,23,0.56))',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
  pointerEvents: 'auto',
};

const MODEL_EXHIBITION_PANEL_STYLE: CSSProperties = {
  width: 'min(96%, 1120px)',
  maxHeight: '92%',
  overflow: 'hidden',
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.36)',
  background: 'linear-gradient(160deg, rgba(15,23,42,0.92), rgba(15,23,42,0.88))',
  boxShadow: '0 30px 80px rgba(2,6,23,0.6)',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  gap: 12,
  padding: 14,
};

const MODEL_EXHIBITION_CONTENT_STYLE: CSSProperties = {
  display: 'grid',
  gap: 14,
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  overflow: 'hidden',
};

const MODEL_SHOWCASE_STAGE_STYLE: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(2,6,23,0.46)',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'minmax(260px, 1fr) auto',
};

const MODEL_PREVIEW_CANVAS_WRAP_STYLE: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  minHeight: 260,
  background:
    'radial-gradient(circle at 28% 18%, rgba(59,130,246,0.35), rgba(15,23,42,0.9) 68%), linear-gradient(180deg, rgba(15,23,42,0.82), rgba(2,6,23,0.92))',
};

const MODEL_PREVIEW_CANVAS_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
};

const MODEL_PREVIEW_STATUS_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  color: '#cbd5e1',
  fontSize: 11,
  letterSpacing: 0.2,
  background: 'rgba(2,6,23,0.24)',
};

const MODEL_SHOWCASE_META_STYLE: CSSProperties = {
  padding: '8px 10px 10px',
  display: 'grid',
  gap: 6,
};

const MODEL_EXHIBITION_LIST_STYLE: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(2,6,23,0.38)',
  overflowY: 'auto',
  padding: 10,
  display: 'grid',
  gap: 8,
};

const MODEL_EXHIBITION_ITEM_BUTTON_STYLE: CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.26)',
  background: 'rgba(15,23,42,0.44)',
  padding: '8px 9px',
  display: 'grid',
  gap: 4,
  textAlign: 'left',
  cursor: 'pointer',
};

const MODEL_META_TEXT_STYLE: CSSProperties = {
  fontSize: 11,
  color: '#cbd5e1',
  lineHeight: 1.5,
  wordBreak: 'break-word',
};

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatHeight(value: number): string {
  return `${Math.max(0, value).toFixed(1)} m`;
}

function formatTuple(value: [number, number, number]): string {
  return value.map((item) => item.toFixed(2)).join(' x ');
}

function resolveAssetFileName(url: string): string {
  const clean = url.split('?')[0] ?? '';
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? clean;
}

function disposeMaterial(material: Material | Material[] | undefined): void {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function disposeObjectResources(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    disposeMaterial(mesh.material as Material | Material[] | undefined);
  });
}

function createRampPreviewGeometry(width: number, height: number, depth: number): BoxGeometry {
  const geometry = new BoxGeometry(width, height, depth, 1, 1, 1);
  const position = geometry.attributes.position;
  const halfDepth = depth * 0.5;
  const topFlatDepth = Math.max(0.001, Math.min(depth * 0.7, depth * 0.36));
  const topFlatEndZ = -halfDepth + topFlatDepth;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const z = position.getZ(index);
    if (y > 0 && z > topFlatEndZ) {
      const ratio = (z - topFlatEndZ) / Math.max(0.001, halfDepth - topFlatEndZ);
      position.setY(index, height * 0.5 - ratio * height);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

interface ModelPreviewColliderConfig {
  assetId: ClimberSetPieceAssetId;
  definition?: ClimberSetPieceDefinition;
}

interface ModelShowcaseViewerProps {
  modelUrls: string[];
  modelName: string;
  collider?: ModelPreviewColliderConfig | null;
}

function ModelShowcaseViewer(props: ModelShowcaseViewerProps) {
  const { modelUrls, modelName, collider = null } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [statusText, setStatusText] = useState('模型加载中...');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setStatusText('模型加载中...');
    if (!modelUrls.length) {
      setStatusText('暂无模型资源');
      return;
    }

    let disposed = false;
    let rafId = 0;
    let loadedModelRoot: Group | null = null;
    let loadedPreviewRoot: Group | null = null;
    const localResourcesToDispose: Array<{
      geometry?: { dispose: () => void };
      material?: { dispose: () => void };
    }> = [];

    const scene = new Scene();
    scene.background = new Color('#0f172a');
    const camera = new PerspectiveCamera(45, 1, 0.1, 120);
    camera.position.set(0, 1, 3.2);
    scene.add(new AmbientLight('#ffffff', 0.65));
    scene.add(new HemisphereLight('#c7e5ff', '#0f172a', 0.56));
    const keyLight = new DirectionalLight('#fff6d5', 1.05);
    keyLight.position.set(4.8, 6.2, 3.2);
    scene.add(keyLight);

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const updateSize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(mount);
    updateSize();

    const loader = new GLTFLoader();

    const animate = () => {
      if (disposed) return;
      if (loadedPreviewRoot) {
        loadedPreviewRoot.rotation.y += 0.005;
      }
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    const loadWithFallback = async () => {
      let root: Group | null = null;
      const previewDefinition: ClimberSetPieceDefinition | null = collider
        ? {
            id: collider.definition?.id ?? '__preview__',
            assetId: collider.assetId,
            position: [0, 0, 0],
            solid: true,
            scale: collider.definition?.scale,
            rotation: collider.definition?.rotation,
            colliderInset: collider.definition?.colliderInset,
            colliderSize: collider.definition?.colliderSize,
            colliderOffset: collider.definition?.colliderOffset,
            colliderShape: collider.definition?.colliderShape,
            colliderLocalRotation: collider.definition?.colliderLocalRotation,
          }
        : null;
      const previewAsset = collider ? getClimberSetPieceAsset(collider.assetId) : null;
      const useProceduralRampVisual =
        (previewDefinition?.colliderShape ?? previewAsset?.colliderShape ?? 'box') === 'ramp';

      if (useProceduralRampVisual) {
        const rampSize = previewDefinition?.colliderSize ??
          previewAsset?.colliderSize ?? [2, 1, 1.4];
        const rampGeometry = createRampPreviewGeometry(rampSize[0], rampSize[1], rampSize[2]);
        rampGeometry.translate(0, rampSize[1] * 0.5, 0);
        const rampMaterial = new MeshStandardMaterial({
          color: '#b9a06c',
          roughness: 0.7,
          metalness: 0.06,
        });
        const rampMesh = new Mesh(rampGeometry, rampMaterial);
        rampMesh.castShadow = true;
        rampMesh.receiveShadow = true;
        const rampRoot = new Group();
        rampRoot.add(rampMesh);
        localResourcesToDispose.push({ geometry: rampGeometry }, { material: rampMaterial });
        root = rampRoot;
      } else {
        for (let index = 0; index < modelUrls.length; index += 1) {
          try {
            const gltf = await loader.loadAsync(modelUrls[index]);
            if (disposed) {
              disposeObjectResources(gltf.scene);
              return;
            }
            root = gltf.scene as Group;
            break;
          } catch {}
        }
      }

      if (!root || disposed) {
        setStatusText(`${modelName} 加载失败`);
        renderer.render(scene, camera);
        return;
      }

      const localBounds = collider ? readSetPieceLocalBounds(root) : null;
      const instanceScaleTuple = previewDefinition?.scale ?? [1, 1, 1];
      const instanceRotationTuple = previewDefinition?.rotation ?? [0, 0, 0];
      root.scale.set(instanceScaleTuple[0], instanceScaleTuple[1], instanceScaleTuple[2]);
      root.rotation.set(
        instanceRotationTuple[0],
        instanceRotationTuple[1],
        instanceRotationTuple[2],
      );

      root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        mesh.frustumCulled = false;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          const sidedMaterial = material as Material & {
            side?: number;
            transparent?: boolean;
            alphaTest?: number;
            depthWrite?: boolean;
            depthTest?: boolean;
          };
          sidedMaterial.side = DoubleSide;
          sidedMaterial.depthTest = true;
          if (sidedMaterial.transparent) {
            sidedMaterial.alphaTest = Math.max(0.08, sidedMaterial.alphaTest ?? 0);
            sidedMaterial.depthWrite = false;
          }
        });
      });

      const previewRoot = new Group();
      previewRoot.add(root);

      if (collider && previewDefinition) {
        const resolvedCollider = resolveSetPieceColliderData(previewDefinition, localBounds);
        const [colliderCenterX, colliderCenterY, colliderCenterZ] = resolvedCollider.center;
        const [colliderSizeX, colliderSizeY, colliderSizeZ] = resolvedCollider.size;
        const [colliderRotationX, colliderRotationY, colliderRotationZ, colliderRotationW] =
          resolvedCollider.rotation;
        const colliderGeometry =
          resolvedCollider.shape === 'ramp'
            ? createRampPreviewGeometry(colliderSizeX, colliderSizeY, colliderSizeZ)
            : new BoxGeometry(colliderSizeX, colliderSizeY, colliderSizeZ);
        const colliderMaterial = new MeshBasicMaterial({
          color: '#22d3ee',
          transparent: true,
          opacity: 0.34,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const colliderMesh = new Mesh(colliderGeometry, colliderMaterial);
        colliderMesh.position.set(colliderCenterX, colliderCenterY, colliderCenterZ);
        colliderMesh.quaternion.set(
          colliderRotationX,
          colliderRotationY,
          colliderRotationZ,
          colliderRotationW,
        );
        colliderMesh.renderOrder = 40;
        previewRoot.add(colliderMesh);

        const edgeGeometry = new EdgesGeometry(colliderGeometry);
        const edgeMaterial = new LineBasicMaterial({
          color: '#67e8f9',
          transparent: true,
          opacity: 1,
          depthTest: false,
          depthWrite: false,
        });
        const edgeLines = new LineSegments(edgeGeometry, edgeMaterial);
        edgeLines.position.copy(colliderMesh.position);
        edgeLines.quaternion.copy(colliderMesh.quaternion);
        edgeLines.renderOrder = 41;
        previewRoot.add(edgeLines);

        localResourcesToDispose.push(
          { geometry: colliderGeometry },
          { material: colliderMaterial },
          { geometry: edgeGeometry },
          { material: edgeMaterial },
        );
      }

      const bounds = new Box3().setFromObject(previewRoot);
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      const maxSide = Math.max(0.001, size.x, size.y, size.z);
      const scale = 1.55 / maxSide;
      previewRoot.scale.setScalar(scale);
      previewRoot.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      const framedBounds = new Box3().setFromObject(previewRoot);
      const sphere = framedBounds.getBoundingSphere(new Sphere());
      const radius = Math.max(0.2, sphere.radius);
      const halfFov = (camera.fov * Math.PI) / 180 / 2;
      const distance = (radius / Math.sin(halfFov)) * 1.12;
      camera.position.set(distance * 0.9, distance * 0.58, distance * 1.05);
      camera.near = Math.max(0.08, distance - radius * 1.9);
      camera.far = distance + radius * 2.8;
      camera.updateProjectionMatrix();
      camera.lookAt(sphere.center);

      scene.add(previewRoot);
      loadedModelRoot = root;
      loadedPreviewRoot = previewRoot;
      setStatusText('');
      animate();
    };

    void loadWithFallback();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      if (loadedPreviewRoot) {
        scene.remove(loadedPreviewRoot);
      }
      if (loadedModelRoot) {
        disposeObjectResources(loadedModelRoot);
      }
      localResourcesToDispose.forEach((item) => item.geometry?.dispose());
      localResourcesToDispose.forEach((item) => item.material?.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [collider, modelName, modelUrls]);

  return (
    <div style={MODEL_SHOWCASE_STAGE_STYLE}>
      <div style={MODEL_PREVIEW_CANVAS_WRAP_STYLE}>
        <div ref={mountRef} style={MODEL_PREVIEW_CANVAS_STYLE} />
        {statusText ? <div style={MODEL_PREVIEW_STATUS_STYLE}>{statusText}</div> : null}
      </div>
      <div style={MODEL_SHOWCASE_META_STYLE}>
        <strong style={{ fontSize: 13, color: '#f8fafc', lineHeight: 1.2 }}>{modelName}</strong>
        <span style={{ fontSize: 11, color: '#cbd5e1' }}>
          自动旋转预览，方便快速筛掉效果不佳的模型。
        </span>
        {collider ? (
          <span style={{ fontSize: 11, color: '#67e8f9' }}>青色线框与半透明区域 = 碰撞体</span>
        ) : null}
      </div>
    </div>
  );
}

function resolveCharacterRuntimeLabel(status: ClimberCharacterRuntimeStatus): string {
  switch (status) {
    case 'model-loading':
      return '模型加载中';
    case 'model-ready':
      return 'GLB 动画已就绪';
    case 'model-ready-static':
      return 'GLB 已加载(无动画)';
    case 'model-no-rig':
      return 'GLB 无骨骼(分段动画)';
    case 'model-fallback':
      return '占位角色(模型缺失)';
    case 'procedural':
    default:
      return '程序角色';
  }
}

export interface ClimberArcadeExperienceProps {
  title?: string;
}

export function ClimberArcadeExperience(props: ClimberArcadeExperienceProps) {
  const { title = 'Climber Playground' } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ClimberPrototypeController | null>(null);
  const activeLevel = CLIMBER_LEVELS[0];
  const [activeCharacterId, setActiveCharacterId] = useState<ClimberCharacterId>('peach');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [debugCollidersVisible, setDebugCollidersVisible] = useState(false);
  const [modelExhibitionVisible, setModelExhibitionVisible] = useState(false);
  const [activeExhibitionItemId, setActiveExhibitionItemId] = useState<string | null>(null);
  const [debugColliderFocusAssetId, setDebugColliderFocusAssetId] =
    useState<ClimberSetPieceAssetId | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [hasEnteredSession, setHasEnteredSession] = useState(false);
  const [characterStatus, setCharacterStatus] =
    useState<ClimberCharacterRuntimeStatus>('procedural');

  const [stats, setStats] = useState<ClimberRunStats>({
    elapsedMs: 0,
    currentHeight: 0,
    bestHeight: 0,
    progress: 0,
    goalReached: false,
    goalReachedAtMs: null,
  });
  useEffect(() => {
    if (!mountRef.current || !activeLevel) return;
    setCharacterStatus(activeCharacterId === 'orb' ? 'procedural' : 'model-loading');
    const controller = createClimberPrototype({
      mount: mountRef.current,
      level: activeLevel,
      characterId: activeCharacterId,
      audioEnabled,
      debugCollidersVisible,
      debugColliderFocusAssetId,
      onStats: (next) => setStats(next),
      onCharacterStatusChange: (nextStatus) => setCharacterStatus(nextStatus),
      onPointerLockChange: (locked) => {
        setPointerLocked(locked);
        if (locked) {
          setHasEnteredSession(true);
        }
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [activeCharacterId]);

  useEffect(() => {
    controllerRef.current?.setAudioEnabled(audioEnabled);
  }, [audioEnabled]);

  useEffect(() => {
    controllerRef.current?.setDebugCollidersVisible(debugCollidersVisible);
  }, [debugCollidersVisible]);

  useEffect(() => {
    controllerRef.current?.setDebugColliderFocusAssetId(debugColliderFocusAssetId);
  }, [debugColliderFocusAssetId]);

  useEffect(() => {
    if (pointerLocked) {
      setModelExhibitionVisible(false);
    }
  }, [pointerLocked]);

  const progressPercent = useMemo(() => Math.round((stats.progress || 0) * 100), [stats.progress]);
  const progressLabel = useMemo(
    () => `${progressPercent.toString().padStart(2, '0')}%`,
    [progressPercent],
  );
  const activeCharacter = useMemo(
    () => CLIMBER_CHARACTER_OPTIONS.find((item) => item.id === activeCharacterId),
    [activeCharacterId],
  );
  const goalTimeLabel = useMemo(
    () => (stats.goalReachedAtMs == null ? '--:--' : formatTime(stats.goalReachedAtMs)),
    [stats.goalReachedAtMs],
  );
  const setPieceAssets = useMemo(() => getAllClimberSetPieceAssets(), []);
  const setPieceUsageMap = useMemo(() => {
    const usage = new Map<ClimberSetPieceAssetId, number>();
    (activeLevel?.setPieces ?? []).forEach((item) => {
      usage.set(item.assetId, (usage.get(item.assetId) ?? 0) + 1);
    });
    return usage;
  }, [activeLevel]);
  const setPieceRepresentativeMap = useMemo(() => {
    const map = new Map<ClimberSetPieceAssetId, ClimberSetPieceDefinition>();
    (activeLevel?.setPieces ?? []).forEach((item) => {
      if (!map.has(item.assetId)) {
        map.set(item.assetId, item);
      }
    });
    return map;
  }, [activeLevel]);
  const characterModelEntries = useMemo(
    () =>
      CLIMBER_CHARACTER_OPTIONS.map((character) => ({
        ...character,
        modelUrls: character.id === 'orb' ? [] : CHARACTER_MODEL_URLS[character.id],
      })),
    [],
  );
  const exhibitionItems = useMemo(() => {
    const characterItems = characterModelEntries.map((character) => ({
      id: `character:${character.id}`,
      kind: 'character' as const,
      name: `角色 · ${character.name}`,
      modelUrls: character.modelUrls,
      meta: `模型文件: ${character.modelUrls.map((url) => resolveAssetFileName(url)).join(' / ')}`,
    }));

    const setPieceItems = setPieceAssets.map((asset) => {
      const representative = setPieceRepresentativeMap.get(asset.id);
      return {
        id: `setpiece:${asset.id}`,
        kind: 'setpiece' as const,
        name: asset.name,
        modelUrls: [asset.url],
        assetId: asset.id,
        collider: {
          assetId: asset.id,
          definition: representative,
        },
        meta: `使用次数: ${setPieceUsageMap.get(asset.id) ?? 0} | 碰撞体: ${
          asset.colliderShape === 'ramp' ? 'Ramp' : 'Box'
        } | 尺寸 ${formatTuple(asset.colliderSize)} | 偏移 ${formatTuple(asset.colliderOffset)}`,
      };
    });

    return [...characterItems, ...setPieceItems];
  }, [characterModelEntries, setPieceAssets, setPieceRepresentativeMap, setPieceUsageMap]);
  const activeExhibitionItem = useMemo(
    () => exhibitionItems.find((item) => item.id === activeExhibitionItemId) ?? exhibitionItems[0],
    [activeExhibitionItemId, exhibitionItems],
  );
  useEffect(() => {
    if (!exhibitionItems.length) {
      setActiveExhibitionItemId(null);
      return;
    }
    if (
      !activeExhibitionItemId ||
      !exhibitionItems.some((item) => item.id === activeExhibitionItemId)
    ) {
      setActiveExhibitionItemId(exhibitionItems[0].id);
    }
  }, [activeExhibitionItemId, exhibitionItems]);
  useEffect(() => {
    if (debugColliderFocusAssetId == null) return;
    const focusExistsInLevel = (activeLevel?.setPieces ?? []).some(
      (piece) => piece.assetId === debugColliderFocusAssetId,
    );
    if (!focusExistsInLevel) {
      setDebugColliderFocusAssetId(null);
    }
  }, [activeLevel, debugColliderFocusAssetId]);
  const activeFocusSetPieceName = useMemo(
    () =>
      debugColliderFocusAssetId == null
        ? null
        : (setPieceAssets.find((asset) => asset.id === debugColliderFocusAssetId)?.name ??
          debugColliderFocusAssetId),
    [debugColliderFocusAssetId, setPieceAssets],
  );
  const activeLevelSetPieceCount = useMemo(
    () => (activeLevel?.setPieces ?? []).length,
    [activeLevel],
  );
  const currentMapName = activeLevel ? activeLevel.name : '--';
  const currentCharacterName = activeCharacter ? activeCharacter.name : '--';

  return (
    <section style={CONTAINER_STYLE}>
      <div style={{ ...PANEL_STYLE, padding: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <span style={TAG_STYLE}>3D Prototype</span>
          <span style={TAG_STYLE}>Engine: Three.js</span>
          <span style={TAG_STYLE}>Mode: Single Player Jump</span>
          <span style={TAG_STYLE}>{pointerLocked ? '控制状态: 游戏中' : '控制状态: 已暂停'}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(1.5rem, 2.8vw, 2rem)',
                color: '#0f172a',
              }}
            >
              {title}
            </h2>
            <p style={{ margin: '8px 0 0', color: '#475569', lineHeight: 1.75, fontSize: 14 }}>
              这是单张超大地图版本，目标是构建“高空密集悬浮板块 +
              高难登顶”的核心体验。后续复杂玩法继续在 `packages/climber-game` 迭代，不污染
              `apps/web` 业务入口代码。
            </p>
            {activeLevel ? (
              <p style={{ margin: '6px 0 0', color: '#334155', fontSize: 13, lineHeight: 1.75 }}>
                当前地图：{activeLevel.name}。{activeLevel.description}
              </p>
            ) : null}
            {activeCharacter ? (
              <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 12, lineHeight: 1.65 }}>
                当前角色：{activeCharacter.name}。{activeCharacter.description}
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={TAG_STYLE}>当前地图: {currentMapName}</span>
            <span style={TAG_STYLE}>当前角色: {currentCharacterName}</span>
            <span style={TAG_STYLE}>声音: {audioEnabled ? '开' : '关'}</span>
            <span style={TAG_STYLE}>碰撞体: {debugCollidersVisible ? '显示' : '隐藏'}</span>
            <span style={TAG_STYLE}>
              碰撞体筛选: {activeFocusSetPieceName == null ? '全部模型' : activeFocusSetPieceName}
            </span>
            <span style={TAG_STYLE}>菜单: Esc</span>
          </div>
        </div>
      </div>

      <div style={{ ...PANEL_STYLE, padding: 12 }}>
        <div style={GAME_SHELL_STYLE}>
          <div ref={mountRef} style={GAME_VIEWPORT_STYLE} />
          <div style={HUD_LAYER_STYLE}>
            <div style={HUD_TOP_ROW_STYLE}>
              <div style={HUD_PANEL_STYLE}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.2 }}>
                  高度 {formatHeight(stats.currentHeight)}
                </div>
                <div style={HUD_META_ROW_STYLE}>
                  <span>最高 {formatHeight(stats.bestHeight)}</span>
                  <span>用时 {formatTime(stats.elapsedMs)}</span>
                </div>
              </div>
              <div style={{ ...HUD_PANEL_STYLE, minWidth: 208 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <strong style={{ fontSize: 13, color: '#e2e8f0' }}>进度</strong>
                  <span style={{ fontSize: 13, color: '#f8fafc' }}>{progressLabel}</span>
                </div>
                <div style={HUD_PROGRESS_TRACK_STYLE}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPercent}%`,
                      background:
                        'linear-gradient(90deg, #38bdf8, color-mix(in srgb, var(--theme-primary) 78%, #facc15))',
                      transition: 'width 180ms ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  角色状态: {resolveCharacterRuntimeLabel(characterStatus)}
                </div>
              </div>
            </div>
            {stats.goalReached ? (
              <div style={GOAL_BANNER_STYLE}>
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: '#fcd34d', letterSpacing: 0.2 }}
                >
                  登顶成功
                </div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#e2e8f0' }}>
                  本次通关用时 {goalTimeLabel}，按“重新开始”可立刻再挑战。
                </div>
              </div>
            ) : (
              <div />
            )}
            <div style={HUD_BOTTOM_ROW_STYLE}>
              <div style={{ ...HUD_PANEL_STYLE, maxWidth: 540 }}>
                <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>按键说明</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: '#cbd5e1' }}>
                  W A S D / 方向键 移动 | 空格 跳跃 | Shift 冲刺 | 鼠标 视角 | 滚轮 缩放 | Esc 暂停
                </div>
              </div>
              <div style={{ ...HUD_PANEL_STYLE, maxWidth: 300 }}>
                <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>
                  {stats.goalReached ? '已登顶' : pointerLocked ? '游戏进行中' : '已暂停'}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.6, color: '#cbd5e1' }}>
                  {stats.goalReached
                    ? '终点已触发特效与结算，你可以继续探索或重新开始。'
                    : '底部地面可站立，场景四周已加入实体边界墙。'}
                </div>
              </div>
            </div>
          </div>
          {!pointerLocked ? (
            <div style={ENTER_OVERLAY_STYLE}>
              <div style={PAUSE_MENU_PANEL_STYLE}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
                  {hasEnteredSession ? '暂停菜单' : '进入游戏'}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#cbd5e1', textAlign: 'left' }}>
                  所有游戏操作都在这里完成：切换角色、重新开始与设置。点击继续后进入第三人称操作。
                </div>

                <div style={MENU_ROW_STYLE}>
                  <div>
                    <div style={MENU_LABEL_STYLE}>角色</div>
                    <select
                      id="climber-menu-character-select"
                      value={activeCharacterId}
                      style={MENU_SELECT_STYLE}
                      onChange={(event) =>
                        setActiveCharacterId(event.target.value as ClimberCharacterId)
                      }
                    >
                      {CLIMBER_CHARACTER_OPTIONS.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={MENU_LABEL_STYLE}>地图</div>
                    <div
                      style={{
                        ...MENU_SELECT_STYLE,
                        minHeight: 41,
                        display: 'flex',
                        alignItems: 'center',
                        color: '#e2e8f0',
                        fontWeight: 600,
                      }}
                    >
                      {activeLevel?.name ?? '单图模式'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(102px, 1fr))',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    style={MENU_BUTTON_PRIMARY_STYLE}
                    onClick={() => controllerRef.current?.requestPointerLock()}
                  >
                    {hasEnteredSession ? '继续游戏' : '开始游戏'}
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => {
                      const controller = controllerRef.current;
                      if (!controller) return;
                      controller.reset();
                      controller.requestPointerLock();
                    }}
                  >
                    重新开始
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => setAudioEnabled((prev) => !prev)}
                  >
                    {audioEnabled ? '声音: 开' : '声音: 关'}
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => setDebugCollidersVisible((prev) => !prev)}
                  >
                    {debugCollidersVisible ? '碰撞体: 开' : '碰撞体: 关'}
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => {
                      setModelExhibitionVisible(true);
                      setDebugCollidersVisible(true);
                    }}
                  >
                    模型展览
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'left', lineHeight: 1.6 }}>
                  当前角色状态: {resolveCharacterRuntimeLabel(characterStatus)}；碰撞体调试:
                  {debugCollidersVisible ? ' 开启' : ' 关闭'}；模型筛选:
                  {activeFocusSetPieceName == null ? ' 全部' : ` ${activeFocusSetPieceName}`}。按
                  `Esc` 可随时回到此菜单。
                </div>
              </div>
              {modelExhibitionVisible ? (
                <div style={MODEL_EXHIBITION_OVERLAY_STYLE}>
                  <div style={MODEL_EXHIBITION_PANEL_STYLE}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 3, textAlign: 'left' }}>
                        <strong style={{ fontSize: 16, color: '#f8fafc' }}>模型展览</strong>
                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                          直接预览每个模型；点击“只看该模型碰撞体”才会联动游戏内筛选。
                        </span>
                      </div>
                      <button
                        type="button"
                        style={MENU_BUTTON_SECONDARY_STYLE}
                        onClick={() => setModelExhibitionVisible(false)}
                      >
                        关闭展览
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'left' }}>
                        当前地图实例数: {activeLevelSetPieceCount} | 角色模型:{' '}
                        {characterModelEntries.length} | 场景模型: {setPieceAssets.length} |
                        碰撞体筛选:
                        {activeFocusSetPieceName == null
                          ? ' 全部模型'
                          : ` ${activeFocusSetPieceName}`}
                      </div>
                      <button
                        type="button"
                        style={{
                          ...MENU_BUTTON_SECONDARY_STYLE,
                          padding: '8px 10px',
                          fontSize: 12,
                        }}
                        onClick={() => {
                          setDebugColliderFocusAssetId(null);
                          setDebugCollidersVisible(true);
                        }}
                      >
                        显示全部碰撞体
                      </button>
                    </div>

                    <div style={MODEL_EXHIBITION_CONTENT_STYLE}>
                      <div style={{ display: 'grid', gap: 10, minHeight: 0 }}>
                        {activeExhibitionItem ? (
                          <ModelShowcaseViewer
                            modelName={activeExhibitionItem.name}
                            modelUrls={activeExhibitionItem.modelUrls}
                            collider={
                              activeExhibitionItem.kind === 'setpiece'
                                ? activeExhibitionItem.collider
                                : null
                            }
                          />
                        ) : (
                          <div style={MODEL_SHOWCASE_STAGE_STYLE}>
                            <div
                              style={{
                                display: 'grid',
                                placeItems: 'center',
                                color: '#cbd5e1',
                                fontSize: 12,
                              }}
                            >
                              暂无模型数据
                            </div>
                          </div>
                        )}
                        <div style={MODEL_META_TEXT_STYLE}>
                          {activeExhibitionItem?.meta ?? '当前没有可展示的模型。'}
                        </div>
                        {activeExhibitionItem?.kind === 'setpiece' ? (
                          <button
                            type="button"
                            style={{
                              ...MENU_BUTTON_SECONDARY_STYLE,
                              padding: '8px 10px',
                              fontSize: 12,
                              justifySelf: 'start',
                              borderColor:
                                debugColliderFocusAssetId === activeExhibitionItem.assetId
                                  ? 'rgba(250,204,21,0.7)'
                                  : undefined,
                              color:
                                debugColliderFocusAssetId === activeExhibitionItem.assetId
                                  ? '#fde68a'
                                  : '#e2e8f0',
                            }}
                            onClick={() => {
                              const assetId = activeExhibitionItem.assetId ?? null;
                              setDebugColliderFocusAssetId((prev) =>
                                prev === assetId ? null : assetId,
                              );
                              setDebugCollidersVisible(true);
                            }}
                          >
                            {debugColliderFocusAssetId === activeExhibitionItem.assetId
                              ? '取消单模型碰撞体'
                              : '只看该模型碰撞体'}
                          </button>
                        ) : null}
                      </div>

                      <div style={MODEL_EXHIBITION_LIST_STYLE}>
                        {exhibitionItems.map((item) => {
                          const selected = item.id === activeExhibitionItem?.id;
                          const isSetPiece = item.kind === 'setpiece';
                          const focusSelected =
                            isSetPiece && item.assetId === debugColliderFocusAssetId;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              style={{
                                ...MODEL_EXHIBITION_ITEM_BUTTON_STYLE,
                                borderColor: selected
                                  ? 'rgba(125,211,252,0.58)'
                                  : 'rgba(148,163,184,0.26)',
                                background: selected
                                  ? 'rgba(30,41,59,0.75)'
                                  : 'rgba(15,23,42,0.44)',
                              }}
                              onClick={() => {
                                setActiveExhibitionItemId(item.id);
                              }}
                            >
                              <strong style={{ fontSize: 12, color: '#f8fafc' }}>
                                {item.name}
                              </strong>
                              <span style={MODEL_META_TEXT_STYLE}>{item.meta}</span>
                              {focusSelected ? (
                                <span style={{ fontSize: 11, color: '#fde68a' }}>
                                  正在查看该模型碰撞体
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ ...PANEL_STYLE, padding: '14px 18px' }}>
        <p style={{ margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.75 }}>
          单图玩法版本：场景以大量高空悬浮板块构成，目标是在一张大地图内连续跳跃并登顶；角色模型会按菜单选择加载
          `peach / daisy` 对应的 glb 资源，失败时自动回退占位角色。
        </p>
      </div>
    </section>
  );
}
