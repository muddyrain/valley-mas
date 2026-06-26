import { MapPin } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, SheetActions, SheetHeader } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        <SheetHeader
          title={title}
          description={description}
          icon={MapPin}
          onClose={() => setOpen(false)}
        />

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

          <FormItem label="城市">
            <Input
              value={draft.city}
              onChange={(event) => updateDraft('city', event.target.value)}
              placeholder="例如：杭州"
            />
          </FormItem>

          <FormItem label="区县 / 区域">
            <Input
              value={draft.district}
              onChange={(event) => updateDraft('district', event.target.value)}
              placeholder="例如：西湖区、滨江区"
            />
          </FormItem>

          <div className="rounded-[1.25rem] border border-life-ai/20 bg-life-ai/5 px-4 py-3">
            <p className="text-xs font-semibold text-life-ai">当前将保存为</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatLocationDisplay(buildLocationValue(draft.city, draft.district)) ||
                '请先填写城市'}
            </p>
          </div>
        </div>

        <SheetActions className="mt-5">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" disabled={!draft.city.trim()} onClick={handleSave}>
            保存定位
          </Button>
        </SheetActions>
      </BottomSheet>
    </>
  );
}
