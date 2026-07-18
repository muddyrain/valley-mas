import { Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AIAppsPanel } from '@/components/workbench/AIAppsPanel';

export default function Workbench() {
  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <Badge variant="outline" className="mb-3">
            <Bot className="mr-2 size-3.5" />
            项目
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            智能体项目
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            创建、调试并发布面向具体任务的智能体。
          </p>
        </header>

        <AIAppsPanel />
      </div>
    </main>
  );
}
