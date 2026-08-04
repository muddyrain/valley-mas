import { ExternalLink, FileText, Github, Pencil, Plus, Save, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type AIPrompt,
  createAIPrompt,
  getAPIErrorMessage,
  listAIPrompts,
  updateAIPrompt,
} from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface PromptLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: string) => void;
  targetLabel?: string;
}

type PromptEditorMode = 'create' | 'edit' | null;

interface PromptDraft {
  name: string;
  description: string;
  content: string;
  tagText: string;
}

const emptyPromptDraft: PromptDraft = {
  name: '',
  description: '',
  content: '',
  tagText: '',
};

function parsePromptTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

export function PromptLibraryDialog({
  open,
  onOpenChange,
  onInsert,
  targetLabel = '提示词',
}: PromptLibraryDialogProps) {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<PromptEditorMode>(null);
  const [draft, setDraft] = useState<PromptDraft>(emptyPromptDraft);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setEditorMode(null);
    setDraft(emptyPromptDraft);
    void listAIPrompts()
      .then(({ list }) => {
        if (!active) return;
        setPrompts(list);
        setSelectedID((current) =>
          list.some((item) => item.id === current) ? current : list[0]?.id || null,
        );
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
  }, [open]);

  const filteredPrompts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return prompts;
    return prompts.filter((item) =>
      `${item.name} ${item.description} ${item.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(keyword),
    );
  }, [prompts, query]);
  const selected = prompts.find((item) => item.id === selectedID) || null;

  const handleInsert = () => {
    if (!selected) return;
    onInsert(selected.content);
    onOpenChange(false);
  };

  const openEditor = (mode: Exclude<PromptEditorMode, null>) => {
    if (mode === 'edit' && !selected) return;
    setEditorMode(mode);
    setDraft(
      mode === 'edit' && selected
        ? {
            name: selected.name,
            description: selected.description,
            content: selected.content,
            tagText: selected.tags.join('，'),
          }
        : emptyPromptDraft,
    );
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error('请输入提示词名称');
      return;
    }
    if (!draft.content.trim()) {
      toast.error('请输入提示词正文');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        content: draft.content,
        tags: parsePromptTags(draft.tagText),
      };
      const saved =
        editorMode === 'edit' && selected
          ? await updateAIPrompt(selected.id, payload)
          : await createAIPrompt(payload);
      setPrompts((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setSelectedID(saved.id);
      if (editorMode === 'create') setQuery('');
      setEditorMode(null);
      toast.success(editorMode === 'edit' ? '提示词已保存' : '提示词已创建');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存提示词失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(50rem,88vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b border-border px-7 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <FileText className="size-5 text-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle>提示词库</DialogTitle>
              <DialogDescription>
                选择一条提示词，插入到当前节点的{targetLabel}末尾。
              </DialogDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => openEditor('create')}
              disabled={Boolean(editorMode)}
            >
              <Plus className="mr-1.5 size-4" />
              新建提示词
            </Button>
            <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border bg-muted/15">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 border-border bg-background pl-9 shadow-sm"
                  placeholder="搜索提示词"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </>
              ) : filteredPrompts.length === 0 ? (
                <p className="px-3 py-8 text-sm text-muted-foreground">没有可用提示词</p>
              ) : (
                filteredPrompts.map((prompt) => {
                  const isSelected = prompt.id === selectedID;
                  const tagClassName = isSelected
                    ? 'border-border bg-background text-foreground'
                    : 'border-transparent bg-muted text-muted-foreground';
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      disabled={Boolean(editorMode)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-[border-color,background-color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${
                        isSelected
                          ? 'border-foreground/20 bg-muted text-foreground shadow-sm'
                          : 'border-transparent bg-transparent hover:border-border hover:bg-background'
                      }`}
                      onClick={() => setSelectedID(prompt.id)}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-background shadow-sm' : 'bg-muted'
                          }`}
                        >
                          <FileText className="size-3.5 text-foreground" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{prompt.name}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {prompt.description || '未填写描述'}
                          </span>
                          {prompt.tags.length > 0 ? (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              {prompt.tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className={`h-5 border px-1.5 text-[10px] font-medium ${tagClassName}`}
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {prompt.tags.length > 2 ? (
                                <Badge
                                  variant="secondary"
                                  className={`h-5 border px-1.5 text-[10px] font-medium ${tagClassName}`}
                                >
                                  +{prompt.tags.length - 2}
                                </Badge>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto bg-background p-7">
            {editorMode ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold">
                    {editorMode === 'edit' ? '编辑提示词' : '新建提示词'}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">保存后可直接插入当前节点。</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-library-name">提示词名称</Label>
                  <Input
                    id="prompt-library-name"
                    value={draft.name}
                    maxLength={20}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="例如：测试助手"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-library-description">提示词描述</Label>
                  <Input
                    id="prompt-library-description"
                    value={draft.description}
                    maxLength={50}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="简要说明用途"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-library-tags">适用标签</Label>
                  <Input
                    id="prompt-library-tags"
                    value={draft.tagText}
                    maxLength={120}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, tagText: event.target.value }))
                    }
                    placeholder="用逗号分隔，最多 8 个"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-library-content">提示词</Label>
                  <Textarea
                    id="prompt-library-content"
                    value={draft.content}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, content: event.target.value }))
                    }
                    placeholder="输入提示词正文"
                    rows={10}
                    className="max-h-64 min-h-48 overflow-y-auto resize-y"
                  />
                </div>
              </div>
            ) : selected ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{selected.name}</h3>
                    {selected.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-xl"
                    onClick={() => openEditor('edit')}
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    编辑
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  {selected.sourceUrl ? (
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Github className="size-3.5" />
                      {selected.sourceAuthor || '导入来源'}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
                <pre className="min-h-72 whitespace-pre-wrap rounded-xl border border-border bg-muted/35 p-5 text-sm leading-6 text-foreground">
                  {selected.content}
                </pre>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                从左侧选择一条提示词
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="border-t border-border bg-muted/15 px-7 py-4">
          {editorMode ? (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setEditorMode(null)}>
                取消编辑
              </Button>
              <Button disabled={saving} onClick={() => void handleSave()}>
                <Save className="mr-1.5 size-4" />
                保存
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button disabled={!selected} onClick={handleInsert}>
                插入提示词
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
