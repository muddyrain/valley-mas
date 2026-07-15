import { MessageCircle } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AIPanel } from '@/layouts/AIPanel';
import { Sidebar } from '@/layouts/Sidebar';
import { useLayoutStore } from '@/stores/useLayoutStore';

export default function WorkbenchLayout() {
  const aiPanelOpen = useLayoutStore((s) => s.aiPanelOpen);
  const toggleAIPanel = useLayoutStore((s) => s.toggleAIPanel);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* AI Panel */}
        {aiPanelOpen && <AIPanel />}

        {/* AI Panel Toggle (when closed) */}
        {!aiPanelOpen && (
          <div className="fixed right-4 bottom-4 z-50 hidden md:block">
            <Button size="icon" onClick={toggleAIPanel} className="rounded-full shadow-lg">
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
