import {
  Code,
  Database,
  GitBranch,
  Globe,
  Hash,
  Keyboard,
  MessageSquare,
  Repeat,
  Send,
  Sparkles,
  Upload,
  Wrench,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, NODE_CATEGORIES, NODE_CONFIGS } from './nodeConfig';

interface NodePanelProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Keyboard,
  MessageSquare,
  Database,
  Code,
  Globe,
  GitBranch,
  Repeat,
  Hash,
  Send,
  Sparkles,
  Wrench,
  Upload,
};

export function NodePanel({ onDragStart }: NodePanelProps) {
  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">节点面板</h2>
        <p className="text-xs text-muted-foreground mt-1">拖拽节点到画布上</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-5">
          {NODE_CATEGORIES.map((category) => {
            const CategoryIcon = iconMap[category.icon];
            const nodesInCategory = Object.values(NODE_CONFIGS).filter(
              (node) => node.category === category.id && !node.fixed,
            );

            if (nodesInCategory.length === 0) return null;

            return (
              <div key={category.id}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  {CategoryIcon && <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {category.label}
                  </span>
                </div>

                <div className="space-y-2">
                  {nodesInCategory.map((node) => {
                    const Icon = iconMap[node.icon];

                    return (
                      <div
                        key={node.type}
                        draggable={node.available !== false}
                        onDragStart={
                          node.available === false ? undefined : (e) => onDragStart(e, node.type)
                        }
                        className={cn(
                          'group flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors',
                          node.available === false
                            ? 'cursor-not-allowed opacity-55'
                            : 'cursor-grab hover:border-accent hover:bg-accent/50 active:cursor-grabbing',
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center justify-center rounded-md p-2',
                            CATEGORY_COLORS[category.id],
                          )}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{node.label}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {node.description}
                          </div>
                        </div>
                        <Badge
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {node.available === false ? '计划中' : '拖拽'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
