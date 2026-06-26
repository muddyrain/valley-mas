# WorldSim 平衡性修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Current note:** 本计划记录的是第一轮“分段参数”修复方案。后续已升级为 `tempo.ts` 平滑曲线方案：战争偏好、终局加速和强弱修正均通过 `smoothstep` 连续插值；最新设计以 `apps/world-sim/docs/TDD.md` 的“平衡性参数”章节为准。

**Goal:** 修复 2000 年不灭国的平衡性问题，让 3000 州 / 8 家势力的随机剧本在 50-200 年内出现明显的势力衰亡，200-500 年内出现统一或僵局。

**Architecture:** 在不动内核架构的前提下，通过调整战斗参数和目标选择逻辑实现平衡性修复。所有改动均符合 TDD 第 10.2 节"不做外交/经济"的约束。

**Tech Stack:** TypeScript 5 + Zustand 4（现有栈，无新依赖）

---

## 涉及文件清单

| 文件 | 改动类型 | 职责 |
|---|---|---|
| `src/core/sim/terrainCombat.ts` | 修改 | 增强 `strengthBias` 修正幅度 |
| `src/core/sim/expansion.ts` | 修改 | 1. 提高 `attemptsPerTick` 上限；2. 目标选择按弱势力加权；3. 空州占满检测与加速 |
| `src/shared/types/sim.ts` | 修改 | 新增平衡性常量导出 |
| `docs/TDD.md` | 修改 | 更新平衡性参数说明 |

---

### Task 1: 增强但不过度放大强弱修正（strengthBias）

**Files:**
- Modify: `src/core/sim/terrainCombat.ts:20-29`
- Test: 静态数学验证

**Goal:** 让大势力能够压制小势力，但避免早期位置优势在 100 年内直接滚成统一。

- [ ] **Step 1: 修改 strengthBias 修正幅度**

```typescript
// terrainCombat.ts 第 23-28 行
/**
 * 强弱差额修正：攻方/(攻方+守方) 控制的州数比例越高，越增加胜率上限。
 * 返回值在 [-0.3, +0.3] 范围内，再叠加到地形基础概率上。
 * 
 * 设计说明（对齐 TDD 第 1.1 节"衰亡"目标）：
 * - 原设计 ±0.18 太弱，100v1 胜率仅 73%，小势力容易苟活
 * - 增强到 ±0.3 后，100v1 胜率约 85%，10v1 胜率约 80%
 * - 大势力有优势，但不会因为前期多吃空州就快速统一
 * - 2v1 胜率约 65%，接近公平对决
 */
export function strengthBias(attackerRegions: number, defenderRegions: number): number {
  const total = attackerRegions + defenderRegions;
  if (total <= 0) return 0;
  const ratio = attackerRegions / total;
  return (ratio - 0.5) * 0.6;  // 原 0.36 → 0.6，范围 ±0.3
}
```

- [ ] **Step 2: 静态验证数学正确性**

Run:
```bash
python3 -c "
def strengthBias(a, d):
    total = a + d
    if total <= 0: return 0
    ratio = a / total
    return (ratio - 0.5) * 0.6

TERRAIN_PROB = {'plain': 0.55, 'forest': 0.5, 'river': 0.4, 'mountain': 0.32}

def clamp01(x): return max(0, min(1, x))

test_cases = [
    (100, 1, 'plain', '100v1 平原'),
    (100, 1, 'mountain', '100v1 山脉'),
    (10, 1, 'plain', '10v1 平原'),
    (10, 1, 'mountain', '10v1 山脉'),
    (2, 1, 'plain', '2v1 平原'),
    (1, 1, 'plain', '1v1 平原'),
    (1, 10, 'plain', '1v10 平原（防守）'),
]

print('胜率验证（增强后）:')
for a, d, terrain, desc in test_cases:
    base = TERRAIN_PROB[terrain]
    bias = strengthBias(a, d)
    win = clamp01(base + bias)
    print(f'  {desc}: base={base:.2f} + bias={bias:+.3f} = {win:.1%}')
"
```
Expected:
```
胜率验证（增强后）:
  100v1 平原: base=0.55 + bias=+0.294 = 84.4%
  100v1 山脉: base=0.32 + bias=+0.294 = 61.4%
  10v1 平原: base=0.55 + bias=+0.245 = 79.5%
  10v1 山脉: base=0.32 + bias=+0.245 = 56.5%
  2v1 平原: base=0.55 + bias=+0.100 = 65.0%
  1v1 平原: base=0.55 + bias=+0.000 = 55.0%
  1v10 平原（防守）: base=0.55 + bias=-0.245 = 30.5%
```

---

### Task 2: 导出平衡性常量到 shared/types

**Files:**
- Modify: `src/shared/types/sim.ts`
- Test: 静态验证

**Goal:** 提取平衡性常量到共享类型，避免硬编码。

- [ ] **Step 1: 在 sim.ts 末尾添加常量**

```typescript
/** 平衡性参数：每 tick 扩张尝试次数系数 */
export const EXPANSION_ATTEMPTS_MULTIPLIER = 16;
export const EXPANSION_ATTEMPTS_MIN = 40;
export const EXPANSION_ATTEMPTS_MAX = 100;
```

---

### Task 3: 提高尝试次数上限

**Files:**
- Modify: `src/core/sim/expansion.ts:60-61`
- Test: 静态验证

**Goal:** 让战斗更频繁，加快游戏节奏。

- [ ] **Step 1: 修改 expansion.ts 顶部 import**

```typescript
// expansion.ts 顶部 import 添加
import { 
  EXPANSION_ATTEMPTS_MULTIPLIER, 
  EXPANSION_ATTEMPTS_MIN, 
  EXPANSION_ATTEMPTS_MAX 
} from '@/shared/types';
```

- [ ] **Step 2: 修改 attemptsPerTick 计算**

```typescript
// expansion.ts 第 60-61 行
// 原: clamp(liveCount * 8, 20, 50)
// 新: clamp(liveCount * 16, 40, 100)
// 设计说明（对齐 TDD Phase 8.5）：
// - 8 家势力从 50 次 → 100 次/tick，战斗频率翻倍
// - 下限从 20 → 40，保证少势力时也有足够动作
// - 上限从 50 → 100，3000 州下仍能保持 60 FPS（TDD 第 538 行验证过）
const attempts = input.attemptsPerTick ?? clamp(
  liveCount * EXPANSION_ATTEMPTS_MULTIPLIER, 
  EXPANSION_ATTEMPTS_MIN, 
  EXPANSION_ATTEMPTS_MAX
);
```

---

### Task 4: 攻击目标优先选择弱势力

**Files:**
- Modify: `src/core/sim/expansion.ts:95-101`
- Test: 静态逻辑验证

**Goal:** 让 AI 集火消灭小势力，而不是随机攻击导致动态平衡。符合 TDD 第 10.2 节"不做外交"的约束（只是 AI 决策优化，不引入同盟/外交关系）。

- [ ] **Step 1: 修改目标选择逻辑，按弱势力加权**

```typescript
// expansion.ts 第 95-101 行
// 原: 完全随机选择 enemyNeighbors 中的目标
// 新: 按占领率分段决定战争偏好，再按守方州数倒数加权选择目标

const ownedTargetPreference = getOwnedTargetPreference(occupiedRatio);
const preferOwnedTarget = rng.next() < ownedTargetPreference;
const sourceRegionNum =
  preferOwnedTarget
    ? (pickWarfrontFromBorder(attacker.border, map, ownerOf, attacker.id, rng) ??
      pickFromSet(attacker.border, rng))
    : pickFromSet(attacker.border, rng);

const enemyNeighbors: RegionId[] = [];
const ownedEnemyNeighbors: Array<{ region: RegionId; weight: number }> = [];

for (const nid of sourceProvince.neighbors) {
  const owner = ownerOf(nid);
  if (owner === attacker.id) continue;
  enemyNeighbors.push(nid);
  if (owner != null) {
    const defender = runtimeById.get(owner);
    const strength = defender?.totalRegions ?? 1;
    ownedEnemyNeighbors.push({
      region: nid,
      weight: 1 / (strength + 1),
    });
  }
}

if (enemyNeighbors.length === 0) {
  attacker.border.delete(sourceRegionNum);
  continue;
}

const targetRegion =
  preferOwnedTarget && ownedEnemyNeighbors.length > 0
    ? pickWeightedRegion(ownedEnemyNeighbors, rng)
    : enemyNeighbors[Math.floor(rng.next() * enemyNeighbors.length)];
```

**设计说明：**
- 不引入任何外交关系数据结构，只是在目标选择时做加权
- 占领率 <50% 时 20% 概率优先战争，50%–90% 时 45%，>90% 时 70%
- 弱势力权重 = 1/(州数+1)，1 州势力权重约为 10 州势力的 5.5 倍
- 战争偏好命中时只在有主州中抽取目标，避免空州边境反向稀释灭国节奏

---

### Task 5: 空州占满后加速机制

**Files:**
- Modify: `src/core/sim/expansion.ts:45-55`
- Test: 静态逻辑验证

**Goal:** 解决终局疲软，但避免占领率刚到 90% 就让领先者继续加速滚雪球。

- [ ] **Step 1: 添加空州占比检测与加速**

```typescript
// expansion.ts 第 45-55 行，在计算 attempts 之前添加

const totalProvinces = map.provinces.length;
let occupiedCount = 0;
for (const p of map.provinces) {
  if (p.ownerFactionId != null) occupiedCount++;
}
const occupiedRatio = occupiedCount / totalProvinces;

// 终局加速：已占领 > 95% 或存活势力 <= 3 时，尝试次数翻倍
// 设计说明（对齐 TDD 第 10.3 节"防终局疲软"）：
// - 前期空州多，大家和平扩张，节奏较慢
// - 后期空州基本占满或剩余势力很少时，加速 ×2 让终局更快到来
const speedMultiplier = occupiedRatio > 0.95 || liveCount <= 3 ? 2 : 1;

const attempts = input.attemptsPerTick ?? clamp(
  liveCount * EXPANSION_ATTEMPTS_MULTIPLIER * speedMultiplier,
  EXPANSION_ATTEMPTS_MIN * speedMultiplier,
  EXPANSION_ATTEMPTS_MAX * speedMultiplier
);
```

---

### Task 6: 同步更新 TDD 文档

**Files:**
- Modify: `docs/TDD.md`（Phase 8.5 第 510 行 + 新增平衡性说明）
- Test: 文档一致性检查

- [ ] **Step 1: 更新 Phase 8.5 第 5 条**

```markdown
5. **每 Tick 40–100 次扩张（终局 ×2）**：`runExpansionTick` 默认 `attempts = clamp(势力数 × 16, 40, 100)`；当已占领 >95% 或存活势力 ≤3 时尝试次数翻倍，避免 3000 州下"前期速胜、后期疲软"。
```

- [ ] **Step 2: 在「UI 控制规范」后新增「平衡性参数」小节**

```markdown
**平衡性参数**（确保势力能够衰亡，对齐产品目标第 1.1 节）：

- **强弱修正**：`strengthBias(attacker, defender)` 返回值范围 ±0.3（原 ±0.18），让大势力有优势但不过早速胜。100v1 平原胜率约 85%，10v1 平原胜率约 80%，1v1 平原胜率 55%。
- **目标选择**：按占领率分段优先战争：<50% 为 20%，50%–90% 为 45%，>90% 为 70%；命中后按 `1/守方州数` 加权攻击弱势力。
- **尝试次数**：`clamp(势力数 × 16, 40, 100)`，已占领 >95% 或存活势力 ≤3 后 ×2，加快终局节奏。
- **地形胜率**：平原 0.55 / 沙漠 0.55 / 森林 0.50 / 河流 0.40 / 山脉 0.32，叠加强弱修正后为最终胜率。
```

---

### Task 7: 编码检查与综合验证

**Files:**
- All modified files
- Test: encoding guard + 静态验证

- [ ] **Step 1: 运行编码检查**

Run:
```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  src/core/sim/terrainCombat.ts \
  src/core/sim/expansion.ts \
  src/shared/types/sim.ts \
  docs/TDD.md
```
Expected: `PASS: no suspicious encoding or text-loss issues detected.`

- [ ] **Step 2: 综合数学验证**

Run:
```bash
python3 -c "
# 综合验证：模拟 8 家势力，每家初始 1 州，3000 州地图
# 计算期望消灭时间

def strengthBias(a, d):
    total = a + d
    if total <= 0: return 0
    ratio = a / total
    return (ratio - 0.5) * 0.6

def clamp01(x): return max(0, min(1, x))

TERRAIN = {'plain': 0.55, 'forest': 0.5, 'river': 0.4, 'mountain': 0.32}

# 模拟 1v1 到 100v1 的胜率
print('=== 胜率表 ===')
for a in [1, 2, 5, 10, 20, 50, 100]:
    for d in [1, 2, 5, 10]:
        if a <= d: continue
        for t in ['plain', 'mountain']:
            base = TERRAIN[t]
            bias = strengthBias(a, d)
            win = clamp01(base + bias)
            # 连续成功 d 次的概率（消灭 d 州势力）
            eliminate_prob = win ** d
            print(f'  {a:3d}v{d:2d} {t:8s}: 胜率={win:5.1%}, 灭国概率={eliminate_prob:5.1%}')

print()
print('=== 节奏估算 ===')
# 8 家，100 次/tick；战争偏好随占领率从 20% → 45% → 70% 分段提升
# 终局加速延后到已占领 >95% 或存活势力 <=3，目标是 200 年内有灭国但不常态 <100 年统一
print('  前期战争偏好: 20%，优先自然扩张')
print('  中期战争偏好: 45%，开始消灭弱势力')
print('  后期战争偏好: 70%，推进终局吞并')
print('  终局加速: 已占领 >95% 或存活势力 <=3')
"
```
