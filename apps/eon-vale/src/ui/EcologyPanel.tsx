import { Leaf, PawPrint, X } from 'lucide-react';
import { type EcologyDiagnostics, EntityKind } from '@/shared/gameTypes';

const SPECIES = [
  EntityKind.Chicken,
  EntityKind.Sheep,
  EntityKind.Cow,
  EntityKind.Deer,
  EntityKind.Wolf,
  EntityKind.Bear,
  EntityKind.Fish,
] as const;

const SPECIES_LABELS: Record<(typeof SPECIES)[number], string> = {
  [EntityKind.Chicken]: '鸡',
  [EntityKind.Sheep]: '羊',
  [EntityKind.Cow]: '牛',
  [EntityKind.Deer]: '鹿',
  [EntityKind.Wolf]: '狼',
  [EntityKind.Bear]: '熊',
  [EntityKind.Fish]: '鱼',
};

const STATUS_LABELS = {
  'not-introduced': '未引入',
  stable: '稳定',
  endangered: '濒危',
  extinct: '灭绝',
  'waiting-habitat': '等待栖息地',
  'return-cooldown': '回归冷却',
  returning: '正在恢复',
} as const;

export function EcologyPanel({
  ecology,
  onClose,
}: {
  ecology: EcologyDiagnostics;
  onClose: () => void;
}) {
  return (
    <aside className="ecology-panel" data-testid="ecology-panel">
      <div className="ecology-heading">
        <span>
          <small>生态图鉴</small>
          <strong>{ecology.animals} 只动物</strong>
        </span>
        <button type="button" onClick={onClose} aria-label="收起生态图鉴">
          <X size={15} />
        </button>
      </div>
      <div className="ecology-species">
        {SPECIES.map((kind) => {
          const species = ecology.species[kind];
          if (!species) return null;
          const ratio =
            species.capacity <= 0 ? 0 : Math.min(100, (species.count / species.capacity) * 100);
          return (
            <div key={kind} className={`ecology-species-row ${species.status}`}>
              <i>{kind === EntityKind.Fish ? <Leaf size={13} /> : <PawPrint size={13} />}</i>
              <span>
                <b>{SPECIES_LABELS[kind]}</b>
                <small>{STATUS_LABELS[species.status]}</small>
                <em>
                  <em style={{ width: `${ratio}%` }} />
                </em>
              </span>
              <strong>
                {species.count} / {species.capacity}
              </strong>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
