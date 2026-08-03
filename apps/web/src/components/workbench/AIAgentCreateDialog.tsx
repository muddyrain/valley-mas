import { Bot, Sparkles, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AgentConfig,
  type AgentProposal,
  createAIApp,
  createAIAppProposal,
  getAPIErrorMessage,
} from '@/api/aiWorkbench';
import { ModelPicker } from '@/components/ai/ModelPicker';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export const AGENT_PROFILE_FIELDS = [
  ['identity', 'IDENTITY.md', '智能伙伴的名字、性格和身份定义'],
  ['userProfile', 'USER.md', '用户基本信息和沟通偏好'],
  ['soul', 'SOUL.md', '底线规则、安全框架和核心价值观'],
  ['agentInstructions', 'AGENTS.md', '智能体执行任务时遵循的协作约定'],
] as const;

export function createDefaultAgentConfig(): AgentConfig {
  return {
    modelProfile: 'ark-text-default',
    systemPrompt: '',
    openingMessage: '',
    exampleQuestions: [],
    identity:
      '# IDENTITY.md\n\n你是一位可靠、友善、具备独立判断力的智能伙伴。请保持清晰、自然和有温度的表达。',
    userProfile: '# USER.md\n\n尚未记录用户档案。请在交流中尊重用户的表达习惯、目标和沟通偏好。',
    soul: '# SOUL.md\n\n诚实说明能力边界；保护用户隐私；不伪造事实或执行结果；遇到高风险操作先确认。',
    agentInstructions:
      '# AGENTS.md\n\n优先理解用户真正想完成的目标；需要工具时说明正在做什么；完成后给出可验证的结果。',
    skillIds: [],
  };
}

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
  const [mode, setMode] = useState<'standard' | 'ai'>('standard');
  const [standardName, setStandardName] = useState('');
  const [standardDescription, setStandardDescription] = useState('');
  const [description, setDescription] = useState('');
  const [textModelId, setTextModelId] = useState('');
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) return;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setMode('standard');
    setStandardName('');
    setStandardDescription('');
    setDescription('');
    setTextModelId('');
    setProposal(null);
    setSelectedTools([]);
    setSelectedKnowledge([]);
    setGenerating(false);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!creating) onOpenChange(nextOpen);
  };

  const finishCreation = (appId: string) => {
    onCreated?.(appId);
    onOpenChange(false);
    navigate(`/workbench/apps/${appId}`);
  };

  const createStandard = async () => {
    const name = standardName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const result = await createAIApp({
        type: 'agent',
        name,
        description: standardDescription.trim(),
        config: createDefaultAgentConfig(),
      });
      toast.success('智能体已创建');
      finishCreation(result.app.id);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建智能体失败'));
    } finally {
      setCreating(false);
    }
  };

  const generate = async () => {
    if (!description.trim()) {
      toast.error('请描述智能体要完成的任务');
      return;
    }
    if (!textModelId) {
      toast.error('请选择文本模型');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    try {
      const result = await createAIAppProposal(
        description.trim(),
        textModelId,
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

  const createFromAI = async () => {
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
      toast.success('智能体已创建，正在生成头像');
      finishCreation(result.app.id);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建智能体失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={mode === 'standard' ? 'max-h-[90vh] sm:max-w-lg' : 'max-h-[90vh] sm:max-w-3xl'}
      >
        <DialogHeader>
          <DialogTitle>创建智能体</DialogTitle>
          <DialogDescription className={mode === 'standard' ? 'sr-only' : undefined}>
            {mode === 'standard'
              ? '填写名称和功能介绍后创建智能体。'
              : '生成可编辑预览后再创建智能体。'}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(value) => setMode(value as 'standard' | 'ai')}>
          <TabsList className="w-full">
            <TabsTrigger value="standard" disabled={generating || creating}>
              标准创建
            </TabsTrigger>
            <TabsTrigger value="ai" disabled={generating || creating}>
              AI 创建
            </TabsTrigger>
          </TabsList>
          <TabsContent value="standard" className="pt-2">
            <div className="grid gap-5">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="agent-name">智能体名称</Label>
                  <span className="text-xs text-muted-foreground">{standardName.length}/50</span>
                </div>
                <Input
                  id="agent-name"
                  autoFocus
                  maxLength={50}
                  value={standardName}
                  placeholder="输入智能体名称"
                  onChange={(event) => setStandardName(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="agent-description">功能介绍</Label>
                  <span className="text-xs text-muted-foreground">
                    {standardDescription.length}/500
                  </span>
                </div>
                <Textarea
                  id="agent-description"
                  maxLength={500}
                  value={standardDescription}
                  className="min-h-32 resize-none"
                  placeholder="介绍智能体能够完成的任务"
                  onChange={(event) => setStandardDescription(event.target.value)}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="ai" className="space-y-4 pt-2">
            <Textarea
              value={description}
              maxLength={4000}
              placeholder="描述你希望创建的智能体"
              className="min-h-28"
              onChange={(event) => setDescription(event.target.value)}
            />
            <ModelPicker
              value={textModelId || undefined}
              onValueChange={setTextModelId}
              capability="text"
              label="文本模型"
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {AGENT_PROFILE_FIELDS.map(([field, title, help]) => (
                      <div key={field} className="space-y-2 rounded-lg border border-border p-3">
                        <Label htmlFor={`proposal-${field}`}>{title}</Label>
                        <p className="text-xs text-muted-foreground">{help}</p>
                        <Textarea
                          id={`proposal-${field}`}
                          value={proposal.config[field] || ''}
                          className="min-h-36 font-mono text-xs leading-5"
                          onChange={(event) =>
                            setProposal({
                              ...proposal,
                              config: { ...proposal.config, [field]: event.target.value },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {proposal.toolSuggestions.map((item) => (
                    <label
                      key={item.name}
                      className="flex gap-3 rounded-lg border border-border p-3"
                    >
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
          </TabsContent>
        </Tabs>
        {mode === 'standard' ? (
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button
              disabled={!standardName.trim() || creating}
              onClick={() => void createStandard()}
            >
              {creating ? '正在创建…' : '创建'}
            </Button>
          </DialogFooter>
        ) : (
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
            <Button
              disabled={!proposal || generating || creating}
              onClick={() => void createFromAI()}
            >
              {creating ? '正在创建…' : '确认创建'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
