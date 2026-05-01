/**
 * LevelBuilder.ts
 * 数据驱动的白盒关卡构建器。
 *
 * 职责：
 *  1. 读取 WhiteboxLevel 数据，生成 Three.js Mesh
 *  2. 自动输出碰撞体数据（供现有碰撞系统使用）
 *  3. 调用 verifyLevelReachability 验证可达性
 *  4. 支持 debug 模式（显示平台编号标注）
 *
 * 禁止：
 *  - 引入 cannon-es 或任何外部物理库
 *  - 加载 GLB / FBX 模型
 */

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  Sprite,
  SpriteMaterial,
} from 'three';

import { verifyLevelReachability } from '../player/PlayerPhysics';
import type { WhiteboxLevel, WhiteboxPlatform } from './level-types';

// ─── 颜色预设（玩具主题）──────────────────────────────────────────────────────

const TOY_COLORS = {
  red: '#EF4444',
  blue: '#3B82F6',
  yellow: '#FBBF24',
  green: '#22C55E',
  orange: '#F97316',
  purple: '#A855F7',
  pink: '#EC4899',
  teal: '#14B8A6',
  checkpoint: '#60A5FA', // 浅蓝色代表安全点
  goal: '#FCD34D', // 金色终点
  start: '#F6D365', // 暖黄起点
} as const;

function resolvePlatformColor(platform: WhiteboxPlatform): string {
  if (platform.isGoal) return TOY_COLORS.goal;
  if (platform.isCheckpoint) return TOY_COLORS.checkpoint;
  return platform.color ?? TOY_COLORS.blue;
}

// ─── 碰撞体数据（对外输出，供现有碰撞系统消费） ────────────────────────────────

export interface LevelColliderEntry {
  id: string;
  center: [number, number, number];
  size: [number, number, number];
  /** 碰撞体形状，box 或 ramp */
  shape: 'box' | 'ramp';
  debugMeta?: {
    category: 'platform';
    instanceId: string;
  };
}

// ─── 构建结果 ────────────────────────────────────────────────────────────────

export interface LevelBuildResult {
  /** 包含所有平台 Mesh 的 Group，已添加到 scene */
  group: Group;
  /** 碰撞体数据列表（与 createClimberPrototype 的 pushCollider 参数兼容） */
  colliders: LevelColliderEntry[];
  /** 可达性问题列表（为空则全部可达） */
  reachabilityIssues: string[];
  /** 清理所有生成资源（Geometry / Material / Texture） */
  dispose: () => void;
}

// ─── 核心构建函数 ─────────────────────────────────────────────────────────────

/**
 * 根据 WhiteboxLevel 数据构建场景 Mesh 和碰撞体数据。
 *
 * @param scene   Three.js 场景，Group 会被直接添加进去
 * @param level   白盒关卡定义
 * @param debug   是否渲染平台编号标注（开发调试用）
 */
export function buildWhiteboxLevel(
  scene: Scene,
  level: WhiteboxLevel,
  debug = false,
): LevelBuildResult {
  const group = new Group();
  group.name = `level:${level.id}`;
  scene.add(group);

  const geometries: (BoxGeometry | CylinderGeometry)[] = [];
  const materials: MeshStandardMaterial[] = [];
  const labelTextures: CanvasTexture[] = [];
  const labelMaterials: SpriteMaterial[] = [];
  const colliders: LevelColliderEntry[] = [];

  level.platforms.forEach((platform, index) => {
    const [w, h, d] = platform.size;
    const [px, py, pz] = platform.position;
    const color = resolvePlatformColor(platform);

    // ── 几何体 ──────────────────────────────────────────────────────────────
    let geo: BoxGeometry | CylinderGeometry;
    if (platform.type === 'cylinder') {
      geo = new CylinderGeometry(w / 2, w / 2, h, 16);
    } else {
      geo = new BoxGeometry(w, h, d);
    }

    // ── 材质（玩具哑光） ────────────────────────────────────────────────────
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.74,
      metalness: 0.04,
    });

    const mesh = new Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = platform.id;
    group.add(mesh);

    geometries.push(geo);
    materials.push(mat);

    // ── 碰撞体 ──────────────────────────────────────────────────────────────
    colliders.push({
      id: platform.id,
      center: [px, py, pz],
      size: [w, h, d],
      shape: platform.type === 'ramp' ? 'ramp' : 'box',
      debugMeta: {
        category: 'platform',
        instanceId: platform.id,
      },
    });

    // ── Debug 标注 ──────────────────────────────────────────────────────────
    if (debug) {
      const label = platform.label ?? `#${index} ${platform.id}`;
      const sprite = createDebugLabelSprite(label, labelTextures, labelMaterials);
      sprite.position.set(px, py + h / 2 + 0.55, pz);
      group.add(sprite);
    }
  });

  // ── 可达性验证 ──────────────────────────────────────────────────────────────
  const reachabilityIssues = verifyLevelReachability(level.platforms);

  return {
    group,
    colliders,
    reachabilityIssues,
    dispose: () => {
      scene.remove(group);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of labelTextures) t.dispose();
      for (const m of labelMaterials) m.dispose();
    },
  };
}

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

function createDebugLabelSprite(
  text: string,
  textures: CanvasTexture[],
  materials: SpriteMaterial[],
): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(15,23,42,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 24), canvas.width / 2, canvas.height / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  const mat = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new Sprite(mat);
  sprite.scale.set(1.8, 0.4, 1);
  sprite.renderOrder = 120;
  textures.push(texture);
  materials.push(mat);
  return sprite;
}
