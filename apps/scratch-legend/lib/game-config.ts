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
    // - requiredProficiency 表示当前段需要刷多少熟练度，不是存档里的累计总值
    // - UI 展示当前段熟练度 / 当前段目标，例如 5/10、25/300、125/1000
    // - 解锁判断使用内部累计总熟练度，并把前置段目标累加为真实阈值
    proficiencyMilestones: [
      {
        id: 'trash-can',
        label: '垃圾桶',
        requiredProficiency: 10,
        description: '第一段熟练度达到 10 后解锁垃圾桶。',
      },
      {
        id: 'scratch-mode',
        label: '刮刮卡',
        requiredProficiency: 50,
        description: '第二段熟练度达到 50 后触发刮刮卡电话解锁流程。',
      },
      {
        id: 'upgrade-tools',
        label: '升级工具',
        requiredProficiency: 300,
        description: '第三段熟练度达到 300 后触发升级工具电话解锁流程。',
      },
      {
        id: 'triple-match-card',
        label: '三连胜出',
        requiredProficiency: 500,
        description: '第四段熟练度达到 500 后预留三连胜出刮刮卡解锁位。',
      },
      {
        id: 'auto-scratcher',
        label: '自动刮刮机',
        requiredProficiency: 1000,
        description: '自动刮刮机段熟练度达到 1000 后触发解锁资格。',
      },
      {
        id: 'auto-stable',
        label: '自动机稳定期',
        requiredProficiency: 3000,
        description: '自动机稳定期熟练度达到 3000 后承接后期自动化升级。',
      },
      {
        id: 'risk-warmup',
        label: '高风险预热',
        requiredProficiency: 5000,
        description: '高风险预热段熟练度达到 5000 后承接风险管理能力。',
      },
      {
        id: 'push-luck-card',
        label: '步步加码',
        requiredProficiency: 10000,
        description: '步步加码段熟练度达到 10000 后解锁高风险逐层挑战票。',
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
          // 阶段8调优：62% → 52%，期望收益从 $6.75 提升至 ~$8.75（亏损率 ~12.5%）
          probability: 0.52,
          displayProbability: null,
          payout: 0,
        },
        {
          id: 'pair-fire',
          label: '火焰成对',
          probability: 0.3,
          displayProbability: 0.5,
          payout: 10,
        },
        {
          id: 'pair-cash',
          label: '纸钞成对',
          probability: 0.13,
          displayProbability: 0.4,
          payout: 25,
        },
        {
          id: 'pair-bag',
          label: '钱袋成对',
          probability: 0.05,
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
        radius: 5,
        stepDistance: 4,
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
          // 阶段8调优：82% → 63%，期望收益从 ~$28.5 提升至 ~$66（亏损率 ~34%）
          probability: 0.63,
          displayProbability: null,
          payout: 0,
        },
        {
          id: 'triple-coin',
          label: '铜币三连',
          probability: 0.25,
          displayProbability: 0.3,
          payout: 100,
        },
        {
          id: 'triple-bag',
          label: '钱袋三连',
          probability: 0.08,
          displayProbability: 0.3,
          payout: 200,
        },
        {
          id: 'triple-cash',
          label: '纸钞三连',
          probability: 0.03,
          displayProbability: 0.3,
          payout: 500,
        },
        {
          id: 'triple-jackpot',
          label: '金币堆三连',
          probability: 0.01,
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
        radius: 5,
        stepDistance: 4,
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
    pushLuck: {
      id: 'push-luck',
      label: '步步加码',
      price: 800,
      scratchCompleteThreshold: 1,
      scratchSymbolRevealThreshold: 0.95,
      scratchBrush: {
        radius: 5,
        stepDistance: 4,
      },
      matchRule: {
        slots: 4,
        requiredMatches: 1,
      },
      prizePool: [
        {
          id: 'push-layer-1',
          label: '第一层止盈',
          probability: 1,
          displayProbability: null,
          payout: 260,
        },
        {
          id: 'push-layer-2',
          label: '第二层止盈',
          probability: 1,
          displayProbability: null,
          payout: 760,
        },
        {
          id: 'push-layer-3',
          label: '第三层止盈',
          probability: 1,
          displayProbability: null,
          payout: 1800,
        },
        {
          id: 'push-layer-4',
          label: '第四层大奖',
          probability: 1,
          displayProbability: null,
          payout: 5200,
        },
        {
          id: 'push-bust',
          label: '爆雷归零',
          probability: 1,
          displayProbability: null,
          payout: 0,
        },
      ] as const,
      pushRule: {
        reserveGoldAfterBust: 1,
        layers: [
          {
            layer: 1,
            cashOutAmount: 260,
            bustPenalty: 0,
            symbol: 'coin',
          },
          {
            layer: 2,
            cashOutAmount: 760,
            bustPenalty: 120,
            symbol: 'bag',
          },
          {
            layer: 3,
            cashOutAmount: 1800,
            bustPenalty: 240,
            symbol: 'cash',
          },
          {
            layer: 4,
            cashOutAmount: 5200,
            bustPenalty: 400,
            symbol: 'jackpot',
          },
        ] as const,
        bustPathPool: [
          {
            id: 'bust-layer-2',
            label: '第二层爆雷',
            probability: 0.35,
            firstBustLayer: 2,
          },
          {
            id: 'bust-layer-3',
            label: '第三层爆雷',
            probability: 0.25,
            firstBustLayer: 3,
          },
          {
            id: 'bust-layer-4',
            label: '第四层爆雷',
            probability: 0.175,
            firstBustLayer: 4,
          },
          {
            id: 'all-safe',
            label: '全程安全',
            probability: 0.05,
            firstBustLayer: null,
          },
        ] as const,
      },
      level: {
        cardsRequiredByLevel: [3, 10, 25, 50, 100, 200, 350, 550, 800] as const,
        payoutMultiplierByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const,
      },
    },
    finalChance: {
      id: 'final-chance',
      label: '最后一刮',
      price: 5000,
      scratchCompleteThreshold: 0.95,
      scratchSymbolRevealThreshold: 0.95,
      scratchBrush: {
        radius: 5,
        stepDistance: 4,
      },
      matchRule: {
        slots: 5,
        requiredMatches: 3,
      },
      prizePool: [
        {
          id: 'final-0',
          label: '彻底失手',
          probability: 0.1,
          displayProbability: 0.1,
          payout: 0,
        },
        {
          id: 'final-1',
          label: '微光未成',
          probability: 0.22,
          displayProbability: 0.22,
          payout: 0,
        },
        {
          id: 'final-2',
          label: '差一点',
          probability: 0.33,
          displayProbability: 0.33,
          payout: 0,
        },
        {
          id: 'final-3',
          label: '终局成功',
          probability: 0.24,
          displayProbability: 0.24,
          payout: 0,
        },
        {
          id: 'final-4',
          label: '大成功',
          probability: 0.09,
          displayProbability: 0.09,
          payout: 0,
        },
        {
          id: 'final-5',
          label: '传说结局',
          probability: 0.02,
          displayProbability: 0.02,
          payout: 0,
        },
      ] as const,
      finalRule: {
        requiredLegendSymbols: 3,
        requiredPushLuckSettlements: 3,
        gloryPreviewByLegendCount: [1, 1, 1, 2, 3, 5] as const,
      },
      level: {
        cardsRequiredByLevel: [1] as const,
        payoutMultiplierByLevel: [1] as const,
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
          id: 'street-high-risk',
          role: 'high-risk',
          roleLabel: '高风险票',
          cardType: 'push-luck',
          description: '逐层止盈或继续加码，越贪越危险。',
        },
        {
          id: 'street-finale',
          role: 'finale',
          roleLabel: '终局票',
          cardType: 'final-chance',
          lockedLabel: '终局票',
          description: '当前卡册的最后一刮，手动处理后进入本轮结算。',
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
  // 阶段四先展示自动刮刮机作为中期目标；真实自动处理逻辑从阶段五开始接入。
  automation: {
    autoScratchMachine: {
      id: 'auto-scratcher',
      label: '自动刮刮机',
      price: 1000,
      description: '自动处理稳定票，风险票仍需手动。',
      unlock: {
        requiredMilestoneId: 'auto-scratcher',
      },
      base: {
        queueCapacity: 2,
        processingSeconds: 8,
        defaultCardType: 'basic-safe',
      },
      upgrades: [
        {
          id: 'auto-capacity',
          label: '刮卡机容量',
          price: 2500,
          description: '提高队列上限，后续从 2 张扩到 3 / 5 / 8 张。',
        },
        {
          id: 'auto-power',
          label: '刮卡机力量',
          price: 2000,
          description: '提高可处理票池，后续允许处理更厚的非风险票。',
        },
        {
          id: 'auto-speed',
          label: '刮卡机速度',
          price: 5000,
          description: '缩短单张处理时间，保持可见刮卡过程。',
        },
      ] as const,
    },
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
      // 熟练度达到多少后自动解锁垃圾桶购买资格。
      autoUnlockAfterCleanedPlates: 10,
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
  // Prestige 永久成长配置。阶段 7 开始接入。
  prestige: {
    permanentUpgrades: [
      {
        id: 'starter-gold',
        label: '起始资金',
        description: '每级使开局启动金增加 $5，让下一轮更快买到第一张卡。',
        maxLevel: 5,
        // 各等级购买所需荣耀点，下标代表当前等级（购买后进入 level+1）。
        gloryCostByLevel: [1, 2, 4, 8, 15] as const,
        effect: {
          type: 'starter-gold-bonus',
          // 每级增加多少开局金币。
          valuePerLevel: 5,
        },
      },
      {
        id: 'eternal-luck',
        label: '永久幸运',
        description: '每级提升安全卡与高赔率卡的基础中奖权重 2%，与刮卡运气工具叠加。',
        maxLevel: 5,
        gloryCostByLevel: [2, 4, 8, 15, 25] as const,
        effect: {
          type: 'global-luck-bonus',
          // 每级从未中奖权重中移出的比例。
          valuePerLevel: 0.02,
          // 与刮卡运气叠加后，未中奖概率总底线。
          losingProbabilityFloor: 0.45,
        },
      },
      {
        id: 'payout-amplifier',
        label: '永久收益',
        description: '每级将安全卡与高赔率卡结算 payout 提升 5%，风险卡和步步加码不受影响。',
        maxLevel: 5,
        gloryCostByLevel: [2, 5, 10, 20, 35] as const,
        effect: {
          type: 'global-payout-multiplier',
          // 每级 payout 倍率增量，例如 level=2 时 payout ×1.10。
          valuePerLevel: 0.05,
        },
      },
      {
        id: 'scratch-efficiency',
        label: '刮擦基础',
        description: '每级使下一轮开局刮除半径 +1，等价于已升级刮除范围工具。',
        maxLevel: 3,
        gloryCostByLevel: [1, 3, 6] as const,
        effect: {
          type: 'base-scratch-radius-bonus',
          // 每级增加多少刮除半径。
          valuePerLevel: 1,
        },
      },
      {
        id: 'early-automation',
        label: '自动化提早接入',
        description: '每级将自动刮刮机解锁所需熟练度降低 100 点，最低保留 200 点。',
        maxLevel: 3,
        gloryCostByLevel: [3, 7, 15] as const,
        effect: {
          type: 'auto-scratcher-threshold-reduction',
          // 每级降低多少熟练度门槛。
          valuePerLevel: 100,
          // 降低后的最低保留值。
          minimumThreshold: 200,
        },
      },
      {
        id: 'album-headstart',
        label: '卡册起步',
        description: '每级将刮刮卡解锁（scratch-mode 段）熟练度门槛降低 5 点，最低保留 10 点。',
        maxLevel: 3,
        gloryCostByLevel: [2, 5, 12] as const,
        effect: {
          type: 'scratch-card-unlock-threshold-reduction',
          // 每级降低多少熟练度门槛。
          valuePerLevel: 5,
          // 降低后的最低保留值（不低于 trash-can 段目标）。
          minimumThreshold: 10,
        },
      },
    ] as const,
  },
} as const;

export type ScratchLegendConfig = typeof scratchLegendConfig;
