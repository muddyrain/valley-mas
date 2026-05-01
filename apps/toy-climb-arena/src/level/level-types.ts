/**
 * level-types.ts
 * 白盒关卡数据结构定义。
 * 不依赖 Three.js，可在纯 TS 环境下使用（如关卡编辑器、测试等）。
 */

// ─── 平台类型 ────────────────────────────────────────────────────────────────

/** 平台几何类型 */
export type PlatformType = 'platform' | 'ramp' | 'cylinder';

/**
 * 白盒平台定义
 * 所有尺寸单位均为米 (m)，坐标系与 Three.js 一致（Y 轴向上）。
 */
export interface WhiteboxPlatform {
  /** 唯一 ID，用于可达性报告和 Debug UI */
  id: string;
  /** 平台中心坐标 [x, y, z] */
  position: [number, number, number];
  /**
   * 平台包围盒尺寸 [宽, 高, 深]
   * - type=platform : Box  (width × height × depth)
   * - type=ramp     : Box（顶面斜切，碰撞体仍为 Box）
   * - type=cylinder : Cylinder (radius=width/2, height)
   */
  size: [number, number, number];
  /** 几何类型，默认 'platform' */
  type?: PlatformType;
  /** 显示颜色（CSS 颜色字符串） */
  color?: string;
  /** 人类可读标签，供 Debug 标注 */
  label?: string;
  /** 是否为安全存档点（每 6~8 步一个） */
  isCheckpoint?: boolean;
  /** 是否为终点平台 */
  isGoal?: boolean;
}

// ─── 关卡主体 ────────────────────────────────────────────────────────────────

export interface WhiteboxLevelTheme {
  skyColor?: string;
  floorColor?: string;
}

/**
 * 白盒关卡定义
 * 不含任何 GLB / FBX 模型引用，所有碰撞体由 LevelBuilder 自动生成。
 */
export interface WhiteboxLevel {
  id: string;
  name: string;
  description: string;
  /** 玩家出生点（球心坐标） */
  startPosition: [number, number, number];
  /** 相机初始偏移量（可选） */
  cameraOffset?: [number, number, number];
  theme?: WhiteboxLevelTheme;
  /**
   * 平台列表，按路径顺序排列。
   * 第一项为出生平台，最后一项为终点。
   * LevelBuilder 将依此顺序做可达性验证。
   */
  platforms: WhiteboxPlatform[];
}
