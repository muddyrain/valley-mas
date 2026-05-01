'use client';

import { Download, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ShareModalProps {
  screenshotDataUrl: string | null;
  onClose: () => void;
}

export function ShareModal({ screenshotDataUrl, onClose }: ShareModalProps) {
  useEffect(() => {
    if (!screenshotDataUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenshotDataUrl, onClose]);

  function handleDownload() {
    if (!screenshotDataUrl) return;
    const a = document.createElement('a');
    a.href = screenshotDataUrl;
    a.download = `脑内会议室-战况-${Date.now()}.png`;
    a.click();
  }

  if (!screenshotDataUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="分享战况"
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 弹窗 */}
      <div className="relative z-10 w-full max-w-3xl animate-share-modal-in">
        {/* 顶部装饰光条 */}
        <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent" />

        <div className="arena-panel rounded-2xl overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <div>
              <h2 className="text-[16px] font-bold text-white tracking-wide">📸 当前战况截图</h2>
              <p className="text-[12px] text-white/45 mt-0.5">可下载分享给朋友</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 截图预览 */}
          <div className="p-4 bg-black/30">
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(123,92,255,0.2)]">
              {/* 极坐标扫光 */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-br from-white/4 via-transparent to-transparent" />
              {/* biome-ignore lint/performance/noImgElement: data URL 截图无法使用 next/image 优化 */}
              <img
                src={screenshotDataUrl}
                alt="战况截图"
                className="w-full h-auto block max-h-[60vh] object-contain"
              />
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/8">
            <p className="text-[12px] text-white/35">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-600/30 to-violet-600/30 px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(217,70,239,0.2)] transition-all hover:border-fuchsia-400/80 hover:shadow-[0_0_28px_rgba(217,70,239,0.35)] hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              下载战况
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
