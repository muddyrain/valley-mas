import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  LineBasicMaterial,
  LineSegments,
  PointLight,
  Points,
  PointsMaterial,
  type Scene,
} from 'three';
import { derivePrecipitationMotion } from '../core/precipitation-motion';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { createRadialAlphaTexture } from './createRadialAlphaTexture';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1103515245, state) + 12345;
    return (state >>> 0) / 4294967296;
  };
}

const MAX_WEATHER_PARTICLES = 1800;

export class WeatherSystem {
  readonly rain: LineSegments;
  readonly snow: Points;
  readonly splashes: Points;
  private readonly rainGeometry: BufferGeometry;
  private readonly snowGeometry: BufferGeometry;
  private readonly rainMaterial: LineBasicMaterial;
  private readonly snowMaterial: PointsMaterial;
  private readonly splashGeometry: BufferGeometry;
  private readonly splashMaterial: PointsMaterial;
  private readonly rainPositions: Float32Array;
  private readonly snowPositions: Float32Array;
  private readonly snowSeeds: Float32Array;
  private readonly splashPositions: Float32Array;
  private readonly splashBases: Float32Array;
  private readonly splashSeeds: Float32Array;
  private readonly fogColor = new Color();
  private readonly lightning = new PointLight('#d8e8ff', 0, 48, 1.4);
  private readonly snowTexture = createRadialAlphaTexture();
  private baseSnowSize = 0.12;
  private particleBudget: number;
  private activeParticles = 0;

  constructor(
    private readonly scene: Scene,
    profile: QualityProfile,
  ) {
    const random = seededRandom(321909);
    this.rainPositions = new Float32Array(MAX_WEATHER_PARTICLES * 6);
    this.snowPositions = new Float32Array(MAX_WEATHER_PARTICLES * 3);
    this.snowSeeds = new Float32Array(MAX_WEATHER_PARTICLES);
    for (let index = 0; index < MAX_WEATHER_PARTICLES; index += 1) {
      const x = (random() - 0.5) * 22;
      const y = random() * 18 - 4;
      const z = (random() - 0.5) * 18;
      const rainOffset = index * 6;
      this.rainPositions[rainOffset] = x;
      this.rainPositions[rainOffset + 1] = y;
      this.rainPositions[rainOffset + 2] = z;
      this.rainPositions[rainOffset + 3] = x + 0.08;
      this.rainPositions[rainOffset + 4] = y - 0.72;
      this.rainPositions[rainOffset + 5] = z;
      const snowOffset = index * 3;
      this.snowPositions[snowOffset] = x * 0.86;
      this.snowPositions[snowOffset + 1] = y;
      this.snowPositions[snowOffset + 2] = z * 0.86;
      this.snowSeeds[index] = random() * Math.PI * 2;
    }

    this.splashPositions = new Float32Array(160 * 3);
    this.splashBases = new Float32Array(160 * 2);
    this.splashSeeds = new Float32Array(160);
    for (let index = 0; index < 160; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 4.55;
      this.splashBases[index * 2] = Math.cos(angle) * radius;
      this.splashBases[index * 2 + 1] = Math.sin(angle) * radius;
      this.splashSeeds[index] = random();
    }

    this.rainGeometry = new BufferGeometry();
    this.rainGeometry.setAttribute('position', new BufferAttribute(this.rainPositions, 3));
    this.rainMaterial = new LineBasicMaterial({
      color: '#a9c1cc',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rain = new LineSegments(this.rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;

    this.snowGeometry = new BufferGeometry();
    this.snowGeometry.setAttribute('position', new BufferAttribute(this.snowPositions, 3));
    this.snowMaterial = new PointsMaterial({
      color: '#d7e3e7',
      size: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaMap: this.snowTexture,
      alphaTest: 0.015,
    });
    this.snow = new Points(this.snowGeometry, this.snowMaterial);
    this.snow.frustumCulled = false;

    this.splashGeometry = new BufferGeometry();
    this.splashGeometry.setAttribute('position', new BufferAttribute(this.splashPositions, 3));
    this.splashMaterial = new PointsMaterial({
      color: '#c9e0e6',
      size: 0.075,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.splashes = new Points(this.splashGeometry, this.splashMaterial);
    this.splashes.frustumCulled = false;

    this.lightning.position.set(-9, 15, -12);
    this.lightning.name = 'weather-lightning';
    this.scene.add(this.rain, this.snow, this.splashes, this.lightning);
    this.particleBudget = profile.weatherParticles;
    this.setQuality(profile);
  }

  setQuality(profile: QualityProfile): void {
    this.particleBudget = profile.weatherParticles;
    this.baseSnowSize = profile.dprCap > 1.5 ? 0.105 : 0.13;
    this.snowMaterial.size = this.baseSnowSize;
    this.splashMaterial.size = profile.dprCap > 1.5 ? 0.065 : 0.082;
  }

  update(signals: SceneSignals, elapsed: number, delta: number): void {
    const rainCount = Math.floor(this.particleBudget * signals.rain * 0.62);
    const snowCount = Math.min(
      MAX_WEATHER_PARTICLES,
      Math.floor(this.particleBudget * signals.snow * (0.95 + signals.snow * 1.2)),
    );
    const splashCount = Math.floor(Math.min(160, this.particleBudget * 0.2) * signals.rain);
    this.activeParticles = rainCount + snowCount + splashCount;
    this.rainGeometry.setDrawRange(0, rainCount * 2);
    this.snowGeometry.setDrawRange(0, snowCount);
    this.splashGeometry.setDrawRange(0, splashCount);
    this.rainMaterial.opacity = signals.rain * 0.44;
    this.snowMaterial.opacity = signals.snow * (0.72 + signals.snow * 0.22);
    this.snowMaterial.size = this.baseSnowSize * (1 + signals.snow * 1.65);
    this.splashMaterial.opacity = signals.rain * 0.48;
    this.lightning.intensity = signals.stormEnergy * signals.lightningFlash * 18;
    this.lightning.position.x = -11 + signals.stormFront * 18;

    const rainMotion = derivePrecipitationMotion({
      wind: signals.windStrength,
      intensity: signals.rain,
      elapsed,
      motionScale: signals.motionScale,
    });
    const rainMotionScale = 0.55 + signals.motionScale * 0.45;
    for (let index = 0; index < rainCount; index += 1) {
      const offset = index * 6;
      const seed = this.snowSeeds[index] ?? 0;
      const turbulence = Math.sin(elapsed * 3.7 + seed) * signals.windStrength * 0.46;
      const windVariance = 0.74 + ((seed / (Math.PI * 2)) % 1) * 0.5;
      let x =
        (this.rainPositions[offset] ?? 0) +
        (rainMotion.velocityX * windVariance + turbulence) * delta * rainMotionScale;
      let y =
        (this.rainPositions[offset + 1] ?? 0) - rainMotion.fallSpeed * delta * rainMotionScale;
      let z =
        (this.rainPositions[offset + 2] ?? 0) +
        (rainMotion.velocityZ * windVariance + turbulence * 0.18) * delta * rainMotionScale;
      if (y < -5.5) y += 20;
      if (x < -11) x += 22;
      if (x > 11) x -= 22;
      if (z < -9) z += 18;
      if (z > 9) z -= 18;
      const lengthVariance = 0.78 + ((seed / (Math.PI * 2)) % 1) * 0.42;
      this.rainPositions[offset] = x;
      this.rainPositions[offset + 1] = y;
      this.rainPositions[offset + 2] = z;
      this.rainPositions[offset + 3] = x + rainMotion.streakX * lengthVariance * windVariance;
      this.rainPositions[offset + 4] = y + rainMotion.streakY * lengthVariance;
      this.rainPositions[offset + 5] = z + rainMotion.streakZ * lengthVariance * windVariance;
    }

    const snowSpeed = delta * (0.85 + signals.snow * 1.2) * (0.45 + signals.motionScale * 0.55);
    for (let index = 0; index < snowCount; index += 1) {
      const offset = index * 3;
      let y = (this.snowPositions[offset + 1] ?? 0) - snowSpeed;
      if (y < -5.5) y += 20;
      const drift = Math.sin(elapsed * 0.65 + (this.snowSeeds[index] ?? 0)) * delta * 0.45;
      let x = (this.snowPositions[offset] ?? 0) + drift + signals.cloudSpeed * delta * 0.5;
      if (x > 9.5) x = -9.5;
      if (x < -9.5) x = 9.5;
      let z =
        (this.snowPositions[offset + 2] ?? 0) +
        Math.cos(elapsed * 0.48 + (this.snowSeeds[index] ?? 0)) * delta * 0.24 +
        signals.windStrength * delta * 0.18;
      if (z > 7.8) z = -7.8;
      if (z < -7.8) z = 7.8;
      this.snowPositions[offset] = x;
      this.snowPositions[offset + 1] = y;
      this.snowPositions[offset + 2] = z;
    }
    for (let index = 0; index < splashCount; index += 1) {
      const offset = index * 3;
      const seed = this.splashSeeds[index] ?? 0;
      const phase = (elapsed * (2.4 + signals.rain * 3.8) + seed * 7.13) % 1;
      const spread = Math.sin(phase * Math.PI) * (0.025 + signals.windStrength * 0.055);
      this.splashPositions[offset] =
        (this.splashBases[index * 2] ?? 0) - spread * (0.6 + seed * 0.4);
      this.splashPositions[offset + 1] = 0.64 + Math.sin(phase * Math.PI) * 0.12;
      this.splashPositions[offset + 2] = (this.splashBases[index * 2 + 1] ?? 0) - spread * 0.22;
    }
    const rainPositionAttribute = this.rainGeometry.attributes.position;
    const snowPositionAttribute = this.snowGeometry.attributes.position;
    const splashPositionAttribute = this.splashGeometry.attributes.position;
    if (rainPositionAttribute) rainPositionAttribute.needsUpdate = rainCount > 0;
    if (snowPositionAttribute) snowPositionAttribute.needsUpdate = snowCount > 0;
    if (splashPositionAttribute) splashPositionAttribute.needsUpdate = splashCount > 0;

    this.fogColor.setRGB(...signals.fogColor);
    if (!(this.scene.fog instanceof FogExp2)) this.scene.fog = new FogExp2(this.fogColor, 0.004);
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density = signals.fogDensity;
  }

  getParticleCount(): number {
    return this.activeParticles;
  }

  dispose(): void {
    this.scene.remove(this.rain, this.snow, this.splashes, this.lightning);
    this.rainGeometry.dispose();
    this.snowGeometry.dispose();
    this.rainMaterial.dispose();
    this.snowMaterial.dispose();
    this.snowTexture.dispose();
    this.splashGeometry.dispose();
    this.splashMaterial.dispose();
  }
}
