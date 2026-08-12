import { Baby, HeartPulse, Home, MoveRight, Utensils, X } from 'lucide-react';
import type { PopulationDiagnostics } from '@/shared/gameTypes';

const CAUSE_LABELS = {
  age: '寿终',
  hunger: '饥荒',
  disease: '疾病',
  violence: '袭击',
  disaster: '灾害',
} as const;

function percent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.max(0, Math.min(100, (value / total) * 100));
}

export function PopulationPanel({
  diagnostics,
  onClose,
}: {
  diagnostics: PopulationDiagnostics;
  onClose: () => void;
}) {
  const population = diagnostics.children + diagnostics.adults + diagnostics.elders;
  const capacityRatio = percent(population, diagnostics.carryingCapacity);
  const trend = diagnostics.trend > 0 ? '增长' : diagnostics.trend < 0 ? '下降' : '稳定';
  const recentHistory = diagnostics.history.slice(-16);
  const historyPeak = Math.max(1, ...recentHistory.map((point) => point.population));

  return (
    <aside className="population-panel" data-testid="population-panel">
      <div className="population-heading">
        <span>
          <small>人口脉络</small>
          <strong>{trend}</strong>
        </span>
        <button type="button" onClick={onClose} aria-label="收起人口脉络">
          <X size={15} />
        </button>
      </div>

      <div className="population-summary">
        <span>
          <Baby size={15} />
          <b>+{diagnostics.birthsLastYear}</b>
          <small>出生</small>
        </span>
        <span>
          <HeartPulse size={15} />
          <b>-{diagnostics.deathsLastYear}</b>
          <small>死亡</small>
        </span>
        <span>
          <MoveRight size={15} />
          <b>{diagnostics.migrationsLastYear}</b>
          <small>迁徙</small>
        </span>
      </div>

      <div className="capacity-meter">
        <span>
          <b>承载力</b>
          <em>
            {population} / {diagnostics.carryingCapacity}
          </em>
        </span>
        <i>
          <i style={{ width: `${capacityRatio}%` }} />
        </i>
      </div>

      <div className="age-structure" role="img" aria-label="年龄结构">
        <i
          className="children"
          style={{ width: `${percent(diagnostics.children, population)}%` }}
        />
        <i className="adults" style={{ width: `${percent(diagnostics.adults, population)}%` }} />
        <i className="elders" style={{ width: `${percent(diagnostics.elders, population)}%` }} />
      </div>
      <div className="age-legend">
        <span>儿童 {diagnostics.children}</span>
        <span>成年 {diagnostics.adults}</span>
        <span>长者 {diagnostics.elders}</span>
      </div>

      <div className="population-ledger">
        <span>
          <Home size={13} />
          <b>住房</b>
          <em>{diagnostics.housingCapacity}</em>
        </span>
        <span>
          <Utensils size={13} />
          <b>储粮</b>
          <em>{Math.floor(diagnostics.storedFood)}</em>
        </span>
      </div>

      {recentHistory.length > 1 && (
        <div className="population-history" role="img" aria-label="近年人口">
          {recentHistory.map((point) => (
            <i
              key={point.year}
              title={`第 ${point.year} 年 · ${point.population} 人`}
              style={{ height: `${Math.max(10, (point.population / historyPeak) * 100)}%` }}
            />
          ))}
        </div>
      )}

      <div className="death-causes">
        {Object.entries(CAUSE_LABELS).map(([cause, label]) => (
          <span key={cause}>
            <b>{label}</b>
            <em>{diagnostics.deathCauses[cause as keyof typeof CAUSE_LABELS]}</em>
          </span>
        ))}
      </div>
    </aside>
  );
}
