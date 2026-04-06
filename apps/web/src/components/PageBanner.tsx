import type { CSSProperties, ReactNode } from 'react';

interface PageBannerProps {
  gradient?: string;
  backgroundStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  padding?: string;
  maxWidth?: string;
  children: ReactNode;
}

export default function PageBanner({
  gradient = 'from-purple-600 via-indigo-600 to-purple-800',
  backgroundStyle,
  overlayStyle,
  padding = 'py-10 md:py-14',
  maxWidth = 'max-w-7xl',
  children,
}: PageBannerProps) {
  return (
    <div className="relative overflow-hidden">
      {/* 允许页面直接传入主题变量渐变，避免个人中心子页继续写死色系 */}
      <div className={`absolute inset-0 bg-linear-to-br ${gradient}`} style={backgroundStyle}>
        <div className="absolute inset-0 opacity-20" style={overlayStyle}>
          <div
            className="absolute -left-4 top-0 h-96 w-96 animate-blob rounded-full blur-3xl filter mix-blend-multiply"
            style={{ background: 'rgba(var(--theme-tertiary-rgb), 0.9)' }}
          />
          <div
            className="animation-delay-2000 absolute -right-4 top-0 h-96 w-96 animate-blob rounded-full blur-3xl filter mix-blend-multiply"
            style={{ background: 'rgba(var(--theme-primary-rgb), 0.88)' }}
          />
          <div
            className="animation-delay-4000 absolute -bottom-8 left-20 h-96 w-96 animate-blob rounded-full blur-3xl filter mix-blend-multiply"
            style={{ background: 'rgba(var(--theme-secondary-rgb), 0.84)' }}
          />
        </div>
      </div>

      {/* 内容层保持统一内边距和最大宽度 */}
      <div className={`relative mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth} ${padding}`}>
        {children}
      </div>
    </div>
  );
}
