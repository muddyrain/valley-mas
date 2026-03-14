import type { ReactNode } from 'react';

interface PageBannerProps {
  /** 渐变色，默认紫蓝 */
  gradient?: string;
  /** Banner 高度 padding，默认 py-10 md:py-14 */
  padding?: string;
  /** 最大宽度，默认 max-w-7xl */
  maxWidth?: string;
  children: ReactNode;
}

/**
 * 通用页面头部 Banner
 * 带动态光晕背景（Profile / MySpace / CreatorProfile / Favorites 共用）
 */
export default function PageBanner({
  gradient = 'from-purple-600 via-indigo-600 to-purple-800',
  padding = 'py-10 md:py-14',
  maxWidth = 'max-w-7xl',
  children,
}: PageBannerProps) {
  return (
    <div className="relative overflow-hidden">
      {/* 渐变背景 */}
      <div className={`absolute inset-0 bg-linear-to-br ${gradient}`}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>
      </div>

      {/* 内容 */}
      <div className={`relative ${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 ${padding}`}>
        {children}
      </div>
    </div>
  );
}
