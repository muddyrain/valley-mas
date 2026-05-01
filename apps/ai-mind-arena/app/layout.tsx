import type { Metadata } from 'next';
import './globals.css';
import { AudioProvider } from '@/lib/audioProvider';

export const metadata: Metadata = {
  title: '脑内会议室',
  description: '把你的纠结丢进去，让 5 个 AI 人格替你吵出答案。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <link rel="icon" type="image/svg+xml" href="/logo.svg" />
      <body>
        <AudioProvider>{children}</AudioProvider>
      </body>
    </html>
  );
}
