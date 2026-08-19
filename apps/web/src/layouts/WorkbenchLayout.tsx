import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { GlobalCommandPalette } from '@/components/search/GlobalCommandPalette';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MobileNavigation } from '@/layouts/MobileNavigation';
import { Sidebar } from '@/layouts/Sidebar';

export default function WorkbenchLayout() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const location = useLocation();
  const isWorkflowEditor =
    location.pathname.startsWith('/workbench/create') ||
    location.pathname.startsWith('/workbench/edit');
  const hasMobileNavigation = !isWorkflowEditor;

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        {!isWorkflowEditor && <Sidebar onSearchOpen={() => setCommandPaletteOpen(true)} />}
        {hasMobileNavigation ? (
          <MobileNavigation onSearchOpen={() => setCommandPaletteOpen(true)} />
        ) : null}

        {/* Main Content */}
        <main
          className={`min-w-0 flex-1 overflow-y-auto ${
            hasMobileNavigation ? 'pt-14 pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-0' : ''
          }`}
        >
          <Outlet />
        </main>

        <GlobalCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
