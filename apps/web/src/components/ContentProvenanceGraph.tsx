import {
  Background,
  BackgroundVariant,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Album, Bot, FileText, GitFork, ImageIcon, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import type { ResourceProvenance, ResourceProvenanceNode } from '@/api/resource';
import { cn } from '@/lib/utils';

type ProvenanceFlowData = ResourceProvenanceNode &
  Record<string, unknown> & { onNavigate?: (href: string) => void };

const TYPE_COPY: Record<ResourceProvenanceNode['type'], string> = {
  resource: '当前资源',
  generation: 'AI 创作',
  album: '资源专辑',
  post: '内容封面',
};

const NODE_ICON = {
  resource: ImageIcon,
  generation: Sparkles,
  album: Album,
  post: FileText,
} as const;

function ProvenanceNode({ data }: NodeProps<Node<ProvenanceFlowData>>) {
  const Icon = NODE_ICON[data.type];
  const isCurrent = data.direction === 'current';
  const isClickable = Boolean(data.href && data.onNavigate);
  const displayLabel =
    data.type === 'generation'
      ? data.label === 'Workflow image generation'
        ? '工作流生图'
        : 'AI 图片创作'
      : data.label;

  return (
    <button
      type="button"
      onClick={() => data.href && data.onNavigate?.(data.href)}
      disabled={!isClickable}
      className={cn(
        'group min-w-48 rounded-xl border px-3 py-3 text-left shadow-sm transition-all duration-200',
        isCurrent
          ? 'border-primary/35 bg-primary text-primary-foreground shadow-primary/15'
          : 'border-border bg-card text-card-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        isClickable ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary"
      />
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            isCurrent
              ? 'bg-primary-foreground/15 text-primary-foreground'
              : 'bg-accent text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'mb-1 block text-[11px] font-medium',
              isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            {TYPE_COPY[data.type]}
          </span>
          <span className="block truncate text-sm font-semibold">{displayLabel}</span>
          {data.detail && (
            <span
              className={cn(
                'mt-1 block truncate text-xs',
                isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground',
              )}
            >
              {data.detail}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

const nodeTypes: NodeTypes = { provenance: ProvenanceNode };

function createNodes(provenance: ResourceProvenance, onNavigate?: (href: string) => void) {
  const sourceNodes = provenance.nodes.filter((node) => node.direction === 'source');
  const currentNode = provenance.nodes.find((node) => node.direction === 'current');
  const derivedNodes = provenance.nodes.filter((node) => node.direction === 'derived');
  const toFlowNode = (
    node: ResourceProvenanceNode,
    x: number,
    y: number,
  ): Node<ProvenanceFlowData> => ({
    id: node.id,
    type: 'provenance',
    position: { x, y },
    data: { ...node, onNavigate },
  });
  const verticalStart = (count: number) => Math.max(24, 124 - ((count - 1) * 92) / 2);
  const nodes: Array<Node<ProvenanceFlowData>> = [];

  sourceNodes.forEach((node, index) => {
    nodes.push(toFlowNode(node, 0, verticalStart(sourceNodes.length) + index * 92));
  });
  if (currentNode) nodes.push(toFlowNode(currentNode, 300, 124));
  derivedNodes.forEach((node, index) => {
    nodes.push(toFlowNode(node, 600, verticalStart(derivedNodes.length) + index * 92));
  });
  return nodes;
}

function createEdges(provenance: ResourceProvenance): Edge[] {
  return provenance.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.id.startsWith('generated:')
      ? '保存为资源'
      : edge.id.startsWith('collected:')
        ? '收录至专辑'
        : '作为封面',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
    labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.9 },
    labelBgPadding: [5, 3],
  }));
}

interface ContentProvenanceGraphProps {
  provenance: ResourceProvenance;
  loading?: boolean;
  onNavigate?: (href: string) => void;
}

export default function ContentProvenanceGraph({
  provenance,
  loading = false,
  onNavigate,
}: ContentProvenanceGraphProps) {
  const nodes = useMemo(() => createNodes(provenance, onNavigate), [onNavigate, provenance]);
  const edges = useMemo(() => createEdges(provenance), [provenance]);
  const hasRelations = provenance.nodes.length > 1;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <GitFork className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">内容溯源图</h2>
            <p className="text-xs text-muted-foreground">创作、收录与内容使用记录</p>
          </div>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.max(0, provenance.nodes.length - 1)} 个关联节点
        </span>
      </div>

      {loading ? (
        <div className="h-80 animate-pulse bg-muted/40" />
      ) : hasRelations ? (
        <div className="content-provenance-canvas h-80 bg-muted/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.45}
            maxZoom={1.25}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1}
              color="hsl(var(--border))"
            />
          </ReactFlow>
        </div>
      ) : (
        <div className="flex h-44 flex-col items-center justify-center gap-2 bg-muted/20 px-5 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">暂无关联记录</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            AI 创作、专辑收录与内容封面记录会在产生后显示。
          </p>
        </div>
      )}
    </section>
  );
}
