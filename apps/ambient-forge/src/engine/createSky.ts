import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { disposeObject3D } from './dispose';

export interface SkyAssembly {
  root: Group;
  update: (signals: SceneSignals, timeOfDay: number) => void;
  setQuality: (profile: QualityProfile) => void;
  dispose: () => void;
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

export function createSky(profile: QualityProfile): SkyAssembly {
  const root = new Group();
  root.name = 'ambient-sky';

  const skyMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new Color(0.03, 0.08, 0.15) },
      bottomColor: { value: new Color(0.3, 0.38, 0.4) },
      offset: { value: 11 },
      exponent: { value: 0.68 },
      storminess: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      uniform float storminess;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float blend = pow(max(h, 0.0), exponent);
        vec3 color = mix(bottomColor, topColor, blend);
        float overcast = storminess * (0.55 + smoothstep(0.02, 0.72, h) * 0.45);
        color = mix(color, color * vec3(0.58, 0.66, 0.72), overcast);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const dome = new Mesh(new SphereGeometry(58, 32, 18), skyMaterial);
  dome.frustumCulled = false;
  root.add(dome);

  const sunMaterial = new MeshBasicMaterial({ color: '#ffd59a', toneMapped: false });
  const sun = new Mesh(new SphereGeometry(1.2, 24, 18), sunMaterial);
  const sunHaloMaterial = new MeshBasicMaterial({
    color: '#ffd59a',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const sunHalo = new Mesh(new SphereGeometry(1.9, 20, 14), sunHaloMaterial);
  sun.add(sunHalo);
  root.add(sun);

  const moonMaterial = new MeshBasicMaterial({ color: '#c7d8df', toneMapped: false });
  const moon = new Mesh(new SphereGeometry(0.78, 20, 16), moonMaterial);
  root.add(moon);

  const random = seededRandom(481516);
  const starPositions = new Float32Array(960 * 3);
  for (let index = 0; index < 960; index += 1) {
    const theta = random() * Math.PI * 2;
    const y = 5 + random() * 36;
    const radius = Math.sqrt(Math.max(0, 44 * 44 - y * y));
    starPositions[index * 3] = Math.cos(theta) * radius;
    starPositions[index * 3 + 1] = y;
    starPositions[index * 3 + 2] = Math.sin(theta) * radius;
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  const starMaterial = new PointsMaterial({
    color: '#d8ecff',
    size: 0.085,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const stars = new Points(starGeometry, starMaterial);
  root.add(stars);

  const setQuality = (nextProfile: QualityProfile) => {
    starGeometry.setDrawRange(0, nextProfile.stars);
    starMaterial.size = nextProfile.dprCap > 1.5 ? 0.075 : 0.09;
  };
  setQuality(profile);

  return {
    root,
    setQuality,
    update(signals, timeOfDay) {
      skyMaterial.uniforms.topColor?.value.setRGB(...signals.skyColor);
      skyMaterial.uniforms.bottomColor?.value.setRGB(...signals.horizonColor);
      if (skyMaterial.uniforms.storminess) {
        skyMaterial.uniforms.storminess.value = Math.min(
          1,
          signals.rain * 0.82 + signals.snow * 0.26 + signals.cloudCover * 0.24,
        );
      }
      const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
      const sunY = Math.sin(angle) * 24;
      const sunX = Math.cos(angle) * 30;
      sun.position.set(sunX, sunY, -24);
      moon.position.set(-sunX, -sunY, -23);
      sun.visible = sunY > -3;
      moon.visible = sunY < 7;
      sunMaterial.color.setRGB(...signals.sunColor);
      sunHaloMaterial.color.copy(sunMaterial.color);
      sunHaloMaterial.opacity = 0.08 + signals.sunLight * 0.08;
      starMaterial.opacity = signals.starVisibility * 0.88;
      stars.rotation.y += 0.00004 * signals.motionScale;
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
