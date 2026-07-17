import { Bot, Sparkles, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AgentProposal,
  createAIApp,
  createAIAppProposal,
  generateAIAppAvatar,
  getAPIErrorMessage,
} from '@/api/aiWorkbench';
import { AIGenerationProgress } from '@/components/ai-workbench/AIGenerationProgress';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

export function AIAgentCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (appId: string) => void;
}) {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (!description.trim()) {
      toast.error('请描述智能体要完成的任务');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    try {
      const result = await createAIAppProposal(
        description.trim(),
        proposal || undefined,
        controller.signal,
      );
      setProposal(result.proposal);
      setSelectedTools([]);
      setSelectedKnowledge([]);
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(getAPIErrorMessage(error, '生成智能体提案失败'));
    } finally {
      controllerRef.current = null;
      setGenerating(false);
    }
  };

  const create = async () => {
    if (!proposal || creating) return;
    setCreating(true);
    try {
      const result = await createAIApp({
        type: 'agent',
        name: proposal.name.trim(),
        description: proposal.description.trim(),
        config: proposal.config,
        toolNames: selectedTools,
        knowledgeBaseIds: selectedKnowledge,
      });
      onCreated?.(result.app.id);
      onOpenChange(false);
      toast.success('智能体草稿已创建，正在生成头像');
      void generateAIAppAvatar(result.app.id)
        .then(() => toast.success('智能体头像已生成'))
        .catch(() => toast.info('头像暂未生成，可在编辑页重试或上传'));
      navigate(`/workbench/apps/${result.app.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建智能体失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI 创建智能体
          </DialogTitle>
          <DialogDescription>
            先生成可编辑预览，确认后才会创建并绑定你勾选的资源。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={description}
          maxLength={4000}
          placeholder="例如：创建一个产品需求评审助手，先检查目标和边界，再输出风险、问题和验收清单。"
          className="min-h-28"
          onChange={(event) => setDescription(event.target.value)}
        />
        {generating ? (
          <AIGenerationProgress
            title="正在设计智能体"
            description="AI 正在梳理角色、能力边界和对话方式，完成后可继续编辑。"
          />
        ) : proposal ? (
          <ScrollArea className="max-h-[52vh] pr-3">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="proposal-name">名称</Label>
                  <Input
                    id="proposal-name"
                    value={proposal.name}
                    maxLength={100}
                    onChange={(event) => setProposal({ ...proposal, name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-description">简介</Label>
                  <Input
                    id="proposal-description"
                    value={proposal.description}
                    maxLength={500}
                    onChange={(event) =>
                      setProposal({ ...proposal, description: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-prompt">系统提示词</Label>
                <Textarea
                  id="proposal-prompt"
                  value={proposal.config.systemPrompt}
                  className="min-h-56 font-mono text-xs leading-5"
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      config: { ...proposal.config, systemPrompt: event.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-opening">开场白</Label>
                <Textarea
                  id="proposal-opening"
                  value={proposal.config.openingMessage}
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      config: { ...proposal.config, openingMessage: event.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>示例问题</Label>
                {proposal.config.exampleQuestions.map((question, index) => (
                  <Input
                    key={`${index}-${question}`}
                    value={question}
                    onChange={(event) => {
                      const next = [...proposal.config.exampleQuestions];
                      next[index] = event.target.value;
                      setProposal({
                        ...proposal,
                        config: { ...proposal.config, exampleQuestions: next },
                      });
                    }}
                  />
                ))}
              </div>
              {proposal.toolSuggestions.map((item) => (
                <label key={item.name} className="flex gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    checked={selectedTools.includes(item.name)}
                    onCheckedChange={(checked) => setSelectedTools(checked ? [item.name] : [])}
                  />
                  <span className="text-sm">
                    <strong>内容搜索</strong>
                    <span className="block text-muted-foreground">{item.reason}</span>
                  </span>
                </label>
              ))}
              {proposal.knowledgeBaseSuggestions.map((item) => (
                <label key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    checked={selectedKnowledge.includes(item.id)}
                    onCheckedChange={(checked) =>
                      setSelectedKnowledge((items) =>
                        checked ? [...items, item.id] : items.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span className="text-sm">
                    <strong>{item.name}</strong>
                    <span className="block text-muted-foreground">{item.reason}</span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            <Bot className="size-5" />
            生成前不会保存任何智能体或资源绑定。
          </div>
        )}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {generating ? (
            <Button variant="outline" onClick={() => controllerRef.current?.abort()}>
              <Square className="mr-2 size-3.5" />
              停止响应
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void generate()}>
              <Sparkles className="mr-2 size-4" />
              {proposal ? '重新生成' : '生成预览'}
            </Button>
          )}
          <Button disabled={!proposal || generating || creating} onClick={() => void create()}>
            {creating ? '正在创建…' : '确认创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
