import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, SheetActions, SheetHeader, SheetSelectField } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ledgerCategories } from '@/lib/ledger';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { LedgerCategory, NewLedgerEntryInput } from '@/types';

const LAST_CATEGORY_STORAGE_KEY = 'life-trace.quick-ledger.last-category';
const DEFAULT_CATEGORY: LedgerCategory = '吃饭';

const ledgerCategoryOptions = ledgerCategories.map((category) => ({
  label: category,
  value: category,
}));

function readLastCategory(): LedgerCategory {
  if (typeof window === 'undefined') {
    return DEFAULT_CATEGORY;
  }
  try {
    const raw = window.localStorage.getItem(LAST_CATEGORY_STORAGE_KEY);
    if (raw && (ledgerCategories as readonly string[]).includes(raw)) {
      return raw as LedgerCategory;
    }
  } catch {
    // ignore storage errors and fall back to default
  }
  return DEFAULT_CATEGORY;
}

function writeLastCategory(category: LedgerCategory) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, category);
  } catch {
    // ignore storage errors
  }
}

type QuickLedgerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickLedgerSheet({ open, onOpenChange }: QuickLedgerSheetProps) {
  const addLedgerEntry = useLifeTraceStore((state) => state.addLedgerEntry);
  const ledgerCreating = useLifeTraceStore((state) => state.ledgerCreating);
  const showToast = useFeedbackToastStore((state) => state.showToast);

  const initialCategory = useMemo(() => readLastCategory(), []);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<LedgerCategory>(initialCategory);
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setAmount('');
    setNote('');
    setAmountError('');
    setCategory(readLastCategory());
  }, [open]);

  const handleClose = () => {
    if (ledgerCreating) {
      return;
    }
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setAmountError('请输入大于 0 的金额');
      return;
    }
    setAmountError('');

    const input: NewLedgerEntryInput = {
      amount: value,
      currency: 'CNY',
      direction: '支出',
      category,
      occurredAt: new Date().toISOString(),
      note: note.trim(),
    };

    const saved = await addLedgerEntry(input);
    if (saved) {
      writeLastCategory(category);
      showToast(`已记下 ${category} ${value.toFixed(2)} 元`, 'success');
      onOpenChange(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
          return;
        }
        onOpenChange(true);
      }}
      overlayLabel="关闭快速记账"
      closeDisabled={ledgerCreating}
      spacing="compact"
    >
      <SheetHeader
        title="记一笔"
        description="只记金额、分类和备注，更多字段去轻账本"
        onClose={handleClose}
        closeDisabled={ledgerCreating}
        className="mb-4"
      />
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <FormItem
          label="金额"
          required
          htmlFor="quick-ledger-amount"
          error={amountError || undefined}
          density="compact"
        >
          <Input
            id="quick-ledger-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              if (amountError) {
                setAmountError('');
              }
            }}
            autoFocus
            aria-invalid={Boolean(amountError)}
          />
        </FormItem>

        <SheetSelectField
          label="分类"
          density="compact"
          value={category}
          options={ledgerCategoryOptions}
          pickerTitle="选择分类"
          onValueChange={(next) => setCategory(next as LedgerCategory)}
        />

        <FormItem label="备注" htmlFor="quick-ledger-note" density="compact">
          <Textarea
            id="quick-ledger-note"
            rows={2}
            placeholder="想说点什么都行，可留空"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormItem>

        <SheetActions className="pt-1.5">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={ledgerCreating}>
            取消
          </Button>
          <Button type="submit" variant="ai" disabled={ledgerCreating}>
            {ledgerCreating ? <ActionLoadingIcon /> : null}
            记一笔
          </Button>
        </SheetActions>
      </form>
    </BottomSheet>
  );
}
