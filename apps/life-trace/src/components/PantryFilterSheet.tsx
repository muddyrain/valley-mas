import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { SheetActions, SheetHeader } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import {
  type PantryListFilters,
  pantryCategoryFilters,
  pantryDetailedStatuses,
  pantryHistoryStatuses,
  pantrySortOptions,
} from '@/lib/pantryListFilters';
import { cn } from '@/lib/utils';
import type { PantryListStatusFilter } from '@/types';

const statusLabels: Record<Exclude<PantryListStatusFilter, 'all'>, string> = {
  normal: '正常',
  expiring: '临期',
  expired: '已过期',
  'no-expiry': '未设过期',
  kept: '仍在使用',
  'used-up': '已用完',
  discarded: '已丢弃',
};

type PantryFilterSheetProps = {
  open: boolean;
  value: PantryListFilters;
  onOpenChange: (open: boolean) => void;
  onApply: (value: PantryListFilters) => void;
};

function FilterChoice({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'min-h-10 rounded-2xl border px-3 py-2 text-sm font-semibold transition',
        active
          ? 'border-life-ai/40 bg-life-ai/10 text-life-ai'
          : 'border-border bg-secondary/65 text-muted-foreground hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PantryFilterSheet({ open, value, onOpenChange, onApply }: PantryFilterSheetProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  return (
    <BottomSheet open={open} overlayLabel="关闭库存筛选" onOpenChange={onOpenChange}>
      <div className="space-y-5 pb-2">
        <SheetHeader
          title="筛选库存"
          description="状态、分类与排序"
          icon={SlidersHorizontal}
          iconClassName="bg-life-ai/10 text-life-ai"
          onClose={() => onOpenChange(false)}
        />

        <section className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground">状态</p>
          <div className="grid grid-cols-2 gap-2">
            {pantryDetailedStatuses.map((status) => (
              <FilterChoice
                key={status}
                active={draft.status === status}
                onClick={() => setDraft((current) => ({ ...current, status }))}
              >
                {statusLabels[status]}
              </FilterChoice>
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground">分类</p>
          <div className="grid grid-cols-3 gap-2">
            {pantryCategoryFilters.map((category) => (
              <FilterChoice
                key={category}
                active={draft.category === category}
                onClick={() => setDraft((current) => ({ ...current, category }))}
              >
                {category === 'all' ? '全部' : category}
              </FilterChoice>
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground">排序</p>
          <div className="grid gap-2">
            {pantrySortOptions.map((option) => (
              <FilterChoice
                key={option.id}
                active={draft.sort === option.id}
                onClick={() => setDraft((current) => ({ ...current, sort: option.id }))}
              >
                {option.label}
              </FilterChoice>
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground">历史状态</p>
          <div className="grid grid-cols-2 gap-2">
            {pantryHistoryStatuses.map((status) => (
              <FilterChoice
                key={status}
                active={draft.status === status}
                onClick={() => setDraft((current) => ({ ...current, status }))}
              >
                {statusLabels[status]}
              </FilterChoice>
            ))}
          </div>
        </section>

        <SheetActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft((current) => ({ ...current, status: 'all', category: 'all' }))}
          >
            重置
          </Button>
          <Button type="button" variant="ai" onClick={() => onApply(draft)}>
            应用筛选
          </Button>
        </SheetActions>
      </div>
    </BottomSheet>
  );
}
