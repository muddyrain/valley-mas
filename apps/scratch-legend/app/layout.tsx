import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '刮出传说',
  description: '刮盘子赚启动资金，解锁刮刮乐的像素经营小游戏。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
