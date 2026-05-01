/**
 * PlayerPhysics.ts
 * 可控跳跃物理参数模块 — 所有物理常量和能力边界计算集中于此。
 * 关卡设计时应先查阅 MAX_JUMP_HEIGHT / MAX_JUMP_DISTANCE_WALK。
 */

// ─── 物理常量 ─────────────────────────────────────────────────────────────────

export const PLAYER_PHYSICS = {
  /** 向下重力加速度 (m/s²) */
  gravity: 21,
  /** 起跳初速 (m/s) */
  jumpVelocity: 8.8,
  /** 步行水平速度 (m/s) */
  moveSpeed: 5.4,
  /** 冲刺水平速度 (m/s) */
  sprintSpeed: 8.2,
  /** 空中水平控制响应系数（越小越"飘"） */
  airControl: 7,
  /** 地面水平控制响应系数 */
  groundControl: 16,
} as const;

// ─── 推导能力边界（供关卡设计 & 可达性验证使用）──────────────────────────────

const { gravity, jumpVelocity, moveSpeed } = PLAYER_PHYSICS;

/**
 * 从起跳点高度能额外爬升的最大高度 (m)
 * 公式: v² / (2g)  ≈ 1.84 m
 */
export const MAX_JUMP_HEIGHT = (jumpVelocity * jumpVelocity) / (2 * gravity);

/** 到达跳跃顶点的时间 (s)  ≈ 0.42 s */
export const TIME_TO_APEX = jumpVelocity / gravity;

/**
 * 同高平台最大水平跳跃距离，步行 (m)  ≈ 4.53 m
 * 全程在空中的时间 = 2 × TIME_TO_APEX（相同起落高度）
 */
export const MAX_JUMP_DISTANCE_WALK = 2 * TIME_TO_APEX * moveSpeed;

/**
 * 同高平台最大水平跳跃距离，冲刺 (m)  ≈ 6.87 m
 */
export const MAX_JUMP_DISTANCE_SPRINT = 2 * TIME_TO_APEX * PLAYER_PHYSICS.sprintSpeed;

// ─── 可达性工具函数 ──────────────────────────────────────────────────────────

/**
 * 判断两个平台之间是否可达（步行，保守估算）。
 *
 * @param horizontalDist  水平距离，平台中心到中心 (m)
 * @param heightDiff      目标平台顶面 − 起跳平台顶面的高度差 (m)，正值表示向上
 * @returns true 表示在当前物理参数下可以跳到
 */
export function isJumpReachable(horizontalDist: number, heightDiff: number): boolean {
  if (heightDiff <= 0) {
    // 向下：额外空中时间 = sqrt(2 * |dh| / g)
    const extraAirTime = Math.sqrt((Math.abs(heightDiff) * 2) / gravity);
    const maxDist = (TIME_TO_APEX + TIME_TO_APEX + extraAirTime) * moveSpeed;
    return horizontalDist <= maxDist;
  }
  // 向上：先检查能否到达高度
  if (heightDiff > MAX_JUMP_HEIGHT - 0.05) return false;
  // 计算到达目标高度时的飞行时间（降落侧，较大根）
  const disc = jumpVelocity * jumpVelocity - 2 * gravity * heightDiff;
  if (disc < 0) return false;
  const landTime = (jumpVelocity + Math.sqrt(disc)) / gravity;
  return horizontalDist <= landTime * moveSpeed;
}

/**
 * 计算两个平台中心之间的水平距离（忽略 Y 轴）。
 */
export function platformHorizontalDist(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

/**
 * 批量验证关卡平台序列可达性，打印警告并返回问题列表。
 * 供 LevelBuilder 和开发调试调用。
 *
 * @param platforms  按路径顺序排列的平台数组
 * @param playerRadius  玩家球半径（默认 0.42）
 */
export function verifyLevelReachability(
  platforms: ReadonlyArray<{
    id: string;
    position: [number, number, number];
    size: [number, number, number];
  }>,
  playerRadius = 0.42,
): string[] {
  const issues: string[] = [];

  for (let i = 1; i < platforms.length; i++) {
    const prev = platforms[i - 1];
    const curr = platforms[i];

    // 平台顶面 = center_y + half_height
    const prevTop = prev.position[1] + prev.size[1] / 2;
    const currTop = curr.position[1] + curr.size[1] / 2;
    const heightDiff = currTop - prevTop;

    // 水平距离（中心到中心）
    const hDist = platformHorizontalDist(prev.position, curr.position);

    // 减去两平台最近边的"可走区域"补偿（选最小水平尺寸的一半）
    const prevHalfW = Math.min(prev.size[0], prev.size[2]) / 2;
    const currHalfW = Math.min(curr.size[0], curr.size[2]) / 2;
    const edgeDist = Math.max(0, hDist - prevHalfW - currHalfW);

    if (!isJumpReachable(edgeDist, heightDiff)) {
      const msg =
        `⚠️ 不可达: ${prev.id} → ${curr.id} ` +
        `| 边缘距=${edgeDist.toFixed(2)}m  高差=${heightDiff.toFixed(2)}m` +
        `  (最大跳高=${MAX_JUMP_HEIGHT.toFixed(2)}m  最大水平=${MAX_JUMP_DISTANCE_WALK.toFixed(2)}m)`;
      console.warn('[LevelReachability]', msg);
      issues.push(msg);
    }
  }

  if (issues.length === 0) {
    console.log(
      `[LevelReachability] ✅ 全部 ${platforms.length - 1} 段路径可达（playerRadius=${playerRadius}）`,
    );
  }

  return issues;
}
