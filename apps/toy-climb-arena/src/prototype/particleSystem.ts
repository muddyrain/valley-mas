/**
 * particleSystem.ts
 * 跳跃拖尾、落地粒子、通关粒子的创建、激发与逐帧更新。
 * 通过 createParticleSystem(scene) 工厂函数创建，返回句柄供主循环调用。
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  MathUtils,
  Points,
  type Scene,
  ShaderMaterial,
} from 'three';

type ParticleSpawn = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  color: string;
};

export interface ParticleSystemHandle {
  /** 在给定位置激发跳跃拖尾 */
  emitJumpTrail(
    ox: number,
    oy: number,
    oz: number,
    vx: number,
    vy: number,
    vz: number,
    delta: number,
  ): void;
  /** 在给定位置激发落地粒子 */
  emitLandParticles(
    ox: number,
    oy: number,
    oz: number,
    impactVelocityY?: number,
    horizontalSpeed?: number,
  ): void;
  /** 在给定位置激发通关粒子 */
  emitGoalParticles(ox: number, oy: number, oz: number): void;
  /** 在给定位置激发存档点粒子 */
  emitCheckpointParticles(ox: number, oy: number, oz: number): void;
  /** 每帧调用（delta 单位秒） */
  update(delta: number): void;
  /** 释放所有 GPU 资源 */
  dispose(): void;
}

interface ParticlePoolConfig {
  count: number;
  gravity: number;
  drag: number;
  opacity: number;
}

interface ParticlePoolHandle {
  spawn(spawn: ParticleSpawn): void;
  update(delta: number): void;
  dispose(): void;
}

const JUMP_TRAIL_PALETTE = ['#fef3c7', '#93c5fd', '#f9a8d4', '#bbf7d0', '#fde68a'];
const LAND_PALETTE = ['#fef08a', '#fdba74', '#fca5a5', '#fff7ed', '#c7d2fe'];
const GOAL_PALETTE = ['#f472b6', '#60a5fa', '#facc15', '#34d399', '#fb7185', '#c084fc', '#fb923c'];
const CHECKPOINT_PALETTE = ['#bfdbfe', '#93c5fd', '#60a5fa', '#dbeafe'];

function createParticlePool(scene: Scene, config: ParticlePoolConfig): ParticlePoolHandle {
  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const velocities = new Float32Array(config.count * 3);
  const ages = new Float32Array(config.count);
  const lifetimes = new Float32Array(config.count);
  const sizes = new Float32Array(config.count);
  const active = new Uint8Array(config.count);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aVelocity', new BufferAttribute(velocities, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aAge', new BufferAttribute(ages, 1).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aLife', new BufferAttribute(lifetimes, 1).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uOpacity: { value: config.opacity },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute vec3 aVelocity;
      attribute float aAge;
      attribute float aLife;
      attribute float aSize;

      varying vec3 vColor;
      varying float vAlpha;

      uniform float uPixelRatio;

      void main() {
        float safeLife = max(aLife, 0.0001);
        float progress = clamp(aAge / safeLife, 0.0, 1.0);
        float lift = (1.0 - progress) * 0.26;
        vec3 animatedPosition = position + aVelocity * lift;
        vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);

        vColor = aColor;
        vAlpha = pow(1.0 - progress, 1.7);
        gl_PointSize = aSize * uPixelRatio * 520.0 / max(1.0, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      uniform float uOpacity;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        float glow = smoothstep(0.5, 0.0, dist);
        float core = smoothstep(0.28, 0.0, dist);
        float alpha = uOpacity * vAlpha * mix(glow, core, 0.42);
        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);

  let cursor = 0;
  let hasActiveParticles = false;

  function writeColor(index: number, color: string): void {
    const rgb = new Color(color);
    const offset = index * 3;
    colors[offset] = rgb.r;
    colors[offset + 1] = rgb.g;
    colors[offset + 2] = rgb.b;
  }

  function resetParticle(index: number): void {
    active[index] = 0;
    ages[index] = 1;
    lifetimes[index] = 0;
    sizes[index] = 0;
  }

  function spawn(spawnData: ParticleSpawn): void {
    const index = cursor;
    cursor = (cursor + 1) % config.count;
    const offset = index * 3;

    active[index] = 1;
    positions[offset] = spawnData.x;
    positions[offset + 1] = spawnData.y;
    positions[offset + 2] = spawnData.z;
    velocities[offset] = spawnData.vx;
    velocities[offset + 1] = spawnData.vy;
    velocities[offset + 2] = spawnData.vz;
    ages[index] = 0;
    lifetimes[index] = Math.max(0.08, spawnData.life);
    sizes[index] = Math.max(0.01, spawnData.size);
    writeColor(index, spawnData.color);
    hasActiveParticles = true;
  }

  function update(delta: number): void {
    if (!hasActiveParticles) return;

    let activeCount = 0;
    for (let i = 0; i < config.count; i++) {
      if (!active[i]) continue;

      ages[i] += delta;
      if (ages[i] >= lifetimes[i]) {
        resetParticle(i);
        continue;
      }

      const offset = i * 3;
      positions[offset] += velocities[offset] * delta;
      positions[offset + 1] += velocities[offset + 1] * delta;
      positions[offset + 2] += velocities[offset + 2] * delta;

      velocities[offset] *= Math.max(0, 1 - config.drag * delta);
      velocities[offset + 1] -= config.gravity * delta;
      velocities[offset + 2] *= Math.max(0, 1 - config.drag * delta);
      activeCount++;
    }

    if (!activeCount) {
      hasActiveParticles = false;
      points.visible = false;
      return;
    }

    points.visible = true;
    geometry.attributes['position'].needsUpdate = true;
    geometry.attributes['aColor'].needsUpdate = true;
    geometry.attributes['aVelocity'].needsUpdate = true;
    geometry.attributes['aAge'].needsUpdate = true;
    geometry.attributes['aLife'].needsUpdate = true;
    geometry.attributes['aSize'].needsUpdate = true;
  }

  function dispose(): void {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return { spawn, update, dispose };
}

export function createParticleSystem(scene: Scene): ParticleSystemHandle {
  const jumpTrailPool = createParticlePool(scene, {
    count: 42,
    gravity: 2.8,
    drag: 1.8,
    opacity: 0.95,
  });
  const landPool = createParticlePool(scene, {
    count: 28,
    gravity: 8.8,
    drag: 2.2,
    opacity: 0.98,
  });
  const goalPool = createParticlePool(scene, {
    count: 56,
    gravity: 3.2,
    drag: 1.2,
    opacity: 1.0,
  });
  const checkpointPool = createParticlePool(scene, {
    count: 32,
    gravity: 6.2,
    drag: 1.9,
    opacity: 0.92,
  });

  // ── 公开接口 ──────────────────────────────────────────────────────────────

  function emitJumpTrail(
    ox: number,
    oy: number,
    oz: number,
    vx: number,
    vy: number,
    vz: number,
    delta: number,
  ) {
    const horizontalSpeed = Math.hypot(vx, vz);
    const liftSpeed = Math.max(0, vy);
    if (horizontalSpeed < 0.08 && liftSpeed < 0.08) return;

    const dirX = horizontalSpeed > 0.001 ? vx / horizontalSpeed : 0;
    const dirZ = horizontalSpeed > 0.001 ? vz / horizontalSpeed : 0;
    const sideX = horizontalSpeed > 0.001 ? -dirZ : 1;
    const sideZ = horizontalSpeed > 0.001 ? dirX : 0;
    const colorPalette = vy >= -0.2 ? JUMP_TRAIL_PALETTE : LAND_PALETTE;
    const count = MathUtils.clamp(
      Math.round(1 + horizontalSpeed * 0.85 + liftSpeed * 0.35 + delta * 30),
      1,
      4,
    );
    for (let i = 0; i < count; i++) {
      const color = colorPalette[(i + Math.floor(horizontalSpeed * 10)) % colorPalette.length];
      const back = 0.08 + Math.random() * 0.18;
      const lateral = (Math.random() - 0.5) * 0.14;
      const spread = 0.03 + Math.random() * 0.04;
      jumpTrailPool.spawn({
        x: ox - dirX * back + sideX * lateral + (Math.random() - 0.5) * spread,
        y: oy + 0.02 + Math.random() * 0.16,
        z: oz - dirZ * back + sideZ * lateral + (Math.random() - 0.5) * spread,
        vx: -dirX * (0.26 + Math.random() * 0.32) + sideX * (Math.random() - 0.5) * 0.16,
        vy: 0.36 + Math.random() * 0.55 + liftSpeed * 0.12,
        vz: -dirZ * (0.26 + Math.random() * 0.32) + sideZ * (Math.random() - 0.5) * 0.16,
        size: 0.06 + Math.random() * 0.05,
        life: 0.22 + Math.random() * 0.16,
        color,
      });
    }
  }

  function emitLandParticles(
    ox: number,
    oy: number,
    oz: number,
    impactVelocityY = 0,
    horizontalSpeed = 0,
  ) {
    const impactStrength = MathUtils.clamp(
      Math.max(0, -impactVelocityY) * 0.22 + horizontalSpeed * 0.16,
      0.9,
      2.4,
    );
    const count = MathUtils.clamp(Math.round(14 + impactStrength * 5), 14, 24);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const ringRadius = 0.04 + Math.random() * 0.12;
      const burstSpeed = (1.0 + Math.random() * 1.5) * impactStrength;
      const rise = 0.65 + Math.random() * 0.85 + impactStrength * 0.24;
      landPool.spawn({
        x: ox + Math.cos(angle) * ringRadius,
        y: oy + 0.01 + Math.random() * 0.08,
        z: oz + Math.sin(angle) * ringRadius,
        vx: Math.cos(angle) * burstSpeed * 0.5,
        vy: rise,
        vz: Math.sin(angle) * burstSpeed * 0.5,
        size: 0.08 + Math.random() * 0.06,
        life: 0.28 + Math.random() * 0.18,
        color: LAND_PALETTE[i % LAND_PALETTE.length],
      });
    }
  }

  function emitGoalParticles(ox: number, oy: number, oz: number) {
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2 + Math.random() * 0.35;
      const sphereLift = 0.14 + Math.random() * 0.36;
      const radius = 0.04 + Math.random() * 0.22;
      const speed = 1.4 + Math.random() * 2.8;
      const color =
        GOAL_PALETTE[(i + Math.floor(Math.random() * GOAL_PALETTE.length)) % GOAL_PALETTE.length];
      goalPool.spawn({
        x: ox + Math.cos(angle) * radius,
        y: oy + sphereLift,
        z: oz + Math.sin(angle) * radius,
        vx: Math.cos(angle) * speed * 0.72,
        vy: 1.15 + Math.random() * 1.85,
        vz: Math.sin(angle) * speed * 0.72,
        size: 0.1 + Math.random() * 0.08,
        life: 0.48 + Math.random() * 0.34,
        color,
      });
    }
  }

  function emitCheckpointParticles(ox: number, oy: number, oz: number) {
    for (let i = 0; i < 30; i++) {
      const theta = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.8 + Math.random() * 2.6;
      checkpointPool.spawn({
        x: ox,
        y: oy,
        z: oz,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.abs(Math.sin(phi) * Math.sin(theta)) * speed + 0.8,
        vz: Math.cos(phi) * speed,
        size: 0.08 + Math.random() * 0.06,
        life: 0.42 + Math.random() * 0.24,
        color: CHECKPOINT_PALETTE[i % CHECKPOINT_PALETTE.length],
      });
    }
  }

  function update(delta: number) {
    jumpTrailPool.update(delta);
    landPool.update(delta);
    goalPool.update(delta);
    checkpointPool.update(delta);
  }

  function dispose() {
    jumpTrailPool.dispose();
    landPool.dispose();
    goalPool.dispose();
    checkpointPool.dispose();
  }

  return {
    emitJumpTrail,
    emitLandParticles,
    emitGoalParticles,
    emitCheckpointParticles,
    update,
    dispose,
  };
}
