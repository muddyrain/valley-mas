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
import { useEffect, useState } from 'react';
import type { Inspection } from '@/render/renderTypes';
import { DiplomacyState, ResidentRole, ResidentSex } from '@/shared/gameTypes';
import {
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
}: {
  inspection: Inspection;
  onClose: () => void;
  onFollow?: (id: number) => void;
}) {
  const [entityTab, setEntityTab] = useState<'overview' | 'growth' | 'equipment' | 'history'>(
    'overview',
  );
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    setEntityTab('overview');
    if (inspection.type !== 'entity') return;
    setFavorite(localStorage.getItem(`eon-vale.favorite.${inspection.id}`) === '1');
  }, [inspection]);

  if (inspection.type === 'entity') {
    const weaponName = ['无', '基础', '精良', '大师'][inspection.weaponTier] || '传奇';
    const armorName = ['布衣', '皮甲', '锁甲', '板甲'][inspection.armorTier] || '王家甲胄';
    const toggleFavorite = () => {
      const next = !favorite;
      setFavorite(next);
      if (next) localStorage.setItem(`eon-vale.favorite.${inspection.id}`, '1');
      else localStorage.removeItem(`eon-vale.favorite.${inspection.id}`);
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
              className={favorite ? 'favorite active' : 'favorite'}
              onClick={toggleFavorite}
              aria-label={favorite ? '取消收藏' : '收藏居民'}
            >
              <Star size={15} fill={favorite ? 'currentColor' : 'none'} />
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
        </div>
      </aside>
    );
  }

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
      <div className="inspector-list diplomacy-list">
        {Object.entries(inspection.kingdom.relations).map(([id, relation]) => (
          <span key={id}>
            <b>王国 {id}</b>
            <em className={relation === DiplomacyState.War ? 'danger' : ''}>
              {DIPLOMACY_LABELS[relation]}
            </em>
          </span>
        ))}
      </div>
    </aside>
  );
}
