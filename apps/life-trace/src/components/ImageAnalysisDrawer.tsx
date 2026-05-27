import { Camera, ImagePlus, Sparkles, X } from 'lucide-react';
import { type ChangeEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildPlanSchedule, type PlanDateOption } from '@/lib/planSchedule';
import { cn } from '@/lib/utils';
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

type ImageAnalysisDrawerProps = {
  open: boolean;
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
  onOpenChange,
  onCreatePlan,
  onCreateTrace,
  onAnalyzed,
}: ImageAnalysisDrawerProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [localPreview, setLocalPreview] = useState('');
  const [kind, setKind] = useState<ImageKind>('电影海报');
  const [analyzed, setAnalyzed] = useState(false);

  const previewUrl = localPreview || imageUrl;
  const analysis = analysisByKind[kind];

  const defaultSchedule = useMemo(() => buildPlanSchedule(analysis.schedule), [analysis.schedule]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLocalPreview(typeof reader.result === 'string' ? reader.result : '');
      setAnalyzed(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = () => {
    setAnalyzed(true);
    onAnalyzed(`分析了${kind}`);
  };

  const handleCreatePlan = () => {
    onCreatePlan({
      title: analysis.title,
      type: analysis.planType,
      ...defaultSchedule,
      reminder: true,
      source: 'image_ai',
      imageUrl: previewUrl || undefined,
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
      imageUrl: previewUrl || undefined,
      mood: analysis.mood,
      tags: analysis.tags,
      source: '手动',
    });
    onOpenChange(false);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 transition',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <button
        type="button"
        aria-label="关闭图片分析"
        className={cn(
          'absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'safe-bottom absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[1.75rem] border border-border bg-card p-5 shadow-2xl transition duration-300',
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible translate-y-[calc(100%+2rem)] opacity-0',
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">分析图片</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              先用本地 mock 分析，后续接真实视觉 AI。
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">图片链接</span>
            <input
              value={imageUrl}
              onChange={(event) => {
                setImageUrl(event.target.value);
                setLocalPreview('');
                setAnalyzed(false);
              }}
              placeholder="粘贴电影海报、饭菜图或生活照片 URL"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>

          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-border bg-secondary p-4 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-6 text-life-ai" />
            上传本地图片预览
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="待分析图片"
              className="aspect-video w-full rounded-[1.25rem] object-cover"
            />
          ) : null}

          <div className="grid grid-cols-3 gap-2">
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
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <Button type="button" variant="ai" className="w-full" onClick={handleAnalyze}>
            <Camera className="size-5" />
            开始分析
          </Button>

          {analyzed ? (
            <Card className="border-life-ai/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-life-ai">
                <Sparkles className="size-5" />
                <span className="text-sm font-semibold">AI 分析结果</span>
              </div>
              <h3 className="font-semibold">{analysis.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button type="button" variant="secondary" onClick={handleCreatePlan}>
                  生成计划
                </Button>
                <Button type="button" variant="ai" onClick={handleCreateTrace}>
                  生成踪迹
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
