import type { StateCreator } from 'zustand';
import type { MapData, TerrainKind } from '@/core/map';
import { TERRAIN_KINDS } from '@/core/map';
import type { FactionId, FactionSummary, RegionId } from '@/shared/types';
import { asFactionId, asRegionId, asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import { ensureFactionIdSeqAtLeast } from './factionSlice';
import type { MapSlice, ProvincePreset } from './mapSlice';
import { PROVINCE_PRESETS } from './mapSlice';
import type { ScenarioSlice } from './scenarioSlice';
import type { SimSlice } from './simSlice';
import type { UiSlice } from './uiSlice';

export type WorldMode = 'edit' | 'simulation';

export type EditTool =
  /** 单击州 → 设为当前编辑势力的领土 */
  | 'paint-owner'
  /** 单击州 → 清除归属（变回无主） */
  | 'erase-owner'
  /** 单击州 → 把当前编辑势力的出生地设为该州（同时归属也归该势力） */
  | 'set-birth'
  /** 单击州 → 把该州地形改为当前编辑地形 */
  | 'paint-terrain'
  /** 仅查看，不做编辑（=旧的浏览模式） */
  | 'inspect';

const EDIT_MAP_VERSION = 1;

export interface ExportedMapDoc {
  /** 文件格式版本 */
  version: number;
  /** 生成时间戳 ISO string */
  exportedAt: string;
  meta: MapData['meta'];
  provinces: ExportedProvince[];
  borders: MapData['borders'];
  factions: FactionSummary[];
  scenarioId: string | null;
}

export interface ExportedProvince {
  id: number;
  site: { x: number; y: number };
  centroid: { x: number; y: number };
  polygon: Array<{ x: number; y: number }>;
  neighbors: number[];
  borderEdgeIds: number[];
  terrain: TerrainKind;
  elevation: number;
  moisture: number;
  ownerFactionId: number | null;
}

export interface ImportMapResult {
  ok: boolean;
  message: string;
}

export interface EditSlice {
  /** 当前世界模式：edit 模式下 RAF 不推进 tick；simulation 模式恢复 sim 行为 */
  worldMode: WorldMode;
  /** 当前编辑工具 */
  editTool: EditTool;
  /** 当前正在涂抹归属时使用的势力 ID（paint-owner / set-birth 共用） */
  editFactionId: FactionId | null;
  /** 当前涂抹地形 */
  editTerrain: TerrainKind;
  /** 是否处于"按住涂抹"中（拖拽批量涂） */
  isPainting: boolean;
  /** 上一次成功导入/导出的提示文案，由 Sidebar 显示 */
  lastEditMessage: string | null;

  setWorldMode: (mode: WorldMode) => void;
  toggleWorldMode: () => void;
  setEditTool: (tool: EditTool) => void;
  setEditFaction: (id: FactionId | null) => void;
  setEditTerrain: (terrain: TerrainKind) => void;

  /**
   * 在编辑模式下对单个 region 应用当前工具。
   * 返回 true 表示有实际变化（用于"涂抹"时判定是否应该刷新版本号）。
   */
  applyEditAt: (regionId: RegionId) => boolean;
  beginPaint: () => void;
  endPaint: () => void;

  /** 把当前 map+factions 序列化为可下载的 JSON 字符串 */
  exportMapToJson: () => string;
  /** 从 JSON 字符串导入。失败时不修改 store。 */
  importMapFromJson: (json: string) => ImportMapResult;
}

type Deps = EditSlice & MapSlice & FactionSlice & SimSlice & ScenarioSlice & UiSlice;

export const createEditSlice: StateCreator<Deps, [], [], EditSlice> = (set, get) => ({
  worldMode: 'simulation',
  editTool: 'paint-owner',
  editFactionId: null,
  editTerrain: 'plain',
  isPainting: false,
  lastEditMessage: null,

  setWorldMode: (mode) => {
    const state = get();
    // 切到 edit 模式：暂停 sim、清掉 victory/stalemate 状态机让用户可以编辑
    if (mode === 'edit') {
      set({
        worldMode: 'edit',
        paused: true,
        // edit 不改变 status；如果之前是 victory/stalemate，让 UI 提示用户重置即可
      });
      return;
    }
    // 切回 simulation：保持当前 paused / status
    set({
      worldMode: 'simulation',
      // 如果当前没有有效势力出生，UI 端 startSim 会自行处理；这里只切模式
      isPainting: false,
      ...(state.status === 'idle' ? {} : {}),
    });
  },

  toggleWorldMode: () => {
    const cur = get().worldMode;
    get().setWorldMode(cur === 'edit' ? 'simulation' : 'edit');
  },

  setEditTool: (tool) => set({ editTool: tool }),
  setEditFaction: (id) => set({ editFactionId: id }),
  setEditTerrain: (terrain) => set({ editTerrain: terrain }),

  beginPaint: () => set({ isPainting: true }),
  endPaint: () => set({ isPainting: false }),

  applyEditAt: (regionId) => {
    const state = get();
    if (state.worldMode !== 'edit') return false;
    const map = state.map;
    if (!map) return false;
    const idx = regionId as unknown as number;
    const province = map.provinces[idx];
    if (!province) return false;

    const tool = state.editTool;
    if (tool === 'inspect') return false;

    if (tool === 'paint-terrain') {
      if (province.terrain === state.editTerrain) return false;
      const nextProvinces = map.provinces.map((p) => ({ ...p }));
      nextProvinces[idx] = { ...nextProvinces[idx], terrain: state.editTerrain };
      set({
        map: { ...map, provinces: nextProvinces },
        snapshotVersion: state.snapshotVersion + 1,
      });
      return true;
    }

    if (tool === 'erase-owner') {
      if (province.ownerFactionId == null) return false;
      const previousOwner = province.ownerFactionId;
      const nextProvinces = map.provinces.map((p) => ({ ...p }));
      nextProvinces[idx] = { ...nextProvinces[idx], ownerFactionId: null };
      const factionsNext = state.factions.map((f) =>
        f.id === previousOwner
          ? {
              ...f,
              regions: Math.max(0, (f.regions ?? 0) - 1),
              birthRegionId:
                f.birthRegionId != null && (f.birthRegionId as unknown as number) === idx
                  ? null
                  : f.birthRegionId,
            }
          : f,
      );
      set({
        map: { ...map, provinces: nextProvinces },
        factions: factionsNext,
        snapshotVersion: state.snapshotVersion + 1,
      });
      return true;
    }

    // paint-owner / set-birth 都需要选定的编辑势力
    const editFactionId = state.editFactionId;
    if (editFactionId == null) return false;
    const editFaction = state.factions.find((f) => f.id === editFactionId);
    if (!editFaction) return false;

    if (tool === 'paint-owner') {
      if (province.ownerFactionId === editFactionId) return false;
      const previousOwner = province.ownerFactionId;
      const nextProvinces = map.provinces.map((p) => ({ ...p }));
      nextProvinces[idx] = { ...nextProvinces[idx], ownerFactionId: editFactionId };
      const factionsNext = state.factions.map((f) => {
        if (f.id === editFactionId) return { ...f, regions: (f.regions ?? 0) + 1 };
        if (previousOwner != null && f.id === previousOwner) {
          return {
            ...f,
            regions: Math.max(0, (f.regions ?? 0) - 1),
            birthRegionId:
              f.birthRegionId != null && (f.birthRegionId as unknown as number) === idx
                ? null
                : f.birthRegionId,
          };
        }
        return f;
      });
      set({
        map: { ...map, provinces: nextProvinces },
        factions: factionsNext,
        snapshotVersion: state.snapshotVersion + 1,
      });
      return true;
    }

    if (tool === 'set-birth') {
      const previousOwner = province.ownerFactionId;
      const previousBirth = editFaction.birthRegionId;
      // 相同出生州：什么都不做
      if (
        previousBirth != null &&
        (previousBirth as unknown as number) === idx &&
        previousOwner === editFactionId
      ) {
        return false;
      }
      const nextProvinces = map.provinces.map((p) => ({ ...p }));
      nextProvinces[idx] = { ...nextProvinces[idx], ownerFactionId: editFactionId };
      const factionsNext = state.factions.map((f) => {
        if (f.id === editFactionId) {
          // birth 改到本州；regions 由统计后修正
          return { ...f, birthRegionId: regionId };
        }
        if (previousOwner != null && f.id === previousOwner) {
          return {
            ...f,
            birthRegionId:
              f.birthRegionId != null && (f.birthRegionId as unknown as number) === idx
                ? null
                : f.birthRegionId,
          };
        }
        return f;
      });
      // 重新统计每势力 regions
      const counts = new Map<number, number>();
      for (const p of nextProvinces) {
        if (p.ownerFactionId == null) continue;
        const k = p.ownerFactionId as unknown as number;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const factionsCounted = factionsNext.map((f) => ({
        ...f,
        regions: counts.get(f.id as unknown as number) ?? 0,
      }));
      set({
        map: { ...map, provinces: nextProvinces },
        factions: factionsCounted,
        snapshotVersion: state.snapshotVersion + 1,
      });
      return true;
    }

    return false;
  },

  exportMapToJson: () => {
    const state = get();
    const map = state.map;
    if (!map) return '';
    const doc: ExportedMapDoc = {
      version: EDIT_MAP_VERSION,
      exportedAt: new Date().toISOString(),
      meta: map.meta,
      provinces: map.provinces.map((p) => ({
        id: p.id as unknown as number,
        site: p.site,
        centroid: p.centroid,
        polygon: p.polygon,
        neighbors: p.neighbors.map((n) => n as unknown as number),
        borderEdgeIds: p.borderEdgeIds,
        terrain: p.terrain,
        elevation: p.elevation,
        moisture: p.moisture,
        ownerFactionId: p.ownerFactionId == null ? null : (p.ownerFactionId as unknown as number),
      })),
      borders: map.borders,
      factions: state.factions,
      scenarioId: state.currentScenarioId ?? null,
    };
    return JSON.stringify(doc, null, 2);
  },

  importMapFromJson: (json) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure = `JSON 解析失败：${message}`;
      set({ lastEditMessage: failure });
      return { ok: false, message: failure };
    }

    const validation = validateMapDoc(parsed);
    if (!validation.ok) {
      set({ lastEditMessage: validation.message });
      return validation;
    }

    const doc = validation.doc;
    const provinces = doc.provinces.map((p) => ({
      id: asRegionId(p.id),
      site: p.site,
      centroid: p.centroid,
      polygon: p.polygon,
      neighbors: p.neighbors.map((n) => asRegionId(n)),
      borderEdgeIds: p.borderEdgeIds,
      terrain: p.terrain,
      elevation: p.elevation,
      moisture: p.moisture,
      ownerFactionId: p.ownerFactionId == null ? null : asFactionId(p.ownerFactionId),
    }));

    const factions: FactionSummary[] = doc.factions.map((f) => ({
      ...f,
      id: asFactionId(f.id as unknown as number),
      birthRegionId:
        f.birthRegionId == null ? null : asRegionId(f.birthRegionId as unknown as number),
    }));

    // 把 mint 序列推过最大已有 ID
    let maxId = 0;
    for (const f of factions) maxId = Math.max(maxId, f.id as unknown as number);
    ensureFactionIdSeqAtLeast(maxId + 1);

    set({
      map: {
        meta: doc.meta,
        provinces,
        borders: doc.borders,
      },
      factions,
      seed: doc.meta.seed,
      provinceCount: ((): ProvincePreset => {
        const c = doc.meta.provinceCount;
        if ((PROVINCE_PRESETS as readonly number[]).includes(c)) return c as ProvincePreset;
        return 3000;
      })(),
      tick: asTick(0),
      status: 'idle',
      paused: true,
      winnerFactionId: null,
      lastTickEventCount: 0,
      snapshotVersion: get().snapshotVersion + 1,
      hoveredRegionId: null,
      selectedRegionId: null,
      lastEditMessage: `已导入地图：${provinces.length} 州 / ${factions.length} 家势力`,
      ...(doc.scenarioId ? { currentScenarioId: doc.scenarioId } : {}),
    });
    return { ok: true, message: `已导入 ${provinces.length} 州` };
  },
});

/* ------------------------------------------------------------------ */
/* 校验                                                                */
/* ------------------------------------------------------------------ */

function validateMapDoc(
  raw: unknown,
): { ok: true; doc: ExportedMapDoc } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: '不是合法的 JSON 对象' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== 'number') {
    return { ok: false, message: '缺少 version 字段' };
  }
  if (obj.version !== EDIT_MAP_VERSION) {
    return { ok: false, message: `不支持的版本：${obj.version}（当前 ${EDIT_MAP_VERSION}）` };
  }
  const meta = obj.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta.seed !== 'string' || typeof meta.provinceCount !== 'number') {
    return { ok: false, message: 'meta 字段缺失或不合法' };
  }
  const provinces = obj.provinces as unknown[];
  if (!Array.isArray(provinces) || provinces.length === 0) {
    return { ok: false, message: 'provinces 不是有效数组' };
  }
  for (const p of provinces) {
    if (!p || typeof p !== 'object') return { ok: false, message: 'province 项不是对象' };
    const pp = p as Record<string, unknown>;
    if (typeof pp.id !== 'number') return { ok: false, message: 'province.id 必须为数字' };
    if (!TERRAIN_KINDS.includes(pp.terrain as TerrainKind)) {
      return { ok: false, message: `province.terrain 非法：${String(pp.terrain)}` };
    }
    if (!Array.isArray(pp.polygon) || (pp.polygon as unknown[]).length < 3) {
      return { ok: false, message: 'province.polygon 至少需 3 个顶点' };
    }
  }
  const borders = obj.borders as unknown[];
  if (!Array.isArray(borders)) {
    return { ok: false, message: 'borders 不是数组' };
  }
  const factions = obj.factions as unknown[];
  if (!Array.isArray(factions)) {
    return { ok: false, message: 'factions 不是数组' };
  }
  return { ok: true, doc: obj as unknown as ExportedMapDoc };
}
