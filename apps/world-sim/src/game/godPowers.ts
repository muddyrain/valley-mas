import type { Position, SimCommand, TerrainType } from '../sim';
import type { WorldSelection } from './inspection';

export type GodPowerToolId =
  | 'inspect'
  | 'favorite'
  | 'follow'
  | 'food'
  | 'life'
  | 'lightning'
  | 'forest'
  | 'grass'
  | 'water'
  | 'forceWar'
  | 'forcePeace';
export type GodPowerCategoryId = 'observe' | 'create' | 'shape' | 'destroy' | 'diplomacy';
export type GodPowerPreviewTone = GodPowerCategoryId | 'invalid';

export type ToolbarRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GodPowerTool = {
  id: GodPowerToolId;
  category: GodPowerCategoryId;
  hotkey: string;
  label: string;
  shortLabel: string;
  accent: number;
};

export type GodPowerPreview = {
  toolId: GodPowerToolId;
  valid: boolean;
  radius: number;
  accent: number;
  tone: GodPowerPreviewTone;
  status: string;
  reason?: string;
};

export type SimCommandDraft = SimCommand extends infer Command
  ? Command extends SimCommand
    ? Omit<Command, 'id' | 'issuedAtTick'>
    : never
  : never;

export type GodPowerTargetContext = {
  targetTerrain?: TerrainType;
  worldWidth?: number;
  worldHeight?: number;
};

export type DiplomacyGodPowerContext = {
  villages: Array<{ id: string; kingdomId?: string }>;
  kingdoms: Array<{ id: string; diplomacyTargetKingdomId?: string }>;
  armies: Array<{ id: string; kingdomId: string; targetKingdomId?: string }>;
};

type DiplomacyTarget = {
  kingdomId: string;
  targetKingdomId: string;
};

const GOD_POWER_BRUSHES: Record<
  GodPowerToolId,
  {
    radius: number;
    action: string;
  }
> = {
  inspect: { radius: 0, action: '不改变世界' },
  favorite: { radius: 0, action: '固定关注' },
  follow: { radius: 0, action: '镜头追踪' },
  food: { radius: 2, action: '可以投放' },
  life: { radius: 0, action: '生成生命' },
  forest: { radius: 4, action: '改变地貌' },
  grass: { radius: 4, action: '改变地貌' },
  water: { radius: 4, action: '改变地貌' },
  lightning: { radius: 2, action: '会造成伤害' },
  forceWar: { radius: 0, action: '神力外交干预' },
  forcePeace: { radius: 0, action: '神力外交干预' },
};

export const GOD_POWER_TOOLS: GodPowerTool[] = [
  {
    id: 'inspect',
    category: 'observe',
    hotkey: 'I',
    label: '检查',
    shortLabel: 'INS',
    accent: 0xf4f4f4,
  },
  {
    id: 'favorite',
    category: 'observe',
    hotkey: 'M',
    label: '关注',
    shortLabel: 'MARK',
    accent: 0xffcd75,
  },
  {
    id: 'follow',
    category: 'observe',
    hotkey: 'T',
    label: '追踪',
    shortLabel: 'TRAK',
    accent: 0x29adff,
  },
  {
    id: 'food',
    category: 'create',
    hotkey: 'B',
    label: '食物',
    shortLabel: 'FOOD',
    accent: 0xffcd75,
  },
  {
    id: 'life',
    category: 'create',
    hotkey: 'N',
    label: '生命',
    shortLabel: 'LIFE',
    accent: 0x99e550,
  },
  {
    id: 'forest',
    category: 'shape',
    hotkey: 'F',
    label: '森林',
    shortLabel: 'TREE',
    accent: 0x257179,
  },
  {
    id: 'grass',
    category: 'shape',
    hotkey: 'G',
    label: '草地',
    shortLabel: 'LAND',
    accent: 0x38b764,
  },
  {
    id: 'water',
    category: 'shape',
    hotkey: 'V',
    label: '水域',
    shortLabel: 'WATR',
    accent: 0x29adff,
  },
  {
    id: 'lightning',
    category: 'destroy',
    hotkey: 'L',
    label: '闪电',
    shortLabel: 'BOLT',
    accent: 0xef7d57,
  },
  {
    id: 'forceWar',
    category: 'diplomacy',
    hotkey: 'Y',
    label: '开战',
    shortLabel: 'WAR',
    accent: 0xef7d57,
  },
  {
    id: 'forcePeace',
    category: 'diplomacy',
    hotkey: 'U',
    label: '和平',
    shortLabel: 'PEACE',
    accent: 0x99e550,
  },
];

export const GOD_POWER_CATEGORIES: Array<{ id: GodPowerCategoryId; label: string }> = [
  { id: 'observe', label: '观察' },
  { id: 'create', label: '创造' },
  { id: 'shape', label: '塑形' },
  { id: 'destroy', label: '破坏' },
  { id: 'diplomacy', label: '外交' },
];

export type GodPowerToolbarLayout = {
  panel: ToolbarRect;
  status: string;
  categories: Array<{
    id: GodPowerCategoryId;
    label: string;
    bounds: ToolbarRect;
  }>;
  buttons: Array<{
    id: GodPowerToolId;
    label: string;
    shortLabel: string;
    hotkey: string;
    category: GodPowerCategoryId;
    accent: number;
    selected: boolean;
    bounds: ToolbarRect;
  }>;
};

export function buildGodPowerToolbarLines(activeToolId: GodPowerToolId, target?: Position) {
  const activeTool = GOD_POWER_TOOLS.find((tool) => tool.id === activeToolId);
  const activeLabel = activeTool ? activeTool.label : activeToolId;

  return [
    `神力：${activeLabel}`,
    `目标：${target ? `${target.x},${target.y}` : '-'}`,
    GOD_POWER_TOOLS.map(
      (tool) => `[${tool.hotkey}] ${tool.label}${tool.id === activeToolId ? '*' : ''}`,
    ).join('  '),
  ];
}

export function layoutGodPowerToolbar(input: {
  viewportWidth: number;
  viewportHeight: number;
  activeToolId: GodPowerToolId;
  target?: Position;
  targetTerrain?: TerrainType;
  worldWidth?: number;
  worldHeight?: number;
}): GodPowerToolbarLayout {
  const panelHeight = input.viewportWidth < 820 ? 104 : 88;
  const panel = {
    x: 12,
    y: input.viewportHeight - panelHeight - 12,
    width: Math.max(320, input.viewportWidth - 24),
    height: panelHeight,
  };
  const orderedTools = GOD_POWER_CATEGORIES.flatMap((category) =>
    GOD_POWER_TOOLS.filter((tool) => tool.category === category.id),
  );
  const buttonGap = input.viewportWidth < 820 ? 6 : 8;
  const buttonHeight = 34;
  const buttonWidth = Math.max(
    58,
    Math.min(
      86,
      Math.floor((panel.width - 32 - buttonGap * (orderedTools.length - 1)) / orderedTools.length),
    ),
  );
  const buttonY = panel.y + panel.height - buttonHeight - 12;
  const buttons = orderedTools.map((tool, index) => ({
    id: tool.id,
    label: tool.label,
    shortLabel: tool.shortLabel,
    hotkey: tool.hotkey,
    category: tool.category,
    accent: tool.accent,
    selected: tool.id === input.activeToolId,
    bounds: {
      x: panel.x + 16 + index * (buttonWidth + buttonGap),
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
    },
  }));
  const categories = GOD_POWER_CATEGORIES.map((category) => {
    const categoryButtons = buttons.filter((button) => button.category === category.id);
    const first = categoryButtons[0];
    const last = categoryButtons.at(-1);

    return {
      ...category,
      bounds: {
        x: first?.bounds.x ?? panel.x + 16,
        y: panel.y + 12,
        width:
          first && last
            ? last.bounds.x + last.bounds.width - first.bounds.x
            : Math.max(48, buttonWidth),
        height: 18,
      },
    };
  });
  const activeTool = getGodPowerTool(input.activeToolId);
  const preview =
    input.worldWidth !== undefined && input.worldHeight !== undefined
      ? buildGodPowerPreview({
          toolId: input.activeToolId,
          target: input.target,
          targetTerrain: input.targetTerrain,
          worldWidth: input.worldWidth,
          worldHeight: input.worldHeight,
        })
      : undefined;

  return {
    panel,
    categories,
    buttons,
    status:
      preview?.status ??
      `${activeTool?.label ?? input.activeToolId} -> ${
        input.target ? `${input.target.x},${input.target.y}` : '-'
      }`,
  };
}

export function buildGodPowerPreview(input: {
  toolId: GodPowerToolId;
  target?: Position;
  targetTerrain?: TerrainType;
  worldWidth: number;
  worldHeight: number;
}): GodPowerPreview {
  const tool = getGodPowerTool(input.toolId);
  const brush = GOD_POWER_BRUSHES[input.toolId];
  const targetText = input.target ? `${input.target.x},${input.target.y}` : '-';

  if (!input.target) {
    return {
      toolId: input.toolId,
      valid: false,
      radius: brush.radius,
      accent: tool.accent,
      tone: 'invalid',
      reason: '没有目标',
      status: `${tool.label} -> - · 没有目标`,
    };
  }

  if (!isInWorld(input.target, input.worldWidth, input.worldHeight)) {
    return {
      toolId: input.toolId,
      valid: false,
      radius: brush.radius,
      accent: tool.accent,
      tone: 'invalid',
      reason: '目标在世界外',
      status: `${tool.label} -> ${targetText} · 目标在世界外`,
    };
  }

  const restrictionReason = getGodPowerTargetRestrictionReason(input.toolId, input.targetTerrain);

  if (restrictionReason) {
    return {
      toolId: input.toolId,
      valid: false,
      radius: brush.radius,
      accent: tool.accent,
      tone: 'invalid',
      reason: restrictionReason,
      status: `${tool.label} -> ${targetText} · ${restrictionReason}`,
    };
  }

  return {
    toolId: input.toolId,
    valid: true,
    radius: brush.radius,
    accent: tool.accent,
    tone: tool.category,
    status:
      brush.radius > 0
        ? `${tool.label} -> ${targetText} · 范围 ${brush.radius} · ${brush.action}`
        : `${tool.label} -> ${targetText} · ${brush.action}`,
  };
}

export function resolveGodPowerToolbarHit(
  layout: GodPowerToolbarLayout,
  position: Position,
): GodPowerToolId | undefined {
  return layout.buttons.find((button) => isInsideRect(position, button.bounds))?.id;
}

export function resolveGodPowerHotkey(key: string): GodPowerToolId | undefined {
  const normalizedKey = key.toLowerCase();
  const tool = GOD_POWER_TOOLS.find(
    (candidate) => candidate.hotkey.toLowerCase() === normalizedKey,
  );

  return tool?.id;
}

export function resolvePointerGodPowerCommand(
  toolId: GodPowerToolId,
  position: Position,
  context: GodPowerTargetContext = {},
): SimCommandDraft | undefined {
  if (
    context.worldWidth !== undefined &&
    context.worldHeight !== undefined &&
    !buildGodPowerPreview({
      toolId,
      target: position,
      targetTerrain: context.targetTerrain,
      worldWidth: context.worldWidth,
      worldHeight: context.worldHeight,
    }).valid
  ) {
    return undefined;
  }

  switch (toolId) {
    case 'food':
      return {
        type: 'place_resource',
        payload: { resourceType: 'food', position, amount: 20, radius: 2 },
      };
    case 'life':
      return {
        type: 'spawn_unit',
        payload: { race: 'human', position, count: 4 },
      };
    case 'lightning':
      return {
        type: 'lightning',
        payload: { position, radius: 2, damage: 80 },
      };
    case 'forest':
    case 'grass':
    case 'water':
      return {
        type: 'change_terrain',
        payload: { terrain: toolId as TerrainType, position, radius: 4 },
      };
    case 'inspect':
    case 'favorite':
    case 'follow':
    case 'forceWar':
    case 'forcePeace':
      return undefined;
  }
}

export function buildGodPowerExecutionFeedback(toolId: GodPowerToolId, command: SimCommandDraft) {
  if (command.type === 'place_resource') {
    return command.payload.resourceType === 'food'
      ? '已投放食物：附近村民会优先取食'
      : '已投放资源：附近村庄会更容易取得补给';
  }

  if (command.type === 'spawn_unit') {
    return '已召唤生命：新单位会开始求生';
  }

  if (command.type === 'lightning') {
    return '已释放闪电：范围内生命会受到伤害';
  }

  if (command.type === 'change_terrain') {
    const labels: Record<TerrainType, string> = {
      grass: '草地',
      forest: '森林',
      hill: '丘陵',
      water: '水域',
      sand: '沙地',
      snow: '雪地',
      lava: '岩浆',
    };

    return `已改变地貌：目标区域会变为${labels[command.payload.terrain]}`;
  }

  if (command.type === 'force_war') {
    return `已开战：${command.payload.aggressorKingdomId} 将向 ${command.payload.targetKingdomId} 动员`;
  }

  if (command.type === 'force_peace') {
    return `已停战：${command.payload.kingdomAId} 与 ${command.payload.kingdomBId} 将停止冲突`;
  }

  return `已执行：${getGodPowerTool(toolId).label}`;
}

export function resolveDiplomacyGodPowerPreview(
  toolId: GodPowerToolId,
  selection: WorldSelection,
  context: DiplomacyGodPowerContext,
): GodPowerPreview {
  const tool = getGodPowerTool(toolId);
  const brush = GOD_POWER_BRUSHES[toolId];
  const target = resolveDiplomacyTarget(selection, context);

  if (!isDiplomacyGodPowerTool(toolId)) {
    return {
      toolId,
      valid: false,
      radius: brush.radius,
      accent: tool.accent,
      tone: 'invalid',
      reason: '不是外交神力',
      status: `${tool.label} · 不是外交神力`,
    };
  }

  if (!target.valid) {
    return {
      toolId,
      valid: false,
      radius: brush.radius,
      accent: tool.accent,
      tone: 'invalid',
      reason: target.reason,
      status: `${tool.label} · ${target.reason}`,
    };
  }

  return {
    toolId,
    valid: true,
    radius: brush.radius,
    accent: tool.accent,
    tone: 'diplomacy',
    status: `${tool.label} -> ${target.kingdomId} 到 ${target.targetKingdomId} · ${brush.action}`,
  };
}

export function resolveDiplomacyGodPowerCommand(
  toolId: GodPowerToolId,
  selection: WorldSelection,
  context: DiplomacyGodPowerContext,
): SimCommandDraft | undefined {
  const target = resolveDiplomacyTarget(selection, context);

  if (!isDiplomacyGodPowerTool(toolId) || !target.valid) {
    return undefined;
  }

  if (toolId === 'forceWar') {
    return {
      type: 'force_war',
      payload: {
        aggressorKingdomId: target.kingdomId,
        targetKingdomId: target.targetKingdomId,
      },
    };
  }

  return {
    type: 'force_peace',
    payload: {
      kingdomAId: target.kingdomId,
      kingdomBId: target.targetKingdomId,
    },
  };
}

export function isDiplomacyGodPowerTool(toolId: GodPowerToolId) {
  return toolId === 'forceWar' || toolId === 'forcePeace';
}

function getGodPowerTool(toolId: GodPowerToolId) {
  return GOD_POWER_TOOLS.find((tool) => tool.id === toolId) ?? GOD_POWER_TOOLS[0];
}

function resolveDiplomacyTarget(
  selection: WorldSelection,
  context: DiplomacyGodPowerContext,
): (DiplomacyTarget & { valid: true }) | { valid: false; reason: string } {
  let kingdomId: string | undefined;
  let targetKingdomId: string | undefined;

  if (selection.type === 'kingdom') {
    const kingdom = context.kingdoms.find((candidate) => candidate.id === selection.id);
    kingdomId = kingdom?.id;
    targetKingdomId = kingdom?.diplomacyTargetKingdomId;
  } else if (selection.type === 'village') {
    const village = context.villages.find((candidate) => candidate.id === selection.id);
    const kingdom = village?.kingdomId
      ? context.kingdoms.find((candidate) => candidate.id === village.kingdomId)
      : undefined;
    kingdomId = kingdom?.id;
    targetKingdomId = kingdom?.diplomacyTargetKingdomId;
  } else if (selection.type === 'army') {
    const army = context.armies.find((candidate) => candidate.id === selection.id);
    kingdomId = army?.kingdomId;
    targetKingdomId = army?.targetKingdomId;
  } else {
    return { valid: false, reason: '需要点王国、村庄或军队' };
  }

  if (!kingdomId) {
    return { valid: false, reason: '目标不属于任何王国' };
  }

  if (!targetKingdomId || targetKingdomId === kingdomId) {
    return { valid: false, reason: '王国没有外交压力目标' };
  }

  return { valid: true, kingdomId, targetKingdomId };
}

function isInWorld(position: Position, worldWidth: number, worldHeight: number) {
  return position.x >= 0 && position.y >= 0 && position.x < worldWidth && position.y < worldHeight;
}

function getGodPowerTargetRestrictionReason(
  toolId: GodPowerToolId,
  targetTerrain: TerrainType | undefined,
) {
  if (!targetTerrain) {
    return undefined;
  }

  if (toolId === 'food' && !isLandTerrain(targetTerrain)) {
    return '食物需要投放在陆地上';
  }

  if (toolId === 'life' && !isWalkableLandTerrain(targetTerrain)) {
    return '生命需要生成在可行走陆地上';
  }

  if (toolId === 'forest') {
    if (!isLandTerrain(targetTerrain)) {
      return '森林需要种在陆地上';
    }

    if (targetTerrain === 'forest') {
      return '目标已经是森林';
    }
  }

  if (toolId === 'grass' && targetTerrain === 'grass') {
    return '目标已经是草地';
  }

  if (toolId === 'water' && targetTerrain === 'water') {
    return '目标已经是水域';
  }

  return undefined;
}

function isLandTerrain(terrain: TerrainType) {
  return terrain !== 'water' && terrain !== 'lava';
}

function isWalkableLandTerrain(terrain: TerrainType) {
  return isLandTerrain(terrain);
}

function isInsideRect(position: Position, rect: ToolbarRect) {
  return (
    position.x >= rect.x &&
    position.x <= rect.x + rect.width &&
    position.y >= rect.y &&
    position.y <= rect.y + rect.height
  );
}
