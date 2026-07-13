import {
  Code,
  Database,
  GitBranch,
  Globe,
  Hash,
  Keyboard,
  MessageSquare,
  Repeat,
  Search,
  Send,
  Sparkles,
  Upload,
  Wrench,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, NODE_CATEGORIES, NODE_CONFIGS } from './nodeConfig';
import type { WorkflowNodeConfig } from './types';

interface NodePanelProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onAddNode?: (nodeType: string) => void;
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

function NodeItem({
  node,
  categoryColor,
  onDragStart,
  onAddNode,
}: {
  node: WorkflowNodeConfig;
  categoryColor: string;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onAddNode?: (nodeType: string) => void;
}) {
  const Icon = iconMap[node.icon];
  const disabled = node.available === false;
  return (
    <div
      draggable={!disabled}
      onDragStart={disabled ? undefined : (e) => onDragStart(e, node.type)}
      onClick={disabled || !onAddNode ? undefined : () => onAddNode(node.type)}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : onAddNode
            ? 'cursor-pointer hover:border-accent hover:bg-accent/50'
            : 'cursor-grab hover:border-accent hover:bg-accent/50 active:cursor-grabbing',
      )}
    >
      <div className={cn('flex items-center justify-center rounded-md p-2', categoryColor)}>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{node.label}</div>
        <div className="text-xs text-muted-foreground truncate">{node.description}</div>
      </div>
      <Badge variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
        {disabled ? '计划中' : onAddNode ? '点击' : '拖拽'}
      </Badge>
    </div>
  );
}

export function NodePanel({ onDragStart, onAddNode }: NodePanelProps) {
  const [query, setQuery] = useState('');

  const filteredNodes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return null;
    return Object.values(NODE_CONFIGS).filter(
      (node) =>
        !node.fixed &&
        (node.label.toLowerCase().includes(keyword) ||
          node.description.toLowerCase().includes(keyword)),
    );
  }, [query]);

  const renderNodeItem = (node: WorkflowNodeConfig) => (
    <NodeItem
      key={node.type}
      node={node}
      categoryColor={CATEGORY_COLORS[node.category]}
      onDragStart={onDragStart}
      onAddNode={onAddNode}
    />
  );

  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      <div className="p-4 border-b border-border space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">节点面板</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {onAddNode ? '点击或拖拽节点到画布' : '拖拽节点到画布上'}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索节点..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-5">
          {filteredNodes ? (
            filteredNodes.length > 0 ? (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground px-1">
                  搜索结果（{filteredNodes.length}）
                </span>
                {filteredNodes.map(renderNodeItem)}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">未找到匹配的节点</div>
            )
          ) : (
            NODE_CATEGORIES.map((category) => {
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
                  <div className="space-y-2">{nodesInCategory.map(renderNodeItem)}</div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
