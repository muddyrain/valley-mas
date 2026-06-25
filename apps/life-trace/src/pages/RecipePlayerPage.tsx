import { ChevronLeft, Loader2, Play, Timer, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderRecipeVideo } from '@/api/advice';
import { Button } from '@/components/ui/button';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface RecipeFromState {
  id: string;
  title: string;
  steps: string[];
  usedItems: string[];
  missingItems: string[];
  timeMinutes: number;
  difficulty: string;
  servings: number;
  tags: string[];
}

function formatSeconds(total: number) {
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type VideoState = 'idle' | 'rendering' | 'ready' | 'error';

export function RecipePlayerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const recipe = location.state?.recipe as RecipeFromState | undefined;
  const pageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Page entrance animation
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          pageRef.current,
          { autoAlpha: 0, scale: 0.96 },
          { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'power2.out' },
        );
      });
    },
    { scope: pageRef },
  );

  if (!recipe) {
    navigate('/ai', { replace: true });
    return null;
  }

  // Manual trigger video rendering
  const handleStartVideo = () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      setVideoState('error');
      return;
    }

    setVideoState('rendering');

    renderRecipeVideo(token, { recipeId: recipe.id })
      .then((res) => {
        setVideoUrl(res.url);
        setExpiresAt(res.expiresAt);
        setVideoState('ready');
      })
      .catch(() => {
        // 服务端 HyperFrames 渲染未实现时，fallback 到错误提示
        setVideoState('error');
      });
  };

  // Cooking timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning]);

  const toggleTimer = () => {
    setTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setElapsedSeconds(0);
  };

  // Video player ready
  if (videoState === 'ready' && videoUrl) {
    return (
      <div ref={pageRef} className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-[#fafafa]">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
          <button
            type="button"
            onClick={() => navigate('/ai', { replace: true })}
            className="flex items-center gap-1.5 text-sm text-[#a1a1aa] hover:text-[#fafafa] transition"
          >
            <ChevronLeft className="size-5" />
            返回
          </button>
          <h1 className="text-sm font-semibold truncate max-w-50">{recipe.title}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#a1a1aa]">{recipe.timeMinutes} 分钟</span>
            <span
              className={cn(
                'text-xs font-semibold',
                recipe.difficulty === '简单' ? 'text-emerald-400' : 'text-amber-400',
              )}
            >
              {recipe.difficulty}
            </span>
          </div>
        </header>

        {/* Video player */}
        <main className="flex-1 flex items-center justify-center overflow-hidden">
          {/* biome-ignore lint/a11y/useMediaCaption: recipe video without caption tracks */}
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-w-full max-h-full object-contain"
            controls
            aria-label="菜谱步骤视频"
          />
        </main>

        {/* Expiration notice */}
        {expiresAt && (
          <div className="px-5 py-2 text-center text-xs text-[#a1a1aa]">
            视频将于 {new Date(expiresAt).toLocaleDateString('zh-CN')} 后失效
          </div>
        )}

        {/* Bottom controls */}
        <div className="px-5 pb-8 pt-4 border-t border-[#27272a] space-y-4">
          {/* Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer
                className={cn(
                  'size-5',
                  timerRunning ? 'text-life-trace animate-pulse' : 'text-[#a1a1aa]',
                )}
              />
              <span className="text-xl font-mono font-semibold tabular-nums">
                {formatSeconds(elapsedSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[#a1a1aa] hover:text-[#fafafa]"
                onClick={resetTimer}
                disabled={elapsedSeconds === 0}
              >
                重置
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'border-life-trace/30 text-life-trace hover:bg-life-trace/10',
                  timerRunning && 'bg-life-trace/10',
                )}
                onClick={toggleTimer}
              >
                {timerRunning ? '暂停' : elapsedSeconds > 0 ? '继续' : '计时'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Recipe detail page with manual video trigger
  return (
    <div ref={pageRef} className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-[#fafafa]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
        <button
          type="button"
          onClick={() => navigate('/ai', { replace: true })}
          className="flex items-center gap-1.5 text-sm text-[#a1a1aa] hover:text-[#fafafa] transition"
        >
          <ChevronLeft className="size-5" />
          返回
        </button>
        <h1 className="text-sm font-semibold truncate max-w-50">{recipe.title}</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#a1a1aa]">{recipe.timeMinutes} 分钟</span>
          <span
            className={cn(
              'text-xs font-semibold',
              recipe.difficulty === '简单' ? 'text-emerald-400' : 'text-amber-400',
            )}
          >
            {recipe.difficulty}
          </span>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-5 pb-24">
        {/* Video generation card */}
        <div className="mt-4 p-4 rounded-xl bg-[#18181b] border border-[#27272a]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-life-trace/10">
              <Video className="size-5 text-life-trace" />
            </div>
            <div>
              <p className="font-semibold text-sm">菜谱教学视频</p>
              <p className="text-xs text-[#a1a1aa]">AI 生成 9:16 竖屏步骤动画</p>
            </div>
          </div>
          <Button
            type="button"
            className="w-full bg-life-trace hover:bg-life-trace/90 text-black font-semibold"
            onClick={handleStartVideo}
            disabled={videoState === 'rendering'}
          >
            {videoState === 'rendering' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Play className="size-4" />
                生成菜谱视频
              </>
            )}
          </Button>
          {videoState === 'error' && (
            <p className="mt-2 text-xs text-amber-400">
              视频生成暂不可用，HyperFrames 渲染尚未集成
            </p>
          )}
        </div>

        {/* Ingredients */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-3 text-[#a1a1aa]">所需食材</h2>
          <div className="space-y-2">
            {recipe.usedItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full bg-life-trace flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
            {recipe.missingItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-amber-400">
                <span className="size-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span>{item}（需购买）</span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-3 text-[#a1a1aa]">烹饪步骤</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-life-trace/20 text-life-trace text-xs flex items-center justify-center font-semibold">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs bg-[#27272a] text-[#a1a1aa]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </main>

      {/* Bottom timer bar */}
      <div className="px-5 py-3 border-t border-[#27272a] bg-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer
              className={cn(
                'size-5',
                timerRunning ? 'text-life-trace animate-pulse' : 'text-[#a1a1aa]',
              )}
            />
            <span className="text-lg font-mono font-semibold tabular-nums">
              {formatSeconds(elapsedSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[#a1a1aa] hover:text-[#fafafa]"
              onClick={resetTimer}
              disabled={elapsedSeconds === 0}
            >
              重置
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'border-life-trace/30 text-life-trace hover:bg-life-trace/10',
                timerRunning && 'bg-life-trace/10',
              )}
              onClick={toggleTimer}
            >
              {timerRunning ? '暂停' : elapsedSeconds > 0 ? '继续' : '计时'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
