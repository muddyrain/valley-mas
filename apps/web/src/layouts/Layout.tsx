import { Outlet } from 'react-router-dom';
import { MotivationalFooter } from '@/components/MotivationalFooter';

import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <MotivationalFooter />
    </div>
  );
}
