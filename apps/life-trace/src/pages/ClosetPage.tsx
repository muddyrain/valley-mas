import { Camera, Check, Plus, Shirt, Star, Trash2, Users, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  analyzeClothingPhoto,
  type ClosetSummary,
  createClosetItem,
  createOutfit,
  deleteClosetItem,
  generateOutfitSuggestions,
  getClosetItem,
  getOutfit,
  listClosetItems,
  listOutfits,
  type OutfitSuggestion,
  updateClosetItem,
  updateOutfitStatus,
} from '@/api/closet';
import { listHouseholds } from '@/api/household';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { ClosetItemSheet, clothingAnalysisToClosetDraft } from '@/components/ClosetItemSheet';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLifeTraceErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { ClosetItem, HouseholdSummary, NewClosetItemInput, Outfit } from '@/types';

const defaultClosetSummary: ClosetSummary = {
  total: 0,
  active: 0,
  shared: 0,
  categories: {},
};

function isSharedHousehold(household?: HouseholdSummary | null) {
  return household?.kind === 'shared' && household.status === 'active';
}

function getHouseholdQueryId(household?: HouseholdSummary | null) {
  return isSharedHousehold(household) ? household?.id : undefined;
}

function formatItemMeta(item: ClosetItem) {
  return [item.color, item.warmthLevel, item.seasons.join(' / ')].filter(Boolean).join(' · ');
}

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function ClosetPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const { itemId, outfitId } = useParams<{ itemId?: string; outfitId?: string }>();
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [summary, setSummary] = useState(defaultClosetSummary);
  const [loading, setLoading] = useState(false);
  const [outfitsLoading, setOutfitsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [itemImageAnalyzing, setItemImageAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<{
    outfit: Outfit;
    items: ClosetItem[];
    household: HouseholdSummary;
  } | null>(null);
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    item: ClosetItem;
    household: HouseholdSummary;
  } | null>(null);
  const [itemLoading, setItemLoading] = useState(false);

  const selectedHousehold = useMemo(
    () => households.find((item) => item.id === selectedHouseholdId) ?? households[0] ?? null,
    [households, selectedHouseholdId],
  );
  const householdId = getHouseholdQueryId(selectedHousehold);
  const sharedAvailable = isSharedHousehold(selectedHousehold);

  useEffect(() => {
    if (!token) {
      return;
    }
    void (async () => {
      try {
        const response = await listHouseholds(token);
        setHouseholds(response.list);
        const personal = response.list.find((item) => item.kind === 'personal') ?? response.list[0];
        setSelectedHouseholdId((current) => current || personal?.id || '');
      } catch (loadError) {
        setError(getLifeTraceErrorMessage(loadError, '读取家庭空间失败'));
      }
    })();
  }, [token]);

  const loadItems = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await listClosetItems(token, {
        householdId,
        page: 1,
        pageSize: 80,
        status: 'all',
      });
      setItems(response.list);
      setSummary(response.summary ?? defaultClosetSummary);
    } catch (loadError) {
      setError(getLifeTraceErrorMessage(loadError, '读取衣橱失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadOutfits = async () => {
    if (!token) {
      return;
    }
    setOutfitsLoading(true);
    try {
      const response = await listOutfits(token, {
        householdId,
        page: 1,
        pageSize: 20,
        status: 'all',
      });
      setOutfits(response.list);
    } catch {
      setOutfits([]);
    } finally {
      setOutfitsLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
    void loadOutfits();
    setSuggestions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, token]);

  useEffect(() => {
    if (!token || !outfitId) {
      setSelectedOutfit(null);
      return;
    }
    setOutfitLoading(true);
    void getOutfit(token, outfitId)
      .then((detail) => setSelectedOutfit(detail))
      .catch((detailError) => {
        showToast(getLifeTraceErrorMessage(detailError, '读取穿搭失败'), 'error');
        navigate('/closet', { replace: true });
      })
      .finally(() => setOutfitLoading(false));
  }, [navigate, outfitId, showToast, token]);

  useEffect(() => {
    if (!token || !itemId) {
      setSelectedItem(null);
      return;
    }
    setItemLoading(true);
    void getClosetItem(token, itemId)
      .then((detail) => setSelectedItem(detail))
      .catch((detailError) => {
        showToast(getLifeTraceErrorMessage(detailError, '读取衣物失败'), 'error');
        navigate('/closet', { replace: true });
      })
      .finally(() => setItemLoading(false));
  }, [itemId, navigate, showToast, token]);

  const handleSaveItem = async (input: NewClosetItemInput) => {
    if (!token) {
      return;
    }
    setSubmitting(true);
    try {
      const saved = editingItem
        ? await updateClosetItem(token, editingItem.id, input, householdId)
        : await createClosetItem(token, input, householdId);
      setItems((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      setSheetOpen(false);
      setEditingItem(null);
      showToast(editingItem ? '衣物已更新' : '衣物已保存', 'success');
      if (selectedItem?.item.id === saved.id && selectedItem.household) {
        setSelectedItem({ ...selectedItem, item: saved });
      }
      void loadItems();
    } catch (saveError) {
      showToast(getLifeTraceErrorMessage(saveError, '保存衣物失败'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeItemImage = async (imageUrl: string) => {
    if (!token || itemImageAnalyzing) {
      return null;
    }
    setItemImageAnalyzing(true);
    try {
      const analysis = await analyzeClothingPhoto(token, {
        imageUrl,
        householdId,
      });
      showToast('已生成衣物草稿', 'success');
      return clothingAnalysisToClosetDraft(analysis, imageUrl, sharedAvailable);
    } catch (analysisError) {
      showToast(getLifeTraceErrorMessage(analysisError, '识别衣物失败'), 'error');
      return null;
    } finally {
      setItemImageAnalyzing(false);
    }
  };

  const handleDeleteItem = async (item: ClosetItem) => {
    if (!token || !window.confirm(`删除「${item.name}」？`)) {
      return;
    }
    try {
      await deleteClosetItem(token, item.id);
      setItems((current) => current.filter((next) => next.id !== item.id));
      showToast('衣物已删除', 'success');
      if (selectedItem?.item.id === item.id) {
        navigate('/closet', { replace: true });
      }
      void loadItems();
    } catch (deleteError) {
      showToast(getLifeTraceErrorMessage(deleteError, '删除衣物失败'), 'error');
    }
  };

  const handleSuggest = async () => {
    if (!token || suggesting) {
      return;
    }
    setSuggesting(true);
    setError('');
    try {
      const response = await generateOutfitSuggestions(token, {
        householdId,
        scene: '日常',
        weatherText: '今日天气',
      });
      setSuggestions(response.suggestions);
      if (response.suggestions.length === 0) {
        showToast('衣橱里还没有足够衣物', 'info');
      }
    } catch (suggestError) {
      setError(getLifeTraceErrorMessage(suggestError, '生成穿搭失败'));
    } finally {
      setSuggesting(false);
    }
  };

  const handleSaveSuggestion = async (suggestion: OutfitSuggestion) => {
    if (!token) {
      return;
    }
    try {
      const saved = await createOutfit(
        token,
        {
          title: suggestion.title,
          itemIds: suggestion.itemIds,
          scene: suggestion.scene || '日常',
          weatherText: suggestion.weatherText || '',
          minTemp: 0,
          maxTemp: 0,
          wornDate: '',
          rating: 0,
          note: suggestion.summary,
          imageUrl: suggestion.items[0]?.imageUrl || '',
          shared: sharedAvailable,
          status: 'saved',
        },
        householdId,
      );
      setOutfits((current) => [saved, ...current]);
      showToast('穿搭已保存', 'success');
    } catch (saveError) {
      showToast(getLifeTraceErrorMessage(saveError, '保存穿搭失败'), 'error');
    }
  };

  const handleWearOutfit = async (target: Outfit) => {
    if (!token) {
      return;
    }
    try {
      const updated = await updateOutfitStatus(token, target.id, {
        status: 'worn',
        wornDate: todayDateKey(),
        rating: target.rating || 4,
        note: target.note,
      });
      setOutfits((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast('穿搭已记录', 'success');
      if (selectedOutfit?.outfit.id === updated.id) {
        setSelectedOutfit({ ...selectedOutfit, outfit: updated });
      }
    } catch (wearError) {
      showToast(getLifeTraceErrorMessage(wearError, '记录穿搭失败'), 'error');
    }
  };

  if (itemId) {
    return (
      <SubPageShell title="衣物详情" eyebrow="衣橱" fallbackBackTo="/closet">
        {itemLoading || !selectedItem ? (
          <Card className="p-5 text-sm text-muted-foreground">正在读取衣物</Card>
        ) : (
          <div className="space-y-5">
            <Card className="overflow-hidden p-0">
              {selectedItem.item.imageUrl ? (
                <img
                  src={selectedItem.item.imageUrl}
                  alt={selectedItem.item.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center bg-secondary text-life-ai">
                  <Shirt className="size-12" />
                </div>
              )}
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge tone={selectedItem.item.shared ? 'ai' : 'trace'}>
                      {selectedItem.item.shared ? '共享衣物' : '个人衣物'}
                    </Badge>
                    <h2 className="mt-3 text-2xl font-semibold tracking-normal">
                      {selectedItem.item.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedItem.household.name} · {formatItemMeta(selectedItem.item)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingItem(selectedItem.item);
                      setSheetOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoPill label="品类" value={selectedItem.item.category} />
                  <InfoPill label="厚薄" value={selectedItem.item.warmthLevel} />
                  <InfoPill label="季节" value={selectedItem.item.seasons.join(' / ')} />
                  <InfoPill label="场景" value={selectedItem.item.sceneTags.join(' / ')} />
                </div>
                {selectedItem.item.material || selectedItem.item.note ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {[selectedItem.item.material, selectedItem.item.note]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-life-alert"
                  onClick={() => void handleDeleteItem(selectedItem.item)}
                >
                  <Trash2 className="size-4" />
                  删除衣物
                </Button>
              </div>
            </Card>

            <ClosetItemSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              item={editingItem}
              sharedAvailable={selectedItem.household.kind === 'shared'}
              submitting={submitting}
              onSubmit={handleSaveItem}
            />
          </div>
        )}
      </SubPageShell>
    );
  }

  if (outfitId) {
    return (
      <SubPageShell title="穿搭详情" eyebrow="衣橱" fallbackBackTo="/closet">
        {outfitLoading || !selectedOutfit ? (
          <Card className="p-5 text-sm text-muted-foreground">正在读取穿搭</Card>
        ) : (
          <div className="space-y-5">
            <Card className="overflow-hidden p-0">
              {selectedOutfit.outfit.imageUrl ? (
                <img
                  src={selectedOutfit.outfit.imageUrl}
                  alt={selectedOutfit.outfit.title}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : null}
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={selectedOutfit.outfit.status === 'worn' ? 'trace' : 'ai'}>
                      {selectedOutfit.outfit.status === 'worn' ? '已穿' : '已保存'}
                    </Badge>
                    <h2 className="mt-3 text-2xl font-semibold tracking-normal">
                      {selectedOutfit.outfit.title}
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ai"
                    size="sm"
                    onClick={() => void handleWearOutfit(selectedOutfit.outfit)}
                  >
                    <Check className="size-4" />
                    记录
                  </Button>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {selectedOutfit.outfit.note || selectedOutfit.outfit.scene}
                </p>
              </div>
            </Card>
            <section>
              <SectionHeader title="衣物" meta={`${selectedOutfit.items.length} 件`} />
              <div className="space-y-3">
                {selectedOutfit.items.map((item) => (
                  <ClosetItemCard key={item.id} item={item} compact />
                ))}
              </div>
            </section>
          </div>
        )}
      </SubPageShell>
    );
  }

  return (
    <SubPageShell
      title="衣橱"
      eyebrow={selectedHousehold?.name || '个人衣橱'}
      fallbackBackTo="/profile"
      action={
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl bg-life-ai text-background"
          aria-label="添加衣物"
          onClick={() => {
            setEditingItem(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-5" />
        </button>
      }
    >
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-life-ai">今日穿搭</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">从衣橱搭一套</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {items.length > 0 ? `${items.length} 件衣物可选` : '先添加几件常穿衣物'}
              </p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Shirt className="size-6" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SummaryPill label="衣物" value={summary.total} />
            <SummaryPill label="活跃" value={summary.active} />
            <SummaryPill label="共享" value={summary.shared} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ai" onClick={() => void handleSuggest()}>
              {suggesting ? <ActionLoadingIcon tone="ai" /> : <WandSparkles className="size-4" />}
              {suggesting ? '搭配中' : '帮我搭'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/ai/photo-clothing-analysis')}
            >
              <Camera className="size-4" />
              拍照识别
            </Button>
          </div>
        </Card>

        {households.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {households.map((household) => {
              const active = household.id === selectedHousehold?.id;
              return (
                <button
                  key={household.id}
                  type="button"
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition',
                    active
                      ? 'border-life-ai/40 bg-life-ai/10 text-life-ai'
                      : 'border-border bg-secondary text-muted-foreground',
                  )}
                  onClick={() => setSelectedHouseholdId(household.id)}
                >
                  {household.kind === 'shared' ? <Users className="size-4" /> : null}
                  {household.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? <p className="text-sm text-life-alert">{error}</p> : null}

        {suggestions.length > 0 ? (
          <section>
            <SectionHeader title="建议穿搭" meta={`${suggestions.length} 套`} />
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <Card key={`${suggestion.title}-${suggestion.itemIds.join('-')}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={suggestion.source === 'ai' ? 'ai' : 'trace'}>
                          {suggestion.source === 'ai' ? 'AI' : '规则'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {suggestion.items.length} 件
                        </span>
                      </div>
                      <h3 className="mt-3 font-semibold">{suggestion.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {suggestion.summary}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSaveSuggestion(suggestion)}
                    >
                      <Star className="size-4" />
                      保存
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeader title="衣物" meta={loading ? '同步中' : `${items.length} 件`} />
          {loading ? (
            <Card className="p-5 text-sm text-muted-foreground">正在读取衣橱</Card>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Shirt}
              tone="ai"
              eyebrow="衣橱"
              title="还没有衣物"
              description="添加几件常穿单品后，就能生成今日穿搭。"
              action={
                <Button type="button" variant="ai" onClick={() => setSheetOpen(true)}>
                  <Plus className="size-4" />
                  添加衣物
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <ClosetItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditingItem(item);
                    setSheetOpen(true);
                  }}
                  onOpen={() => navigate(`/closet/items/${item.id}`)}
                  onDelete={() => void handleDeleteItem(item)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="穿搭" meta={outfitsLoading ? '同步中' : `${outfits.length} 套`} />
          {outfits.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">保存穿搭后会出现在这里。</Card>
          ) : (
            <div className="space-y-3">
              {outfits.slice(0, 5).map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-border bg-card p-4 text-left transition hover:bg-secondary/60"
                  onClick={() => navigate(`/closet/outfits/${outfit.id}`)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{outfit.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {outfit.scene} ·{' '}
                      {outfit.status === 'worn' ? outfit.wornDate || '已穿' : '已保存'}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleWearOutfit(outfit);
                    }}
                  >
                    <Check className="size-4" />
                    记录
                  </Button>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <ClosetItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        item={editingItem}
        sharedAvailable={sharedAvailable}
        submitting={submitting}
        analyzing={itemImageAnalyzing}
        onAnalyzeImage={handleAnalyzeItemImage}
        onSubmit={handleSaveItem}
      />
    </SubPageShell>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold">{value || '未标注'}</p>
    </div>
  );
}

function ClosetItemCard({
  item,
  compact = false,
  onOpen,
  onEdit,
  onDelete,
}: {
  item: ClosetItem;
  compact?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className={cn('overflow-hidden p-0', compact && 'flex items-center gap-3 p-3')}>
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className={cn(
            compact ? 'size-16 rounded-2xl object-cover' : 'aspect-square w-full object-cover',
          )}
        />
      ) : (
        <div
          className={cn(
            'grid place-items-center bg-secondary text-life-ai',
            compact ? 'size-16 rounded-2xl' : 'aspect-square w-full',
          )}
        >
          <Shirt className="size-7" />
        </div>
      )}
      <div className={cn('min-w-0 p-3', compact && 'flex-1 p-0')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {formatItemMeta(item)}
            </p>
          </div>
          {item.shared ? <Badge tone="ai">共享</Badge> : null}
        </div>
        {onEdit || onDelete ? (
          <div className="mt-3 flex gap-2">
            {onOpen ? (
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onOpen}>
                详情
              </Button>
            ) : null}
            {onEdit ? (
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onEdit}>
                编辑
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDelete}
                aria-label="删除衣物"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
