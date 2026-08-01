import { MessageCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { AIPanel } from '@/layouts/AIPanel';
import { MobileNavigation } from '@/layouts/MobileNavigation';
import { Sidebar } from '@/layouts/Sidebar';
import { useLayoutStore } from '@/stores/useLayoutStore';

export default function WorkbenchLayout() {
  const aiPanelOpen = useLayoutStore((s) => s.aiPanelOpen);
  const toggleAIPanel = useLayoutStore((s) => s.toggleAIPanel);
  const setAIPanelOpen = useLayoutStore((s) => s.setAIPanelOpen);
  const isMobile = useIsMobile();
  const didSyncMobileAssistant = useRef(false);
  const location = useLocation();
  const isContextualWorkspace = location.pathname.startsWith('/workbench');
  const isWorkflowEditor =
    location.pathname.startsWith('/workbench/create') ||
    location.pathname.startsWith('/workbench/edit');
  const isAgentWorkspace = location.pathname.startsWith('/workbench/apps/');
  const hasMobileNavigation = !isWorkflowEditor && !isAgentWorkspace;

  useEffect(() => {
    if (isContextualWorkspace && aiPanelOpen) setAIPanelOpen(false);
  }, [aiPanelOpen, isContextualWorkspace, setAIPanelOpen]);

  useEffect(() => {
    if (isMobile && !didSyncMobileAssistant.current) {
      didSyncMobileAssistant.current = true;
      setAIPanelOpen(false);
    }
    if (!isMobile) didSyncMobileAssistant.current = false;
  }, [isMobile, setAIPanelOpen]);

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        {!isWorkflowEditor && !isAgentWorkspace && <Sidebar />}
        {hasMobileNavigation ? <MobileNavigation /> : null}

        {/* Main Content */}
        <main
          className={`min-w-0 flex-1 overflow-y-auto ${
            hasMobileNavigation ? 'pt-14 pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-0' : ''
          }`}
        >
          <Outlet />
        </main>

        {/* AI Panel */}
        {!isContextualWorkspace && aiPanelOpen && <AIPanel />}

        {/* AI Panel Toggle (when closed) */}
        {!isContextualWorkspace && !aiPanelOpen && (
          <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4 md:z-50">
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
