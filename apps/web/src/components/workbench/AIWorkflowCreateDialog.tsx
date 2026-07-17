import { Sparkles, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import { type AIWorkflowDraft, createAIWorkflowDraft, createWorkflow } from '@/api/workflow';
import { AIGenerationProgress } from '@/components/ai-workbench/AIGenerationProgress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { NODE_CONFIGS } from '@/components/workflow/nodeConfig';

function editorGraph(draft: AIWorkflowDraft) {
  return {
    schemaVersion: 2,
    nodes: draft.graph.nodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: { x: 280, y: 80 + index * 150 },
      data: {
        label: NODE_CONFIGS[node.type]?.label || node.id,
        nodeType: node.type,
        config: node.config,
      },
      config: node.config,
    })),
    edges: draft.graph.edges.map((edge, index) => ({
      id: `${edge.source}-${edge.target}-${index}`,
      ...edge,
      sourceHandle: edge.sourceHandle || 'output',
    })),
  };
}

export function AIWorkflowCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState<AIWorkflowDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (!description.trim()) {
      toast.error('请描述工作流要完成的任务');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      const result = await createAIWorkflowDraft(
        description.trim(),
        draft || undefined,
        controller.signal,
      );
      setDraft(result.draft);
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(getAPIErrorMessage(error, '生成工作流草稿失败'));
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  };

  const create = async () => {
    if (!draft || creating) return;
    setCreating(true);
    try {
      const workflow = await createWorkflow({
        name: draft.name,
        description: draft.description,
        graph: JSON.stringify(editorGraph(draft)),
        status: 'draft',
      });
      toast.success('工作流草稿已创建');
      onOpenChange(false);
      navigate(`/workbench/edit?id=${workflow.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建工作流失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI 创建工作流
          </DialogTitle>
          <DialogDescription>
            AI 只会使用当前开放的安全节点，确认前不会创建工作流。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={description}
          className="min-h-28"
          maxLength={4000}
          placeholder="例如：上传 Markdown，提取内容后让 AI 生成摘要，最后创建博客草稿。"
          onChange={(event) => setDescription(event.target.value)}
        />
        {loading ? (
          <AIGenerationProgress
            title="正在规划工作流"
            description="AI 正在选择安全节点并检查连接关系，完成后会显示节点预览。"
          />
        ) : draft ? (
          <ScrollArea className="max-h-[48vh] pr-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>名称</Label>
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>简介</Label>
                <Input
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>节点预览</Label>
                {draft.graph.nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                      {index + 1}
                    </span>
                    <span className="font-medium">
                      {NODE_CONFIGS[node.type]?.label || node.type}
                    </span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {node.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : null}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {loading ? (
            <Button variant="outline" onClick={() => controllerRef.current?.abort()}>
              <Square className="mr-2 size-3.5" />
              停止响应
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void generate()}>
              <Sparkles className="mr-2 size-4" />
              {draft ? '重新生成' : '生成预览'}
            </Button>
          )}
          <Button disabled={!draft || loading || creating} onClick={() => void create()}>
            {creating ? '正在创建…' : '确认创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
