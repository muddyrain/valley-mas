import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  Pencil,
  Plus,
  ShoppingBasket,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { FormItem, SheetActions, SheetHeader, SheetSelectField } from '@/components/FormItem';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ledgerCategories } from '@/lib/ledger';
import { getLocalISODate } from '@/lib/planSchedule';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type {
  LedgerCategory,
  NewLedgerEntryInput,
  NewShoppingListItemInput,
  ShoppingListItem,
  ShoppingListSource,
} from '@/types';

type ShoppingFormErrors = Partial<Record<'name' | 'quantity', string>>;

const categoryOptions: Array<{ value: string; label: string }> = [
  { value: '食品', label: '食品' },
  { value: '日用品', label: '日用品' },
  { value: '药品', label: '药品' },
  { value: '宠物', label: '宠物' },
  { value: '其他', label: '其他' },
];

const defaultForm: NewShoppingListItemInput = {
  name: '',
  quantity: 1,
  unit: '件',
  category: '食品',
  source: 'manual',
  note: '',
};

const sourceLabel: Record<ShoppingListSource, string> = {
  manual: '手动',
  pantry_used_up: '用完',
  pantry_low: '剩量低',
  pantry_discard: '丢弃',
  recipe: '菜谱',
};

const LAST_LEDGER_CATEGORY_KEY = 'life-trace.shopping-list.last-ledger-category';
const DEFAULT_LEDGER_CATEGORY: LedgerCategory = '家用';

const ledgerCategoryOptions = ledgerCategories.map((category) => ({
  label: category,
  value: category,
}));

const shoppingCategoryToLedger: Record<string, LedgerCategory> = {
  食品: '吃饭',
  日用品: '家用',
  药品: '医疗',
  宠物: '家用',
};

function readLastLedgerCategory(): LedgerCategory {
  if (typeof window === 'undefined') return DEFAULT_LEDGER_CATEGORY;
  try {
    const raw = window.localStorage.getItem(LAST_LEDGER_CATEGORY_KEY);
    if (raw && (ledgerCategories as readonly string[]).includes(raw)) {
      return raw as LedgerCategory;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LEDGER_CATEGORY;
}

function writeLastLedgerCategory(category: LedgerCategory) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_LEDGER_CATEGORY_KEY, category);
  } catch {
    // ignore
  }
}

function inferLedgerCategoryFromShopping(category?: string): LedgerCategory {
  if (!category) return readLastLedgerCategory();
  return shoppingCategoryToLedger[category] ?? readLastLedgerCategory();
}

const LEDGER_PROMPT_ENABLED_KEY = 'life-trace.shopping-list.ledger-prompt-enabled';

function readLedgerPromptEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(LEDGER_PROMPT_ENABLED_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

function writeLedgerPromptEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LEDGER_PROMPT_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

function formatCheckedDateLabel(iso: string, todayIso: string, yesterdayIso: string) {
  if (iso === todayIso) return '今天';
  if (iso === yesterdayIso) return '昨天';
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(parsed);
}

function itemToInput(item: ShoppingListItem): NewShoppingListItemInput {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    source: item.source,
    sourcePantryItemId: item.sourcePantryItemId,
    note: item.note ?? '',
  };
}

function normalizeFormInput(form: NewShoppingListItemInput): NewShoppingListItemInput {
  return {
    ...form,
    name: form.name.trim(),
    quantity:
      form.quantity === undefined || form.quantity === null
        ? 1
        : Math.max(1, Math.floor(Number(form.quantity))),
    unit: form.unit?.trim() || '件',
    category: form.category?.trim() || '食品',
    note: form.note?.trim() || '',
  };
}

export function ShoppingListPage() {
  const items = useLifeTraceStore((state) => state.shoppingListItems);
  const loaded = useLifeTraceStore((state) => state.shoppingListLoaded);
  const loading = useLifeTraceStore((state) => state.shoppingListLoading);
  const error = useLifeTraceStore((state) => state.shoppingListError);
  const householdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const householdName = useLifeTraceStore((state) => state.preferredPantryHouseholdName);
  const loadShoppingList = useLifeTraceStore((state) => state.loadShoppingList);
  const addShoppingItem = useLifeTraceStore((state) => state.addShoppingItem);
  const editShoppingItem = useLifeTraceStore((state) => state.editShoppingItem);
  const toggleShoppingItem = useLifeTraceStore((state) => state.toggleShoppingItem);
  const removeShoppingItem = useLifeTraceStore((state) => state.removeShoppingItem);
  const addLedgerEntry = useLifeTraceStore((state) => state.addLedgerEntry);
  const ledgerCreating = useLifeTraceStore((state) => state.ledgerCreating);
  const showToast = useFeedbackToastStore((state) => state.showToast);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewShoppingListItemInput>(defaultForm);
  const [formErrors, setFormErrors] = useState<ShoppingFormErrors>({});
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShoppingListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ledgerTarget, setLedgerTarget] = useState<ShoppingListItem | null>(null);
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerCategoryValue, setLedgerCategoryValue] =
    useState<LedgerCategory>(DEFAULT_LEDGER_CATEGORY);
  const [ledgerNote, setLedgerNote] = useState('');
  const [ledgerAmountError, setLedgerAmountError] = useState('');
  const [ledgerPromptEnabled, setLedgerPromptEnabled] = useState<boolean>(() =>
    readLedgerPromptEnabled(),
  );

  const todayIso = useMemo(() => getLocalISODate(new Date()), []);
  const yesterdayIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalISODate(d);
  }, []);

  useEffect(() => {
    void loadShoppingList();
  }, [householdId, loadShoppingList]);

  const { openItems, checkedGroups } = useMemo(() => {
    const open: ShoppingListItem[] = [];
    const groupMap = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      if (item.checkedAt) {
        const key = getLocalISODate(new Date(item.checkedAt));
        const list = groupMap.get(key);
        if (list) {
          list.push(item);
        } else {
          groupMap.set(key, [item]);
        }
      } else {
        open.push(item);
      }
    }
    const groups = Array.from(groupMap.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([key, list]) => ({
        key,
        label: formatCheckedDateLabel(key, todayIso, yesterdayIso),
        items: list.sort((a, b) => {
          const aTime = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
          const bTime = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
          return bTime - aTime;
        }),
      }));
    return { openItems: open, checkedGroups: groups };
  }, [items, todayIso, yesterdayIso]);

  const checkedTotal = useMemo(
    () => checkedGroups.reduce((sum, group) => sum + group.items.length, 0),
    [checkedGroups],
  );

  const toggleLedgerPrompt = (next: boolean) => {
    setLedgerPromptEnabled(next);
    writeLedgerPromptEnabled(next);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (item: ShoppingListItem) => {
    setEditingItem(item);
    setForm(itemToInput(item));
    setFormErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingItem(null);
    setFormErrors({});
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ShoppingFormErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = '请填写名称';
    }
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = '数量需大于 0';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const input = normalizeFormInput(form);
      const saved = editingItem
        ? await editShoppingItem(editingItem.id, input)
        : await addShoppingItem(input);
      if (saved) {
        showToast(editingItem ? '已更新采购清单' : '已加入采购清单', 'success');
        closeForm();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (item: ShoppingListItem) => {
    const actionKey = `${item.id}:toggle`;
    if (pendingActionId) {
      return;
    }
    const willCheck = !item.checkedAt;
    setPendingActionId(actionKey);
    try {
      const next = await toggleShoppingItem(item.id, willCheck);
      if (next) {
        showToast(next.checkedAt ? '已标记为已买' : '已恢复为待买', 'success');
        if (next.checkedAt && willCheck && ledgerPromptEnabled) {
          openLedgerSheet(next);
        }
      }
    } finally {
      setPendingActionId((current) => (current === actionKey ? null : current));
    }
  };

  const openLedgerSheet = (item: ShoppingListItem) => {
    setLedgerTarget(item);
    setLedgerAmount('');
    setLedgerNote(item.name + (item.note ? ` · ${item.note}` : ''));
    setLedgerCategoryValue(inferLedgerCategoryFromShopping(item.category));
    setLedgerAmountError('');
  };

  const closeLedgerSheet = () => {
    if (ledgerCreating) return;
    setLedgerTarget(null);
    setLedgerAmount('');
    setLedgerNote('');
    setLedgerAmountError('');
  };

  const submitLedger = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ledgerTarget) return;
    const value = Number(ledgerAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setLedgerAmountError('请输入大于 0 的金额');
      return;
    }
    setLedgerAmountError('');
    const input: NewLedgerEntryInput = {
      amount: value,
      currency: 'CNY',
      direction: '支出',
      category: ledgerCategoryValue,
      occurredAt: new Date().toISOString(),
      merchant: ledgerTarget.name,
      note: ledgerNote.trim(),
    };
    const saved = await addLedgerEntry(input);
    if (saved) {
      writeLastLedgerCategory(ledgerCategoryValue);
      showToast(`已记下 ${ledgerCategoryValue} ${value.toFixed(2)} 元`, 'success');
      setLedgerTarget(null);
      setLedgerAmount('');
      setLedgerNote('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) {
      return;
    }
    setDeleting(true);
    try {
      const ok = await removeShoppingItem(confirmDelete.id);
      if (ok) {
        showToast('已移除', 'success');
        setConfirmDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = (item: ShoppingListItem) => {
    const toggling = pendingActionId === `${item.id}:toggle`;
    const isChecked = Boolean(item.checkedAt);
    return (
      <Card key={item.id} className="p-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={isChecked ? '恢复为待买' : '标记为已买'}
            disabled={toggling}
            onClick={() => void handleToggle(item)}
            className={cn(
              'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border transition',
              isChecked
                ? 'border-life-health/30 bg-life-health/10 text-life-health'
                : 'border-border text-muted-foreground hover:border-life-health/40 hover:text-life-health',
            )}
          >
            {toggling ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : isChecked ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Circle className="size-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone={isChecked ? 'default' : 'health'}>{item.category}</Badge>
              {item.source !== 'manual' ? (
                <Badge tone="trace">{sourceLabel[item.source] || '触发'}</Badge>
              ) : null}
            </div>
            <p
              className={cn(
                'text-base font-semibold',
                isChecked ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {item.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.quantity}
              {item.unit}
            </p>
            {item.note ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {item.note}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(item)}>
              <Pencil className="size-4" />
              编辑
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(item)}>
              <Trash2 className="size-4" />
              删除
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <SubPageShell
      title="采购清单"
      eyebrow="Shopping"
      fallbackBackTo="/profile"
      action={
        <Button type="button" variant="ai" size="icon" aria-label="新增采购项" onClick={openCreate}>
          <Plus className="size-4" />
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-24 sm:px-6">
        {householdName ? (
          <p className="text-xs text-muted-foreground">当前空间：{householdName}</p>
        ) : null}

        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/85 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">勾选已买时弹出记一笔</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              关闭后勾选只会记录"已买"，不再弹账本
            </span>
          </span>
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-life-health"
            checked={ledgerPromptEnabled}
            onChange={(event) => toggleLedgerPrompt(event.target.checked)}
          />
        </label>

        {error ? (
          <Card className="border-life-alert/30 bg-life-alert/10 p-4 text-sm text-life-alert">
            {error}
          </Card>
        ) : null}

        {loading && !loaded ? (
          <Card className="grid min-h-44 place-items-center p-6 text-sm text-muted-foreground">
            <LoaderCircle className="mb-3 size-6 animate-spin text-life-health motion-reduce:animate-none" />
            正在同步采购清单
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title="清单空空如也"
            description="把要买的东西先记下来，去超市或下单时一眼看清。"
            eyebrow="采购清单"
            icon={ShoppingBasket}
            tone="health"
            action={
              <Button type="button" variant="ai" onClick={openCreate}>
                <Plus className="size-4" />
                添加一项
              </Button>
            }
          />
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">待买</h2>
                <span className="text-xs text-muted-foreground">{openItems.length} 项</span>
              </div>
              {openItems.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">暂无待买项。</Card>
              ) : (
                <div className="grid gap-3">{openItems.map(renderItem)}</div>
              )}
            </section>

            {checkedGroups.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">已买</h2>
                  <span className="text-xs text-muted-foreground">{checkedTotal} 项</span>
                </div>
                <div className="space-y-4">
                  {checkedGroups.map((group) => (
                    <div key={group.key} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {group.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.items.length} 项
                        </span>
                      </div>
                      <div className="grid gap-3">{group.items.map(renderItem)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          }
        }}
        overlayLabel="关闭采购项编辑"
        zIndexClassName="z-[70]"
        spacing="compact"
      >
        <SheetHeader
          title={editingItem ? '编辑采购项' : '加入采购清单'}
          onClose={closeForm}
          className="mb-4"
        />
        <form className="space-y-3.5" onSubmit={submitForm}>
          <FormItem label="名称" error={formErrors.name} density="compact">
            <Input
              value={form.name}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, name: value }));
                setFormErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="例如：酱油 / 卷纸"
              aria-invalid={Boolean(formErrors.name)}
            />
          </FormItem>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="数量" error={formErrors.quantity} density="compact">
              <Input
                type="number"
                min="1"
                step="1"
                value={form.quantity ?? 1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setForm((current) => ({ ...current, quantity: value }));
                  setFormErrors((current) => ({ ...current, quantity: undefined }));
                }}
                aria-invalid={Boolean(formErrors.quantity)}
              />
            </FormItem>
            <FormItem label="单位" density="compact">
              <Input
                value={form.unit ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit: event.target.value }))
                }
                placeholder="件 / 瓶 / 包"
              />
            </FormItem>
          </div>

          <SheetSelectField
            label="分类"
            density="compact"
            value={form.category ?? '食品'}
            options={categoryOptions}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                category: value,
              }))
            }
          />

          <FormItem label="备注" density="compact">
            <Textarea
              value={form.note ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="例如：买无糖的"
            />
          </FormItem>

          <SheetActions className="pt-1.5">
            <Button type="button" variant="secondary" onClick={closeForm}>
              取消
            </Button>
            <Button type="submit" variant="ai" disabled={submitting}>
              {submitting ? <ActionLoadingIcon /> : null}
              保存
            </Button>
          </SheetActions>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="移除该采购项？"
        description={confirmDelete ? `将从清单移除「${confirmDelete.name}」。` : ''}
        confirmLabel="确认移除"
        loadingLabel="移除中"
        loading={deleting}
        onCancel={() => {
          if (!deleting) {
            setConfirmDelete(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <BottomSheet
        open={Boolean(ledgerTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeLedgerSheet();
          }
        }}
        overlayLabel="关闭顺手记账"
        zIndexClassName="z-[80]"
        closeDisabled={ledgerCreating}
        spacing="compact"
      >
        <SheetHeader
          title="顺手记一笔"
          description={ledgerTarget ? `为「${ledgerTarget.name}」记下支出，可跳过` : '可跳过'}
          onClose={closeLedgerSheet}
          closeDisabled={ledgerCreating}
          className="mb-4"
        />
        <form className="space-y-3.5" onSubmit={submitLedger}>
          <FormItem
            label="金额"
            required
            htmlFor="shopping-ledger-amount"
            error={ledgerAmountError || undefined}
            density="compact"
          >
            <Input
              id="shopping-ledger-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={ledgerAmount}
              onChange={(event) => {
                setLedgerAmount(event.target.value);
                if (ledgerAmountError) {
                  setLedgerAmountError('');
                }
              }}
              autoFocus
              aria-invalid={Boolean(ledgerAmountError)}
            />
          </FormItem>

          <SheetSelectField
            label="分类"
            density="compact"
            value={ledgerCategoryValue}
            options={ledgerCategoryOptions}
            pickerTitle="选择分类"
            onValueChange={(next) => setLedgerCategoryValue(next as LedgerCategory)}
          />

          <FormItem label="备注" htmlFor="shopping-ledger-note" density="compact">
            <Textarea
              id="shopping-ledger-note"
              rows={2}
              placeholder="可留空"
              value={ledgerNote}
              onChange={(event) => setLedgerNote(event.target.value)}
            />
          </FormItem>

          <SheetActions className="pt-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={closeLedgerSheet}
              disabled={ledgerCreating}
            >
              跳过
            </Button>
            <Button type="submit" variant="ai" disabled={ledgerCreating}>
              {ledgerCreating ? <ActionLoadingIcon /> : null}
              记一笔
            </Button>
          </SheetActions>
        </form>
      </BottomSheet>
    </SubPageShell>
  );
}
