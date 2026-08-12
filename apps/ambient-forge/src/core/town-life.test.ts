import { describe, expect, it } from 'vitest';
import {
  clampCrowdOffset,
  findSocialEncounter,
  getCrowdOffsetTarget,
  getCrowdTravelScale,
  getNpcRoutine,
  getPedestrianBrakeScale,
  getSocialPairKey,
  limitCrowdOffsetStep,
  pickClearestCrowdPosition,
  pickCrowdPassingPosition,
  resolveCrowdMovement,
  resolveCrowdOffsets,
  stepCrowdOffset,
} from './town-life';

describe('town life', () => {
  it('按一天中的时间划分居民通勤、工作、休闲和休息阶段', () => {
    expect(getNpcRoutine(6.5)).toBe('commute');
    expect(getNpcRoutine(10)).toBe('work');
    expect(getNpcRoutine(19)).toBe('leisure');
    expect(getNpcRoutine(23)).toBe('rest');
  });

  it('找出距离足够近且不受控的居民作为社交组合', () => {
    expect(
      findSocialEncounter([
        { id: 'traveler', position: [0, 0] },
        { id: 'photographer', position: [0.8, 0.2] },
        { id: 'courier', position: [4, 4], controlled: true },
      ]),
    ).toEqual(['traveler', 'photographer']);
  });

  it('同一对居民进入成对冷却后不会立刻重复打招呼，但仍可与其他邻居互动', () => {
    const blockedPairs = new Set([getSocialPairKey('traveler', 'photographer')]);
    const encounter = findSocialEncounter(
      [
        { id: 'traveler', position: [0, 0] },
        { id: 'photographer', position: [0.5, 0] },
        { id: 'courier', position: [0.9, 0] },
      ],
      1.25,
      blockedPairs,
    );

    expect(getSocialPairKey('photographer', 'traveler')).toBe('photographer:traveler');
    expect(encounter).toEqual(['photographer', 'courier']);
  });

  it('正面相遇时只让一名居民沿右侧横向礼让，避免双方背对背弹开', () => {
    const offsets = resolveCrowdOffsets(
      [
        { id: 'traveler', position: [0, 0], forward: [1, 0] },
        { id: 'photographer', position: [0.3, 0], forward: [-1, 0] },
      ],
      0.9,
    );

    const movingOffsets = Object.values(offsets).filter((offset) => Math.hypot(...offset) > 0.01);
    expect(movingOffsets).toHaveLength(1);
    expect(Math.abs(movingOffsets[0]?.[0] ?? 0)).toBeLessThan(0.01);
    expect(Math.abs(movingOffsets[0]?.[1] ?? 0)).toBeGreaterThan(0.2);
  });

  it('三名居民同向通过窄路时加入横向错身，避免纵向修正互相抵消', () => {
    const offsets = resolveCrowdOffsets([
      { id: 'front', position: [0, 0], forward: [0, 1] },
      { id: 'middle', position: [0, 0.35], forward: [0, 1] },
      { id: 'back', position: [0, 0.7], forward: [0, 1] },
    ]);

    expect(Math.abs(offsets.middle?.[0] ?? 0)).toBeGreaterThan(0.02);
    expect(Math.abs(offsets.front?.[0] ?? 0) + Math.abs(offsets.back?.[0] ?? 0)).toBeGreaterThan(
      0.05,
    );
  });

  it('两名都在行走时平均分摊错身距离，不把整段横移压给其中一人', () => {
    const offsets = resolveCrowdOffsets([
      { id: 'florist', position: [0, 0], forward: [1, 0], moving: true },
      { id: 'photographer', position: [0.35, 0], forward: [1, 0], moving: true },
    ]);

    expect(Math.hypot(...offsets.florist)).toBeGreaterThan(0.1);
    expect(Math.hypot(...offsets.photographer)).toBeGreaterThan(0.1);
    expect(Math.hypot(...offsets.florist)).toBeLessThanOrEqual(0.38);
    expect(Math.hypot(...offsets.photographer)).toBeLessThanOrEqual(0.38);
    expect(offsets.florist[1]).toBeCloseTo(-offsets.photographer[1], 6);
  });

  it('两名移动居民完成错身前后保持同一通行侧，避让向量不突然翻面', () => {
    const before = resolveCrowdOffsets([
      { id: 'courier', position: [-0.1, 0], forward: [0, 1], moving: true },
      { id: 'mechanic', position: [0.1, 0.7], forward: [0, -1], moving: true },
    ]);
    const after = resolveCrowdOffsets([
      { id: 'courier', position: [0.1, 0.8], forward: [0, 1], moving: true },
      { id: 'mechanic', position: [-0.1, 0], forward: [0, -1], moving: true },
    ]);

    expect(Math.sign(before.mechanic[0])).toBe(Math.sign(after.mechanic[0]));
  });

  it('两名都在移动的居民距离尚远时不提前横移绕行', () => {
    const offsets = resolveCrowdOffsets([
      { id: 'courier', position: [0, 0], forward: [0, 1], moving: true },
      { id: 'mechanic', position: [0, 1], forward: [0, -1], moving: true },
    ]);

    expect(offsets.courier).toEqual([0, 0]);
    expect(offsets.mechanic).toEqual([0, 0]);
  });

  it('赶路居民接近静止邻居时提前减速，双向相遇只由稳定的一方礼让', () => {
    const approachingIdle = [
      { id: 'baker', position: [0, 1] as const, forward: [0, 1] as const, moving: false },
      { id: 'musician', position: [0, 0] as const, forward: [0, 1] as const, moving: true },
    ];
    expect(getCrowdTravelScale('musician', approachingIdle)).toBe(0);

    const headOn = [
      { id: 'baker', position: [0, 0] as const, forward: [0, 1] as const, moving: true },
      { id: 'musician', position: [0, 1] as const, forward: [0, -1] as const, moving: true },
    ];
    expect(getCrowdTravelScale('baker', headOn)).toBe(1);
    expect(getCrowdTravelScale('musician', headOn)).toBe(0.12);

    expect(
      getCrowdTravelScale('musician', [
        approachingIdle[0] as (typeof approachingIdle)[number],
        { ...approachingIdle[1], position: [0, -2.2] },
      ]),
    ).toBe(1);
  });

  it('静止居民挡路时先提前侧移，取得横向净空后再恢复前进', () => {
    const agents = [
      { id: 'baker', position: [0, 1] as const, forward: [0, 1] as const, moving: false },
      { id: 'musician', position: [0, 0] as const, forward: [0, 1] as const, moving: true },
    ];
    const offsets = resolveCrowdOffsets(agents);

    expect(Math.abs(offsets.musician?.[0] ?? 0)).toBeGreaterThan(0.6);
    expect(
      getCrowdTravelScale('musician', [
        agents[0],
        { ...agents[1], position: [offsets.musician?.[0] ?? 0, 0] },
      ]),
    ).toBe(1);
    expect(getCrowdTravelScale('musician', [agents[0], { ...agents[1], position: [0.5, 0] }])).toBe(
      1,
    );
  });

  it('行进者与已到站居民相遇时始终由行进者绕行，不受名称排序影响', () => {
    const offsets = resolveCrowdOffsets([
      { id: 'courier', position: [0, 0], forward: [0, 1], moving: true },
      { id: 'mechanic', position: [0, 1], forward: [0, 1], moving: false },
    ]);

    expect(Math.hypot(...offsets.courier)).toBeGreaterThan(0.6);
    expect(offsets.mechanic).toEqual([0, 0]);
  });

  it('多个静止居民分布在道路两侧时，行进者保持同一绕行侧不会互相抵消', () => {
    const offsets = resolveCrowdOffsets([
      { id: 'courier', position: [0, 0], forward: [0, 1], moving: true },
      { id: 'mechanic', position: [-0.3, 1], forward: [0, 1], moving: false },
      { id: 'harborhand', position: [0.3, 1], forward: [0, 1], moving: false },
    ]);

    expect(Math.abs(offsets.courier?.[0] ?? 0)).toBeGreaterThan(1);
    expect(Math.abs(offsets.courier?.[1] ?? 0)).toBeLessThan(0.01);
  });

  it('居民单帧移动会在邻居安全圈边缘停下，不会靠软偏移穿过身体', () => {
    const resolved = resolveCrowdMovement(
      'musician',
      [0, 0],
      [0, 0.2],
      [
        { id: 'musician', position: [0, 0], forward: [0, 1], moving: true },
        { id: 'barista', position: [0, 1], forward: [0, 1], moving: false },
      ],
      0.84,
    );

    expect(resolved[0]).toBeCloseTo(0, 6);
    expect(resolved[1]).toBeCloseTo(0.16, 6);
    expect(Math.hypot(resolved[0], resolved[1] - 1)).toBeCloseTo(0.84, 6);
  });

  it('居民已在安全圈内时逐帧脱离，不会被一次推出近一米', () => {
    const resolved = resolveCrowdMovement(
      'musician',
      [0, 0],
      [0.02, 0],
      [
        { id: 'musician', position: [0, 0], forward: [1, 0], moving: true },
        { id: 'barista', position: [0.1, 0], forward: [1, 0], moving: false },
      ],
      0.84,
      0.03,
    );

    expect(Math.hypot(resolved[0], resolved[1])).toBeLessThanOrEqual(0.031);
  });

  it('人群错身偏移收敛到稳定目标，不会每帧累加后再回弹', () => {
    let offset: readonly [number, number] = [0, 0];
    let maximumOffset = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      offset = stepCrowdOffset(offset, [0, 0.6], 0.05);
      maximumOffset = Math.max(maximumOffset, Math.hypot(...offset));
    }

    expect(offset[1]).toBeCloseTo(0.6, 3);
    expect(maximumOffset).toBeLessThanOrEqual(0.601);

    for (let frame = 0; frame < 60; frame += 1) {
      offset = stepCrowdOffset(offset, [0, 0], 0.05);
    }
    expect(Math.hypot(...offset)).toBeLessThan(0.01);
  });

  it('二次分离累加偏移时仍限制在单帧安全范围内，避免下一帧高速回弹', () => {
    const offset = clampCrowdOffset([1.08, 0.81], 0.68);

    expect(Math.hypot(...offset)).toBeCloseTo(0.68, 6);
    expect(offset[0] / offset[1]).toBeCloseTo(4 / 3, 6);
    expect(clampCrowdOffset([0.2, -0.3], 0.68)).toEqual([0.2, -0.3]);
  });

  it('避让目标突然换侧时限制单帧位移，不让居民横向弹跳', () => {
    const limited = limitCrowdOffsetStep([0.71, 0.08], [-0.38, 0.84], 0.09);

    expect(Math.hypot(limited[0] - 0.71, limited[1] - 0.08)).toBeCloseTo(0.09, 6);
    expect(limited[0]).toBeGreaterThan(0.6);
  });

  it('静止居民保留已分配的站位，开始行走后才平滑归还避让偏移', () => {
    expect(getCrowdOffsetTarget([0.72, -0.16], [0, 0], false)).toEqual([0.72, -0.16]);
    expect(getCrowdOffsetTarget([0.72, -0.16], [0, 0], true)).toEqual([0, 0]);
    expect(getCrowdOffsetTarget([0.2, 0], [0, 0.48], false)).toEqual([0.2, 0]);
    expect(getCrowdOffsetTarget([0, 0], [0, 0.48], false)).toEqual([0, 0.48]);
  });

  it('障碍挤压一侧避让点时，选择真正远离上下车居民的另一侧', () => {
    expect(
      pickClearestCrowdPosition(
        [
          [0.12, 0.08],
          [0.12, -0.72],
        ],
        [[0, 0]],
      ),
    ).toEqual([0.12, -0.72]);
  });

  it('两侧净空只有轻微差异时保留原错身侧，不在下一帧横跳到另一侧', () => {
    expect(
      pickClearestCrowdPosition(
        [
          [0.6, 0],
          [-0.6, 0],
        ],
        [[0.1, 5]],
        0,
        0.12,
      ),
    ).toEqual([0.6, 0]);
  });

  it('首选绕行侧被建筑裁掉大半时改走完整可通行的另一侧', () => {
    expect(
      pickCrowdPassingPosition(
        [
          [-0.34, -0.23],
          [0.68, 0.23],
        ],
        [0, 0],
        0.72,
        [[-1.2, -0.4]],
      ),
    ).toEqual([0.68, 0.23]);
  });

  it('不会把正在赶路的迎面居民误判为社交组合', () => {
    expect(
      findSocialEncounter([
        { id: 'traveler', position: [0, 0], moving: true },
        { id: 'photographer', position: [0.6, 0], moving: true },
      ]),
    ).toBeNull();
  });

  it('车辆会为正前方行人停车，但不会被路侧行人误触发', () => {
    expect(getPedestrianBrakeScale([0, 0], 0, [[0.2, 2.2]])).toBe(0);
    expect(getPedestrianBrakeScale([0, 0], 0, [[3.2, 2.2]])).toBe(1);
  });

  it('行人进入车身近距离安全圈时会无视方向立即停车', () => {
    expect(getPedestrianBrakeScale([0, 0], 0, [[1.5, -0.2]])).toBe(0);
  });
});
