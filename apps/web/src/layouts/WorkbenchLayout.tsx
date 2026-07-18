import { MessageCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AIPanel } from '@/layouts/AIPanel';
import { Sidebar } from '@/layouts/Sidebar';
import { useLayoutStore } from '@/stores/useLayoutStore';

export default function WorkbenchLayout() {
  const aiPanelOpen = useLayoutStore((s) => s.aiPanelOpen);
  const toggleAIPanel = useLayoutStore((s) => s.toggleAIPanel);
  const setAIPanelOpen = useLayoutStore((s) => s.setAIPanelOpen);
  const location = useLocation();
  const isContextualWorkspace = location.pathname.startsWith('/workbench');

  useEffect(() => {
    if (isContextualWorkspace && aiPanelOpen) setAIPanelOpen(false);
  }, [aiPanelOpen, isContextualWorkspace, setAIPanelOpen]);

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
        {!isContextualWorkspace && aiPanelOpen && <AIPanel />}

        {/* AI Panel Toggle (when closed) */}
        {!isContextualWorkspace && !aiPanelOpen && (
          <div className="fixed right-4 bottom-4 z-50 hidden md:block">
            <Button
              size="icon"
              onClick={toggleAIPanel}
              className="rounded-full shadow-lg"
              aria-label="打开快速助手"
              title="打开快速助手"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
