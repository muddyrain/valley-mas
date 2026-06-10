import { Camera, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyzeImage, type ImageAnalysisResponse } from '@/api/advice';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { SheetActions, SheetHeader } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildPlanSchedule, type PlanDateOption } from '@/lib/planSchedule';
import type { NewPlanInput, NewTraceInput, PlanType } from '@/types';

type ImageKind = '电影海报' | '美食照片' | '生活照片';

type ImageAnalysis = {
  title: string;
  summary: string;
  planType: PlanType;
  mood: string;
  tags: string[];
  schedule: {
    dateOption: PlanDateOption;
    time: string;
  };
};

type ImageAnalysisResult = ImageAnalysis | ImageAnalysisResponse;

type ImageAnalysisDrawerProps = {
  open: boolean;
  token?: string | null;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (input: NewPlanInput) => void;
  onCreateTrace: (input: NewTraceInput) => void;
  onAnalyzed: (title: string) => void;
};

const kindOptions: ImageKind[] = ['电影海报', '美食照片', '生活照片'];

const analysisByKind: Record<ImageKind, ImageAnalysis> = {
  电影海报: {
    title: '周末看一部电影',
    summary: '这张图适合作为电影计划封面，建议安排在周末晚上，并在观影后生成一条观影踪迹。',
    planType: '电影',
    mood: '期待',
    tags: ['电影', '周末', '放松'],
    schedule: { dateOption: '周六', time: '20:00' },
  },
  美食照片: {
    title: '安排一次放松晚餐',
    summary: '这张图更像一顿值得期待的晚餐，可以记录为吃饭计划，完成后沉淀成美食踪迹。',
    planType: '吃饭',
    mood: '满足',
    tags: ['美食', '晚餐', '生活奖励'],
    schedule: { dateOption: '周五', time: '19:30' },
  },
  生活照片: {
    title: '记录一个生活瞬间',
    summary: '这张图适合作为日常生活踪迹，建议补充地点、心情和一句回忆。',
    planType: '普通事项',
    mood: '平静',
    tags: ['日常', '生活', '记录'],
    schedule: { dateOption: '今天', time: '21:00' },
  },
};

export function ImageAnalysisDrawer({
  open,
  token,
  onOpenChange,
  onCreatePlan,
  onCreateTrace,
  onAnalyzed,
}: ImageAnalysisDrawerProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [kind, setKind] = useState<ImageKind>('电影海报');
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');

  const fallbackAnalysis = analysisByKind[kind];
  const analysis = analysisResult ?? fallbackAnalysis;

  const defaultSchedule = useMemo(() => buildPlanSchedule(analysis.schedule), [analysis.schedule]);

  const updateImageUrl = (url: string) => {
    setImageUrl(url);
    setAnalyzed(false);
    setAnalysisResult(null);
    setAnalysisError('');
  };

  const handleAnalyze = async () => {
    if (!imageUrl) {
      setAnalysisError('请先上传一张图片，再开始分析。');
      return;
    }

    setAnalyzing(true);
    setAnalysisError('');
    try {
      if (!token) {
        throw new Error('请先登录后再使用服务端 AI 图片分析');
      }

      const remoteAnalysis = await analyzeImage(token, {
        imageUrl: imageUrl.trim(),
        kind,
      });
      setAnalysisResult(remoteAnalysis);
      setAnalyzed(true);
      onAnalyzed(`用服务端 AI 分析了${kind}`);
    } catch (error) {
      setAnalysisResult(fallbackAnalysis);
      setAnalyzed(true);
      setAnalysisError(
        `服务端 AI 暂不可用，已使用本地结果：${
          error instanceof Error ? error.message : '请稍后再试'
        }`,
      );
      onAnalyzed(`分析了${kind}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreatePlan = () => {
    onCreatePlan({
      title: analysis.title,
      type: analysis.planType,
      ...defaultSchedule,
      reminder: true,
      source: 'image_ai',
      imageUrl: imageUrl || undefined,
      location: '',
      note: analysis.summary,
    });
    onOpenChange(false);
  };

  const handleCreateTrace = () => {
    onCreateTrace({
      title: analysis.title,
      summary: analysis.summary,
      timeLabel: '刚刚',
      imageUrl: imageUrl || undefined,
      mood: analysis.mood,
      tags: analysis.tags,
      source: '手动',
    });
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭图片分析"
      zIndexClassName="z-40"
    >
      <SheetHeader
        title="分析图片"
        description="先上传到云端，再交给服务端视觉 AI 分析。"
        icon={Camera}
        onClose={() => onOpenChange(false)}
      />

      <div className="space-y-4">
        <AppImageUploader
          value={imageUrl}
          onChange={updateImageUrl}
          label="分析图片"
          description="上传电影海报、美食照片或生活照片后，AI 会基于云端图片分析。"
          disabled={analyzing}
          onUploadingChange={setImageUploading}
        />

        <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-2">
          {kindOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                kind === option
                  ? 'bg-life-ai text-background'
                  : 'bg-secondary text-muted-foreground'
              }`}
              onClick={() => {
                setKind(option);
                setAnalyzed(false);
                setAnalysisResult(null);
                setAnalysisError('');
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="ai"
          className="w-full"
          disabled={analyzing || imageUploading}
          onClick={() => void handleAnalyze()}
        >
          {analyzing ? <ActionLoadingIcon className="size-5" /> : <Camera className="size-5" />}
          {imageUploading ? '图片上传中' : analyzing ? '分析中' : '开始分析'}
        </Button>

        {analysisError ? (
          <p className="rounded-2xl bg-life-alert/10 px-4 py-3 text-sm leading-6 text-life-alert">
            {analysisError}
          </p>
        ) : null}

        {analyzed ? (
          <Card className="border-life-ai/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-life-ai">
              <Sparkles className="size-5" />
              <span className="text-sm font-semibold">AI 分析结果</span>
            </div>
            <h3 className="font-semibold">{analysis.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
            <SheetActions className="mt-4">
              <Button type="button" variant="secondary" onClick={handleCreatePlan}>
                生成计划
              </Button>
              <Button type="button" variant="ai" onClick={handleCreateTrace}>
                生成踪迹
              </Button>
            </SheetActions>
          </Card>
        ) : null}
      </div>
    </BottomSheet>
  );
}
