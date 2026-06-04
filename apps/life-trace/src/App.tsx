import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppFeedbackToast } from '@/components/AppFeedbackToast';
import { AppReminderToast } from '@/components/AppReminderToast';
import { AppShell } from '@/components/AppShell';
import { LifeTraceBrandMark } from '@/components/LifeTraceBrandMark';
import { AiActionsPage, AiHistoryPage, AiPage, AiWeeklyReviewsPage } from '@/pages/AiPage';
import { LoginPage } from '@/pages/LoginPage';
import { PantryPage } from '@/pages/PantryPage';
import { PhotoItemAnalysisPage } from '@/pages/PhotoItemAnalysisPage';
import { PlansPage } from '@/pages/PlansPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TodayPage } from '@/pages/TodayPage';
import { TracesPage } from '@/pages/TracesPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { AppTab } from '@/types';

const tabRoutes: Record<AppTab, string> = {
  today: '/today',
  plans: '/plans',
  ai: '/ai',
  traces: '/traces',
  profile: '/profile',
};

function AppContent() {
  const loadSettings = useLifeTraceStore((state) => state.loadSettings);
  const loadPantry = useLifeTraceStore((state) => state.loadPantry);
  const loadPlans = useLifeTraceStore((state) => state.loadPlans);
  const loadTraces = useLifeTraceStore((state) => state.loadTraces);
  const { status, token, verifySession } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'idle') {
      void verifySession();
    }
  }, [status, verifySession]);

  useEffect(() => {
    if (status === 'authenticated' && token) {
      void loadSettings();
      void loadPantry();
      void loadPlans();
      void loadTraces();
    }
  }, [loadPantry, loadPlans, loadSettings, loadTraces, status, token]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && tab in tabRoutes) {
      navigate(tabRoutes[tab as AppTab], { replace: true });
    }
  }, [navigate]);

  if ((status === 'checking' && token) || status === 'idle') {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <div className="text-center">
          <div className="relative mx-auto mb-5 grid size-16 place-items-center">
            <div className="absolute inset-0 animate-ping rounded-3xl bg-life-ai/15 motion-reduce:animate-none" />
            <div className="absolute inset-1 rounded-3xl border border-life-ai/25 bg-life-ai/10 shadow-[0_0_42px_rgba(6,182,212,0.18)]" />
            <LifeTraceBrandMark className="relative size-11 animate-pulse motion-reduce:animate-none" />
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
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/pantry" element={<PantryPage />} />
          <Route path="/plans/:planId?" element={<PlansPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/ai/history" element={<AiHistoryPage />} />
          <Route path="/ai/actions" element={<AiActionsPage />} />
          <Route path="/ai/photo-item-analysis" element={<PhotoItemAnalysisPage />} />
          <Route path="/ai/weekly-reviews" element={<AiWeeklyReviewsPage />} />
          <Route path="/traces/:traceId?" element={<TracesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </AppShell>
      <AppFeedbackToast />
      <AppReminderToast />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
