import type { StateCreator } from 'zustand';
import type { Province } from '@/core/map';
import { createPrngFromSeed } from '@/shared/math';
import type { FactionId, FactionSummary, RegionId } from '@/shared/types';
import { asFactionId, asTick } from '@/shared/types';
import type { MapSlice } from './mapSlice';
import type { SimSlice } from './simSlice';
import type { UiSlice } from './uiSlice';

export interface FactionCreateInput {
  name?: string;
  leader?: string;
  colorHex?: string;
  birthRegionId?: RegionId | null;
}

export interface FactionSlice {
  factions: FactionSummary[];
  setFactions: (factions: FactionSummary[]) => void;
  createFaction: (input?: FactionCreateInput) => FactionId | null;
  removeFaction: (id: FactionId) => void;
  renameFaction: (id: FactionId, name: string) => void;
  recolorFaction: (id: FactionId, colorHex?: string) => void;
  respawnFaction: (id: FactionId, regionId?: RegionId | null) => void;
  resetFactions: () => void;
}

/**
 * Phase 4 默认君主池：用户期望的「刘备/曹操/孙权/李世民」全部在内，
 * 同时提供其他历史人物兜底。仅作为「自动建议」，用户可在 UI 输入任意名称。
 */
export const DEFAULT_LEADER_POOL = [
  '刘备',
  '曹操',
  '孙权',
  '李世民',
  '李渊',
  '刘邦',
  '汉武帝',
  '秦始皇',
  '朱元璋',
  '朱棣',
  '康熙',
  '乾隆',
  '成吉思汗',
  '忽必烈',
  '赵匡胤',
  '杨广',
];

/** 默认势力名池：常用朝代或政权名 */
export const DEFAULT_FACTION_NAME_POOL = [
  '蜀汉',
  '曹魏',
  '东吴',
  '大唐',
  '大汉',
  '大明',
  '大宋',
  '大清',
  '大元',
  '大秦',
  '大楚',
  '北周',
  '北齐',
  '南齐',
  '后梁',
];

/** 经典名 → 默认君主映射，匹配时自动配对 */
const NAME_LEADER_PRESET: Record<string, string> = {
  蜀汉: '刘备',
  曹魏: '曹操',
  东吴: '孙权',
  大唐: '李世民',
  大汉: '刘邦',
  大明: '朱元璋',
  大清: '康熙',
  大宋: '赵匡胤',
  大元: '忽必烈',
  大秦: '秦始皇',
};

const INITIAL_PRESETS: Array<{ name: string; leader: string; color: string }> = [
  { name: '蜀汉', leader: '刘备', color: '#e05656' },
  { name: '曹魏', leader: '曹操', color: '#3a82f6' },
  { name: '东吴', leader: '孙权', color: '#4caf7c' },
  { name: '大唐', leader: '李世民', color: '#f5b942' },
];

let nextFactionIdSeq = 1;
const reserveFactionId = (): FactionId => asFactionId(nextFactionIdSeq++);

/**
 * 跨 slice 共享的 FactionId 分配器。scenario slice 等其他模块创建势力时也走同一序列，
 * 避免与 createFaction 产生 ID 冲突。
 */
export const mintFactionId = (): FactionId => reserveFactionId();

/**
 * 导入外部地图后调用，把内部序列推到大于已有 ID 的位置，
 * 防止后续 mint 时与导入的旧 ID 撞车。
 */
export const ensureFactionIdSeqAtLeast = (next: number): void => {
  if (Number.isFinite(next) && next > nextFactionIdSeq) {
    nextFactionIdSeq = Math.floor(next);
  }
};

/**
 * 会话级 PRNG。仅供 UI 行为（随机颜色 / 随机出生 / 自动挑名）使用，
 * 不参与地图地形生成；因此这里允许使用时间戳避免每次刷新都给出相同序列。
 */
const sessionRng = createPrngFromSeed(`faction-session-${Date.now().toString(16)}`);

/**
 * 高对比势力色板。地图地形已经把绿/蓝/沙黄/棕灰占满，这里刻意避开同色相，
 * 优先把"红、蓝紫、青、明黄、橙、品红、洋红、深绿"等高饱和、相互拉开的颜色排在前面，
 * 避免新建势力的颜色和地形/相邻势力混成一团。
 */
const FACTION_COLOR_PALETTE: string[] = [
  '#e05656', // 鲜红
  '#3a82f6', // 钴蓝
  '#f5b942', // 明黄
  '#a855f7', // 紫
  '#06b6d4', // 青
  '#f97316', // 橙
  '#ec4899', // 品红
  '#22c55e', // 翠绿（明度高，与地形深绿区分）
  '#fde047', // 柠黄
  '#0ea5e9', // 天蓝
  '#dc2626', // 深红
  '#a3e635', // 黄绿
  '#7c3aed', // 深紫
  '#14b8a6', // 蓝绿
  '#f472b6', // 粉
  '#fb923c', // 暖橙
];

let paletteCursor = 0;

function randomColorHex(): string {
  // 先按色板循环取色，保证前 N 家势力相互之间色差最大；
  // 用尽后再走 HSL 随机生成，避开地形主色相的「绿蓝棕沙」窗口。
  if (paletteCursor < FACTION_COLOR_PALETTE.length) {
    const c = FACTION_COLOR_PALETTE[paletteCursor++];
    return c;
  }
  // 避开 70°-160°（草绿/林绿）和 25°-50°（沙黄）
  let h = sessionRng.next() * 360;
  if ((h >= 70 && h <= 160) || (h >= 25 && h <= 50)) {
    h = (h + 180) % 360;
  }
  const s = 70 + sessionRng.next() * 20;
  const l = 52 + sessionRng.next() * 10;
  return hslToHex(h, s, l);
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const k = (n: number) => (n + h / 30) % 12;
  const channel = (n: number) => {
    const v = lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function normalizeColor(input: string): string | null {
  const trimmed = input.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function pickFreeName(used: Set<string>): string {
  for (const cand of DEFAULT_FACTION_NAME_POOL) {
    if (!used.has(cand)) return cand;
  }
  let n = 1;
  while (used.has(`势力${n}`)) n++;
  return `势力${n}`;
}

function pickLeaderForName(name: string, used: Set<string>): string {
  const preset = NAME_LEADER_PRESET[name];
  if (preset && !used.has(preset)) return preset;
  for (const cand of DEFAULT_LEADER_POOL) {
    if (!used.has(cand)) return cand;
  }
  return DEFAULT_LEADER_POOL[Math.floor(sessionRng.next() * DEFAULT_LEADER_POOL.length)];
}

function pickFreeRegion(provinces: Province[]): RegionId | null {
  const free: RegionId[] = [];
  for (const p of provinces) {
    if (p.ownerFactionId == null) free.push(p.id);
  }
  if (free.length === 0) return null;
  const idx = Math.floor(sessionRng.next() * free.length);
  return free[idx];
}

function buildInitialFactions(): FactionSummary[] {
  return INITIAL_PRESETS.map((preset) => ({
    id: reserveFactionId(),
    name: preset.name,
    leader: preset.leader,
    colorHex: preset.color,
    birthRegionId: null,
    capitalRegionId: null,
    centroidRegionId: null,
    regions: 0,
    population: 0,
  }));
}

function recountRegions(factions: FactionSummary[], provinces: Province[]): FactionSummary[] {
  const counts = new Map<FactionId, number>();
  for (const p of provinces) {
    if (p.ownerFactionId != null) {
      counts.set(p.ownerFactionId, (counts.get(p.ownerFactionId) ?? 0) + 1);
    }
  }
  return factions.map((f) => ({ ...f, regions: counts.get(f.id) ?? 0 }));
}

type Deps = FactionSlice & MapSlice & UiSlice & SimSlice;

export const createFactionSlice: StateCreator<Deps, [], [], FactionSlice> = (set, get) => {
  const cloneMap = () => {
    const map = get().map;
    if (!map) return null;
    return { ...map, provinces: map.provinces.map((p) => ({ ...p })) };
  };

  const findFaction = (id: FactionId) => get().factions.find((f) => f.id === id) ?? null;

  return {
    factions: buildInitialFactions(),

    setFactions: (factions) => set({ factions }),

    createFaction: (input) => {
      const factions = get().factions;
      const usedNames = new Set(factions.map((f) => f.name));
      const usedLeaders = new Set(factions.map((f) => f.leader));

      const id = reserveFactionId();
      const rawName = (input?.name ?? '').trim();
      const name = rawName.length > 0 ? rawName : pickFreeName(usedNames);
      const rawLeader = (input?.leader ?? '').trim();
      const leader = rawLeader.length > 0 ? rawLeader : pickLeaderForName(name, usedLeaders);
      const colorHex = (input?.colorHex && normalizeColor(input.colorHex)) || randomColorHex();

      const cloned = cloneMap();
      let birthRegionId: RegionId | null = input?.birthRegionId ?? null;
      if (cloned && birthRegionId == null) {
        birthRegionId = pickFreeRegion(cloned.provinces);
      }
      if (cloned && birthRegionId != null) {
        const idx = birthRegionId as unknown as number;
        const province = cloned.provinces[idx];
        if (province) province.ownerFactionId = id;
      }

      const newFaction: FactionSummary = {
        id,
        name,
        leader,
        colorHex,
        birthRegionId,
        capitalRegionId: birthRegionId,
        centroidRegionId: birthRegionId,
        regions: birthRegionId != null ? 1 : 0,
        population: 0,
      };

      if (cloned) {
        set({ factions: [...factions, newFaction], map: cloned });
      } else {
        set({ factions: [...factions, newFaction] });
      }
      return id;
    },

    removeFaction: (id) => {
      const factions = get().factions;
      if (!factions.some((f) => f.id === id)) return;

      const cloned = cloneMap();
      if (cloned) {
        for (const p of cloned.provinces) {
          if (p.ownerFactionId === id) p.ownerFactionId = null;
        }
      }
      const factionsNext = factions.filter((f) => f.id !== id);

      if (cloned) {
        set({ factions: factionsNext, map: cloned });
      } else {
        set({ factions: factionsNext });
      }
      if (get().selectedFactionId === id) {
        set({ selectedFactionId: null });
      }
    },

    renameFaction: (id, name) => {
      const trimmed = name.trim();
      if (trimmed.length === 0) return;
      const factionsNext = get().factions.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
      set({ factions: factionsNext });
    },

    recolorFaction: (id, colorHex) => {
      const normalized = colorHex ? normalizeColor(colorHex) : null;
      const next = normalized ?? randomColorHex();
      const factionsNext = get().factions.map((f) => (f.id === id ? { ...f, colorHex: next } : f));
      set({ factions: factionsNext });
    },

    respawnFaction: (id, regionId) => {
      const faction = findFaction(id);
      if (!faction) return;

      const cloned = cloneMap();
      if (!cloned) return;

      for (const p of cloned.provinces) {
        if (p.ownerFactionId === id) p.ownerFactionId = null;
      }

      let target: RegionId | null = regionId ?? null;
      if (target == null) {
        target = pickFreeRegion(cloned.provinces);
      }
      if (target != null) {
        const idx = target as unknown as number;
        const province = cloned.provinces[idx];
        if (province) province.ownerFactionId = id;
      }

      const factionsRaw = get().factions.map((f) =>
        f.id === id
          ? {
              ...f,
              birthRegionId: target,
              capitalRegionId: target,
              centroidRegionId: target,
              regions: target != null ? 1 : 0,
            }
          : f,
      );
      const factionsNext = recountRegions(factionsRaw, cloned.provinces);
      set({ factions: factionsNext, map: cloned });
    },

    resetFactions: () => {
      const cloned = cloneMap();
      if (cloned) {
        for (const p of cloned.provinces) {
          p.ownerFactionId = null;
        }
      }
      const factionsNext = buildInitialFactions();
      const simReset = {
        tick: asTick(0),
        status: 'idle' as const,
        winnerFactionId: null,
        lastTickEventCount: 0,
        snapshotVersion: 0,
        paused: true,
      };
      if (cloned) {
        set({ factions: factionsNext, map: cloned, selectedFactionId: null, ...simReset });
      } else {
        set({ factions: factionsNext, selectedFactionId: null, ...simReset });
      }
    },
  };
};
