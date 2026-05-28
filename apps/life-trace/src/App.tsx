import { Sparkles } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
import { AppReminderToast } from '@/components/AppReminderToast';
import { AppShell } from '@/components/AppShell';
import { AiPage } from '@/pages/AiPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlansPage } from '@/pages/PlansPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TodayPage } from '@/pages/TodayPage';
import { TracesPage } from '@/pages/TracesPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { AppTab } from '@/types';

const pages = {
  today: <TodayPage />,
  plans: <PlansPage />,
  ai: <AiPage />,
  traces: <TracesPage />,
  profile: <ProfilePage />,
};

const pageEntries = Object.entries(pages) as Array<[AppTab, ReactElement]>;

export default function App() {
  const activeTab = useLifeTraceStore((state) => state.activeTab);
  const setActiveTab = useLifeTraceStore((state) => state.setActiveTab);
  const loadSettings = useLifeTraceStore((state) => state.loadSettings);
  const loadPlans = useLifeTraceStore((state) => state.loadPlans);
  const loadTraces = useLifeTraceStore((state) => state.loadTraces);
  const { status, token, verifySession } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') {
      void verifySession();
    }
  }, [status, verifySession]);

  useEffect(() => {
    if (status === 'authenticated' && token) {
      void loadSettings();
      void loadPlans();
      void loadTraces();
    }
  }, [loadPlans, loadSettings, loadTraces, status, token]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && tab in pages) {
      setActiveTab(tab as AppTab);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setActiveTab]);

  if ((status === 'checking' && token) || status === 'idle') {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <div className="text-center">
          <div className="relative mx-auto mb-5 grid size-16 place-items-center">
            <div className="absolute inset-0 animate-ping rounded-3xl bg-life-ai/15 motion-reduce:animate-none" />
            <div className="absolute inset-1 rounded-3xl border border-life-ai/25 bg-life-ai/10 shadow-[0_0_42px_rgba(6,182,212,0.18)]" />
            <div className="relative grid size-11 animate-pulse place-items-center rounded-2xl bg-life-ai text-background motion-reduce:animate-none">
              <Sparkles className="size-5" />
            </div>
          </div>
          <p className="text-sm font-semibold text-foreground">Life Trace</p>
          <p className="mt-2 text-sm text-muted-foreground">正在确认登录状态</p>
        </div>
      </main>
    );
  }

  if (!token || status !== 'authenticated') {
    return <LoginPage />;
  }

  return (
    <>
      <AppShell>
        {pageEntries.map(([tab, page]) => (
          <section
            key={tab}
            hidden={activeTab !== tab}
            data-page-entrance={activeTab === tab ? '' : undefined}
          >
            {page}
          </section>
        ))}
      </AppShell>
      <AppReminderToast />
    </>
  );
}
