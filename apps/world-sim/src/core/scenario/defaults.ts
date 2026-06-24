/**
 * 默认人名 / 朝代池。
 *
 * 之所以放在 `core/scenario` 而不是 `state/slices/factionSlice`，是因为：
 *   - apply.ts 也要在 fallback 路径上引用同一份数据；
 *   - state → core 是允许的依赖方向，反过来不行。
 *
 * factionSlice 仍 re-export 同名常量，保持现有 `state/index.ts` 对外接口稳定。
 */

/**
 * 默认君主池：用户期望的「刘备 / 曹操 / 孙权 / 李世民」全部在内，
 * 同时提供其他历史人物兜底。仅作为「自动建议」，用户可在 UI 输入任意名称。
 */
export const DEFAULT_LEADER_POOL: readonly string[] = [
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
export const DEFAULT_FACTION_NAME_POOL: readonly string[] = [
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
  '前秦',
  '西凉',
  '东晋',
  '北魏',
  '南陈',
];

/** 经典名 → 默认君主映射，匹配时自动配对 */
export const NAME_LEADER_PRESET: Readonly<Record<string, string>> = {
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

/**
 * 国外历史政体 → 君主/领袖配对。
 *
 * 与中文朝代池**互不混配**：拿破仑只能出现在「法兰西帝国」这类政体下，
 * 不会出现「大唐 + 拿破仑」「大宋 + 斯大林」这种违和组合。
 *
 * 在 random 剧本里作为整组（政体名 + 领袖）一起被抽出，
 * 由 factionsFactory 控制中文与国外政体的配比。
 */
export interface WorldPolityPair {
  /** 政体名（势力显示名） */
  factionName: string;
  /** 默认领袖名 */
  leader: string;
}

export const WORLD_POLITY_PAIRS: readonly WorldPolityPair[] = [
  { factionName: '法兰西帝国', leader: '拿破仑' },
  { factionName: '第三帝国', leader: '希特勒' },
  { factionName: '苏维埃', leader: '斯大林' },
  { factionName: '美利坚', leader: '罗斯福' },
  { factionName: '罗马帝国', leader: '凯撒' },
  { factionName: '马其顿', leader: '亚历山大' },
  { factionName: '蒙古汗国', leader: '成吉思汗' },
  { factionName: '奥斯曼', leader: '苏莱曼' },
  { factionName: '大英帝国', leader: '维多利亚' },
  { factionName: '普鲁士', leader: '俾斯麦' },
  { factionName: '大日本帝国', leader: '丰臣秀吉' },
  { factionName: '波斯帝国', leader: '居鲁士' },
];
