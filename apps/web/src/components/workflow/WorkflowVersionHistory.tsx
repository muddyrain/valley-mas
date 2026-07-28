import {
  Background,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { Eye, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkflowPlatformData, WorkflowVersion } from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

type VersionPreviewGraph = {
  nodes: Node[];
  edges: Edge[];
  error: string | null;
};

function versionPreviewGraph(config: string): VersionPreviewGraph {
  try {
    const parsed: unknown = JSON.parse(config);
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid graph');
    const graph = parsed as { nodes?: unknown; edges?: unknown };
    const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const nodes = rawNodes.flatMap((rawNode, index) => {
      if (!rawNode || typeof rawNode !== 'object') return [];
      const item = rawNode as {
        id?: unknown;
        label?: unknown;
        type?: unknown;
        position?: { x?: unknown; y?: unknown };
      };
      if (typeof item.id !== 'string') return [];
      return [
        {
          id: item.id,
          position: {
            x: typeof item.position?.x === 'number' ? item.position.x : (index % 3) * 240,
            y: typeof item.position?.y === 'number' ? item.position.y : Math.floor(index / 3) * 120,
          },
          data: {
            label: typeof item.label === 'string' && item.label.trim() ? item.label : item.id,
            nodeType: typeof item.type === 'string' ? item.type : '',
          },
        } satisfies Node,
      ];
    });
    const nodeIDs = new Set(nodes.map((node) => node.id));
    const edges = (Array.isArray(graph.edges) ? graph.edges : []).flatMap((rawEdge, index) => {
      if (!rawEdge || typeof rawEdge !== 'object') return [];
      const item = rawEdge as { id?: unknown; source?: unknown; target?: unknown };
      if (
        typeof item.source !== 'string' ||
        typeof item.target !== 'string' ||
        !nodeIDs.has(item.source) ||
        !nodeIDs.has(item.target)
      ) {
        return [];
      }
      return [
        {
          id: typeof item.id === 'string' ? item.id : `edge-${index}`,
          source: item.source,
          target: item.target,
        } satisfies Edge,
      ];
    });
    return { nodes, edges, error: nodes.length ? null : '该版本没有可预览的节点。' };
  } catch {
    return { nodes: [], edges: [], error: '该版本的流程快照无法预览。' };
  }
}

function WorkflowVersionGraphPreview({ config }: { config: string }) {
  const preview = useMemo(() => versionPreviewGraph(config), [config]);
  if (preview.error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {preview.error}
      </div>
    );
  }
  return (
    <ReactFlow
      nodes={preview.nodes}
      edges={preview.edges}
      fitView
      minZoom={0.2}
      maxZoom={1.2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={18} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function WorkflowVersionHistory({
  platform,
  loading,
  onRestore,
}: {
  platform: WorkflowPlatformData | null;
  loading: boolean;
  onRestore: (version: WorkflowVersion) => Promise<void>;
}) {
  const [previewVersion, setPreviewVersion] = useState<WorkflowVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const versions = useMemo(
    () => [...(platform?.versions || [])].sort((left, right) => right.number - left.number),
    [platform?.versions],
  );

  const restorePreviewVersion = async () => {
    if (!previewVersion || restoring) return;
    setRestoring(true);
    try {
      await onRestore(previewVersion);
    } finally {
      setRestoring(false);
    }
  };

  if (loading && !platform) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!versions.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">暂无历史版本</p>;
  }

  return (
    <>
      <ol className="relative ml-2 border-l border-border">
        {versions.map((version) => {
          const isCurrent = version.id === platform?.app.draftVersionId;
          const isPublished = version.id === platform?.app.publishedVersionId;
          return (
            <li key={version.id} className="relative pb-4 pl-6 last:pb-0">
              <span
                className={`absolute -left-[5px] top-4 size-2.5 rounded-full border-2 border-background ${
                  isCurrent ? 'bg-primary' : 'bg-muted-foreground/40'
                }`}
                aria-hidden="true"
              />
              <Button
                type="button"
                variant="ghost"
                aria-current={isCurrent ? 'true' : undefined}
                className={`h-auto w-full justify-start rounded-lg border p-3 text-left hover:bg-muted/40 ${
                  isCurrent ? 'border-primary/25 bg-primary/5' : 'border-transparent'
                }`}
                onClick={() => setPreviewVersion(version)}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">v{version.number}</span>
                    {isCurrent ? <Badge variant="secondary">当前草稿</Badge> : null}
                    {isPublished ? <Badge variant="outline">已发布</Badge> : null}
                  </span>
                  <time
                    className="mt-2 block text-xs text-muted-foreground"
                    dateTime={version.createdAt}
                  >
                    {new Date(version.createdAt).toLocaleString('zh-CN')}
                  </time>
                </span>
                <Eye className="ml-3 size-4 shrink-0 text-muted-foreground" />
              </Button>
            </li>
          );
        })}
      </ol>

      <Dialog
        open={Boolean(previewVersion)}
        onOpenChange={(open) => {
          if (!open && !restoring) setPreviewVersion(null);
        }}
      >
        <DialogContent className="flex h-[94vh] w-[calc(100vw-2rem)] max-w-none flex-col sm:h-[min(94vh,960px)] sm:w-[96vw] sm:max-w-[1440px]">
          <DialogHeader>
            <DialogTitle>版本预览 {previewVersion ? `v${previewVersion.number}` : ''}</DialogTitle>
            <DialogDescription>
              {previewVersion ? new Date(previewVersion.createdAt).toLocaleString('zh-CN') : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
            {previewVersion ? (
              <ReactFlowProvider>
                <WorkflowVersionGraphPreview config={previewVersion.config} />
              </ReactFlowProvider>
            ) : null}
          </div>
          {previewVersion && previewVersion.id !== platform?.app.draftVersionId ? (
            <div className="flex justify-end">
              <Button onClick={() => void restorePreviewVersion()} disabled={restoring}>
                <RotateCcw className="mr-2 size-4" />
                {restoring ? '正在恢复…' : '恢复为此版本'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
