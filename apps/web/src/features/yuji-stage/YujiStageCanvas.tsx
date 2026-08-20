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
  Shape,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import yujiInflatedModelUrl from '@/assets/yuji-stage/yuji-inflated.glb?url';
import type { PointerBus, ScrollBus } from './stageBus';
import type { StagePerformanceTier } from './stagePerformance';
import type { StageCoverRegistration } from './YujiStageContext';

interface YujiStageCanvasProps {
  covers: StageCoverRegistration[];
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
    float pointerGlow = exp(-10.0 * distance(uv, uPointer));
    float horizon = smoothstep(0.08, 0.72, uv.y) * (1.0 - smoothstep(0.62, 1.0, uv.y));
    vec3 pale = mix(vec3(0.34, 0.68, 1.0), vec3(0.82, 0.96, 1.0), uv.y);
    vec3 dark = mix(vec3(0.02, 0.08, 0.42), vec3(0.15, 0.2, 1.0), uv.y);
    vec3 color = mix(pale, dark, uDark);
    float alpha = (r1 * 0.08 + r2 * 0.1 + r3 * 0.12) * horizon + pointerGlow * 0.2;
    gl_FragColor = vec4(color, alpha);
  }
`;

function LightField({ pointerBus, theme }: Pick<YujiStageCanvasProps, 'pointerBus' | 'theme'>) {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    const pointer = pointerBus.frame;
    material.uniforms.uPointer.value.set(pointer.x, 1 - pointer.y);
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 0, -3.8]} scale={[13.5, 7.7, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={lightFieldFragmentShader}
        transparent
        uniforms={{
          uDark: { value: theme === 'dark' ? 1 : 0 },
          uPointer: { value: new Vector2(0.5, 0.5) },
          uTime: { value: 0 },
        }}
        vertexShader={lightFieldVertexShader}
      />
    </mesh>
  );
}

function PointerTrail({ pointerBus }: Pick<YujiStageCanvasProps, 'pointerBus'>) {
  const trailRefs = useRef<Array<Mesh | null>>([]);
  const target = useRef(new Vector3());
  const previous = useRef(new Vector3());

  useFrame(() => {
    const pointer = pointerBus.frame;
    target.current.set((pointer.x - 0.5) * 10.4, (0.5 - pointer.y) * 5.8, -2.28);
    previous.current.copy(target.current);
    trailRefs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const strength = pointer.inside ? 0.22 - index * 0.007 : 0.055;
      mesh.position.lerp(previous.current, Math.max(strength, 0.04));
      previous.current.copy(mesh.position);
      const pulse = pointer.inside ? 1 : 0.35;
      mesh.scale.setScalar(pulse * (1 - index / 18) + 0.08);
    });
  });

  return (
    <group>
      {Array.from({ length: 14 }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            trailRefs.current[index] = mesh;
          }}
          position={[0, 0, -2.28 - index * 0.008]}
        >
          <sphereGeometry args={[0.58 - index * 0.023, 16, 16]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={index < 4 ? '#bffaff' : '#3668ff'}
            depthWrite={false}
            opacity={0.18 - index * 0.008}
            transparent
          />
        </mesh>
      ))}
    </group>
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
  pointerBus,
  scrollBus,
  theme,
}: Pick<YujiStageCanvasProps, 'pointerBus' | 'scrollBus' | 'theme'>) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const pointer = pointerBus.frame;
    const scrollProgress = MathUtils.clamp(
      scrollBus.frame.scroll / Math.max(scrollBus.frame.viewportHeight, 1),
      0,
      1,
    );
    const targetX = pointer.inside ? (pointer.x - 0.5) * 0.42 : 0;
    const targetY = pointer.inside ? (0.5 - pointer.y) * 0.3 : 0;
    group.position.x = MathUtils.lerp(group.position.x, targetX, 0.045);
    group.position.y = MathUtils.lerp(group.position.y, targetY + scrollProgress * 0.56, 0.045);
    group.rotation.z = Math.sin(state.clock.elapsedTime * 0.24) * 0.035;
    group.scale.setScalar(Math.min(0.66, state.viewport.width / 8.8));
    group.visible = scrollProgress < 0.98;
  });

  const dark = theme === 'dark';
  const arrowShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.78, 0.66);
    shape.lineTo(0.84, 0.02);
    shape.lineTo(0.18, -0.22);
    shape.lineTo(0.46, -0.82);
    shape.lineTo(0.08, -0.98);
    shape.lineTo(-0.22, -0.34);
    shape.lineTo(-0.78, -0.62);
    shape.closePath();
    return shape;
  }, []);

  return (
    <group ref={groupRef} position={[0, 0.24, -1.18]}>
      <mesh position={[-3.25, 1.45, 0]} rotation={[0.72, 0.1, -0.38]}>
        <torusGeometry args={[0.58, 0.16, 16, 64]} />
        <meshStandardMaterial
          color={dark ? '#59e7ff' : '#0578ff'}
          emissive={dark ? '#1766ff' : '#0026ff'}
          emissiveIntensity={dark ? 2.2 : 0.38}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[2.92, 1.18, -0.1]} rotation={[0.3, -0.2, 0.62]}>
        <octahedronGeometry args={[0.66, 0]} />
        <meshStandardMaterial
          color={dark ? '#ff6bd6' : '#ff3fa4'}
          emissive={dark ? '#ff238a' : '#a60050'}
          emissiveIntensity={dark ? 1.6 : 0.24}
          roughness={0.24}
        />
      </mesh>
      <mesh position={[-2.05, -1.38, 0.12]} rotation={[0.2, 0.48, 0.42]}>
        <boxGeometry args={[0.76, 0.76, 0.3]} />
        <meshStandardMaterial
          color="#d8ff3e"
          emissive="#7ca800"
          emissiveIntensity={dark ? 1.2 : 0.22}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[2.18, -1.52, 0.04]} rotation={[0.6, -0.2, -0.38]}>
        <torusKnotGeometry args={[0.44, 0.13, 72, 10, 2, 3]} />
        <meshStandardMaterial
          color={dark ? '#7c5cff' : '#4821ff'}
          emissive="#3717ff"
          emissiveIntensity={dark ? 1.7 : 0.25}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[4.12, -1.12, 0.2]} rotation={[0.34, -0.46, -0.68]} scale={0.58}>
        <extrudeGeometry
          args={[
            arrowShape,
            {
              bevelEnabled: true,
              bevelSegments: 8,
              bevelSize: 0.1,
              bevelThickness: 0.11,
              curveSegments: 16,
              depth: 0.28,
            },
          ]}
        />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={dark ? '#54c8ff' : '#087cff'}
          emissive={dark ? '#175dff' : '#003ee8'}
          emissiveIntensity={dark ? 1.4 : 0.18}
          iridescence={1}
          iridescenceIOR={1.34}
          metalness={0.08}
          roughness={0.12}
        />
      </mesh>
      <mesh position={[0.52, 1.76, -0.16]} rotation={[0.2, 0.1, -0.1]}>
        <coneGeometry args={[0.34, 0.86, 3]} />
        <meshStandardMaterial
          color="#ff7246"
          emissive="#e12f00"
          emissiveIntensity={dark ? 1.45 : 0.2}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[-0.18, -1.75, -0.2]}>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={dark ? '#65f5ff' : '#ffffff'}
          emissiveIntensity={dark ? 3 : 0.4}
          roughness={0.08}
        />
      </mesh>
    </group>
  );
}

function WordmarkScene({
  pointerBus,
  scrollBus,
  setLoadProgress,
  setReady,
  theme,
  tier,
}: Pick<
  YujiStageCanvasProps,
  'pointerBus' | 'scrollBus' | 'setLoadProgress' | 'setReady' | 'theme' | 'tier'
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
    const scrollProgress = MathUtils.clamp(
      scroll.scroll / Math.max(scroll.viewportHeight, 1),
      0,
      1,
    );
    const targetX = pointer.inside ? (0.5 - pointer.y) * 0.22 : -0.03;
    const targetY = pointer.inside ? (pointer.x - 0.5) * 0.32 : 0;
    group.rotation.x = MathUtils.lerp(group.rotation.x, targetX, 0.055);
    group.rotation.y = MathUtils.lerp(group.rotation.y, targetY, 0.055);
    group.rotation.z = MathUtils.lerp(group.rotation.z, targetY * -0.05, 0.045);
    group.position.y = MathUtils.lerp(group.position.y, scrollProgress * 0.72, 0.08);
    const fitScale = Math.min(tier === 'full' ? 0.68 : 0.6, state.viewport.width / 8.2);
    const scale = fitScale * (1 - scrollProgress * 0.12);
    group.scale.setScalar(scale);
    material.uniforms.uOpacity.value = Math.max(0, 1 - scrollProgress * 1.25);
    material.uniforms.uPointer.value.set(pointer.x, pointer.y);
    material.uniforms.uTime.value = state.clock.elapsedTime;
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
      <LightField pointerBus={pointerBus} theme={theme} />
      <PointerTrail pointerBus={pointerBus} />
      <SignalObjects pointerBus={pointerBus} scrollBus={scrollBus} theme={theme} />
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
  uniform float uVelocity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float curl = sin(uv.x * 3.14159265) * clamp(abs(uVelocity) * 0.0025, 0.0, 0.22);
    transformed.z += curl;
    transformed.y += curl * sign(uVelocity) * (uv.y - 0.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
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

function CoverMesh({ cover, scrollBus }: { cover: StageCoverRegistration; scrollBus: ScrollBus }) {
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
          uVelocity: { value: 0 },
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
    material.uniforms.uVelocity.value = scrollBus.frame.velocity;
    material.uniforms.uPlaneSize.value.set(rect.width, rect.height);
  });

  return (
    <mesh ref={meshRef} material={material} visible={false}>
      <planeGeometry args={[1, 1, 24, 8]} />
    </mesh>
  );
}

function CoverScene({ covers, scrollBus }: Pick<YujiStageCanvasProps, 'covers' | 'scrollBus'>) {
  return (
    <>
      {covers.map((cover) => (
        <CoverMesh cover={cover} key={cover.id} scrollBus={scrollBus} />
      ))}
    </>
  );
}

export function YujiStageCanvas({
  covers,
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
              pointerBus={pointerBus}
              scrollBus={scrollBus}
              setLoadProgress={setLoadProgress}
              setReady={setReady}
              theme={theme}
              tier={tier}
            />
          ) : null}
          <CoverScene covers={covers} scrollBus={scrollBus} />
        </Canvas>
      </StageErrorBoundary>
    </div>
  );
}
