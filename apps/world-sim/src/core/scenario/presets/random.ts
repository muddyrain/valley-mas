import {
  DEFAULT_FACTION_NAME_POOL,
  DEFAULT_LEADER_POOL,
  NAME_LEADER_PRESET,
  WORLD_POLITY_PAIRS,
} from '../defaults';
import type { Scenario, ScenarioFaction } from '../types';

/**
 * 随机剧本默认家数。
 *
 * 决策记录：
 * - 4 家太冷清，3000 州下早期 1-2 家死亡就空场；
 * - 8 家在标签可读性、首都菱形不挤、3-4 家死亡仍有戏的平衡点上较合适；
 * - 上限 ≤ 中文池 (20) + 国外池 (12) = 32，但默认仅取 8。
 */
const RANDOM_FACTION_COUNT = 8;

/**
 * 16 色硬编码板：复用与 factionSlice FACTION_COLOR_PALETTE 同一组高对比色，
 * 8 家以下不会重复，最多 16 家也能保证两两不同色相。
 */
const RANDOM_FACTION_COLORS = [
  '#e05656', // 鲜红
  '#3a82f6', // 钴蓝
  '#f5b942', // 明黄
  '#a855f7', // 紫
  '#06b6d4', // 青
  '#f97316', // 橙
  '#ec4899', // 品红
  '#22c55e', // 翠绿
  '#fde047', // 柠黄
  '#0ea5e9', // 天蓝
  '#dc2626', // 深红
  '#a3e635', // 黄绿
  '#7c3aed', // 深紫
  '#14b8a6', // 蓝绿
  '#f472b6', // 粉
  '#fb923c', // 暖橙
];

/**
 * 国外政体出现概率（0~1）。
 *
 * 在每位被抽中的"势力槽位"上独立投硬币：命中则从 WORLD_POLITY_PAIRS 抽一组
 * （政体名 + 领袖打包，避免「大唐 + 拿破仑」的跨配），未命中则从中文朝代池抽。
 *
 * 0.3 大致对应 8 家中平均 2-3 家是国外政体，保留中文为主基调。
 */
const FOREIGN_POLITY_RATIO = 0.3;

/**
 * 随机剧本：每次加载抽 RANDOM_FACTION_COUNT 家不重名势力。
 *
 * 中文朝代和国外政体**整组配对，互不混配**：
 *   - 中文：从 DEFAULT_FACTION_NAME_POOL 抽朝代名，再走 NAME_LEADER_PRESET / DEFAULT_LEADER_POOL 配君主；
 *   - 国外：从 WORLD_POLITY_PAIRS 整组抽（政体名 + 领袖一起出）；
 *   - 不会出现「大唐 + 拿破仑」「大宋 + 斯大林」这种跨时空跨文化的违和组合。
 *
 * 走 factionsFactory 而不是写死 factions：同一个 seed 下名字也会随会话变化，
 * 符合「随机剧本」语义；且避开「势力·甲/乙/丙/丁」占位名。
 */
export const RANDOM_SCENARIO: Scenario = {
  id: 'random',
  name: '随机剧本',
  description: `从中外历史政体中随机抽 ${RANDOM_FACTION_COUNT} 家势力，出生地随机分布。`,
  factions: [],
  factionsFactory: (rng, options) => {
    // 默认两边都开；用户在 Sidebar 单独勾选时由 scenarioSlice 透传 options。
    // 极端情况下（用户两边都关）兜底为只开中文，避免 0 家势力。
    let useChinese = options?.includeChinese ?? true;
    const useForeign = options?.includeForeign ?? true;
    if (!useChinese && !useForeign) useChinese = true;

    const chinesePool = useChinese ? DEFAULT_FACTION_NAME_POOL.slice() : [];
    const foreignPool = useForeign ? WORLD_POLITY_PAIRS.slice() : [];
    const usedLeaders = new Set<string>();
    const result: ScenarioFaction[] = [];

    for (let i = 0; i < RANDOM_FACTION_COUNT; i++) {
      // 仅在两边都开启时按概率切；只开一边时直接走那一边
      const wantForeign = useForeign && (!useChinese || rng.next() < FOREIGN_POLITY_RATIO);
      let factionName: string;
      let leader: string;

      if (wantForeign && foreignPool.length > 0) {
        const idx = Math.floor(rng.next() * foreignPool.length);
        const safeIdx = Math.min(idx, foreignPool.length - 1);
        const pair = foreignPool[safeIdx];
        foreignPool.splice(safeIdx, 1);
        factionName = pair.factionName;
        leader = pair.leader;
      } else if (chinesePool.length > 0) {
        const idx = Math.floor(rng.next() * chinesePool.length);
        const safeIdx = Math.min(idx, chinesePool.length - 1);
        factionName = chinesePool[safeIdx];
        chinesePool.splice(safeIdx, 1);
        leader = pickChineseLeader(factionName, usedLeaders);
      } else if (foreignPool.length > 0) {
        // 中文池用尽，剩下的槽位强制走国外池
        const pair = foreignPool[0];
        foreignPool.splice(0, 1);
        factionName = pair.factionName;
        leader = pair.leader;
      } else {
        // 两边都用尽（理论上 ≥ 32 家才会触发，本次 8 家不会走到）
        break;
      }

      usedLeaders.add(leader);
      result.push({
        factionName,
        leader,
        colorHex: RANDOM_FACTION_COLORS[i % RANDOM_FACTION_COLORS.length],
        spawnProvinceIds: ['random'],
      });
    }

    return result;
  },
};

function pickChineseLeader(name: string, used: Set<string>): string {
  const preset = NAME_LEADER_PRESET[name];
  if (preset && !used.has(preset)) return preset;
  for (const candidate of DEFAULT_LEADER_POOL) {
    if (!used.has(candidate)) return candidate;
  }
  return DEFAULT_LEADER_POOL[0];
}
