import type {
  ClimberPlatformDefinition,
  ToyPlatformDifficultyTier,
  ToyPlatformKind,
  ToyPlatformMechanicTag,
  ToyPlatformProfile,
  ToyPlatformThemeZone,
} from './types';

export interface ToyPlatformKindDefinition {
  kind: ToyPlatformKind;
  label: string;
  family: 'static' | 'dynamic' | 'function' | 'climb' | 'goal';
  defaultTags: ToyPlatformMechanicTag[];
  defaultThemeZone: ToyPlatformThemeZone;
  defaultDifficultyTier: ToyPlatformDifficultyTier;
  toyAnalogy: string;
  gameplayRole: string;
}

export interface ResolvedToyPlatformProfile extends ToyPlatformProfile {
  kind: ToyPlatformKind;
  themeZone: ToyPlatformThemeZone;
  difficultyTier: ToyPlatformDifficultyTier;
  mechanicTags: ToyPlatformMechanicTag[];
  visualVariant: string;
  definition: ToyPlatformKindDefinition;
}

export const TOY_PLATFORM_KIND_CATALOG: Record<ToyPlatformKind, ToyPlatformKindDefinition> = {
  square_plate: {
    kind: 'square_plate',
    label: '方形积木板',
    family: 'static',
    defaultTags: ['static', 'rest'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'tutorial',
    toyAnalogy: '厚实拼装底板、木质玩具台、软胶垫',
    gameplayRole: '主路径和节奏缓冲，给玩家观察下一跳的空间',
  },
  round_disc: {
    kind: 'round_disc',
    label: '圆形纽扣盘',
    family: 'static',
    defaultTags: ['static', 'precision'],
    defaultThemeZone: 'sky_island',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '大纽扣、瓶盖圆盘、齿轮圆台',
    gameplayRole: '小落点过渡，要求更精确的跳跃落点',
  },
  narrow_plank: {
    kind: 'narrow_plank',
    label: '窄长踏板',
    family: 'static',
    defaultTags: ['static', 'narrow', 'precision'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'easy',
    toyAnalogy: '雪糕棒、铅笔桥、磁力条',
    gameplayRole: '连续节奏跳和高空窄路径',
  },
  irregular_fragment: {
    kind: 'irregular_fragment',
    label: '不规则碎片',
    family: 'static',
    defaultTags: ['static', 'precision'],
    defaultThemeZone: 'sky_island',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '破碎拼图块、泡沫碎片、积木残片',
    gameplayRole: '制造中心安全、边缘危险的高压落点',
  },
  stacked_steps: {
    kind: 'stacked_steps',
    label: '堆叠阶梯',
    family: 'static',
    defaultTags: ['static', 'rest'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'tutorial',
    toyAnalogy: '积木堆、玩具箱、桶状积木阶梯',
    gameplayRole: '开局教学和低风险高度递进',
  },
  wobble_board: {
    kind: 'wobble_board',
    label: '摇晃跷板',
    family: 'dynamic',
    defaultTags: ['unstable', 'timing'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '跷跷板积木、弹簧支撑木板',
    gameplayRole: '要求玩家等平台平稳或借最高点起跳',
  },
  moving_lift: {
    kind: 'moving_lift',
    label: '轨道移动台',
    family: 'dynamic',
    defaultTags: ['moving', 'timing'],
    defaultThemeZone: 'workshop',
    defaultDifficultyTier: 'easy',
    toyAnalogy: '电动玩具轨道车、滑轨托盘、升降积木板',
    gameplayRole: '横向或纵向衔接较大间距',
  },
  rotating_gear: {
    kind: 'rotating_gear',
    label: '旋转齿轮台',
    family: 'dynamic',
    defaultTags: ['rotating', 'precision'],
    defaultThemeZone: 'castle',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '大齿轮圆盘、十字风车、旋转积木叶片',
    gameplayRole: '中心安全、边缘危险，要求结合旋转方向起跳',
  },
  extendable_bridge: {
    kind: 'extendable_bridge',
    label: '伸缩桥',
    family: 'dynamic',
    defaultTags: ['timing'],
    defaultThemeZone: 'castle',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '抽屉积木桥、伸缩尺踏板、弹出式玩具桥',
    gameplayRole: '伸出窗口内快速踩踏并离开',
  },
  tilting_board: {
    kind: 'tilting_board',
    label: '倾斜平衡板',
    family: 'dynamic',
    defaultTags: ['unstable', 'timing'],
    defaultThemeZone: 'castle',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '半球底座台、软胶倾斜板',
    gameplayRole: '倾角变化导致滑动，需要保持重心',
  },
  blink_panel: {
    kind: 'blink_panel',
    label: '忽隐忽现板',
    family: 'dynamic',
    defaultTags: ['timing', 'precision'],
    defaultThemeZone: 'sky_island',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '透明亚克力积木、发光拼图块',
    gameplayRole: '记忆节奏，在显现窗口完成跳跃',
  },
  trampoline: {
    kind: 'trampoline',
    label: '大弹簧床',
    family: 'function',
    defaultTags: ['bounce', 'timing'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'easy',
    toyAnalogy: '弹簧床、软胶鼓面、大号玩具弹垫',
    gameplayRole: '提供关键高度或捷径',
  },
  bounce_pad: {
    kind: 'bounce_pad',
    label: '小弹跳垫',
    family: 'function',
    defaultTags: ['bounce'],
    defaultThemeZone: 'olympus',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '小型弹力贴片、云朵垫、蘑菇垫',
    gameplayRole: '温和补高，修正差一点够不到的平台',
  },
  conveyor_belt: {
    kind: 'conveyor_belt',
    label: '玩具传送带',
    family: 'function',
    defaultTags: ['conveyor', 'timing'],
    defaultThemeZone: 'workshop',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '积木履带、玩具工厂传送带',
    gameplayRole: '推动玩家，需要反向平衡并抓起跳位置',
  },
  ice_block: {
    kind: 'ice_block',
    label: '透明冰块',
    family: 'function',
    defaultTags: ['slippery', 'precision'],
    defaultThemeZone: 'sky_island',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '透明蓝色积木、塑料冰片',
    gameplayRole: '低摩擦滑行，要求提前规划落点和起跳方向',
  },
  sticky_pad: {
    kind: 'sticky_pad',
    label: '软糖粘垫',
    family: 'function',
    defaultTags: ['sticky'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '软糖垫、橡皮泥板、魔术贴平台',
    gameplayRole: '降低移动速度，制造起跳蓄力压力',
  },
  crumble_tile: {
    kind: 'crumble_tile',
    label: '裂纹崩塌板',
    family: 'function',
    defaultTags: ['crumble', 'timing'],
    defaultThemeZone: 'castle',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '裂纹积木、破碎饼干板、坏掉拼图块',
    gameplayRole: '踩上后延迟崩塌，迫使玩家快速离开',
  },
  climb_wall: {
    kind: 'climb_wall',
    label: '攀爬积木墙',
    family: 'climb',
    defaultTags: ['vertical'],
    defaultThemeZone: 'castle',
    defaultDifficultyTier: 'medium',
    toyAnalogy: '带凸点的积木墙、玩具攀岩板',
    gameplayRole: '垂直高度衔接，减少纯跳台堆叠',
  },
  swing_rope: {
    kind: 'swing_rope',
    label: '彩绳摆荡',
    family: 'climb',
    defaultTags: ['swing', 'timing'],
    defaultThemeZone: 'olympus',
    defaultDifficultyTier: 'finale',
    toyAnalogy: '彩绳、跳绳、挂钩绳',
    gameplayRole: '摆荡蓄力后松手，跨越远距离空隙',
  },
  ladder: {
    kind: 'ladder',
    label: '玩具梯子',
    family: 'climb',
    defaultTags: ['vertical', 'static'],
    defaultThemeZone: 'barn',
    defaultDifficultyTier: 'tutorial',
    toyAnalogy: '木质玩具梯、金属玩具梯',
    gameplayRole: '低风险垂直移动教学',
  },
  balance_pole: {
    kind: 'balance_pole',
    label: '平衡细柱',
    family: 'climb',
    defaultTags: ['precision', 'narrow'],
    defaultThemeZone: 'sky_island',
    defaultDifficultyTier: 'hard',
    toyAnalogy: '铅笔柱、积木圆柱、棒棒糖柱',
    gameplayRole: '高空窄顶面稳定后起跳',
  },
  goal_crown: {
    kind: 'goal_crown',
    label: '终点皇冠台',
    family: 'goal',
    defaultTags: ['goal', 'rest'],
    defaultThemeZone: 'olympus',
    defaultDifficultyTier: 'finale',
    toyAnalogy: '金色皇冠积木、奖杯底座',
    gameplayRole: '终局落点和庆祝焦点',
  },
};

function inferThemeZone(platform: ClimberPlatformDefinition): ToyPlatformThemeZone {
  if (platform.toyProfile?.themeZone) return platform.toyProfile.themeZone;
  if (platform.id === 'goal') return 'olympus';
  if (platform.id.startsWith('z0-') || platform.id === 'start') return 'barn';
  if (platform.id.startsWith('z1-') || platform.id.startsWith('z2-')) return 'castle';
  if (platform.id.startsWith('z3-') || platform.id.startsWith('z4-')) return 'sky_island';
  if (platform.id.startsWith('z5-') || platform.id.startsWith('z6-')) return 'olympus';
  return 'workshop';
}

function inferDifficultyTier(platform: ClimberPlatformDefinition): ToyPlatformDifficultyTier {
  if (platform.toyProfile?.difficultyTier) return platform.toyProfile.difficultyTier;
  const topY = platform.position[1] + platform.size[1] / 2;
  if (platform.isGoal) return 'finale';
  if (topY < 12) return 'tutorial';
  if (topY < 32) return 'easy';
  if (topY < 62) return 'medium';
  if (topY < 84) return 'hard';
  return 'finale';
}

function inferKind(platform: ClimberPlatformDefinition): ToyPlatformKind {
  if (platform.toyProfile?.kind) return platform.toyProfile.kind;
  if (platform.isGoal) return 'goal_crown';
  if (platform.bouncy) {
    return platform.bouncy.boostVelocity >= 13 ? 'trampoline' : 'bounce_pad';
  }
  if (platform.crumble) return 'crumble_tile';
  if (platform.icy) return 'ice_block';
  if (platform.conveyor) return 'conveyor_belt';
  if (platform.blink) return 'blink_panel';
  if (platform.rotating) return 'rotating_gear';
  if (platform.moving) return 'moving_lift';
  if (platform.unstable) return 'wobble_board';

  const [width, height, depth] = platform.size;
  const longest = Math.max(width, depth);
  const shortest = Math.min(width, depth);
  if (shortest <= 1.8 && longest >= 4) return 'narrow_plank';
  if (height >= 1.4 && shortest <= 5) return 'stacked_steps';
  if (shortest <= 2.2) return 'round_disc';
  if (
    platform.id.includes('rock') ||
    platform.id.includes('cloud') ||
    platform.id.includes('fragment')
  ) {
    return 'irregular_fragment';
  }
  return 'square_plate';
}

function mergeTags(
  defaultTags: ToyPlatformMechanicTag[],
  extraTags: ToyPlatformMechanicTag[] | undefined,
): ToyPlatformMechanicTag[] {
  return Array.from(new Set([...defaultTags, ...(extraTags ?? [])]));
}

export function resolveToyPlatformProfile(
  platform: ClimberPlatformDefinition,
): ResolvedToyPlatformProfile {
  const kind = inferKind(platform);
  const definition = TOY_PLATFORM_KIND_CATALOG[kind];
  const themeZone = inferThemeZone(platform);
  const difficultyTier = inferDifficultyTier(platform);
  const visualVariant =
    platform.toyProfile?.visualVariant ?? `${themeZone}:${difficultyTier}:${kind}`;

  return {
    ...platform.toyProfile,
    kind,
    themeZone,
    difficultyTier,
    mechanicTags: mergeTags(definition.defaultTags, platform.toyProfile?.mechanicTags),
    visualVariant,
    definition,
  };
}
