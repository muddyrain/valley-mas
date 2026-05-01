/**
 * particleSystem.ts
 * 落地粒子 + 存档点激活粒子的创建、激发与逐帧更新。
 * 通过 createParticleSystem(scene) 工厂函数创建，返回句柄供主循环调用。
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  Points,
  PointsMaterial,
  type Scene,
} from 'three';

export interface ParticleSystemHandle {
  /** 在给定位置激发落地粒子 */
  emitLandParticles(ox: number, oy: number, oz: number): void;
  /** 在给定位置激发存档点粒子 */
  emitCheckpointParticles(ox: number, oy: number, oz: number): void;
  /** 每帧调用（delta 单位秒） */
  update(delta: number): void;
  /** 释放所有 GPU 资源 */
  dispose(): void;
}

export function createParticleSystem(scene: Scene): ParticleSystemHandle {
  // ── 落地粒子 ──────────────────────────────────────────────────────────────
  const LAND_PARTICLE_COUNT = 22;
  const LAND_PARTICLE_DURATION = 0.4;

  const landParticlePositions = new Float32Array(LAND_PARTICLE_COUNT * 3);
  const landParticleVelocities: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < LAND_PARTICLE_COUNT; i++) {
    landParticleVelocities.push({ x: 0, y: 0, z: 0 });
  }
  const landParticleGeo = new BufferGeometry();
  landParticleGeo.setAttribute('position', new Float32BufferAttribute(landParticlePositions, 3));
  const landParticleMat = new PointsMaterial({
    color: '#FDE68A',
    size: 0.12,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const landParticles = new Points(landParticleGeo, landParticleMat);
  landParticles.visible = false;
  scene.add(landParticles);
  let landParticleTimer = 0;

  // ── 存档点激活粒子 ────────────────────────────────────────────────────────
  const CP_PARTICLE_COUNT = 30;
  const CP_PARTICLE_DURATION = 0.6;

  const cpParticlePositions = new Float32Array(CP_PARTICLE_COUNT * 3);
  const cpParticleVelocities: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < CP_PARTICLE_COUNT; i++) {
    cpParticleVelocities.push({ x: 0, y: 0, z: 0 });
  }
  const cpParticleGeo = new BufferGeometry();
  cpParticleGeo.setAttribute('position', new Float32BufferAttribute(cpParticlePositions, 3));
  const cpParticleMat = new PointsMaterial({
    color: '#93C5FD',
    size: 0.16,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const cpParticles = new Points(cpParticleGeo, cpParticleMat);
  cpParticles.visible = false;
  scene.add(cpParticles);
  let cpParticleTimer = 0;

  // ── 公开接口 ──────────────────────────────────────────────────────────────

  function emitLandParticles(ox: number, oy: number, oz: number) {
    landParticleTimer = LAND_PARTICLE_DURATION;
    landParticles.visible = true;
    landParticleMat.opacity = 0.9;
    for (let i = 0; i < LAND_PARTICLE_COUNT; i++) {
      landParticlePositions[i * 3] = ox;
      landParticlePositions[i * 3 + 1] = oy;
      landParticlePositions[i * 3 + 2] = oz;
      const angle = (i / LAND_PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.5 + Math.random() * 2.5;
      const upBias = 0.8 + Math.random() * 1.6;
      const vel = landParticleVelocities[i];
      if (vel) {
        vel.x = Math.cos(angle) * speed * 0.55;
        vel.y = upBias;
        vel.z = Math.sin(angle) * speed * 0.55;
      }
    }
    const posAttr = landParticleGeo.attributes['position'];
    if (posAttr) posAttr.needsUpdate = true;
  }

  function emitCheckpointParticles(ox: number, oy: number, oz: number) {
    cpParticleTimer = CP_PARTICLE_DURATION;
    cpParticles.visible = true;
    cpParticleMat.opacity = 1.0;
    for (let i = 0; i < CP_PARTICLE_COUNT; i++) {
      cpParticlePositions[i * 3] = ox;
      cpParticlePositions[i * 3 + 1] = oy;
      cpParticlePositions[i * 3 + 2] = oz;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 2.0 + Math.random() * 3.0;
      const vel = cpParticleVelocities[i];
      if (vel) {
        vel.x = Math.sin(phi) * Math.cos(theta) * speed;
        vel.y = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed + 1.0;
        vel.z = Math.cos(phi) * speed;
      }
    }
    const posAttr = cpParticleGeo.attributes['position'];
    if (posAttr) posAttr.needsUpdate = true;
  }

  function update(delta: number) {
    if (landParticleTimer > 0) {
      landParticleTimer = Math.max(0, landParticleTimer - delta);
      const progress = 1 - landParticleTimer / LAND_PARTICLE_DURATION;
      landParticleMat.opacity = MathUtils.lerp(0.9, 0, progress * progress);
      for (let i = 0; i < LAND_PARTICLE_COUNT; i++) {
        const vel = landParticleVelocities[i];
        if (vel) {
          landParticlePositions[i * 3] += vel.x * delta;
          landParticlePositions[i * 3 + 1] += vel.y * delta;
          landParticlePositions[i * 3 + 2] += vel.z * delta;
          vel.y -= 9 * delta;
        }
      }
      const posAttr = landParticleGeo.attributes['position'];
      if (posAttr) posAttr.needsUpdate = true;
      if (landParticleTimer <= 0) landParticles.visible = false;
    }

    if (cpParticleTimer > 0) {
      cpParticleTimer = Math.max(0, cpParticleTimer - delta);
      const progress = 1 - cpParticleTimer / CP_PARTICLE_DURATION;
      cpParticleMat.opacity = MathUtils.lerp(1.0, 0, progress * progress);
      for (let i = 0; i < CP_PARTICLE_COUNT; i++) {
        const vel = cpParticleVelocities[i];
        if (vel) {
          cpParticlePositions[i * 3] += vel.x * delta;
          cpParticlePositions[i * 3 + 1] += vel.y * delta;
          cpParticlePositions[i * 3 + 2] += vel.z * delta;
          vel.y -= 7 * delta;
        }
      }
      const posAttr = cpParticleGeo.attributes['position'];
      if (posAttr) posAttr.needsUpdate = true;
      if (cpParticleTimer <= 0) cpParticles.visible = false;
    }
  }

  function dispose() {
    scene.remove(landParticles);
    scene.remove(cpParticles);
    landParticleGeo.dispose();
    cpParticleGeo.dispose();
    landParticleMat.dispose();
    cpParticleMat.dispose();
  }

  return { emitLandParticles, emitCheckpointParticles, update, dispose };
}
