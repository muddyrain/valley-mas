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
  // 成长与解锁配置：主要承载“熟练度达到多少后解锁什么”的长期目标。
  progression: {
    // 熟练度分段里程碑列表。
    // 约定：
    // - requiredProficiency 表示“上一段清零后，本段还需要多少熟练度”
    // - UI 展示本段进度，例如 0/3、0/10、0/50、0/150
    // - 解锁判断会把前置分段累加为总阈值
    proficiencyMilestones: [
      {
        id: 'trash-can',
        label: '垃圾桶',
        requiredProficiency: 3,
        description: '第一段熟练度达到 3 后解锁垃圾桶。',
      },
      {
        id: 'scratch-mode',
        label: '刮刮卡',
        requiredProficiency: 10,
        description: '第二段熟练度达到 10 后触发刮刮卡电话解锁流程。',
      },
      {
        id: 'upgrade-tools',
        label: '升级工具',
        requiredProficiency: 50,
        description: '第三段熟练度达到 50 后触发升级工具电话解锁流程。',
      },
      {
        id: 'triple-match-card',
        label: '三连胜出',
        requiredProficiency: 100,
        description: '第四段熟练度达到 100 后预留三连胜出刮刮卡解锁位。',
      },
      {
        id: 'late-game-goal',
        label: '后续目标',
        requiredProficiency: 1000,
        description: '第五段熟练度达到 1000 后预留后续长期目标解锁位。',
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
      rewardByLevel: [2, 3, 5, 8, 12, 15, 18, 24, 30, 36, 48] as const,
    },
    brokenPlate: {
      // 从哪个等级开始引入碎盘风险。
      enabledAtLevel: 1,
      // 碎盘概率，0.1 = 10%。
      chance: 0.1,
      // 破产保护底线。
      // 只有在扣完“当前等级本应赚到的收益”等额惩罚后，仍然至少能保留 1 金币继续买盘子，才允许出现碎盘结果。
      reserveGoldForNextPlate: 1,
    },
    cleanBrush: {
      radius: 27,
    },
  },
  // 刮刮卡配置。阶段二只启用第一张低风险教学卡。
  scratchCards: {
    basicSafe: {
      id: 'basic-safe',
      label: '成双入对',
      // 第一张卡的本地 MVP 价格，参考成双入对卡片。
      price: 10,
      // 有效刮开比例达到该阈值后，允许玩家结算。
      scratchCompleteThreshold: 0.8,
      // 单个结果格刮开到该比例后，才触发图案揭露闪烁。
      scratchSymbolRevealThreshold: 0.95,
      scratchBrush: {
        // 刮层笔刷半径。数值越小，单次拖动刮开的范围越小。
        radius: 8,
        // 连续拖动时采样间距，数值越小刮痕越连续。
        stepDistance: 5,
      },
      // 阶段二教学规则：3 格结果区，必须刮出任意一对才给钱。
      matchRule: {
        slots: 3,
        requiredMatches: 2,
      },
      prizePool: [
        {
          id: 'no-pair',
          label: '未成对',
          probability: 0.72,
          displayProbability: null,
          payout: 0,
        },
        {
          id: 'pair-fire',
          label: '火焰成对',
          probability: 0.2,
          displayProbability: 0.5,
          payout: 10,
        },
        {
          id: 'pair-cash',
          label: '纸钞成对',
          probability: 0.06,
          displayProbability: 0.4,
          payout: 25,
        },
        {
          id: 'pair-bag',
          label: '钱袋成对',
          probability: 0.02,
          displayProbability: 0.1,
          payout: 50,
        },
      ] as const,
      level: {
        // 每一级升到下一级需要结算多少张“成双入对”。
        cardsRequiredByLevel: [3, 10, 25, 50, 100, 200, 350, 550, 800] as const,
        // 下标 0 代表等级 0。等级 1 使用 1.3 倍，对齐当前阶段 2.5 统一等级规则。
        payoutMultiplierByLevel: [1, 1.3, 1.65, 2.1, 2.7, 3.4, 4.3, 5.4, 6.8, 8.5] as const,
      },
    },
    tripleMatch: {
      id: 'triple-match',
      label: '三连胜出',
      price: 100,
      scratchCompleteThreshold: 0.82,
      scratchSymbolRevealThreshold: 0.95,
      scratchBrush: {
        radius: 8,
        stepDistance: 5,
      },
      // 阶段 2.5 规则：5 格结果区，必须出现 3 个相同图标才给钱。
      matchRule: {
        slots: 5,
        requiredMatches: 3,
      },
      prizePool: [
        {
          id: 'no-triple',
          label: '未三连',
          probability: 0.82,
          displayProbability: null,
          payout: 0,
        },
        {
          id: 'triple-coin',
          label: '铜币三连',
          probability: 0.1,
          displayProbability: 0.3,
          payout: 100,
        },
        {
          id: 'triple-bag',
          label: '钱袋三连',
          probability: 0.05,
          displayProbability: 0.3,
          payout: 200,
        },
        {
          id: 'triple-cash',
          label: '纸钞三连',
          probability: 0.025,
          displayProbability: 0.3,
          payout: 500,
        },
        {
          id: 'triple-jackpot',
          label: '金币堆三连',
          probability: 0.005,
          displayProbability: 0.1,
          payout: 1000,
        },
      ] as const,
      level: {
        // 本阶段只接入独立等级进度，暂不启用数值成长，所以各等级倍率都保持 1。
        cardsRequiredByLevel: [3, 10, 25, 50, 100, 200, 350, 550, 800] as const,
        payoutMultiplierByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const,
      },
    },
    riskPeek: {
      id: 'risk-peek',
      label: '险中求财',
      price: 150,
      scratchCompleteThreshold: 0.84,
      scratchSymbolRevealThreshold: 0.95,
      scratchBrush: {
        radius: 8,
        stepDistance: 5,
      },
      matchRule: {
        slots: 6,
        requiredMatches: 1,
      },
      riskRule: {
        dangerSlots: 1,
        discardCostRatio: 0.3,
        reserveGoldAfterDiscard: 1,
        penaltyAmount: 0,
      },
      prizePool: [
        {
          id: 'risk-danger',
          label: '危险符号',
          probability: 0.32,
          displayProbability: null,
          payout: 0,
        },
        {
          id: 'risk-coin',
          label: '铜币保底',
          probability: 0.38,
          displayProbability: 0.45,
          payout: 180,
        },
        {
          id: 'risk-bag',
          label: '钱袋翻倍',
          probability: 0.22,
          displayProbability: 0.35,
          payout: 260,
        },
        {
          id: 'risk-cash',
          label: '纸钞爆发',
          probability: 0.08,
          displayProbability: 0.2,
          payout: 420,
        },
      ] as const,
      level: {
        // 阶段三先接入独立等级进度，风险卡数值成长留到后续卡册/升级阶段。
        cardsRequiredByLevel: [3, 10, 25, 50, 100, 200, 350, 550, 800] as const,
        payoutMultiplierByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const,
      },
    },
  },
  // 阶段四卡册目录结构。这里只定义卡片职责与目录归属，不改变单张卡的购买、概率或结算规则。
  cardAlbums: [
    {
      id: 'street-luck',
      label: '街角好运',
      subtitle: '第一本卡册',
      description: '从稳定回本到手动冒险，承接当前阶段的三张核心票。',
      slots: [
        {
          id: 'street-stable',
          role: 'stable',
          roleLabel: '稳定票',
          cardType: 'basic-safe',
          description: '低风险教学票，适合反复刷基础资金。',
        },
        {
          id: 'street-risk',
          role: 'risk',
          roleLabel: '风险票',
          cardType: 'risk-peek',
          description: '通过 Peek 判断继续或止损，默认手动处理。',
        },
        {
          id: 'street-high-odds',
          role: 'high-odds',
          roleLabel: '高赔率票',
          cardType: 'triple-match',
          description: '更高成本和更强波动，追求三连爆奖。',
        },
        {
          id: 'street-finale',
          role: 'finale',
          roleLabel: '终局票',
          cardType: null,
          lockedLabel: '终局票',
          description: '当前卡册的最终挑战位，后续阶段再接入规则。',
        },
      ] as const,
    },
    {
      id: 'next-album',
      label: '下一本卡册',
      subtitle: '设计中',
      description: '第二本卡册尚未定义，先保留锁定入口。',
      slots: [] as const,
    },
  ] as const,
  // 阶段 2.5 升级工具配置。当前只把手动刮卡相关工具接入 UI 与本地等级状态。
  upgradeTools: {
    items: [
      {
        id: 'scratch-luck',
        label: '刮卡运气',
        price: 200,
        priceMultiplierByLevel: [1, 1.5, 2.25, 3.4, 5.1, 7.6, 11.4, 17, 25.5, 38] as const,
        level: 0,
        maxLevel: 10,
        description: '提升基础刮刮卡和高赔率票的真实中奖权重。',
        effectLabel: '每级 -3% 未中奖权重',
        effect: {
          type: 'scratch-luck',
          valuePerLevel: 0.03,
          losingProbabilityFloor: 0.45,
        },
      },
      {
        id: 'scratch-radius',
        label: '刮除范围',
        price: 100,
        priceMultiplierByLevel: [1, 1.5, 2.25, 3.4, 5.1, 7.6, 11.4, 17, 25.5, 38] as const,
        level: 0,
        maxLevel: 10,
        description: '提升刮层笔刷半径，改善手动刮卡效率。',
        effectLabel: '每级 +1 刮除半径',
        effect: {
          type: 'scratch-brush-radius',
          valuePerLevel: 1,
        },
      },
      {
        id: 'copper-coin',
        label: '铜币',
        price: 500,
        priceMultiplierByLevel: [1, 1.5, 2.25, 3.4, 5.1, 7.6, 11.4, 17, 25.5, 38] as const,
        level: 1,
        maxLevel: 10,
        description: '预留奖励放大和特殊资源入口，当前先作为可配置工具展示。',
        effectLabel: '力量 1',
        effect: {
          type: 'reserved',
          valuePerLevel: 0,
        },
      },
    ] as const,
  },
  // 破产救援贷款。阶段二只做“无法继续时的兜底电话”，不接入复杂债务惩罚。
  loans: {
    // 签字后立刻到账的启动金。
    principal: 5,
    // 6000% 利率对应的偿还金额，UI 只展示整笔贷款待偿还金额。
    repaymentAmount: 300,
    interestRateLabel: '6000%',
    templates: [
      {
        id: 'loan-1',
        title: '贷款 #1',
        effect: '每 20 张卡中会有 1 张不是你要的卡',
        penalty: {
          type: 'wrong-card-every-n',
          everyCards: 20,
          enabled: true,
        },
      },
      {
        id: 'loan-2',
        title: '贷款 #2',
        effect: '你的刮除范围降低了 1',
        penalty: {
          type: 'scratch-brush-radius-delta',
          delta: -1,
          enabled: true,
        },
      },
      {
        id: 'loan-3',
        title: '贷款 #3',
        effect: '刮刮机器人的速度降低了 30%',
        penalty: {
          type: 'automation-speed-multiplier',
          multiplier: 0.7,
          enabled: false,
        },
      },
    ] as const,
  },
  // 辅助道具解锁配置。
  unlockables: {
    trashCan: {
      // 累计清洁多少个盘子后自动解锁垃圾桶。
      autoUnlockAfterCleanedPlates: 3,
      // 解锁后仍需要在辅助道具页购买才会出现在桌面。
      price: 2,
    },
  },
  // 电话提示与风险消息配置。
  notifications: {
    phone: {
      // 从该工作等级开始存在碎盘风险；第一次真实碎盘后电话才提示风险。
      brokenPlateNoticeLevel: 1,
    },
  },
} as const;

export type ScratchLegendConfig = typeof scratchLegendConfig;
