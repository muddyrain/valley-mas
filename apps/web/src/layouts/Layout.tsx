import { Outlet } from 'react-router-dom';
import { MotivationalFooter } from '@/components/MotivationalFooter';

import Header from './Header';

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <MotivationalFooter />
    </div>
  );
}
