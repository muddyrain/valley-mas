import { useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { AiPage } from '@/pages/AiPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlansPage } from '@/pages/PlansPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TodayPage } from '@/pages/TodayPage';
import { TracesPage } from '@/pages/TracesPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

const pages = {
  today: <TodayPage />,
  plans: <PlansPage />,
  ai: <AiPage />,
  traces: <TracesPage />,
  profile: <ProfilePage />,
};

export default function App() {
  const activeTab = useLifeTraceStore((state) => state.activeTab);
  const loadPlans = useLifeTraceStore((state) => state.loadPlans);
  const { status, token, verifySession } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') {
      void verifySession();
    }
  }, [status, verifySession]);

  useEffect(() => {
    if (status === 'authenticated' && token) {
      void loadPlans();
    }
  }, [loadPlans, status, token]);

  if ((status === 'checking' && token) || status === 'idle') {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-pulse rounded-2xl bg-life-ai" />
          <p className="text-sm text-muted-foreground">正在确认登录状态</p>
        </div>
      </main>
    );
  }

  if (!token || status !== 'authenticated') {
    return <LoginPage />;
  }

  return <AppShell>{pages[activeTab]}</AppShell>;
}
