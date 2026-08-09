import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  ShaderMaterial,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { createRadialAlphaTexture } from './createRadialAlphaTexture';

export interface WaterfallAssembly {
  root: Group;
  update: (signals: SceneSignals, elapsed: number) => void;
  setQuality: (profile: QualityProfile) => void;
  getParticleCount: () => number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWaterfall(profile: QualityProfile): WaterfallAssembly {
  const root = new Group();
  root.name = 'island-waterfall';

  const surfaceMaterial = new MeshStandardMaterial({
    color: '#6ba1a4',
    emissive: '#315f68',
    emissiveIntensity: 0.22,
    roughness: 0.24,
    metalness: 0.04,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    side: DoubleSide,
  });
  const pond = new Mesh(new CircleGeometry(1.1, 24), surfaceMaterial);
  pond.position.set(-3.67, 0.565, 0.82);
  pond.rotation.x = -Math.PI / 2;
  pond.scale.y = 0.58;
  root.add(pond);

  const channel = new Mesh(new PlaneGeometry(1.55, 0.58, 8, 3), surfaceMaterial);
  channel.position.set(-4.18, 0.57, 0.82);
  channel.rotation.x = -Math.PI / 2;
  channel.rotation.z = -0.04;
  root.add(channel);

  const ripples: Array<{ mesh: Mesh; material: MeshStandardMaterial; phase: number }> = [];
  for (let index = 0; index < 3; index += 1) {
    const rippleMaterial = new MeshStandardMaterial({
      color: '#c7e6e1',
      emissive: '#79b6b6',
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      roughness: 0.2,
    });
    const ripple = new Mesh(new RingGeometry(0.13, 0.155, 28), rippleMaterial);
    ripple.position.set(-3.67 + (index - 1) * 0.22, 0.578 + index * 0.001, 0.82);
    ripple.rotation.x = -Math.PI / 2;
    ripple.renderOrder = 3;
    root.add(ripple);
    ripples.push({ mesh: ripple, material: rippleMaterial, phase: index / 3 });
  }

  const wetStainMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uWetness: { value: 0.5 },
      uColor: { value: new Color('#27494e') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uWetness;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
        float vertical = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
        float streak = 0.72 + sin(vUv.y * 31.0 + sin(vUv.x * 17.0) * 2.0) * 0.18;
        gl_FragColor = vec4(uColor, edge * vertical * streak * uWetness * 0.42);
      }
    `,
  });
  const wetStain = new Mesh(new PlaneGeometry(1.48, 3.9, 6, 18), wetStainMaterial);
  wetStain.position.set(-4.75, -1.38, 0.785);
  wetStain.rotation.y = -0.08;
  wetStain.renderOrder = 1;
  root.add(wetStain);

  const waterfallMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.78 },
      uWind: { value: 0 },
      uDeepColor: { value: new Color('#4d8994') },
      uFoamColor: { value: new Color('#d9f0ea') },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        float fall = 1.0 - uv.y;
        float taper = mix(0.62, 1.0, smoothstep(0.0, 0.78, uv.y));
        transformed.x *= taper;
        transformed.x += sin(uv.y * 17.0 + uTime * 3.2) * 0.055 * fall;
        transformed.x -= uWind * fall * fall * 0.32;
        transformed.z += sin(uv.y * 23.0 + uv.x * 8.0 + uTime * 4.1) * 0.035;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uDeepColor;
      uniform vec3 uFoamColor;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.13, vUv.x) * (1.0 - smoothstep(0.87, 1.0, vUv.x));
        float broad = 0.5 + 0.5 * sin(vUv.x * 27.0 + sin(vUv.y * 15.0 - uTime * 2.3) * 1.7);
        float fine = 0.5 + 0.5 * sin(vUv.x * 51.0 - sin(vUv.y * 24.0 - uTime * 3.1) * 1.2);
        float pulse = 0.5 + 0.5 * sin(vUv.y * 72.0 - uTime * 8.6 + vUv.x * 8.0);
        float ribbons = smoothstep(0.5, 0.92, broad * 0.68 + fine * 0.32);
        float strands = ribbons * (0.58 + pulse * 0.42);
        float lipFoam = smoothstep(0.8, 1.0, vUv.y);
        float lowerMist = 1.0 - smoothstep(0.0, 0.2, vUv.y);
        float bottomFade = 0.24 + smoothstep(0.0, 0.18, vUv.y) * 0.76;
        vec3 color = mix(uDeepColor, uFoamColor, strands * 0.48 + lipFoam * 0.42 + lowerMist * 0.18);
        float alpha = (0.42 + strands * 0.28 + lipFoam * 0.16) * edge * bottomFade * uOpacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  const waterfall = new Mesh(new PlaneGeometry(1.36, 3.9, 12, 32), waterfallMaterial);
  waterfall.position.set(-4.74, -1.38, 0.82);
  waterfall.rotation.y = -0.08;
  waterfall.renderOrder = 2;
  root.add(waterfall);

  const foamMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 0.72 },
      uColor: { value: new Color('#e8f7f2') },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        float fall = 1.0 - uv.y;
        transformed.x *= mix(0.58, 1.0, uv.y);
        transformed.x += sin(uv.y * 21.0 + uTime * 3.8 + uv.x * 7.0) * 0.04 * fall;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlow;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));
        float first = 0.5 + 0.5 * sin(vUv.x * 29.0 + sin(vUv.y * 18.0 - uTime * 2.6) * 1.5);
        float second = 0.5 + 0.5 * sin(vUv.x * 47.0 - sin(vUv.y * 26.0 - uTime * 3.4) * 1.1);
        float pulse = 0.5 + 0.5 * sin(vUv.y * 82.0 - uTime * 9.0 + vUv.x * 9.0);
        float ribbons = smoothstep(0.62, 0.94, first * 0.7 + second * 0.3);
        float foam = ribbons * (0.42 + pulse * 0.58);
        float top = smoothstep(0.86, 1.0, vUv.y) * 0.34;
        float fade = smoothstep(0.04, 0.22, vUv.y);
        gl_FragColor = vec4(uColor, (foam * 0.24 + top) * edge * fade * uFlow);
      }
    `,
  });
  const foamSheet = new Mesh(new PlaneGeometry(1.18, 3.82, 10, 30), foamMaterial);
  foamSheet.position.set(-4.735, -1.35, 0.85);
  foamSheet.rotation.y = -0.08;
  foamSheet.renderOrder = 3;
  const waterfallSide = new Mesh(new PlaneGeometry(0.62, 3.86, 8, 30), waterfallMaterial);
  waterfallSide.position.set(-4.74, -1.38, 0.82);
  waterfallSide.rotation.y = Math.PI / 2 - 0.08;
  waterfallSide.renderOrder = 2;
  const foamSide = new Mesh(new PlaneGeometry(0.48, 3.78, 6, 28), foamMaterial);
  foamSide.position.set(-4.74, -1.35, 0.82);
  foamSide.rotation.y = Math.PI / 2 - 0.08;
  foamSide.renderOrder = 3;
  root.add(foamSheet, waterfallSide, foamSide);

  const ribbonOffsets = [-0.38, -0.08, 0.28] as const;
  for (let index = 0; index < ribbonOffsets.length; index += 1) {
    const ribbon = new Mesh(new PlaneGeometry(0.2 + index * 0.035, 3.68, 4, 28), foamMaterial);
    ribbon.position.set(-4.74 + ribbonOffsets[index], -1.36, 0.875 + index * 0.008);
    ribbon.rotation.y = -0.08;
    ribbon.renderOrder = 4;
    root.add(ribbon);
  }

  const lipFoamMaterial = new MeshStandardMaterial({
    color: '#d9efeb',
    emissive: '#76aeb0',
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    roughness: 0.18,
    side: DoubleSide,
  });
  const lipFoam: Mesh[] = [];
  for (const [x, z, scaleX, scaleZ] of [
    [-4.48, 0.82, 1.35, 0.7],
    [-4.7, 0.66, 1.1, 0.58],
    [-4.72, 1.04, 0.95, 0.52],
  ] as const) {
    const foam = new Mesh(new CircleGeometry(0.28, 18), lipFoamMaterial);
    foam.position.set(x, 0.59, z);
    foam.rotation.x = -Math.PI / 2;
    foam.scale.set(scaleX, scaleZ, 1);
    foam.renderOrder = 3;
    lipFoam.push(foam);
    root.add(foam);
  }

  const lipMaterial = new MeshStandardMaterial({
    color: '#68716d',
    roughness: 0.92,
    flatShading: true,
  });
  const lipGeometry = new IcosahedronGeometry(0.38, 0);
  for (const [x, y, z, scale] of [
    [-4.82, 0.28, 0.24, 1.1],
    [-4.76, 0.22, 1.4, 0.9],
    [-4.55, -0.08, 0.18, 0.78],
    [-4.58, -0.04, 1.48, 0.74],
  ] as const) {
    const rock = new Mesh(lipGeometry, lipMaterial);
    rock.position.set(x, y, z);
    rock.scale.set(scale, scale * 0.78, scale);
    root.add(rock);
  }

  const plungeShelf = new Mesh(new CylinderGeometry(1.45, 0.82, 0.32, 16), lipMaterial);
  plungeShelf.position.set(-4.74, -3.56, 0.82);
  root.add(plungeShelf);

  const plungePoolMaterial = new MeshStandardMaterial({
    color: '#4d858a',
    emissive: '#21494f',
    emissiveIntensity: 0.24,
    roughness: 0.14,
    metalness: 0.06,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: DoubleSide,
  });
  const plungePool = new Mesh(new CircleGeometry(1.24, 30), plungePoolMaterial);
  plungePool.position.set(-4.74, -3.38, 0.82);
  plungePool.rotation.x = -Math.PI / 2;
  plungePool.scale.y = 0.72;
  plungePool.renderOrder = 2;
  root.add(plungePool);

  const impactRings: Array<{ mesh: Mesh; material: MeshStandardMaterial; phase: number }> = [];
  for (let index = 0; index < 4; index += 1) {
    const material = new MeshStandardMaterial({
      color: '#e2f3ee',
      emissive: '#7ab7b4',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 0.12,
      side: DoubleSide,
    });
    const ring = new Mesh(new RingGeometry(0.13, 0.18, 30), material);
    ring.position.set(-4.74, -3.365 + index * 0.001, 0.82);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 0.72;
    ring.renderOrder = 4;
    root.add(ring);
    impactRings.push({ mesh: ring, material, phase: index / 4 });
  }

  const iceMaterial = new MeshStandardMaterial({
    color: '#c9e4e4',
    emissive: '#6ca0a6',
    emissiveIntensity: 0.22,
    metalness: 0.06,
    roughness: 0.2,
    transparent: true,
    opacity: 0,
  });
  for (let index = 0; index < 6; index += 1) {
    const length = 0.24 + (index % 3) * 0.12;
    const icicle = new Mesh(new CylinderGeometry(0.045, 0.006, length, 7), iceMaterial);
    icicle.position.set(-5.16 + index * 0.17, 0.19 - length * 0.5, 0.79 + (index % 2) * 0.08);
    icicle.rotation.z = (index - 2.5) * 0.018;
    root.add(icicle);
  }

  const random = seededRandom(71023);
  const sprayPositions = new Float32Array(96 * 3);
  const spraySeeds = new Float32Array(96);
  for (let index = 0; index < spraySeeds.length; index += 1) spraySeeds[index] = random();
  const sprayGeometry = new BufferGeometry();
  sprayGeometry.setAttribute('position', new BufferAttribute(sprayPositions, 3));
  const sprayTexture = createRadialAlphaTexture();
  const sprayMaterial = new PointsMaterial({
    color: '#d9f1ed',
    size: 0.11,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    alphaMap: sprayTexture,
    alphaTest: 0.015,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const spray = new Points(sprayGeometry, sprayMaterial);
  spray.frustumCulled = false;
  root.add(spray);

  let sprayBudget = 96;
  let activeSprayCount = 96;
  const setQuality = (nextProfile: QualityProfile) => {
    sprayBudget = Math.min(96, Math.max(28, Math.ceil(nextProfile.weatherParticles * 0.11)));
    sprayGeometry.setDrawRange(0, sprayBudget);
    sprayMaterial.size = nextProfile.dprCap > 1.5 ? 0.075 : 0.095;
  };
  setQuality(profile);

  const baseWater = new Color('#6ba1a4');
  const stormWater = new Color('#4d747b');
  return {
    root,
    setQuality,
    getParticleCount: () => activeSprayCount,
    update(signals, elapsed) {
      const flow = Math.max(0.5, 0.72 + signals.rain * 0.28 - signals.snow * 0.18);
      waterfallMaterial.uniforms.uTime.value = elapsed;
      waterfallMaterial.uniforms.uWind.value = signals.windStrength * signals.motionScale;
      waterfallMaterial.uniforms.uOpacity.value = flow;
      foamMaterial.uniforms.uTime.value = elapsed;
      foamMaterial.uniforms.uFlow.value = flow;
      wetStainMaterial.uniforms.uWetness.value = 0.42 + signals.wetness * 0.58;
      surfaceMaterial.color.copy(baseWater).lerp(stormWater, signals.wetness * 0.72);
      surfaceMaterial.opacity = 0.66 + signals.rain * 0.14;
      plungePoolMaterial.color.copy(baseWater).lerp(stormWater, signals.wetness * 0.8);
      plungePoolMaterial.opacity = 0.7 + flow * 0.12;
      plungePool.rotation.z = Math.sin(elapsed * 0.22) * 0.018 * signals.motionScale;
      lipFoamMaterial.opacity = 0.46 + flow * 0.24;
      iceMaterial.opacity = signals.snowCover * 0.86;
      pond.rotation.z = Math.sin(elapsed * 0.3) * 0.012 * signals.motionScale;
      for (const ripple of ripples) {
        const phase = (elapsed * (0.16 + flow * 0.08) + ripple.phase) % 1;
        ripple.mesh.scale.setScalar(0.8 + phase * 5.2);
        ripple.material.opacity = (1 - phase) * (0.12 + signals.rain * 0.1);
      }
      for (const ring of impactRings) {
        const phase = (elapsed * (0.3 + flow * 0.18) + ring.phase) % 1;
        ring.mesh.scale.set(0.7 + phase * 5.4, (0.7 + phase * 5.4) * 0.72, 1);
        ring.material.opacity = (1 - phase) * (0.16 + flow * 0.18);
      }
      activeSprayCount = Math.floor(sprayBudget * flow);
      sprayGeometry.setDrawRange(0, activeSprayCount);
      sprayMaterial.opacity = 0.34 + flow * 0.28;
      for (let index = 0; index < activeSprayCount; index += 1) {
        const seed = spraySeeds[index] ?? 0;
        const phase = (elapsed * (0.24 + seed * 0.14) + seed) % 1;
        const offset = index * 3;
        if (index % 8 === 0) {
          sprayPositions[offset] =
            -4.74 + (seed - 0.5) * (0.86 - phase * 0.24) - signals.windStrength * phase * 0.32;
          sprayPositions[offset + 1] = 0.42 - phase * 3.62;
          sprayPositions[offset + 2] = 0.84 + Math.sin(seed * 17 + phase * 8) * 0.08;
        } else {
          const spread = Math.sin(phase * Math.PI);
          sprayPositions[offset] =
            -4.74 + (seed - 0.5) * (0.82 + phase * 0.72) - signals.windStrength * phase * 0.4;
          sprayPositions[offset + 1] = -3.22 + spread * (0.22 + seed * 0.34);
          sprayPositions[offset + 2] =
            0.82 + Math.cos(seed * 19 + phase * 6) * spread * (0.24 + seed * 0.18);
        }
      }
      const sprayAttribute = sprayGeometry.attributes.position;
      if (sprayAttribute) sprayAttribute.needsUpdate = true;
    },
  };
}
