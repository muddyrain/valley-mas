'use client';

import { Info, Share2, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { RulesModal } from '@/components/RulesModal';
import { ShareModal } from '@/components/ShareModal';
import { useAudio } from '@/lib/audioProvider';

export function HomeToolbar() {
  const { audioEnabled, toggleAudio, playShutter } = useAudio();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    // 快门音（随音效开关）
    playShutter();

    // 触发拍照闪光动效
    const flash = flashRef.current;
    if (flash) {
      flash.style.opacity = '1';
      flash.style.transition = 'opacity 0ms';
      void flash.offsetHeight;
      flash.style.transition = 'opacity 600ms ease-out';
      flash.style.opacity = '0';
    }

    // 等闪光帧结束后再截图
    await new Promise<void>((r) => setTimeout(r, 80));

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a071a',
        scale: window.devicePixelRatio || 1,
        logging: false,
        /**
         * html2canvas 不支持 background-clip: text 的 CSS 渐变文字。
         * 通过 onclone 在克隆文档里把所有渐变文字临时降级为白色，
         * 让截图效果可读。
         */
        onclone(_clonedDoc, clonedEl) {
          // 找到所有带 bg-clip-text / text-transparent 的元素
          const gradientTextEls = clonedEl.querySelectorAll<HTMLElement>(
            '[class*="bg-clip-text"], [class*="text-transparent"]',
          );
          for (const el of gradientTextEls) {
            el.style.backgroundImage = 'none';
            el.style.webkitBackgroundClip = 'unset';
            el.style.backgroundClip = 'unset';
            el.style.color = '#f0d0ff';
            el.style.webkitTextFillColor = '#f0d0ff';
          }
        },
      });
      setScreenshotDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('截图失败', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, playShutter]);

  return (
    <>
      {/* 拍照闪光遮罩 */}
      <div
        ref={flashRef}
        aria-hidden="true"
        style={{ opacity: 0, pointerEvents: 'none' }}
        className="fixed inset-0 z-[100] bg-white"
      />

      {/* 工具栏按钮 */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setRulesOpen(true)} className="arena-toolbar-button">
          <Info className="h-4 w-4" />
          规则说明
        </button>

        <button
          type="button"
          onClick={toggleAudio}
          className={`arena-toolbar-button transition-all ${
            audioEnabled
              ? 'border-fuchsia-400/60 bg-fuchsia-900/30 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.2)]'
              : ''
          }`}
        >
          {audioEnabled ? (
            <Volume2 className="h-4 w-4 text-fuchsia-300" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          {audioEnabled ? '音效开' : '音效关'}
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={isCapturing}
          className="arena-toolbar-button disabled:opacity-50 disabled:cursor-wait"
        >
          <Share2 className="h-4 w-4" />
          {isCapturing ? '截图中...' : '分享战况'}
        </button>
      </div>

      {/* 规则弹窗 */}
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {/* 分享弹窗 */}
      <ShareModal
        screenshotDataUrl={screenshotDataUrl}
        onClose={() => setScreenshotDataUrl(null)}
      />
    </>
  );
}
