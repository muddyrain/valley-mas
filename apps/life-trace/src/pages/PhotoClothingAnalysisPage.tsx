import { Camera, Check, Shirt, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  analyzeClothingPhoto,
  type ClothingPhotoAnalysisResponse,
  createClosetItem,
} from '@/api/closet';
import { listHouseholds } from '@/api/household';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { ClosetItemSheet, defaultClosetItemForm } from '@/components/ClosetItemSheet';
import { EmptyState } from '@/components/EmptyState';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLifeTraceErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { HouseholdSummary, NewClosetItemInput } from '@/types';

function analysisToForm(
  analysis: ClothingPhotoAnalysisResponse,
  imageUrl: string,
  shared: boolean,
): NewClosetItemInput {
  return {
    ...defaultClosetItemForm,
    name: analysis.name,
    category: analysis.category,
    color: analysis.color,
    material: analysis.material || '',
    warmthLevel: analysis.warmthLevel,
    seasons: analysis.seasons.length ? analysis.seasons : ['四季'],
    sceneTags: analysis.sceneTags.length ? analysis.sceneTags : ['日常'],
    imageUrl,
    shared,
    note: analysis.summary,
  };
}

export function PhotoClothingAnalysisPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hint, setHint] = useState('');
  const [analysis, setAnalysis] = useState<ClothingPhotoAnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedHousehold = useMemo(
    () => households.find((item) => item.id === selectedHouseholdId) ?? households[0] ?? null,
    [households, selectedHouseholdId],
  );
  const householdId =
    selectedHousehold?.kind === 'shared' && selectedHousehold.status === 'active'
      ? selectedHousehold.id
      : undefined;
  const sharedAvailable = Boolean(householdId);

  useEffect(() => {
    if (!token) {
      return;
    }
    void listHouseholds(token)
      .then((response) => {
        setHouseholds(response.list);
        const personal = response.list.find((item) => item.kind === 'personal') ?? response.list[0];
        setSelectedHouseholdId(personal?.id || '');
      })
      .catch((loadError) => setError(getLifeTraceErrorMessage(loadError, '读取家庭空间失败')));
  }, [token]);

  const handleAnalyze = async () => {
    if (!token || !imageUrl || analyzing) {
      return;
    }
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeClothingPhoto(token, {
        imageUrl,
        householdId,
        hint,
      });
      setAnalysis(result);
      setConfirmOpen(true);
    } catch (analysisError) {
      setError(getLifeTraceErrorMessage(analysisError, '识别衣物失败'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (input: NewClosetItemInput) => {
    if (!token) {
      return;
    }
    setSaving(true);
    try {
      const saved = await createClosetItem(token, input, householdId);
      showToast(`已保存「${saved.name}」`, 'success');
      navigate('/closet');
    } catch (saveError) {
      showToast(getLifeTraceErrorMessage(saveError, '保存衣物失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const draft = analysis ? analysisToForm(analysis, imageUrl, sharedAvailable) : undefined;

  return (
    <SubPageShell title="拍照识别衣物" eyebrow="衣橱 AI" fallbackBackTo="/closet">
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Camera className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">衣物照片</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                上传后生成衣物草稿，保存前可以调整。
              </p>
            </div>
          </div>

          <AppImageUploader
            value={imageUrl}
            onChange={(url) => {
              setImageUrl(url);
              setAnalysis(null);
              setError('');
            }}
            label="衣物图片"
            description="支持拍照或从相册选择。"
            cameraAndLibrary
            disabled={analyzing}
          />

          {households.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium">保存空间</span>
              <select
                value={selectedHouseholdId}
                onChange={(event) => setSelectedHouseholdId(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none focus:border-life-ai/50"
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium">提示</span>
            <input
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-life-ai/50"
              placeholder="比如：这是通勤常穿的衬衫"
            />
          </label>

          {error ? <p className="text-sm text-life-alert">{error}</p> : null}

          <Button
            type="button"
            variant="ai"
            className="w-full"
            disabled={!imageUrl || analyzing}
            onClick={() => void handleAnalyze()}
          >
            {analyzing ? <ActionLoadingIcon tone="ai" /> : <Sparkles className="size-4" />}
            {analyzing ? '识别中' : '开始识别'}
          </Button>
        </Card>

        {analysis ? (
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="ai">草稿</Badge>
                <h2 className="mt-3 text-xl font-semibold">{analysis.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              </div>
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
                <Shirt className="size-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoPill label="品类" value={analysis.category} />
              <InfoPill label="颜色" value={analysis.color} />
              <InfoPill label="厚薄" value={analysis.warmthLevel} />
              <InfoPill label="季节" value={analysis.seasons.join(' / ')} />
            </div>
            {analysis.warnings.length > 0 ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {analysis.warnings.join('；')}
              </p>
            ) : null}
            <Button type="button" className="w-full" onClick={() => setConfirmOpen(true)}>
              <Check className="size-4" />
              确认入衣橱
            </Button>
          </Card>
        ) : (
          <EmptyState
            icon={Shirt}
            tone="ai"
            eyebrow="衣物识别"
            title="等待衣物照片"
            description="拍照或选择图片后，Life AI 会生成衣物草稿。"
          />
        )}
      </div>

      <ClosetItemSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        initialValue={draft}
        sharedAvailable={sharedAvailable}
        submitting={saving}
        onSubmit={handleSave}
      />
    </SubPageShell>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
