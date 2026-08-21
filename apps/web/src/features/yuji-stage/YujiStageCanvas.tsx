import { Canvas, useFrame } from '@react-three/fiber';
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AdditiveBlending,
  type BufferGeometry,
  DoubleSide,
  type Group,
  MathUtils,
  Mesh,
  type Object3D,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import yujiInflatedModelUrl from '@/assets/yuji-stage/yuji-inflated.glb?url';
import { StagePostProcess } from './StagePostProcess';
import type { PointerBus, ScrollBus } from './stageBus';
import { resolveFluidActivity, resolveHeroExitProgress } from './stageMotion';
import type { StagePerformanceTier } from './stagePerformance';
import type { StageCoverRegistration } from './YujiStageContext';

interface YujiStageCanvasProps {
  covers: StageCoverRegistration[];
  introReleased: boolean;
  introSettled: boolean;
  mode: 'articles' | 'home';
  pointerBus: PointerBus;
  running: boolean;
  scrollBus: ScrollBus;
  setLoadProgress: (progress: number) => void;
  setReady: (ready: boolean) => void;
  theme: 'dark' | 'light';
  tier: StagePerformanceTier;
}

class StageErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function StageClock() {
  useFrame((state) => {
    state.gl.setClearAlpha(0);
  }, -100);
  return null;
}

const lightFieldVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lightFieldFragmentShader = /* glsl */ `
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uDark;
  uniform float uExit;
  uniform float uPointerGlow;
  varying vec2 vUv;

  float ray(vec2 uv, float offset, float width) {
    float axis = uv.y - uv.x * 0.32 + offset;
    return 1.0 - smoothstep(0.0, width, abs(axis));
  }

  void main() {
    vec2 uv = vUv;
    float r1 = ray(uv, -0.14 + sin(uTime * 0.11) * 0.025, 0.12);
    float r2 = ray(uv, 0.28 + cos(uTime * 0.09) * 0.03, 0.08);
    float r3 = ray(uv, -0.52, 0.045);
    float pointerGlow = exp(-10.0 * distance(uv, uPointer)) * uPointerGlow;
    float horizon = smoothstep(0.08, 0.72, uv.y) * (1.0 - smoothstep(0.62, 1.0, uv.y));
    vec3 pale = mix(vec3(0.34, 0.68, 1.0), vec3(0.82, 0.96, 1.0), uv.y);
    vec3 dark = mix(vec3(0.02, 0.08, 0.42), vec3(0.15, 0.2, 1.0), uv.y);
    vec3 color = mix(pale, dark, uDark);
    float alpha = (r1 * 0.08 + r2 * 0.1 + r3 * 0.12) * horizon + pointerGlow * 0.2;
    gl_FragColor = vec4(color, alpha * (1.0 - uExit));
  }
`;

function LightField({
  pointerBus,
  scrollBus,
  theme,
  tier,
}: Pick<YujiStageCanvasProps, 'pointerBus' | 'scrollBus' | 'theme' | 'tier'>) {
  const materialRef = useRef<ShaderMaterial>(null);
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    const displayViewport = state.viewport.getCurrentViewport(state.camera, [0, 0, -3.8]);
    meshRef.current?.scale.set(displayViewport.width * 1.06, displayViewport.height * 1.06, 1);
    const pointer = pointerBus.frame;
    material.uniforms.uPointer.value.set(pointer.x, 1 - pointer.y);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uExit.value = resolveHeroExitProgress(
      scrollBus.frame.scroll,
      scrollBus.frame.viewportHeight,
    );
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -3.8]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={lightFieldFragmentShader}
        transparent
        uniforms={{
          uDark: { value: theme === 'dark' ? 1 : 0 },
          uExit: { value: 0 },
          uPointerGlow: { value: tier === 'full' ? 0 : 1 },
          uPointer: { value: new Vector2(0.5, 0.5) },
          uTime: { value: 0 },
        }}
        vertexShader={lightFieldVertexShader}
      />
    </mesh>
  );
}

const wordmarkVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying vec3 vLocalPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    vLocalPosition = position;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const wordmarkFragmentShader = /* glsl */ `
  uniform float uDark;
  uniform float uFlowEnergy;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying vec3 vLocalPosition;

  float hash21(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(vViewDirection);
    float facing = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.35);
    float sweep = vLocalPosition.x * 0.72 + vLocalPosition.y * 0.46;
    sweep += (uPointer.x - 0.5) * 1.3 - (uPointer.y - 0.5) * 0.75;
    float film = 0.5 + 0.5 * sin(sweep * 5.6 + fresnel * 11.0 + uTime * 0.14);
    vec3 spectrum = 0.55 + 0.45 * cos(
      6.28318 * (vec3(0.02, 0.35, 0.68) + film * 0.2 + fresnel * 0.12)
    );
    vec3 lightDirection = normalize(vec3(-0.45, 0.72, 0.8));
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float specular = pow(max(dot(normal, halfDirection), 0.0), 72.0);
    vec3 lightBase = mix(vec3(0.68, 0.86, 1.0), vec3(0.94, 0.985, 1.0), facing);
    vec3 darkBase = mix(vec3(0.11, 0.19, 0.72), vec3(0.55, 0.72, 1.0), facing);
    vec3 base = mix(lightBase, darkBase, uDark);
    float colorWeight = 0.07 + fresnel * 0.42 + (1.0 - facing) * 0.08;
    vec3 color = mix(base, spectrum, colorWeight);
    color += specular * mix(vec3(0.95, 1.0, 1.0), spectrum, 0.32) * 1.25;
    color += fresnel * mix(vec3(0.16, 0.58, 1.0), vec3(0.42, 0.3, 1.0), uDark) * 0.42;
    color += fresnel * vec3(0.32, 0.86, 1.0) * uFlowEnergy * 0.5;
    float grain = hash21(gl_FragCoord.xy + floor(uTime * 2.0)) - 0.5;
    color += grain * 0.018;
    float alpha = mix(0.84, 0.985, fresnel + specular * 0.2) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function findFirstGeometry(root: Object3D): BufferGeometry | null {
  let geometry: BufferGeometry | null = null;
  root.traverse((object) => {
    if (!geometry && object instanceof Mesh) geometry = object.geometry;
  });
  return geometry;
}

function InflatedWordmark({
  material,
  setLoadProgress,
  setReady,
}: {
  material: ShaderMaterial;
  setLoadProgress: (progress: number) => void;
  setReady: (ready: boolean) => void;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    let active = true;
    let ownedGeometry: BufferGeometry | null = null;
    const loader = new GLTFLoader();
    setLoadProgress(3);
    setReady(false);
    loader.load(
      yujiInflatedModelUrl,
      (gltf) => {
        const resolved = findFirstGeometry(gltf.scene);
        if (!active || !resolved) {
          setLoadProgress(100);
          return;
        }
        ownedGeometry = resolved.clone();
        setGeometry(ownedGeometry);
        setLoadProgress(100);
        setReady(true);
      },
      (event) => {
        if (!active) return;
        const measured = event.total > 0 ? (event.loaded / event.total) * 100 : 0;
        const estimated = 8 + Math.log2(event.loaded / 16384 + 1) * 13;
        setLoadProgress(Math.min(96, Math.max(measured, estimated)));
      },
      () => {
        if (!active) return;
        setLoadProgress(100);
        setReady(false);
      },
    );
    return () => {
      active = false;
      ownedGeometry?.dispose();
      setReady(false);
    };
  }, [setLoadProgress, setReady]);

  return geometry ? <mesh geometry={geometry} material={material} /> : null;
}

function SignalObjects({
  introReleased,
  introSettled,
  pointerBus,
  scrollBus,
  theme,
}: Pick<
  YujiStageCanvasProps,
  'introReleased' | 'introSettled' | 'pointerBus' | 'scrollBus' | 'theme'
>) {
  const groupRef = useRef<Group>(null);
  const signalRefs = useRef<Array<Mesh | null>>([]);
  const introStartRef = useRef<number | null>(null);
  const landingY = [1.45, 1.18, -1.38, -1.52, -1.12, 1.76, -1.75];
  const fallDelay = [0.15, 0.1, 0.25, 0.2, 0.3, 0.05, 0];

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const pointer = pointerBus.frame;
    const scrollProgress = resolveHeroExitProgress(
      scrollBus.frame.scroll,
      scrollBus.frame.viewportHeight,
    );
    if (introReleased && introStartRef.current === null) {
      introStartRef.current = state.clock.elapsedTime;
    }
    const introElapsed = introSettled
      ? Number.POSITIVE_INFINITY
      : introReleased && introStartRef.current !== null
        ? state.clock.elapsedTime - introStartRef.current
        : -1;
    signalRefs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const progress = introSettled
        ? 1
        : MathUtils.clamp((introElapsed - fallDelay[index]) / 0.76, 0, 1);
      if (progress < 0.78) {
        const fall = progress / 0.78;
        mesh.position.y = landingY[index] + 5.4 * (1 - fall) ** 3;
      } else {
        const bounce = (progress - 0.78) / 0.22;
        mesh.position.y = landingY[index] - Math.sin(bounce * Math.PI) * 0.12 * (1 - bounce);
      }
    });
    const targetX = pointer.inside ? (pointer.x - 0.5) * 0.42 : 0;
    const targetY = pointer.inside ? (0.5 - pointer.y) * 0.3 : 0;
    group.position.x = MathUtils.lerp(group.position.x, targetX, 0.045);
    group.position.y = MathUtils.lerp(group.position.y, targetY + scrollProgress * 0.56, 0.045);
    group.position.z = -1.18 - scrollProgress * 1.2;
    group.rotation.z = Math.sin(state.clock.elapsedTime * 0.24) * 0.035;
    group.scale.setScalar(Math.min(0.66, state.viewport.width / 8.8) * (1 - scrollProgress * 0.15));
    group.visible = scrollProgress < 0.995;
  });

  const dark = theme === 'dark';
  const signalSurface = {
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 1,
    iridescenceIOR: 1.34,
    metalness: 0.02,
    roughness: 0.16,
  } as const;

  return (
    <group ref={groupRef} position={[0, 0.24, -1.18]}>
      <mesh
        ref={(mesh) => {
          signalRefs.current[0] = mesh;
        }}
        position={[-3.25, 1.45, 0]}
        rotation={[0.72, 0.1, -0.38]}
      >
        <torusGeometry args={[0.58, 0.12, 18, 64]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#85e8ff' : '#8dd6ff'}
          emissive={dark ? '#1979b7' : '#397bb8'}
          emissiveIntensity={dark ? 0.82 : 0.14}
        />
      </mesh>
      <mesh
        ref={(mesh) => {
          signalRefs.current[1] = mesh;
        }}
        position={[2.92, 1.18, -0.1]}
        rotation={[0.3, -0.2, 0.62]}
        scale={[1.28, 0.74, 0.56]}
      >
        <sphereGeometry args={[0.48, 32, 24]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#d9c8ff' : '#d8d5ff'}
          emissive={dark ? '#6651a8' : '#6b75b5'}
          emissiveIntensity={dark ? 0.68 : 0.1}
        />
      </mesh>
      <mesh
        ref={(mesh) => {
          signalRefs.current[2] = mesh;
        }}
        position={[-2.05, -1.38, 0.12]}
        rotation={[0.35, 0.55, 1.02]}
      >
        <capsuleGeometry args={[0.22, 0.5, 8, 24]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#b8f3ff' : '#c4edff'}
          emissive={dark ? '#278ca6' : '#3d91aa'}
          emissiveIntensity={dark ? 0.72 : 0.11}
        />
      </mesh>
      <mesh
        ref={(mesh) => {
          signalRefs.current[3] = mesh;
        }}
        position={[2.18, -1.52, 0.04]}
        rotation={[0.6, -0.2, -0.38]}
      >
        <torusKnotGeometry args={[0.42, 0.11, 72, 12, 2, 3]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#b69cff' : '#a99ee8'}
          emissive={dark ? '#5944a6' : '#625aa8'}
          emissiveIntensity={dark ? 0.78 : 0.12}
        />
      </mesh>
      <mesh
        ref={(mesh) => {
          signalRefs.current[4] = mesh;
        }}
        position={[4.12, -1.12, 0.2]}
        rotation={[0.58, -0.46, -0.68]}
        scale={[1, 0.72, 1]}
      >
        <torusGeometry args={[0.43, 0.07, 16, 64]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#87e5ff' : '#9fdcff'}
          emissive={dark ? '#2c7899' : '#4b82a8'}
          emissiveIntensity={dark ? 0.72 : 0.1}
        />
      </mesh>
      <mesh
        ref={(mesh) => {
          signalRefs.current[5] = mesh;
        }}
        position={[0.52, 1.76, -0.16]}
        rotation={[0.2, 0.1, 0.44]}
      >
        <capsuleGeometry args={[0.18, 0.52, 8, 24]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#ffd0dc' : '#f5d5dc'}
          emissive={dark ? '#a75572' : '#a86e7c'}
          emissiveIntensity={dark ? 0.62 : 0.09}
        />
      </mesh>
      <mesh
        ref={(mesh) => {
          signalRefs.current[6] = mesh;
        }}
        position={[-0.18, -1.75, -0.2]}
      >
        <sphereGeometry args={[0.24, 28, 20]} />
        <meshPhysicalMaterial
          {...signalSurface}
          color={dark ? '#e5faff' : '#edf7ff'}
          emissive={dark ? '#61bfd3' : '#8cb8ca'}
          emissiveIntensity={dark ? 0.8 : 0.13}
        />
      </mesh>
    </group>
  );
}

function WordmarkScene({
  introReleased,
  introSettled,
  pointerBus,
  scrollBus,
  setLoadProgress,
  setReady,
  theme,
  tier,
}: Pick<
  YujiStageCanvasProps,
  | 'introReleased'
  | 'introSettled'
  | 'pointerBus'
  | 'scrollBus'
  | 'setLoadProgress'
  | 'setReady'
  | 'theme'
  | 'tier'
>) {
  const groupRef = useRef<Group>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        depthWrite: true,
        fragmentShader: wordmarkFragmentShader,
        side: DoubleSide,
        toneMapped: false,
        transparent: true,
        uniforms: {
          uDark: { value: theme === 'dark' ? 1 : 0 },
          uFlowEnergy: { value: 0 },
          uOpacity: { value: 1 },
          uPointer: { value: new Vector2(0.5, 0.5) },
          uTime: { value: 0 },
        },
        vertexShader: wordmarkVertexShader,
      }),
    [theme],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const pointer = pointerBus.frame;
    const scroll = scrollBus.frame;
    const scrollProgress = resolveHeroExitProgress(scroll.scroll, scroll.viewportHeight);
    const targetX = pointer.inside ? (0.5 - pointer.y) * 0.22 : -0.03;
    const targetY = pointer.inside ? (pointer.x - 0.5) * 0.32 : 0;
    group.rotation.x = MathUtils.lerp(group.rotation.x, targetX, 0.055);
    group.rotation.y = MathUtils.lerp(group.rotation.y, targetY, 0.055);
    group.rotation.z = MathUtils.lerp(group.rotation.z, targetY * -0.05, 0.045);
    group.position.y = MathUtils.lerp(group.position.y, scrollProgress * 0.72, 0.08);
    group.position.z = -scrollProgress * 1.2;
    const fitScale = Math.min(tier === 'full' ? 0.68 : 0.6, state.viewport.width / 8.2);
    const scale = fitScale * (1 - scrollProgress * 0.12);
    group.scale.setScalar(scale);
    material.uniforms.uOpacity.value = Math.max(0, 1 - scrollProgress * 1.25);
    material.uniforms.uPointer.value.set(pointer.x, pointer.y);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uFlowEnergy.value =
      Math.min(1, pointer.speed / 4) *
      resolveFluidActivity(pointer.inside, pointer.lastMoveAt, performance.now());
    group.visible = material.uniforms.uOpacity.value > 0.02;
  });

  return (
    <>
      <ambientLight intensity={theme === 'light' ? 1.6 : 1.1} />
      <directionalLight
        color="#ffffff"
        intensity={theme === 'light' ? 3.8 : 3.8}
        position={[-4, 5, 7]}
      />
      <pointLight color="#59e7ff" intensity={theme === 'light' ? 9 : 34} position={[-4, 3, 5]} />
      <pointLight color="#ff55b8" intensity={theme === 'light' ? 6 : 25} position={[4, -2, 4]} />
      <LightField pointerBus={pointerBus} scrollBus={scrollBus} theme={theme} tier={tier} />
      <SignalObjects
        introReleased={introReleased}
        introSettled={introSettled || tier !== 'full'}
        pointerBus={pointerBus}
        scrollBus={scrollBus}
        theme={theme}
      />
      <group ref={groupRef} position={[0, 0.54, 0]} rotation={[-0.05, 0.04, -0.025]}>
        <InflatedWordmark
          material={material}
          setLoadProgress={setLoadProgress}
          setReady={setReady}
        />
      </group>
    </>
  );
}

const coverVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coverFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uImageSize;
  uniform vec2 uPlaneSize;
  uniform float uHover;
  uniform float uReveal;
  uniform float uTime;
  varying vec2 vUv;

  vec2 coverUv(vec2 uv) {
    float imageAspect = uImageSize.x / max(uImageSize.y, 1.0);
    float planeAspect = uPlaneSize.x / max(uPlaneSize.y, 1.0);
    vec2 ratio = vec2(
      min(planeAspect / imageAspect, 1.0),
      min(imageAspect / planeAspect, 1.0)
    );
    return uv * ratio + (1.0 - ratio) * 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv);
    vec4 source = texture2D(uTexture, uv);
    vec3 negative = vec3(1.0) - source.rgb;
    vec3 color = mix(negative, source.rgb, uReveal);
    vec2 cell = fract(gl_FragCoord.xy / 7.0) - 0.5;
    float dotMask = 1.0 - smoothstep(0.22, 0.48, length(cell));
    float sweep = smoothstep(0.1, 0.9, vUv.x + sin(uTime * 2.0) * 0.04);
    vec3 signal = mix(vec3(0.08, 0.18, 1.0), vec3(0.35, 0.95, 1.0), sweep);
    color = mix(color, signal * (0.4 + dotMask * 0.8), uHover * 0.72);
    gl_FragColor = vec4(color, source.a);
  }
`;

function CoverMesh({ cover }: { cover: StageCoverRegistration }) {
  const meshRef = useRef<Mesh>(null);
  const frameRef = useRef(0);
  const revealRef = useRef(0);
  const hoverRef = useRef(0);
  const [texture, setTexture] = useState<Texture | null>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        fragmentShader: coverFragmentShader,
        transparent: true,
        uniforms: {
          uHover: { value: 0 },
          uImageSize: { value: new Vector2(1, 1) },
          uPlaneSize: { value: new Vector2(1, 1) },
          uReveal: { value: 0 },
          uTexture: { value: null },
          uTime: { value: 0 },
        },
        vertexShader: coverVertexShader,
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    const loader = new TextureLoader();
    loader.load(
      cover.src,
      (loaded) => {
        if (!active) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = SRGBColorSpace;
        loaded.wrapS = RepeatWrapping;
        loaded.wrapT = RepeatWrapping;
        setTexture(loaded);
      },
      undefined,
      () => setTexture(null),
    );
    return () => {
      active = false;
    };
  }, [cover.src]);

  useEffect(() => {
    material.uniforms.uTexture.value = texture;
    if (texture?.image) {
      const image = texture.image as { height?: number; width?: number };
      material.uniforms.uImageSize.value.set(image.width ?? 1, image.height ?? 1);
    }
    return () => texture?.dispose();
  }, [material, texture]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !texture || !cover.element.isConnected) {
      if (mesh) mesh.visible = false;
      return;
    }

    frameRef.current += 1;
    const rect = cover.element.getBoundingClientRect();
    const nearViewport = rect.bottom > -state.size.height && rect.top < state.size.height * 2;
    if (!nearViewport || (frameRef.current % 12 !== 0 && rect.bottom < -80)) {
      mesh.visible = false;
      return;
    }

    const world = state.viewport.getCurrentViewport(state.camera, [0, 0, 0]);
    const scaleX = world.width / state.size.width;
    const scaleY = world.height / state.size.height;
    mesh.visible = rect.width > 1 && rect.height > 1;
    mesh.position.set(
      (rect.left + rect.width / 2 - state.size.width / 2) * scaleX,
      (state.size.height / 2 - rect.top - rect.height / 2) * scaleY,
      0,
    );
    mesh.scale.set(rect.width * scaleX, rect.height * scaleY, 1);

    const interactive =
      cover.element.matches(':hover') || cover.element.contains(document.activeElement);
    hoverRef.current = MathUtils.lerp(hoverRef.current, interactive ? 1 : 0, 0.12);
    revealRef.current = MathUtils.lerp(revealRef.current, 1, 0.075);
    material.uniforms.uHover.value = hoverRef.current;
    material.uniforms.uReveal.value = revealRef.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPlaneSize.value.set(rect.width, rect.height);
  });

  return (
    <mesh ref={meshRef} material={material} visible={false}>
      <planeGeometry args={[1, 1, 24, 8]} />
    </mesh>
  );
}

function CoverScene({ covers }: Pick<YujiStageCanvasProps, 'covers'>) {
  return (
    <>
      {covers.map((cover) => (
        <CoverMesh cover={cover} key={cover.id} />
      ))}
    </>
  );
}

export function YujiStageCanvas({
  covers,
  introReleased,
  introSettled,
  mode,
  pointerBus,
  running,
  scrollBus,
  setLoadProgress,
  setReady,
  theme,
  tier,
}: YujiStageCanvasProps) {
  return (
    <div className="yuji-stage-canvas" aria-hidden="true" data-tier={tier}>
      <StageErrorBoundary
        onError={() => {
          setLoadProgress(100);
          setReady(false);
        }}
      >
        <Canvas
          camera={{ far: 100, fov: 36, near: 0.1, position: [0, 0, 8] }}
          dpr={tier === 'full' ? [1, 1.75] : 1}
          frameloop={running ? 'always' : 'never'}
          gl={{
            alpha: true,
            antialias: tier === 'full',
            powerPreference: 'high-performance',
            premultipliedAlpha: false,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.setClearAlpha(0);
            gl.domElement.addEventListener('webglcontextlost', () => setReady(false), {
              once: true,
            });
            if (mode === 'articles') {
              setLoadProgress(100);
              setReady(true);
            }
          }}
        >
          <StageClock />
          {mode === 'home' ? (
            <WordmarkScene
              introReleased={introReleased}
              introSettled={introSettled}
              pointerBus={pointerBus}
              scrollBus={scrollBus}
              setLoadProgress={setLoadProgress}
              setReady={setReady}
              theme={theme}
              tier={tier}
            />
          ) : null}
          <CoverScene covers={covers} />
          {tier === 'full' ? (
            <StagePostProcess
              mode={mode}
              pointerBus={pointerBus}
              scrollBus={scrollBus}
              theme={theme}
            />
          ) : null}
        </Canvas>
      </StageErrorBoundary>
    </div>
  );
}
