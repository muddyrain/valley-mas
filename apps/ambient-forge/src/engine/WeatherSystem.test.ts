import { PointLight, type PointsMaterial, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import { WeatherSystem } from './WeatherSystem';

describe('WeatherSystem', () => {
  it('把强风位移和倾角真实写入雨线的 GPU 缓冲区', () => {
    const scene = new Scene();
    const weather = new WeatherSystem(scene, getQualityProfile('high'));
    const signals = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      weather: 'rain',
      weatherIntensity: 1,
      wind: 1,
    });
    const positions = weather.rain.geometry.getAttribute('position').array as Float32Array;
    const initialHeadX = positions[0] ?? 0;

    weather.update(signals, 1.2, 1 / 30);

    const horizontal = Math.abs((positions[3] ?? 0) - (positions[0] ?? 0));
    const vertical = Math.abs((positions[4] ?? 0) - (positions[1] ?? 0));
    expect(positions[0] ?? 0).toBeLessThan(initialHeadX - 0.4);
    expect(horizontal / vertical).toBeGreaterThan(0.75);
    expect(weather.rain.geometry.drawRange.count).toBeLessThanOrEqual(1100);
    weather.dispose();
  });

  it('满强度降雪会突破基础粒子预算并放大近景雪片', () => {
    const scene = new Scene();
    const profile = getQualityProfile('high');
    const weather = new WeatherSystem(scene, profile);
    const signals = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      weather: 'snow',
      weatherIntensity: 1,
    });

    weather.update(signals, 1.2, 1 / 30);

    expect(weather.snow.geometry.drawRange.count).toBeGreaterThan(profile.weatherParticles);
    expect((weather.snow.material as PointsMaterial).size).toBeGreaterThan(0.14);
    weather.dispose();
  });

  it('使用天气生命周期的闪电脉冲而不是固定周期闪烁', () => {
    const scene = new Scene();
    const weather = new WeatherSystem(scene, getQualityProfile('high'));
    const signals = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      weather: 'rain',
      weatherIntensity: 1,
      wind: 1,
    });
    const lightning = scene.getObjectByName('weather-lightning');

    weather.update({ ...signals, lightningFlash: 1, stormEnergy: 1 }, 0, 1 / 60);

    expect(lightning).toBeInstanceOf(PointLight);
    expect((lightning as PointLight).intensity).toBeGreaterThan(10);
    weather.dispose();
  });
});
