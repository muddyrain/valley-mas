import type { MapModeId, TerrainKind } from '@/core/map';
import type { RandomSource } from '@/shared/math';
import type { FactionId, RegionId } from '@/shared/types';

/**
 * 剧本：用户可见的高层"开局"配置。它只描述势力名 + 出生指令，
 * 真实的颜色 / 君主等填充在 applyScenarioToWorld 内完成。
 *
 * 当 `factions` 为空数组时由 `factionsFactory(rng, options)` 动态生成（如 random 剧本每次抽不同朝代名）。
 */
export interface Scenario {
  id: string;
  name: string;
  /** UI 简介，可选 */
  description?: string;
  /** 静态势力清单。若需要每次加载抖动，请改用 factionsFactory。 */
  factions: ScenarioFaction[];
  /** 剧本推荐的地图形态；状态层会在应用剧本前同步切换。 */
  preferredMapMode?: MapModeId;
  /** 同一地图形态下的稳定 seed 后缀，用于让不同剧本拥有不同地图。 */
  mapSeedSuffix?: string;
  /** 传给 factionsFactory 的固定偏好，避免 UI 另挂一组来源开关。 */
  factoryOptions?: ScenarioFactoryOptions;
  /**
   * 动态势力工厂：当存在时，scenarioSlice.loadScenario 会用 rng 生成的结果替换 factions。
   * 用于 random 剧本「每次抽不同朝代名 + 自动配君主」这种语义。
   * options 由剧本元数据传入偏好（如 includeChinese / includeForeign）。
   */
  factionsFactory?: (rng: RandomSource, options?: ScenarioFactoryOptions) => ScenarioFaction[];
}

/**
 * 动态剧本工厂的可选偏好。
 *
 * 目前由 random / foreign-polities 两个剧本消费。
 * 两者都关闭时由工厂负责兜底（默认开启中文）。
 */
export interface ScenarioFactoryOptions {
  /** 是否启用中文朝代池（DEFAULT_FACTION_NAME_POOL）。默认 true */
  includeChinese?: boolean;
  /** 是否启用国外政体池（WORLD_POLITY_PAIRS）。默认 true */
  includeForeign?: boolean;
}

/**
 * 剧本中单家势力的开局描述。spawnProvinceIds 接收字符串数组以便：
 *   1) 直接序列化到 JSON 文件作为外部剧本扩展；
 *   2) 同时承载"固定 ID"与"随机指令"两种语义。
 *
 * 当 spawnProvinceIds 为空数组时按 'random' 处理（兜底）。
 */
export interface ScenarioFaction {
  factionName: string;
  /** 君主/代表人物。留空时由势力 slice 的默认池兜底 */
  leader?: string;
  /** 主色（hex）。留空时随机分配 */
  colorHex?: string;
  /**
   * 出生州指令列表。每个字符串都按下列规则解析：
   *   - 纯数字（"17"）           → 固定 RegionId
   *   - "random"                  → 任意空州
   *   - "random:plain" 等         → 指定地形随机
   *   - "random:n|s|e|w|nw|ne|sw|se" → 按地图九宫格的方位随机
   *
   * 多个指令同时出现表示「多出生点」。最终首个指令对应 birthRegionId。
   */
  spawnProvinceIds: string[];
}

/**
 * 解析后的出生指令，仅在 applyScenarioToWorld 内部消费。
 */
export type SpawnDirective =
  | { kind: 'fixed'; regionId: RegionId }
  | { kind: 'random' }
  | { kind: 'random-terrain'; terrain: TerrainKind }
  | { kind: 'random-quadrant'; quadrant: SpawnQuadrant };

export type SpawnQuadrant = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'center';

/**
 * 在状态层把剧本应用到当前地图后，写回的"势力 + 占领"快照。
 */
export interface ScenarioApplyResult {
  /** 完整的下一帧 factions（替换式） */
  factionAssignments: ScenarioFactionAssignment[];
  /** Province.ownerFactionId 的覆写（仅本次受影响的州） */
  ownership: Array<{ regionId: RegionId; factionId: FactionId }>;
  /** 解析过程中无法满足的指令数（例如随机不到合规州），便于 UI 提示 */
  unresolvedCount: number;
}

export interface ScenarioFactionAssignment {
  factionId: FactionId;
  factionName: string;
  leader: string;
  colorHex: string;
  birthRegionId: RegionId | null;
  spawnRegionIds: RegionId[];
}
