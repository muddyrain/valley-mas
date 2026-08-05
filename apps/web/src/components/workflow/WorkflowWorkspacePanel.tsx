import { memo, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type WorkflowWorkspaceTab = 'ai' | 'node';

interface WorkflowWorkspacePanelProps {
  activeTab: WorkflowWorkspaceTab;
  onActiveTabChange: (tab: WorkflowWorkspaceTab) => void;
  copilotContent: ReactNode;
  nodeContent: ReactNode;
  aiUnread?: boolean;
}

export const WorkflowWorkspacePanel = memo(function WorkflowWorkspacePanel({
  activeTab,
  onActiveTabChange,
  copilotContent,
  nodeContent,
  aiUnread = false,
}: WorkflowWorkspacePanelProps) {
  return (
    <div className="h-full border-l border-border bg-card">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onActiveTabChange(value as WorkflowWorkspaceTab)}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)] flex-none">
          <TabsTrigger value="node" className="flex-1">
            节点信息
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1">
            AI 协作
            {aiUnread ? (
              <>
                <span className="ml-1.5 size-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="sr-only">有新的 AI 协作状态</span>
              </>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="node"
          className="flex min-h-0 flex-1 flex-col overflow-hidden [&>div]:border-l-0"
        >
          {nodeContent}
        </TabsContent>
        <TabsContent
          value="ai"
          keepMounted
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {copilotContent}
        </TabsContent>
      </Tabs>
    </div>
  );
});
