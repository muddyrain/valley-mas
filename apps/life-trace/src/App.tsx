import { AppShell } from '@/components/AppShell';
import { AiPage } from '@/pages/AiPage';
import { PlansPage } from '@/pages/PlansPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TodayPage } from '@/pages/TodayPage';
import { TracesPage } from '@/pages/TracesPage';
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

  return <AppShell>{pages[activeTab]}</AppShell>;
}
