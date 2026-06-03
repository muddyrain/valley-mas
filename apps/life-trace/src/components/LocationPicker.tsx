import { ChevronRight, MapPin, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import {
  buildLocationValue,
  formatLocationDisplay,
  type LifeLocationValue,
  parseLocationValue,
} from '@/lib/location';
import { cn } from '@/lib/utils';

const quickCities = ['杭州', '上海', '北京', '深圳', '广州', '成都', '武汉', '南京'];

type LocationPickerProps = {
  value: string;
  title?: string;
  description?: string;
  onChange: (value: string) => void;
  children: (props: {
    displayValue: string;
    city: string;
    district: string;
    openPicker: () => void;
  }) => ReactNode;
};

export function LocationPicker({
  value,
  title = '更换定位',
  description = '支持填写城市和区县，天气和每日简报会优先按这里的定位生成。',
  onChange,
  children,
}: LocationPickerProps) {
  const parsed = useMemo(() => parseLocationValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LifeLocationValue>(parsed);

  useEffect(() => {
    if (!open) {
      setDraft(parsed);
    }
  }, [open, parsed]);

  const displayValue = formatLocationDisplay(value) || '未设置定位';

  const updateDraft = <K extends keyof LifeLocationValue>(
    key: K,
    nextValue: LifeLocationValue[K],
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: nextValue,
    }));

  const handleSave = () => {
    const nextCity = draft.city.trim();
    if (!nextCity) {
      return;
    }
    onChange(buildLocationValue(nextCity, draft.district));
    setOpen(false);
  };

  return (
    <>
      {children({
        displayValue,
        city: parsed.city,
        district: parsed.district,
        openPicker: () => setOpen(true),
      })}

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        overlayLabel={`关闭${title}`}
        zIndexClassName="z-[72]"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">常用城市</p>
            <div className="flex flex-wrap gap-2">
              {quickCities.map((city) => {
                const active = draft.city === city;
                return (
                  <button
                    key={city}
                    type="button"
                    className={cn(
                      'rounded-full border px-3 py-2 text-sm font-semibold transition',
                      active
                        ? 'border-life-ai/45 bg-life-ai/10 text-life-ai'
                        : 'border-border bg-secondary text-muted-foreground',
                    )}
                    onClick={() => updateDraft('city', city)}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block rounded-[1.35rem] border border-border bg-card/80 p-4">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <MapPin className="size-4 text-life-ai" />
              城市
            </span>
            <input
              value={draft.city}
              onChange={(event) => updateDraft('city', event.target.value)}
              placeholder="例如：杭州"
              className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <label className="block rounded-[1.35rem] border border-border bg-card/80 p-4">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ChevronRight className="size-4 text-life-ai" />
              区县 / 区域
            </span>
            <input
              value={draft.district}
              onChange={(event) => updateDraft('district', event.target.value)}
              placeholder="例如：西湖区、滨江区"
              className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="rounded-[1.35rem] border border-life-ai/20 bg-life-ai/5 px-4 py-3">
            <p className="text-xs font-semibold text-life-ai">当前将保存为</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatLocationDisplay(buildLocationValue(draft.city, draft.district)) ||
                '请先填写城市'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" disabled={!draft.city.trim()} onClick={handleSave}>
            保存定位
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
