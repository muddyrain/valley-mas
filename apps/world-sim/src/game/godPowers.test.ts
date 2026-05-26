import { describe, expect, it } from 'vitest';
import {
  buildGodPowerExecutionFeedback,
  buildGodPowerPreview,
  buildGodPowerToolbarLines,
  layoutGodPowerToolbar,
  resolveDiplomacyGodPowerCommand,
  resolveDiplomacyGodPowerPreview,
  resolveGodPowerHotkey,
  resolveGodPowerToolbarHit,
  resolvePointerGodPowerCommand,
} from './godPowers';

describe('god power toolbar shell', () => {
  it('summarizes the active god power and pointer target', () => {
    expect(buildGodPowerToolbarLines('food', { x: 12, y: 8 })).toEqual([
      '神力：食物',
      '目标：12,8',
      '[I] 检查  [M] 关注  [T] 追踪  [B] 食物*  [N] 生命  [F] 森林  [G] 草地  [V] 水域  [L] 闪电  [Y] 开战  [U] 和平',
    ]);
  });

  it('maps hotkeys to god power tools without using speed keys', () => {
    expect(resolveGodPowerHotkey('b')).toBe('food');
    expect(resolveGodPowerHotkey('n')).toBe('life');
    expect(resolveGodPowerHotkey('l')).toBe('lightning');
    expect(resolveGodPowerHotkey('f')).toBe('forest');
    expect(resolveGodPowerHotkey('g')).toBe('grass');
    expect(resolveGodPowerHotkey('v')).toBe('water');
    expect(resolveGodPowerHotkey('i')).toBe('inspect');
    expect(resolveGodPowerHotkey('m')).toBe('favorite');
    expect(resolveGodPowerHotkey('t')).toBe('follow');
    expect(resolveGodPowerHotkey('y')).toBe('forceWar');
    expect(resolveGodPowerHotkey('u')).toBe('forcePeace');
    expect(resolveGodPowerHotkey('h')).toBeUndefined();
    expect(resolveGodPowerHotkey('j')).toBeUndefined();
    expect(resolveGodPowerHotkey('1')).toBeUndefined();
  });

  it('converts selected pointer tools into existing sim commands', () => {
    expect(resolvePointerGodPowerCommand('food', { x: 12, y: 8 })).toEqual({
      type: 'place_resource',
      payload: { resourceType: 'food', position: { x: 12, y: 8 }, amount: 20, radius: 2 },
    });
    expect(resolvePointerGodPowerCommand('life', { x: 12, y: 8 })).toEqual({
      type: 'spawn_unit',
      payload: { race: 'human', position: { x: 12, y: 8 }, count: 4 },
    });
    expect(resolvePointerGodPowerCommand('lightning', { x: 12, y: 8 })).toEqual({
      type: 'lightning',
      payload: { position: { x: 12, y: 8 }, radius: 2, damage: 80 },
    });
    expect(resolvePointerGodPowerCommand('forest', { x: 12, y: 8 })).toEqual({
      type: 'change_terrain',
      payload: { terrain: 'forest', position: { x: 12, y: 8 }, radius: 4 },
    });
    expect(resolvePointerGodPowerCommand('inspect', { x: 12, y: 8 })).toBeUndefined();
    expect(resolvePointerGodPowerCommand('favorite', { x: 12, y: 8 })).toBeUndefined();
    expect(resolvePointerGodPowerCommand('follow', { x: 12, y: 8 })).toBeUndefined();
    expect(resolvePointerGodPowerCommand('forceWar', { x: 12, y: 8 })).toBeUndefined();
    expect(resolvePointerGodPowerCommand('forcePeace', { x: 12, y: 8 })).toBeUndefined();
  });

  it('lays out grouped clickable toolbar buttons with a selected tool state', () => {
    const layout = layoutGodPowerToolbar({
      viewportWidth: 960,
      viewportHeight: 720,
      activeToolId: 'lightning',
      target: { x: 12, y: 8 },
    });

    expect(layout.categories.map((category) => category.label)).toEqual([
      '观察',
      '创造',
      '塑形',
      '破坏',
      '外交',
    ]);
    expect(layout.buttons.map((button) => button.id)).toEqual([
      'inspect',
      'favorite',
      'follow',
      'food',
      'life',
      'forest',
      'grass',
      'water',
      'lightning',
      'forceWar',
      'forcePeace',
    ]);
    expect(layout.buttons.find((button) => button.id === 'lightning')?.selected).toBe(true);
    expect(layout.status).toEqual('闪电 -> 12,8');

    const food = layout.buttons.find((button) => button.id === 'food');

    expect(food).toBeDefined();
    expect(
      resolveGodPowerToolbarHit(layout, {
        x: Math.floor((food?.bounds.x ?? 0) + 4),
        y: Math.floor((food?.bounds.y ?? 0) + 4),
      }),
    ).toBe('food');
    expect(resolveGodPowerToolbarHit(layout, { x: 4, y: 4 })).toBeUndefined();
  });

  it('keeps favorite and follow tools inside the observation lane', () => {
    const layout = layoutGodPowerToolbar({
      viewportWidth: 1120,
      viewportHeight: 720,
      activeToolId: 'follow',
      target: { x: 12, y: 8 },
      worldWidth: 64,
      worldHeight: 64,
    });

    expect(
      layout.buttons.filter((button) => button.category === 'observe').map((button) => button.id),
    ).toEqual(['inspect', 'favorite', 'follow']);
    expect(layout.buttons.find((button) => button.id === 'follow')?.selected).toBe(true);
    expect(layout.status).toBe('追踪 -> 12,8 · 镜头追踪');
  });
});

describe('diplomacy god power tools', () => {
  const context = {
    villages: [{ id: 'village-a', kingdomId: 'kingdom-a' }],
    kingdoms: [
      { id: 'kingdom-a', diplomacyTargetKingdomId: 'kingdom-b' },
      { id: 'kingdom-b' },
      { id: 'kingdom-c' },
    ],
    armies: [{ id: 'army-a', kingdomId: 'kingdom-a', targetKingdomId: 'kingdom-b' }],
  };

  it('previews war and peace from a kingdom pressure target', () => {
    expect(
      resolveDiplomacyGodPowerPreview('forceWar', { type: 'kingdom', id: 'kingdom-a' }, context),
    ).toMatchObject({
      valid: true,
      tone: 'diplomacy',
      status: '开战 -> kingdom-a 到 kingdom-b · 神力外交干预',
    });
    expect(
      resolveDiplomacyGodPowerPreview('forcePeace', { type: 'village', id: 'village-a' }, context),
    ).toMatchObject({
      valid: true,
      tone: 'diplomacy',
      status: '和平 -> kingdom-a 到 kingdom-b · 神力外交干预',
    });
  });

  it('rejects diplomacy tools without a kingdom pressure target', () => {
    expect(
      resolveDiplomacyGodPowerPreview('forceWar', { type: 'kingdom', id: 'kingdom-c' }, context),
    ).toMatchObject({
      valid: false,
      reason: '王国没有外交压力目标',
    });
    expect(
      resolveDiplomacyGodPowerPreview('forcePeace', { type: 'tile', x: 1, y: 1 }, context),
    ).toMatchObject({
      valid: false,
      reason: '需要点王国、村庄或军队',
    });
  });

  it('builds force war and peace commands from diplomacy tool targets', () => {
    expect(
      resolveDiplomacyGodPowerCommand('forceWar', { type: 'kingdom', id: 'kingdom-a' }, context),
    ).toEqual({
      type: 'force_war',
      payload: {
        aggressorKingdomId: 'kingdom-a',
        targetKingdomId: 'kingdom-b',
      },
    });
    expect(
      resolveDiplomacyGodPowerCommand('forcePeace', { type: 'army', id: 'army-a' }, context),
    ).toEqual({
      type: 'force_peace',
      payload: {
        kingdomAId: 'kingdom-a',
        kingdomBId: 'kingdom-b',
      },
    });
    expect(
      resolveDiplomacyGodPowerCommand('forceWar', { type: 'kingdom', id: 'kingdom-c' }, context),
    ).toBeUndefined();
  });
});

describe('god power execution feedback', () => {
  it('describes consequence feedback for creation and destruction powers', () => {
    expect(
      buildGodPowerExecutionFeedback('food', {
        type: 'place_resource',
        payload: { resourceType: 'food', position: { x: 12, y: 8 }, amount: 20, radius: 2 },
      }),
    ).toBe('已投放食物：附近村民会优先取食');
    expect(
      buildGodPowerExecutionFeedback('life', {
        type: 'spawn_unit',
        payload: { race: 'human', position: { x: 12, y: 8 }, count: 4 },
      }),
    ).toBe('已召唤生命：新单位会开始求生');
    expect(
      buildGodPowerExecutionFeedback('lightning', {
        type: 'lightning',
        payload: { position: { x: 12, y: 8 }, radius: 2, damage: 80 },
      }),
    ).toBe('已释放闪电：范围内生命会受到伤害');
  });

  it('describes diplomacy consequences with both kingdoms', () => {
    expect(
      buildGodPowerExecutionFeedback('forceWar', {
        type: 'force_war',
        payload: { aggressorKingdomId: 'kingdom-a', targetKingdomId: 'kingdom-b' },
      }),
    ).toBe('已开战：kingdom-a 将向 kingdom-b 动员');
    expect(
      buildGodPowerExecutionFeedback('forcePeace', {
        type: 'force_peace',
        payload: { kingdomAId: 'kingdom-a', kingdomBId: 'kingdom-b' },
      }),
    ).toBe('已停战：kingdom-a 与 kingdom-b 将停止冲突');
  });
});

describe('god power target previews', () => {
  it('describes a valid resource brush before the command is issued', () => {
    expect(
      buildGodPowerPreview({
        toolId: 'food',
        target: { x: 12, y: 8 },
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toEqual({
      toolId: 'food',
      valid: true,
      radius: 2,
      accent: 0xffcd75,
      tone: 'create',
      status: '食物 -> 12,8 · 范围 2 · 可以投放',
    });
  });

  it('describes terrain brushes with their wider shaping radius', () => {
    const preview = buildGodPowerPreview({
      toolId: 'forest',
      target: { x: 12, y: 8 },
      worldWidth: 64,
      worldHeight: 64,
    });

    expect(preview.valid).toBe(true);
    expect(preview.radius).toBe(4);
    expect(preview.tone).toBe('shape');
    expect(preview.status).toBe('森林 -> 12,8 · 范围 4 · 改变地貌');
  });

  it('keeps inspect as a zero-radius non-mutating preview', () => {
    expect(
      buildGodPowerPreview({
        toolId: 'inspect',
        target: { x: 12, y: 8 },
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: true,
      radius: 0,
      tone: 'observe',
      status: '检查 -> 12,8 · 不改变世界',
    });
  });

  it('keeps favorite and follow as zero-radius observation previews', () => {
    expect(
      buildGodPowerPreview({
        toolId: 'favorite',
        target: { x: 12, y: 8 },
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: true,
      radius: 0,
      tone: 'observe',
      status: '关注 -> 12,8 · 固定关注',
    });
    expect(
      buildGodPowerPreview({
        toolId: 'follow',
        target: { x: 12, y: 8 },
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: true,
      radius: 0,
      tone: 'observe',
      status: '追踪 -> 12,8 · 镜头追踪',
    });
  });

  it('warns before destructive powers are applied', () => {
    const preview = buildGodPowerPreview({
      toolId: 'lightning',
      target: { x: 12, y: 8 },
      worldWidth: 64,
      worldHeight: 64,
    });

    expect(preview.valid).toBe(true);
    expect(preview.radius).toBe(2);
    expect(preview.tone).toBe('destroy');
    expect(preview.status).toBe('闪电 -> 12,8 · 范围 2 · 会造成伤害');
  });

  it('rejects food and life on water before commands are issued', () => {
    expect(
      buildGodPowerPreview({
        toolId: 'food',
        target: { x: 12, y: 8 },
        targetTerrain: 'water',
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: false,
      tone: 'invalid',
      reason: '食物需要投放在陆地上',
      status: '食物 -> 12,8 · 食物需要投放在陆地上',
    });
    expect(
      buildGodPowerPreview({
        toolId: 'life',
        target: { x: 12, y: 8 },
        targetTerrain: 'water',
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: false,
      tone: 'invalid',
      reason: '生命需要生成在可行走陆地上',
      status: '生命 -> 12,8 · 生命需要生成在可行走陆地上',
    });
  });

  it('rejects no-op terrain brushes with clear reasons', () => {
    expect(
      buildGodPowerPreview({
        toolId: 'forest',
        target: { x: 12, y: 8 },
        targetTerrain: 'forest',
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: false,
      reason: '目标已经是森林',
    });
    expect(
      buildGodPowerPreview({
        toolId: 'water',
        target: { x: 12, y: 8 },
        targetTerrain: 'water',
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: false,
      reason: '目标已经是水域',
    });
  });

  it('blocks command construction when target context is invalid', () => {
    expect(
      resolvePointerGodPowerCommand(
        'food',
        { x: 12, y: 8 },
        {
          targetTerrain: 'water',
          worldWidth: 64,
          worldHeight: 64,
        },
      ),
    ).toBeUndefined();
    expect(
      resolvePointerGodPowerCommand(
        'food',
        { x: 12, y: 8 },
        {
          targetTerrain: 'grass',
          worldWidth: 64,
          worldHeight: 64,
        },
      ),
    ).toEqual({
      type: 'place_resource',
      payload: { resourceType: 'food', position: { x: 12, y: 8 }, amount: 20, radius: 2 },
    });
  });

  it('rejects targets outside the world before issuing a command', () => {
    expect(
      buildGodPowerPreview({
        toolId: 'food',
        target: { x: -1, y: 8 },
        worldWidth: 64,
        worldHeight: 64,
      }),
    ).toMatchObject({
      valid: false,
      radius: 2,
      tone: 'invalid',
      reason: '目标在世界外',
      status: '食物 -> -1,8 · 目标在世界外',
    });
  });
});
