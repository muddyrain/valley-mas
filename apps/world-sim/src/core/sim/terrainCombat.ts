import type { TerrainKind } from '@/core/map';

/**
 * 攻方进攻一个地形所在州的"基础胜率"。配合两侧实力差再做一次微调。
 *
 * 设计取舍：
 * - 平原/沙漠是开阔地，攻方占优 → 0.55
 * - 森林视野受限，进退两难 → 0.50
 * - 河流水面阻隔 → 0.40
 * - 山脉防御工事，最难啃 → 0.32
 */
export const TERRAIN_ATTACK_PROB: Record<TerrainKind, number> = {
  plain: 0.55,
  desert: 0.55,
  forest: 0.5,
  river: 0.4,
  mountain: 0.32,
};

/**
 * 强弱差额修正：攻方/(攻方+守方) 控制的州数比例越高，越增加胜率上限。
 * 返回值由 tempo.strengthBiasScale 控制，再叠加到地形基础概率上。
 *
 * 当最大势力占比过高时，tempo 会降低 scale，避免早期领地优势直接滚成速胜。
 */
export function strengthBias(
  attackerRegions: number,
  defenderRegions: number,
  scale = 0.65,
): number {
  const total = attackerRegions + defenderRegions;
  if (total <= 0) return 0;
  const ratio = attackerRegions / total;
  return (ratio - 0.5) * scale;
}
