import {
  Building2,
  Crosshair,
  Crown,
  Heart,
  History,
  Package,
  PackageOpen,
  Star,
  TrendingUp,
  UserRound,
  Wheat,
} from 'lucide-react';
import { useState } from 'react';
import type { Inspection } from '@/render/renderTypes';
import {
  type ConstructionPriority,
  DiplomacyState,
  PlanningZoneKind,
  ResidentRole,
  ResidentSex,
  type WorldHistoryEntry,
  type WorldHistoryLink,
} from '@/shared/gameTypes';
import {
  BUILDING_LABELS,
  DIPLOMACY_LABELS,
  ENTITY_LABELS,
  PROFESSION_LABELS,
  STATE_LABELS,
  TIER_LABELS,
} from './labels';

function Gauge({
  label,
  value,
  tone = 'green',
}: {
  label: string;
  value: number;
  tone?: 'green' | 'gold' | 'red';
}) {
  const percentage = Math.max(0, Math.min(100, value / 10));
  return (
    <div className="inspector-gauge">
      <span>
        <b>{label}</b>
        <em>{Math.round(percentage)}%</em>
      </span>
      <i>
        <i className={tone} style={{ width: `${percentage}%` }} />
      </i>
    </div>
  );
}

export function InspectorPanel({
  inspection,
  onClose,
  onFollow,
  onConstructionPriority,
  activePlanningZone,
  onPlanningZone,
  onFocusCapital,
  onFavorite,
  onHistoryNavigate,
}: {
  inspection: Inspection;
  onClose: () => void;
  onFollow?: (id: number) => void;
  onConstructionPriority?: (villageId: number, priority: ConstructionPriority) => void;
  activePlanningZone?: PlanningZoneKind | null;
  onPlanningZone?: (villageId: number, zone: PlanningZoneKind | null) => void;
  onFocusCapital?: (villageId: number) => void;
  onFavorite?: (lifeId: number, favorite: boolean) => void;
  onHistoryNavigate?: (link: WorldHistoryLink, event: WorldHistoryEntry) => void;
}) {
  const [entityTab, setEntityTab] = useState<'overview' | 'growth' | 'equipment' | 'history'>(
    'overview',
  );
  if (inspection.type === 'entity') {
    const weaponName = ['无', '基础', '精良', '大师'][inspection.weaponTier] || '传奇';
    const armorName = ['布衣', '皮甲', '锁甲', '板甲'][inspection.armorTier] || '王家甲胄';
    const toggleFavorite = () => {
      onFavorite?.(inspection.lifeId, !inspection.favorite);
    };
    const roleLabel =
      {
        [ResidentRole.Citizen]: '居民',
        [ResidentRole.Veteran]: '老兵',
        [ResidentRole.Master]: '大师',
        [ResidentRole.Captain]: '队长',
        [ResidentRole.Leader]: '领主',
        [ResidentRole.King]: '国王',
      }[inspection.role as ResidentRole] ?? '居民';
    const taskPhaseLabels = {
      reserved: '已预留',
      travel: '前往目标',
      pickup: '取得物资',
      work: '持续工作',
      delivery: '送往目的地',
      complete: '已完成',
      suspended: '暂时中断',
      failed: '未能完成',
    } as const;
    const taskReasonLabels = {
      none: '等待村庄安排',
      hunger: '需要正常进食',
      'critical-hunger': '极度饥饿',
      fatigue: '需要回家休息',
      'critical-fatigue': '精力耗尽',
      danger: '附近存在危险',
      'village-needs-food': '村庄需要食物',
      'village-needs-wood': '村庄需要木材',
      'village-needs-stone': '村庄需要石料',
      'village-needs-metal': '村庄需要金属',
      'village-needs-tools': '村庄需要工具',
      'village-needs-equipment': '村庄需要装备',
      'village-needs-housing': '村庄需要住房',
      'village-construction': '工地需要推进',
      'professional-duty': '履行职业职责',
    } as const;
    const carriedLabels = [
      '无',
      '木材',
      '石料',
      '金属',
      '食物',
      '工具',
      '装备',
      '工坊材料',
    ] as const;
    const taskFailureReason = inspection.task?.failureReason || '无';
    const carriedResourceLabel = carriedLabels[inspection.carriedResourceKind] || '物资';
    return (
      <aside className="inspector-panel" data-testid="entity-inspector">
        <div className="inspector-heading">
          <span className="inspector-icon">
            <UserRound size={19} />
          </span>
          <span>
            <small>{ENTITY_LABELS[inspection.kind] || '生命'}</small>
            <strong>{inspection.name}</strong>
          </span>
          <span className="inspector-heading-actions">
            <button
              type="button"
              className={inspection.favorite ? 'favorite active' : 'favorite'}
              onClick={toggleFavorite}
              aria-label={inspection.favorite ? '取消收藏' : '收藏居民'}
            >
              <Star size={15} fill={inspection.favorite ? 'currentColor' : 'none'} />
            </button>
            <button type="button" onClick={onClose} aria-label="关闭">
              ×
            </button>
          </span>
        </div>
        <div className="tag-row">
          <span>{PROFESSION_LABELS[inspection.profession] || '居民'}</span>
          <span>{inspection.age} 岁</span>
          <span>{inspection.sex === ResidentSex.Female ? '女性' : '男性'}</span>
          <span>{roleLabel}</span>
          <span className="accent">{STATE_LABELS[inspection.state] || '行动中'}</span>
        </div>
        <div className="inspector-tabs" role="tablist" aria-label="居民资料">
          {(
            [
              ['overview', '概况', UserRound],
              ['growth', '成长', TrendingUp],
              ['equipment', '装备', Package],
              ['history', '经历', History],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={entityTab === value}
              className={entityTab === value ? 'active' : ''}
              onClick={() => setEntityTab(value)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        {entityTab === 'overview' && (
          <>
            <div className="gauge-stack">
              <Gauge label="健康" value={inspection.health} />
              <Gauge label="饱食" value={1_000 - inspection.hunger} tone="gold" />
              <Gauge label="精力" value={inspection.energy} />
              {inspection.malnutrition > 0 && (
                <Gauge label="营养" value={1_000 - inspection.malnutrition} tone="red" />
              )}
            </div>
            <div className="inspector-list">
              <span>
                <b>村庄</b>
                <em>{inspection.villageName}</em>
              </span>
              <span>
                <b>王国</b>
                <em>{inspection.kingdomName}</em>
              </span>
              <span>
                <b>特质</b>
                <em>{['温和', '好奇', '坚毅', '谨慎'][inspection.traits % 4]}</em>
              </span>
              <span>
                <b>行动</b>
                <em>{STATE_LABELS[inspection.state] || '行动中'}</em>
              </span>
              <span>
                <b>原因</b>
                <em>
                  {inspection.task ? taskReasonLabels[inspection.task.reason] : '等待村庄安排'}
                </em>
              </span>
              <span>
                <b>阶段</b>
                <em>{inspection.task ? taskPhaseLabels[inspection.task.phase] : '无当前任务'}</em>
              </span>
              <span>
                <b>目的地</b>
                <em>{inspection.task ? `地图格 #${inspection.task.targetCell}` : '—'}</em>
              </span>
              <span>
                <b>进度</b>
                <em>
                  {inspection.task
                    ? `${Math.floor(inspection.task.progress)} / ${Math.floor(inspection.task.requiredProgress)}`
                    : '—'}
                </em>
              </span>
              <span>
                <b>预期结果</b>
                <em>{inspection.task?.expectedResult ?? '—'}</em>
              </span>
              <span>
                <b>阻碍</b>
                <em>{taskFailureReason}</em>
              </span>
              <span>
                <b>预留至</b>
                <em>{inspection.task ? `第 ${inspection.task.leaseUntilTick} Tick` : '—'}</em>
              </span>
              <span>
                <b>携带</b>
                <em>
                  {inspection.carriedResourceAmount > 0
                    ? `${carriedResourceLabel} × ${inspection.carriedResourceAmount}`
                    : '无'}
                </em>
              </span>
              <span>
                <b>住所</b>
                <em>{inspection.homeName}</em>
              </span>
              <span>
                <b>工位</b>
                <em>{inspection.workplaceName}</em>
              </span>
              <span>
                <b>伴侣</b>
                <em>{inspection.partnerName}</em>
              </span>
            </div>
          </>
        )}
        {entityTab === 'growth' && (
          <div className="growth-panel">
            <strong>等级 {inspection.level}</strong>
            <span>
              <b>经验</b>
              <em>{inspection.experience.toLocaleString('zh-CN')}</em>
            </span>
            <span>
              <b>村庄贡献</b>
              <em>{inspection.contribution.toLocaleString('zh-CN')}</em>
            </span>
            <span>
              <b>身份</b>
              <em>{roleLabel}</em>
            </span>
            <span>
              <b>家庭</b>
              <em>{inspection.familyId > 0 ? `第 ${inspection.familyId} 家庭` : '未成家'}</em>
            </span>
            {inspection.parentNames.length > 0 && (
              <span>
                <b>父母</b>
                <em>{inspection.parentNames.join('、')}</em>
              </span>
            )}
          </div>
        )}
        {entityTab === 'equipment' && (
          <div className="equipment-panel">
            <span>
              <i>武</i>
              <b>武器</b>
              <em>{weaponName}</em>
            </span>
            <span>
              <i>甲</i>
              <b>护甲</b>
              <em>{armorName}</em>
            </span>
            <small>装备由村庄工坊制作并自动分配。</small>
          </div>
        )}
        {entityTab === 'history' && (
          <div className="resident-history">
            {inspection.history.length > 0 ? (
              inspection.history.map((event) => (
                <span key={`${event.tick}-${event.message}`}>
                  <i />
                  <b>{event.message}</b>
                  <small>第 {Math.floor(event.tick / 20)} 日</small>
                  {event.links.length > 0 && (
                    <span className="history-inline-links">
                      {event.links.map((link, index) => (
                        <button
                          key={`${link.kind}-${link.lifeId ?? link.id ?? link.warId ?? link.cell}-${index}`}
                          type="button"
                          disabled={!link.available}
                          onClick={() => onHistoryNavigate?.(link, event)}
                        >
                          {link.label}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              ))
            ) : (
              <p>还没有值得记入编年的经历。</p>
            )}
          </div>
        )}
        {onFollow && (
          <button type="button" className="follow-action" onClick={() => onFollow(inspection.id)}>
            <Crosshair size={14} />
            跟随
          </button>
        )}
      </aside>
    );
  }

  if (inspection.type === 'village') {
    const { village } = inspection;
    return (
      <aside className="inspector-panel" data-testid="village-inspector">
        <div className="inspector-heading">
          <span className="inspector-icon">
            <Building2 size={19} />
          </span>
          <span>
            <small>{TIER_LABELS[village.tier]}</small>
            <strong>{village.name}</strong>
          </span>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="resource-cards">
          <span>
            <UserRound size={15} />
            <b>{village.population}</b>
            <small>人口</small>
          </span>
          <span>
            <Wheat size={15} />
            <b>{Math.floor(village.resources.food)}</b>
            <small>食物</small>
          </span>
          <span>
            <PackageOpen size={15} />
            <b>{Math.floor(village.resources.wood)}</b>
            <small>木材</small>
          </span>
        </div>
        <Gauge
          label="城镇状态"
          value={village.health}
          tone={village.health < 400 ? 'red' : 'green'}
        />
        <div className="inspector-list">
          <span>
            <b>王国</b>
            <em>{inspection.kingdomName}</em>
          </span>
          <span>
            <b>建筑</b>
            <em>{inspection.completedBuildings} 座完成</em>
          </span>
          <span>
            <b>石料</b>
            <em>{Math.floor(village.resources.stone)}</em>
          </span>
          <span>
            <b>住房</b>
            <em>
              {village.population} / {village.housingCapacity}
            </em>
          </span>
          <span>
            <b>承载力</b>
            <em>{village.carryingCapacity}</em>
          </span>
          <span>
            <b>食物结余</b>
            <em>
              {village.foodTrend >= 0 ? '+' : ''}
              {village.foodTrend.toFixed(1)}
            </em>
          </span>
          <span>
            <b>分类仓储</b>
            <em>
              食物 {Math.floor(village.resources.food)}/{village.storageCapacityByKind.food} · 木材{' '}
              {Math.floor(village.resources.wood)}/{village.storageCapacityByKind.wood} · 石料{' '}
              {Math.floor(village.resources.stone)}/{village.storageCapacityByKind.stone}
            </em>
          </span>
          <span>
            <b>露天积存</b>
            <em>
              食物 {Math.floor(village.outdoorStockpile.food)} · 木材{' '}
              {Math.floor(village.outdoorStockpile.wood)} · 石料{' '}
              {Math.floor(village.outdoorStockpile.stone)} · 金属{' '}
              {Math.floor(village.outdoorStockpile.metal)}
            </em>
          </span>
          <span>
            <b>建设决定</b>
            <em>{village.constructionDecision}</em>
          </span>
          {village.constructionOverrideReason && (
            <span>
              <b>优先覆盖</b>
              <em>{village.constructionOverrideReason}</em>
            </span>
          )}
        </div>
        <div className="inspector-list" data-testid="village-development">
          <span>
            <b>下一阶段</b>
            <em>
              {inspection.development.nextTier === null
                ? '已达城邦'
                : TIER_LABELS[inspection.development.nextTier]}
            </em>
          </span>
          {inspection.development.nextTier !== null && (
            <span>
              <b>人口条件</b>
              <em>
                {inspection.development.population} / {inspection.development.requiredPopulation}
              </em>
            </span>
          )}
          {inspection.development.buildings.map((item) => (
            <span key={item.type}>
              <b>{BUILDING_LABELS[item.type]}</b>
              <em>
                {item.current} / {item.required}
              </em>
            </span>
          ))}
        </div>
        <div className="inspector-list" data-testid="village-work-hotspots">
          <span>
            <b>住宅规划</b>
            <em>{inspection.planningZones.residential} 格</em>
          </span>
          <span>
            <b>生产规划</b>
            <em>{inspection.planningZones.production} 格</em>
          </span>
          <span>
            <b>防御规划</b>
            <em>{inspection.planningZones.defense} 格</em>
          </span>
          {inspection.workHotspots.slice(0, 4).map((hotspot, index) => (
            <span key={`${hotspot.kind}-${index}`}>
              <b>
                {{
                  production: '生产热点',
                  construction: '建设热点',
                  logistics: '运输热点',
                  defense: '防务热点',
                }[hotspot.kind] ?? '工作热点'}
              </b>
              <em>{hotspot.count} 人</em>
            </span>
          ))}
        </div>
        <div className="inspector-list" data-testid="village-capabilities">
          <span>
            <b>守卫训练</b>
            <em>{inspection.capabilities.guardTrainingSlots} 个工位</em>
          </span>
          <span>
            <b>治理范围</b>
            <em>+{inspection.capabilities.territoryReachBonus} 格</em>
          </span>
          <span>
            <b>领土巩固</b>
            <em>+{inspection.capabilities.claimStrengthBonus}</em>
          </span>
          <span>
            <b>城墙防线</b>
            <em>{inspection.capabilities.captureBlockers} 道</em>
          </span>
          <span>
            <b>边境警戒</b>
            <em>
              {inspection.capabilities.watchtowers} 座 · 射程 {inspection.capabilities.watchRange}{' '}
              格 · 伤害 {inspection.capabilities.watchDamage}
            </em>
          </span>
        </div>
        <div className="resident-history village-chronicle" data-testid="village-chronicle">
          <strong>聚落纪事</strong>
          {inspection.history.length > 0 ? (
            inspection.history.slice(0, 10).map((event) => (
              <span key={event.id}>
                <i />
                <b>{event.message}</b>
                <small>第 {Math.floor(event.tick / 20)} 日</small>
              </span>
            ))
          ) : (
            <p>这座聚落还没有纪事。</p>
          )}
        </div>
        {onPlanningZone && (
          <div
            className="choice-row"
            role="group"
            aria-label="空间规划"
            data-testid="planning-zone-tools"
          >
            {(
              [
                [PlanningZoneKind.Residential, '住宅区'],
                [PlanningZoneKind.Production, '生产区'],
                [PlanningZoneKind.Defense, '防御区'],
                [PlanningZoneKind.None, '清除'],
              ] as const
            ).map(([zone, label]) => (
              <button
                key={zone}
                type="button"
                className={activePlanningZone === zone ? 'active' : ''}
                onClick={() =>
                  onPlanningZone(village.id, activePlanningZone === zone ? null : zone)
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {onConstructionPriority && (
          <label className="inspector-select">
            <span>建设优先</span>
            <select
              value={village.constructionPriority}
              onChange={(event) =>
                onConstructionPriority(village.id, event.target.value as ConstructionPriority)
              }
            >
              <option value="automatic">自动</option>
              <option value="housing">住房</option>
              <option value="storage">储粮</option>
              <option value="food">食物</option>
              <option value="production">生产</option>
              <option value="defense">防御</option>
            </select>
          </label>
        )}
      </aside>
    );
  }

  if (inspection.type === 'building') {
    const { building } = inspection;
    return (
      <aside className="inspector-panel" data-testid="building-inspector">
        <div className="inspector-heading">
          <span className="inspector-icon">
            <Building2 size={19} />
          </span>
          <span>
            <small>{inspection.villageName}</small>
            <strong>{BUILDING_LABELS[building.type]}</strong>
          </span>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <Gauge
          label="建筑状态"
          value={building.health * 10}
          tone={building.health <= 0 ? 'red' : 'green'}
        />
        <div className="inspector-list">
          <span>
            <b>能力</b>
            <em>{inspection.capability}</em>
          </span>
          <span>
            <b>工人</b>
            <em>
              {inspection.workerNames.length > 0 ? inspection.workerNames.join('、') : '暂无'}
            </em>
          </span>
          <span>
            <b>工位</b>
            <em>
              {building.assignedWorkerIds.length} / {building.workSlots}
            </em>
          </span>
          <span>
            <b>输入</b>
            <em>{inspection.inputs}</em>
          </span>
          <span>
            <b>输出</b>
            <em>{inspection.outputs}</em>
          </span>
          <span>
            <b>状态</b>
            <em>{inspection.stopReason}</em>
          </span>
          <span>
            <b>施工</b>
            <em>
              {Math.floor(building.progress)} / {building.requiredProgress}
            </em>
          </span>
        </div>
      </aside>
    );
  }

  const capital = inspection.capital;
  return (
    <aside className="inspector-panel" data-testid="kingdom-inspector">
      <div className="inspector-heading">
        <span className="inspector-icon" style={{ color: inspection.kingdom.color }}>
          <Crown size={19} />
        </span>
        <span>
          <small>王国</small>
          <strong>{inspection.kingdom.name}</strong>
        </span>
        <button type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="resource-cards">
        <span>
          <UserRound size={15} />
          <b>{inspection.population}</b>
          <small>人口</small>
        </span>
        <span>
          <Building2 size={15} />
          <b>{inspection.kingdom.villageIds.length}</b>
          <small>村庄</small>
        </span>
        <span>
          <Heart size={15} />
          <b>{inspection.kingdom.militaryPower}</b>
          <small>军力</small>
        </span>
      </div>
      <div className="tag-row">
        <span className="accent">首都 · {capital?.name || '暂无'}</span>
        <span>邻国 {inspection.neighbours.length}</span>
        <span>
          战争 {Object.values(inspection.kingdom.relations).filter((value) => value === 2).length}
        </span>
      </div>
      <div className="inspector-list kingdom-observation-list">
        {inspection.neighbours.map((neighbour) => (
          <span key={neighbour.id}>
            <b>{neighbour.name}</b>
            <em className={neighbour.relation === DiplomacyState.War ? 'danger' : ''}>
              {neighbour.diagonalOnly ? '斜向相邻' : `接壤 ${neighbour.sharedEdges} 格`} ·{' '}
              {DIPLOMACY_LABELS[neighbour.relation]}
            </em>
          </span>
        ))}
        {inspection.neighbours.length === 0 && (
          <span>
            <b>邻接</b>
            <em>尚无邻国</em>
          </span>
        )}
        {inspection.villages.slice(0, 6).map((village) => (
          <span key={village.id}>
            <b>{village.isCapital ? `♛ ${village.name}` : village.name}</b>
            <em>
              {TIER_LABELS[village.tier]} · {village.population} 人
            </em>
          </span>
        ))}
      </div>
      <div className="resident-history kingdom-chronicle" data-testid="kingdom-chronicle">
        <strong>王国纪事</strong>
        {inspection.history.length > 0 ? (
          inspection.history.slice(0, 8).map((event) => (
            <span key={event.id}>
              <i />
              <b>{event.message}</b>
              <small>第 {Math.floor(event.tick / 20)} 日</small>
            </span>
          ))
        ) : (
          <p>这个王国还没有纪事。</p>
        )}
      </div>
      {capital && onFocusCapital && (
        <button type="button" className="follow-action" onClick={() => onFocusCapital(capital.id)}>
          <Crosshair size={14} />
          定位首都
        </button>
      )}
    </aside>
  );
}
