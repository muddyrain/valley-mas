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
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* AI Panel */}
        {aiPanelOpen && <AIPanel />}

        {/* AI Panel Toggle (when closed) */}
        {!aiPanelOpen && (
          <div className="fixed bottom-4 right-4 z-50">
            <Button
              size="icon"
              onClick={toggleAIPanel}
              className="h-12 w-12 rounded-full shadow-lg"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
