export interface DeliveryBatchDefinition {
  id:
    | 'long-world-baseline'
    | 'resident-readability-slice'
    | 'settlement-and-kingdom-readability'
    | 'wild-ecology-and-food-loop'
    | 'full-world-visual-rollout'
    | 'ocean-transport-expansion';
  title: string;
  status: 'planned' | 'validating' | 'complete';
  playableLoopRequired: true;
  backendOnlyDeliveryAllowed: false;
  decorativeOnlyDeliveryAllowed: false;
  exitCriteria: readonly string[];
}

export const DELIVERY_BATCHES = Object.freeze([
  {
    id: 'long-world-baseline',
    title: '长寿世界基线',
    status: 'complete',
    playableLoopRequired: true,
    backendOnlyDeliveryAllowed: false,
    decorativeOnlyDeliveryAllowed: false,
    exitCriteria: [
      '健康世界的人口与代际结构长期稳定',
      '动物具有可诊断的出生与死亡闭环',
      '空格与数字速度快捷键符合玩家设置',
      '8× 完整世界性能门禁通过',
      '250 年与多种子长局测试通过',
    ],
  },
  {
    id: 'resident-readability-slice',
    title: '居民十秒可读垂直切片',
    status: 'complete',
    playableLoopRequired: true,
    backendOnlyDeliveryAllowed: false,
    decorativeOnlyDeliveryAllowed: false,
    exitCriteria: [
      '居民不再用无目标游走制造活跃假象',
      '步行、伐木、采矿、搬运和建造动作对应真实任务阶段',
      '玩家能在十秒内解释居民目标、原因、进度、目的地和结果',
      '村庄、森林、矿区和海岸垂直切片通过三级缩放验收',
    ],
  },
  {
    id: 'settlement-and-kingdom-readability',
    title: '聚落与王国可读性',
    status: 'complete',
    playableLoopRequired: true,
    backendOnlyDeliveryAllowed: false,
    decorativeOnlyDeliveryAllowed: false,
    exitCriteria: [
      '逐格领土真实影响资源归属与征服',
      '四级聚落通过真实建设形成可见差异',
      '王国边界、工作热点、村庄纪事和历史定位可用',
      '兵营、议事厅、城墙和瞭望塔具有可观察且会随损毁失效的真实能力',
    ],
  },
  {
    id: 'wild-ecology-and-food-loop',
    title: '完整野生生态与食物闭环',
    status: 'complete',
    playableLoopRequired: true,
    backendOnlyDeliveryAllowed: false,
    decorativeOnlyDeliveryAllowed: false,
    exitCriteria: [
      '动物饥饿、寿命、繁衍、捕食和死亡原因形成闭环',
      '尸体、狩猎、屠宰、搬运和入库形成闭环',
      '岸边捕鱼消耗真实鱼群并完成真实入库',
    ],
  },
  {
    id: 'full-world-visual-rollout',
    title: '全地图视觉推广',
    status: 'complete',
    playableLoopRequired: true,
    backendOnlyDeliveryAllowed: false,
    decorativeOnlyDeliveryAllowed: false,
    exitCriteria: [
      '垂直切片验证过的正式像素资产推广到完整世界',
      '人物、动物、资源、建筑和地形在三级 LOD 中保持清晰',
      '8× 实机视觉由 owner 验收，自动化性能基准通过',
    ],
  },
  {
    id: 'ocean-transport-expansion',
    title: '海洋交通扩展',
    status: 'planned',
    playableLoopRequired: true,
    backendOnlyDeliveryAllowed: false,
    decorativeOnlyDeliveryAllowed: false,
    exitCriteria: [
      '码头、造船、渔船、运输船和沉船形成真实生命周期',
      '应急游泳、体力与溺水规则接入寻路和表现',
      '跨岛迁徙、殖民、战争和运输必须使用船只',
    ],
  },
] as const satisfies readonly DeliveryBatchDefinition[]);
