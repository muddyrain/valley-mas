import {
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AIPrompt,
  archiveAIPrompt,
  createAIPrompt,
  getAPIErrorMessage,
  listAIPrompts,
  updateAIPrompt,
} from '@/api/aiWorkbench';
import { PromptAssistantDialog } from '@/components/ai-workbench/PromptAssistantDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

function formatPromptDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function PromptResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const keyword = searchParams.get('prompt_search') || '';

  const visiblePrompts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    if (!normalizedKeyword) return prompts;
    return prompts.filter((prompt) =>
      `${prompt.name} ${prompt.description}`.toLocaleLowerCase().includes(normalizedKeyword),
    );
  }, [keyword, prompts]);

  useEffect(() => {
    let active = true;
    void listAIPrompts()
      .then(({ list }) => {
        if (active) setPrompts(list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载提示词库失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('prompt_search', value);
    else next.delete('prompt_search');
    setSearchParams(next, { replace: true });
  };

  const openEditor = (prompt: AIPrompt | null) => {
    setEditingPrompt(prompt);
    setName(prompt?.name || '');
    setDescription(prompt?.description || '');
    setContent(prompt?.content || '');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入提示词名称');
      return;
    }
    if (!content.trim()) {
      toast.error('请输入提示词正文');
      return;
    }
    try {
      setSaving(true);
      const payload = { name: name.trim(), description: description.trim(), content };
      const saved = editingPrompt
        ? await updateAIPrompt(editingPrompt.id, payload)
        : await createAIPrompt(payload);
      setPrompts((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setEditingPrompt(saved);
      setEditorOpen(false);
      toast.success(editingPrompt ? '提示词已保存' : '提示词已创建');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存提示词失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (prompt: AIPrompt) => {
    try {
      await archiveAIPrompt(prompt.id);
      setPrompts((items) => items.filter((item) => item.id !== prompt.id));
      toast.success('提示词已归档');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '归档提示词失败'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="搜索提示词"
            className="pl-9"
          />
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="mr-2 size-4" />
          新建提示词
        </Button>
      </div>

      {loading ? (
        <div aria-busy="true" className="space-y-3 py-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : visiblePrompts.length === 0 ? (
        <div className="py-24 text-center">
          <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {keyword ? '没有匹配的提示词' : '还没有提示词'}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3">资源</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>编辑时间</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiblePrompts.map((prompt) => (
              <TableRow
                key={prompt.id}
                className="cursor-pointer"
                onClick={() => openEditor(prompt)}
              >
                <TableCell className="max-w-0 px-3">
                  <div className="flex min-w-0 items-center gap-3 py-1">
                    <FileText className="size-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {prompt.name}
                      </span>
                      {prompt.description ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {prompt.description}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">提示词</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPromptDate(prompt.updatedAt)}
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`操作 ${prompt.name}`}
                          onClick={(event) => event.stopPropagation()}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditor(prompt)}>
                        <Pencil />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => void handleArchive(prompt)}
                      >
                        <Trash2 />
                        归档
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && prompts.length > 0 ? (
        <div className="border-t border-border px-3 py-4 text-sm text-muted-foreground">
          共 {visiblePrompts.length} 个提示词
        </div>
      ) : null}

      <Dialog open={editorOpen} onOpenChange={(open) => !saving && setEditorOpen(open)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? '编辑提示词' : '新建提示词'}</DialogTitle>
            <DialogDescription>保存后可在大模型节点中插入正文。</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="prompt-resource-name">提示词名称</Label>
              <Input
                id="prompt-resource-name"
                value={name}
                maxLength={20}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：测试助手"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-resource-description">提示词描述</Label>
              <Input
                id="prompt-resource-description"
                value={description}
                maxLength={50}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="简要说明用途"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="prompt-resource-content">提示词</Label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!content.trim()}
                  onClick={() => setAssistantOpen(true)}
                >
                  <Sparkles className="mr-2 size-3.5" />
                  AI 优化
                </Button>
              </div>
              <Textarea
                id="prompt-resource-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="例如：你是一个测试助手，用于各种 AI 测试。"
                className="min-h-80"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              <Save className="mr-2 size-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromptAssistantDialog
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        target="prompt_resource"
        currentPrompt={content}
        allowedVariables={[]}
        onReplace={(suggestion) => setContent(suggestion.optimizedPrompt)}
      />
    </div>
  );
}
