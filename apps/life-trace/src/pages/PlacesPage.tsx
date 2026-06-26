import {
  Archive,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  Pencil,
  Plus,
  Star,
  StarOff,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { FormItem, SheetActions, SheetSelectField } from '@/components/FormItem';
import { LoadErrorState } from '@/components/LoadErrorState';
import { SectionHeader } from '@/components/SectionHeader';
import { InlineRefreshStatus, ListCardSkeleton } from '@/components/StableListState';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Place, PlaceRecord, PlaceStatus } from '@/types';

type PlaceFormState = {
  name: string;
  status: PlaceStatus;
  favorite: boolean;
  city: string;
  district: string;
  address: string;
  latitude: string;
  longitude: string;
  note: string;
};

const defaultPlaceForm: PlaceFormState = {
  name: '',
  status: 'visited',
  favorite: false,
  city: '',
  district: '',
  address: '',
  latitude: '',
  longitude: '',
  note: '',
};

const placeStatusOptions: Array<{ label: string; value: PlaceStatus }> = [
  { value: 'visited', label: '去过' },
  { value: 'want', label: '想去' },
];

function placeToForm(place: Place): PlaceFormState {
  return {
    name: place.name,
    status: place.status || 'visited',
    favorite: place.favorite,
    city: place.city || '',
    district: place.district || '',
    address: place.address || '',
    latitude: typeof place.latitude === 'number' ? String(place.latitude) : '',
    longitude: typeof place.longitude === 'number' ? String(place.longitude) : '',
    note: place.note || '',
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getPlaceLocationText(place: Place) {
  return [place.city, place.district, place.address].filter(Boolean).join(' · ');
}

function formatPlaceDate(value?: string) {
  if (!value) {
    return '暂无';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '暂无';
  }
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupPlaces(places: Place[]) {
  const activePlaces = places.filter((place) => !place.archived);
  const wantPlaces = activePlaces.filter((place) => place.status === 'want');
  const visitedPlaces = activePlaces.filter((place) => place.status !== 'want');
  const favorites = activePlaces.filter((place) => place.favorite);
  const frequent = [...visitedPlaces]
    .sort((left, right) => right.visitCount - left.visitCount)
    .slice(0, 8);
  const recent = [...visitedPlaces]
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
    .slice(0, 8);

  return { favorites, frequent, recent, wantPlaces };
}

function PlaceCard({ place }: { place: Place }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="block w-full text-left"
      data-scroll-anchor={`places:${place.id}`}
      onClick={() => navigate(`/places/${place.id}`)}
    >
      <Card className="p-4 transition hover:border-life-trace/35 hover:bg-life-trace/5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-trace/10 text-life-trace">
            {place.favorite ? (
              <Star className="size-5 fill-current" />
            ) : (
              <MapPin className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{place.name}</h3>
              {place.status === 'want' ? <Badge tone="plan">想去</Badge> : null}
              {place.archived ? <Badge tone="default">已归档</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{place.visitCount} 次记录</span>
              <span>{formatPlaceDate(place.lastSeenAt)}</span>
            </div>
            {getPlaceLocationText(place) ? (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {getPlaceLocationText(place)}
              </p>
            ) : null}
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>
    </button>
  );
}

function PlaceGroup({ title, places }: { title: string; places: Place[] }) {
  if (places.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionHeader title={title} meta={`${places.length} 个`} />
      <div className="space-y-2">
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </section>
  );
}

function PlaceRecordCard({ record }: { record: PlaceRecord }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-2xl',
            record.recordType === 'plan'
              ? 'bg-life-ai/10 text-life-ai'
              : 'bg-life-trace/10 text-life-trace',
          )}
        >
          {record.recordType === 'plan' ? (
            <CalendarDays className="size-5" />
          ) : (
            <Clock className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={record.recordType === 'plan' ? 'plan' : 'trace'}>
              {record.recordType === 'plan' ? '计划' : '踪迹'}
            </Badge>
            {record.completed ? <Badge tone="health">已完成</Badge> : null}
          </div>
          <h3 className="mt-2 line-clamp-2 font-semibold">{record.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {record.timeLabel || formatPlaceDate(record.createdAt)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function PlaceFormFields({
  form,
  setForm,
}: {
  form: PlaceFormState;
  setForm: (updater: (current: PlaceFormState) => PlaceFormState) => void;
}) {
  const updateField = <K extends keyof PlaceFormState>(key: K, value: PlaceFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <FormItem label="地点名称">
        <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
      </FormItem>
      <div className="grid grid-cols-2 gap-3">
        <SheetSelectField
          label="状态"
          value={form.status}
          options={placeStatusOptions}
          onValueChange={(value) => updateField('status', value)}
        />
        <div className="flex h-11 items-center justify-between gap-3 self-end rounded-2xl border border-border bg-secondary px-4 text-sm">
          <span>收藏</span>
          <Switch
            size="sm"
            checked={form.favorite}
            onCheckedChange={(checked) => updateField('favorite', checked)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <FormItem label="城市">
          <Input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
        </FormItem>
        <FormItem label="区县">
          <Input
            value={form.district}
            onChange={(event) => updateField('district', event.target.value)}
          />
        </FormItem>
      </div>
      <FormItem label="地址">
        <Input
          value={form.address}
          onChange={(event) => updateField('address', event.target.value)}
        />
      </FormItem>
      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <FormItem label="纬度">
          <Input
            inputMode="decimal"
            value={form.latitude}
            onChange={(event) => updateField('latitude', event.target.value)}
            placeholder="-90 到 90"
          />
        </FormItem>
        <FormItem label="经度">
          <Input
            inputMode="decimal"
            value={form.longitude}
            onChange={(event) => updateField('longitude', event.target.value)}
            placeholder="-180 到 180"
          />
        </FormItem>
      </div>
      <FormItem label="备注">
        <Textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} />
      </FormItem>
    </>
  );
}

function buildPlacePayload(form: PlaceFormState, options: { includeEmpty?: boolean } = {}) {
  const latitude = parseOptionalNumber(form.latitude);
  const longitude = parseOptionalNumber(form.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }
  if ((latitude === undefined) !== (longitude === undefined)) {
    return null;
  }

  return {
    name: form.name.trim(),
    status: form.status,
    favorite: form.favorite,
    city: options.includeEmpty ? form.city.trim() : form.city.trim() || undefined,
    district: options.includeEmpty ? form.district.trim() : form.district.trim() || undefined,
    address: options.includeEmpty ? form.address.trim() : form.address.trim() || undefined,
    latitude,
    longitude,
    clearCoordinates: options.includeEmpty && latitude === undefined,
    note: options.includeEmpty ? form.note.trim() : form.note.trim() || undefined,
  };
}

function PlacesListView() {
  const places = useLifeTraceStore((state) => state.places);
  const placesLoaded = useLifeTraceStore((state) => state.placesLoaded);
  const placesLoading = useLifeTraceStore((state) => state.placesLoading);
  const placesLoadingMore = useLifeTraceStore((state) => state.placesLoadingMore);
  const placesError = useLifeTraceStore((state) => state.placesError);
  const placesPagination = useLifeTraceStore((state) => state.placesPagination);
  const placeCreating = useLifeTraceStore((state) => state.placeCreating);
  const loadPlaces = useLifeTraceStore((state) => state.loadPlaces);
  const loadMorePlaces = useLifeTraceStore((state) => state.loadMorePlaces);
  const addPlace = useLifeTraceStore((state) => state.addPlace);
  const exportPlaces = useLifeTraceStore((state) => state.exportPlaces);
  const convertInbox = useLifeTraceStore((state) => state.convertInbox);
  const groups = useMemo(() => groupPlaces(places), [places]);
  const initialPlacesLoading = placesLoading && !placesLoaded;
  const placesRefreshing = placesLoading && placesLoaded;
  const location = useLocation();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<PlaceFormState>(defaultPlaceForm);
  const [formError, setFormError] = useState('');
  const [pendingInboxItemId, setPendingInboxItemId] = useState<string | null>(null);

  useEffect(() => {
    void loadPlaces({ page: 1, pageSize: 20, archived: false });
  }, [loadPlaces]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') !== '1') {
      return;
    }
    const rawStatus = params.get('status');
    const status: PlaceStatus =
      rawStatus === 'want' || rawStatus === 'visited' ? rawStatus : 'want';
    setCreateForm({
      ...defaultPlaceForm,
      name: params.get('name') ?? '',
      status,
      note: params.get('note') ?? '',
    });
    setPendingInboxItemId(params.get('inboxItemId'));
    setFormError('');
    setCreating(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!createForm.name.trim()) {
      setFormError('请先输入地点名称。');
      return;
    }
    const payload = buildPlacePayload(createForm);
    if (!payload) {
      setFormError('请填写有效的经纬度。');
      return;
    }
    const created = await addPlace(payload);
    if (created) {
      if (pendingInboxItemId) {
        void convertInbox(pendingInboxItemId, 'place', created.id);
      }
      setCreateForm(defaultPlaceForm);
      setPendingInboxItemId(null);
      setCreating(false);
    }
  };

  const handleExport = async () => {
    const exported = await exportPlaces();
    if (!exported) {
      return;
    }
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `life-trace-places-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SubPageShell
      title="地点库"
      eyebrow="Places"
      fallbackBackTo="/profile"
      action={
        <Button type="button" variant="ghost" size="icon" onClick={() => setCreating(true)}>
          <Plus className="size-5" />
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-trace/10 text-life-trace">
              <MapPin className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">常去地点</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {placesLoaded ? `${places.length} 个地点` : '正在同步地点'}
              </p>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => void handleExport()}>
              <Download className="size-4" />
            </Button>
          </div>
        </Card>

        {creating ? (
          <Card className="p-4">
            <form className="space-y-3" onSubmit={handleCreate}>
              <PlaceFormFields form={createForm} setForm={setCreateForm} />
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <SheetActions className="pt-0">
                <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="ai"
                  disabled={placeCreating || !createForm.name.trim()}
                >
                  {placeCreating ? '创建中' : '保存地点'}
                </Button>
              </SheetActions>
            </form>
          </Card>
        ) : null}

        {placesError ? <LoadErrorState error={placesError} onRetry={() => loadPlaces()} /> : null}

        {initialPlacesLoading ? <ListCardSkeleton rows={3} /> : null}

        {!placesLoading && placesLoaded && places.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="还没有地点"
            description="带地点的计划和踪迹会出现在这里。"
          />
        ) : null}

        <div className="relative space-y-5">
          {placesRefreshing ? <InlineRefreshStatus tone="trace" /> : null}
          <PlaceGroup title="收藏地点" places={groups.favorites} />
          <PlaceGroup title="想去地点" places={groups.wantPlaces} />
          <PlaceGroup title="常去地点" places={groups.frequent} />
          <PlaceGroup title="最近出现" places={groups.recent} />
        </div>

        {placesPagination.hasMore ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={placesLoadingMore}
            onClick={loadMorePlaces}
          >
            {placesLoadingMore ? '加载中' : '加载更多地点'}
          </Button>
        ) : null}
      </div>
    </SubPageShell>
  );
}

function PlaceDetailView({ placeId }: { placeId: string }) {
  const navigate = useNavigate();
  const place = useLifeTraceStore((state) => state.placeDetail);
  const records = useLifeTraceStore((state) => state.placeRecords);
  const loading = useLifeTraceStore((state) => state.placeDetailLoading);
  const recordsLoading = useLifeTraceStore((state) => state.placeRecordsLoading);
  const updating = useLifeTraceStore((state) => Boolean(state.placeUpdatingById[placeId]));
  const placesError = useLifeTraceStore((state) => state.placesError);
  const loadPlaceDetail = useLifeTraceStore((state) => state.loadPlaceDetail);
  const editPlace = useLifeTraceStore((state) => state.editPlace);
  const [editing, setEditing] = useState(false);
  const [draftForm, setDraftForm] = useState<PlaceFormState>(defaultPlaceForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    void loadPlaceDetail(placeId);
  }, [loadPlaceDetail, placeId]);

  useEffect(() => {
    if (place) {
      setDraftForm(placeToForm(place));
      setFormError('');
    }
  }, [place]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!draftForm.name.trim()) {
      setFormError('请先输入地点名称。');
      return;
    }
    const payload = buildPlacePayload(draftForm, { includeEmpty: true });
    if (!payload) {
      setFormError('请填写有效的经纬度。');
      return;
    }
    const updated = await editPlace(placeId, payload);
    if (updated) {
      setEditing(false);
    }
  };

  if (!place && loading) {
    return (
      <SubPageShell title="地点详情" fallbackBackTo="/places">
        <Card className="p-4 text-sm text-muted-foreground">正在读取地点</Card>
      </SubPageShell>
    );
  }

  if (!place) {
    return (
      <SubPageShell title="地点详情" fallbackBackTo="/places">
        <LoadErrorState
          error={placesError || '地点不存在'}
          onRetry={() => loadPlaceDetail(placeId)}
        />
      </SubPageShell>
    );
  }

  return (
    <SubPageShell
      title={place.name}
      eyebrow="地点详情"
      fallbackBackTo="/places"
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setEditing((value) => !value)}
        >
          <Pencil className="size-5" />
        </Button>
      }
    >
      <div className="space-y-5">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-trace/10 text-life-trace">
              {place.favorite ? (
                <Star className="size-6 fill-current" />
              ) : (
                <MapPin className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{place.name}</h2>
                {place.status === 'want' ? <Badge tone="plan">想去</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {place.visitCount} 次记录 · 最近 {formatPlaceDate(place.lastSeenAt)}
              </p>
              {getPlaceLocationText(place) ? (
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  {getPlaceLocationText(place)}
                </p>
              ) : null}
              {place.note ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{place.note}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">记录</p>
              <p className="mt-1 text-base font-semibold">{place.visitCount}</p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">首次</p>
              <p className="mt-1 truncate text-sm font-semibold">
                {formatPlaceDate(place.firstSeenAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">最近</p>
              <p className="mt-1 truncate text-sm font-semibold">
                {formatPlaceDate(place.lastSeenAt)}
              </p>
            </div>
          </div>
          {typeof place.latitude === 'number' && typeof place.longitude === 'number' ? (
            <div className="mt-2 rounded-2xl bg-secondary px-3 py-3 text-sm text-muted-foreground">
              {place.latitude}, {place.longitude}
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={place.favorite ? 'secondary' : 'outline'}
              disabled={updating}
              onClick={() => editPlace(place.id, { favorite: !place.favorite })}
            >
              {place.favorite ? <StarOff className="size-4" /> : <Star className="size-4" />}
              {place.favorite ? '取消收藏' : '收藏地点'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={updating}
              onClick={async () => {
                const updated = await editPlace(place.id, { archived: true });
                if (updated) {
                  navigate('/places');
                }
              }}
            >
              <Archive className="size-4" />
              归档
            </Button>
          </div>
        </Card>

        {editing ? (
          <Card className="p-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <PlaceFormFields form={draftForm} setForm={setDraftForm} />
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <SheetActions className="pt-0">
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  取消
                </Button>
                <Button type="submit" variant="ai" disabled={updating || !draftForm.name.trim()}>
                  {updating ? '保存中' : '保存地点'}
                </Button>
              </SheetActions>
            </form>
          </Card>
        ) : null}

        <section className="space-y-3">
          <SectionHeader title="关联记录" meta={`${records.length} 条`} />
          {recordsLoading ? (
            <Card className="p-4 text-sm text-muted-foreground">正在同步记录</Card>
          ) : records.length > 0 ? (
            <div className="space-y-2">
              {records.map((record) => (
                <PlaceRecordCard key={`${record.recordType}-${record.id}`} record={record} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MapPin}
              title="暂无记录"
              description="新的计划和踪迹会继续归到这里。"
            />
          )}
        </section>
      </div>
    </SubPageShell>
  );
}

export function PlacesPage() {
  const { placeId } = useParams();
  return placeId ? <PlaceDetailView placeId={placeId} /> : <PlacesListView />;
}
