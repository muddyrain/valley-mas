// Scratch Legend 的静态玩法配置单一来源。
// 这里专门放“阶段规则、数值、解锁阈值、交互节奏”这类不会在单局中频繁变化的内容。
// 后续做本地持久化时，建议把它和玩家运行态存档拆开：
// - 这里保存默认规则
// - 存档里保存金币、累计进度、已解锁状态等动态数据
export const scratchLegendConfig = {
  // 经济基础配置：决定玩家开局时手上有多少钱。
  economy: {
    // 开局默认金币。
    initialGold: 1,
  },
  // 成长与解锁配置：主要承载“累计赚到多少钱后解锁什么”的长期目标。
  progression: {
    // 累计金币里程碑列表。
    // 约定：
    // - totalGoldEarned 表示“历史累计赚到的正收益”，不是当前手上剩余金币
    // - 数组顺序就是默认展示顺序，UI 会优先展示下一个未完成里程碑
    // - 后续如果新增 100、200 之类的里程碑，继续往后追加即可
    unlockMilestones: [
      {
        // 里程碑唯一标识，供逻辑判断、通知系统和持久化使用。
        id: 'scratch-mode',
        // 给 UI 展示的名称。
        label: '刮刮乐模式',
        // 累计赚到 10 金币后触发该里程碑。
        totalGoldEarned: 10,
        // 给提示文案或调试面板看的描述。
        description: '累计赚到 10 金币后解锁刮刮乐模式提示。',
      },
      {
        id: 'next-feature',
        label: '后续功能',
        // 这里只先预留阶段二之后的下一档累计目标。
        totalGoldEarned: 50,
        description: '累计赚到 50 金币后预留下一阶段功能解锁位。',
      },
    ] as const,
  },
  // 日常工作（洗盘子）相关配置。
  // 这部分控制阶段一最核心的启动金循环。
  work: {
    // 每生成一个待清洁脏盘子的固定成本。
    plateCost: 1,
    // 完成整只盘子的最短动作时长，用于避免擦一下就瞬间结算。
    actionDurationMs: 600,
    // 清洁完成阈值。
    // 内部使用 0~1 比例，达到 0.95 就认为玩家已经擦干净了。
    cleanCompleteThreshold: 0.95,
    plate: {
      // 桌面小盘子的视觉尺寸，拖拽边界也会依赖它计算。
      desktopSize: 94,
      // 新盘子从桌面上方飞入时的动画时长。
      enterAnimationMs: 420,
      spawnArea: {
        // 脏盘子随机生成区域，使用桌面百分比坐标，避免总刷在固定位置。
        xPercentMin: 22,
        xPercentRange: 56,
        yPercentMin: 24,
        yPercentRange: 50,
      },
    },
    drag: {
      // 长按多久后进入“可以开始拖”的预备状态。
      holdMs: 140,
      // 长按后至少移动多少像素，才真正进入拖拽，避免和点击打开清洁视图冲突。
      moveThreshold: 6,
    },
    level: {
      // 阶段一工作等级上限。
      maxLevel: 10,
      // 每个等级升到下一个等级分别需要清洁多少个盘子。
      // 下标代表“当前等级”，值代表“升到下一级所需盘子数”：
      // - 0 => 从等级 0 升到等级 1 需要 10 个盘子
      // - 1 => 从等级 1 升到等级 2 需要 10 个盘子
      // - ...
      // 当前先保持每级都需要 10 个盘子，后续可直接改成不同节奏，例如 [3, 5, 8, ...]。
      // 约定：
      // - 数组长度应等于 maxLevel
      // - 达到 maxLevel 后不再继续升级
      platesRequiredByLevel: [5, 15, 30, 50, 80, 120, 180, 260, 360, 480] as const,
      // 各等级默认收益表。
      // 下标就是等级，例如：
      // - 0 => 2
      // - 1 => 2
      // - 2 => 3
      // 后续如果要调平衡，优先改这里，不要去组件内散写金额。
      rewardByLevel: [2, 2, 3, 5, 8, 12, 18, 25, 36, 48, 64] as const,
    },
    brokenPlate: {
      // 从哪个等级开始引入碎盘风险。
      enabledAtLevel: 1,
      // 碎盘概率，0.1 = 10%。
      chance: 0.1,
      // 触发碎盘时扣除的金币数量。
      penaltyGold: 3,
      // 破产保护底线。
      // 只有在扣完碎盘惩罚后，仍然至少能保留 1 金币继续买盘子，才允许出现碎盘结果。
      reserveGoldForNextPlate: 1,
    },
  },
  // 辅助道具解锁配置。
  unlockables: {
    trashCan: {
      // 累计清洁多少个盘子后自动解锁垃圾桶。
      autoUnlockAfterCleanedPlates: 3,
    },
  },
  // 电话提示与风险消息配置。
  notifications: {
    phone: {
      // 到达该工作等级后，电话会提示“之后擦盘子可能会碎”。
      brokenPlateNoticeLevel: 1,
    },
  },
} as const;

export type ScratchLegendConfig = typeof scratchLegendConfig;
