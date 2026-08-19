import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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

const STYLE_PROMPT_SEED_PATH = '/blog-cover-style-prompts.json';
const PROMPT_PAGE_SIZE = 10;

interface StylePromptSeed {
  name: string;
  description: string;
  content: string;
  tags: string[];
}

async function loadStylePromptSeeds(): Promise<StylePromptSeed[]> {
  const response = await fetch(STYLE_PROMPT_SEED_PATH);
  if (!response.ok) {
    throw new Error('读取提示词库模板失败');
  }
  const result = (await response.json()) as StylePromptSeed[];
  return result.filter((item) => item.name?.trim() && item.content?.trim());
}

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

const suggestedPromptTags = ['通用', '工作流', '生图', '写作', '博客'];

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

function formatPromptTags(tags: string[]) {
  return tags.join('，');
}

function normalizePromptName(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function PromptResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedingPrompts, setSeedingPrompts] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [pendingArchivePrompt, setPendingArchivePrompt] = useState<AIPrompt | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tagText, setTagText] = useState('');
  const keyword = searchParams.get('prompt_search') || '';
  const activeTag = searchParams.get('prompt_tag') || '';
  const currentPage = Math.max(1, Number.parseInt(searchParams.get('prompt_page') || '1', 10) || 1);

  const visiblePrompts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return prompts.filter((prompt) => {
      const matchesKeyword =
        !normalizedKeyword ||
        `${prompt.name} ${prompt.description} ${prompt.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(normalizedKeyword);
      return matchesKeyword && (!activeTag || prompt.tags.includes(activeTag));
    });
  }, [activeTag, keyword, prompts]);
  const totalPromptPages = Math.max(1, Math.ceil(visiblePrompts.length / PROMPT_PAGE_SIZE));
  const pagedPrompts = useMemo(() => {
    const start = (currentPage - 1) * PROMPT_PAGE_SIZE;
    return visiblePrompts.slice(start, start + PROMPT_PAGE_SIZE);
  }, [currentPage, visiblePrompts]);

  const updatePage = (value: number) => {
    const next = new URLSearchParams(searchParams);
    const nextPage = Math.max(1, value);
    if (nextPage <= 1) {
      next.delete('prompt_page');
    } else {
      next.set('prompt_page', String(nextPage));
    }
    setSearchParams(next, { replace: true });
  };
  const tagFilters = useMemo(
    () =>
      Array.from(
        new Set([activeTag, ...prompts.flatMap((prompt) => prompt.tags)].filter(Boolean)),
      ).sort((left, right) => {
        const leftIndex = suggestedPromptTags.indexOf(left);
        const rightIndex = suggestedPromptTags.indexOf(right);
        if (leftIndex >= 0 || rightIndex >= 0) {
          return (
            (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
            (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
          );
        }
        return left.localeCompare(right, 'zh-CN');
      }),
    [activeTag, prompts],
  );

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
    next.delete('prompt_page');
    setSearchParams(next, { replace: true });
  };

  const openEditor = (prompt: AIPrompt | null) => {
    setEditingPrompt(prompt);
    setName(prompt?.name || '');
    setDescription(prompt?.description || '');
    setContent(prompt?.content || '');
    setTagText(formatPromptTags(prompt?.tags || []));
    setEditorOpen(true);
  };

  const handleSeedStylePrompts = async () => {
    if (seedingPrompts) return;

    const normalizedPromptName = (value: string) => value.trim().toLocaleLowerCase();
    const existingPromptNames = new Set(prompts.map((prompt) => normalizedPromptName(prompt.name)));
    const existsByContent = new Set(prompts.map((prompt) => prompt.content.trim()));

    let seedCandidates: StylePromptSeed[];
    try {
      seedCandidates = await loadStylePromptSeeds();
    } catch {
      toast.error('读取生图风格提示词资源失败，请稍后重试');
      return;
    }

    const availableSeedCandidates = seedCandidates.filter(
      (seed) =>
        !existingPromptNames.has(normalizedPromptName(seed.name)) &&
        !existsByContent.has(seed.content.trim()),
    );

    if (availableSeedCandidates.length === 0) {
      toast.info('提示词库中已包含全部生图风格模板');
      return;
    }

    setSeedingPrompts(true);
    try {
      const inserted: AIPrompt[] = [];
      const existingAfterCreate = new Set(existingPromptNames);
      for (const seed of availableSeedCandidates) {
        const normalizedName = normalizedPromptName(seed.name);
        if (existingAfterCreate.has(normalizedName)) {
          continue;
        }

        const payload = {
          name: seed.name,
          description: seed.description,
          content: seed.content,
          tags: Array.from(new Set([...seed.tags, '生图'])),
        };
        const saved = await createAIPrompt(payload);
        inserted.push(saved);
        existingAfterCreate.add(normalizedName);
      }

      if (inserted.length === 0) {
        toast.info('无可新增的生图风格提示词');
        return;
      }

      setPrompts((items) => [...inserted, ...items]);
      toast.success(`已新增 ${inserted.length} 个生图风格提示词`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '新增生图风格提示词失败'));
    } finally {
      setSeedingPrompts(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入提示词名称');
      return;
    }
    const normalizedName = normalizePromptName(name);
    const duplicatedTitle = prompts.some(
      (prompt) =>
        prompt.id !== editingPrompt?.id && normalizePromptName(prompt.name) === normalizedName,
    );
    if (duplicatedTitle) {
      toast.error('提示词名称已存在，请使用其他名称');
      return;
    }
    if (!content.trim()) {
      toast.error('请输入提示词正文');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        content,
        tags: parsePromptTags(tagText),
      };
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

  const updateTagFilter = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    if (tag) next.set('prompt_tag', tag);
    else next.delete('prompt_tag');
    next.delete('prompt_page');
    setSearchParams(next, { replace: true });
  };

  const toggleEditorTag = (tag: string) => {
    const tags = parsePromptTags(tagText);
    setTagText(
      formatPromptTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]),
    );
  };

  const requestArchivePrompt = (prompt: AIPrompt) => {
    setPendingArchivePrompt(prompt);
  };

  const executeArchivePrompt = async () => {
    if (!pendingArchivePrompt) {
      return;
    }
    try {
      setArchiving(true);
      await handleArchive(pendingArchivePrompt);
      setPendingArchivePrompt(null);
    } finally {
      setArchiving(false);
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

  useEffect(() => {
    if (currentPage > totalPromptPages) {
      const next = new URLSearchParams(searchParams);
      if (totalPromptPages <= 1) {
        next.delete('prompt_page');
      } else {
        next.set('prompt_page', String(totalPromptPages));
      }
      setSearchParams(next, { replace: true });
    }
  }, [currentPage, searchParams, setSearchParams, totalPromptPages]);

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
        <div className="flex items-center gap-2">
          <Button onClick={() => openEditor(null)}>
            <Plus className="mr-2 size-4" />
            新建提示词
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleSeedStylePrompts()}
            disabled={loading || seedingPrompts}
          >
            <Sparkles className="mr-2 size-4" />
            {seedingPrompts ? '导入中…' : '导入 AI 生图风格提示词'}
          </Button>
        </div>
      </div>

      {tagFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="按标签筛选">
          <Button
            type="button"
            size="sm"
            variant={activeTag ? 'outline' : 'secondary'}
            onClick={() => updateTagFilter('')}
          >
            全部
          </Button>
          {tagFilters.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant={activeTag === tag ? 'secondary' : 'outline'}
              onClick={() => updateTagFilter(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div aria-busy="true" className="space-y-3 py-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : visiblePrompts.length === 0 ? (
        <div className="py-24 text-center">
          <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {keyword || activeTag ? '没有匹配的提示词' : '还没有提示词'}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">资源</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>编辑时间</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedPrompts.map((prompt) => (
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
                          {prompt.tags.length > 0 ? (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {prompt.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                              {prompt.tags.length > 3 ? (
                                <Badge variant="outline">+{prompt.tags.length - 3}</Badge>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {prompt.sourceUrl ? '链接导入' : '自己创建'}
                    </TableCell>
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
                            onClick={(event) => {
                              event.stopPropagation();
                              requestArchivePrompt(prompt);
                            }}
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
          </div>
          <div className="divide-y divide-border md:hidden">
            {pagedPrompts.map((prompt) => (
              <article key={prompt.id} className="px-3 py-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openEditor(prompt)}
                  >
                    <p className="truncate font-medium text-foreground">{prompt.name}</p>
                    {prompt.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {prompt.description}
                      </p>
                    ) : null}
                    {prompt.tags.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {prompt.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        {prompt.tags.length > 3 ? (
                          <Badge variant="outline">+{prompt.tags.length - 3}</Badge>
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`操作 ${prompt.name}`} />
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
                        onClick={(event) => {
                          event.stopPropagation();
                          requestArchivePrompt(prompt);
                        }}
                      >
                        <Trash2 />
                        归档
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-3 pl-8 text-xs text-muted-foreground">
                  {prompt.sourceUrl ? '链接导入' : '自己创建'} ·{' '}
                  {formatPromptDate(prompt.updatedAt)}
                </p>
              </article>
            ))}
          </div>
        </>
      )}

      {!loading && visiblePrompts.length > 0 ? (
        <div className="border-t border-border px-3 py-4 text-sm text-muted-foreground">
          第 {Math.min(currentPage, totalPromptPages)} / {totalPromptPages} 页 · 共{' '}
          {visiblePrompts.length} 个提示词
          {totalPromptPages > 1 ? (
            <span className="mt-3 block">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1 || loading}
                onClick={() => updatePage(currentPage - 1)}
                className="mr-2"
              >
                <ChevronLeft className="mr-1 size-4" />
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPromptPages || loading}
                onClick={() => updatePage(currentPage + 1)}
              >
                下一页
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </span>
          ) : null}
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
              <Label htmlFor="prompt-resource-tags">适用标签</Label>
              <div className="flex flex-wrap gap-2">
                {suggestedPromptTags.map((tag) => {
                  const selected = parsePromptTags(tagText).includes(tag);
                  return (
                    <Button
                      key={tag}
                      type="button"
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      aria-pressed={selected}
                      onClick={() => toggleEditorTag(tag)}
                    >
                      {tag}
                    </Button>
                  );
                })}
              </div>
              <Input
                id="prompt-resource-tags"
                value={tagText}
                maxLength={120}
                onChange={(event) => setTagText(event.target.value)}
                placeholder="用逗号分隔，最多 8 个"
              />
            </div>
            {editingPrompt?.sourceUrl ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/25 p-3">
                <p className="text-sm font-medium text-foreground">导入来源</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {editingPrompt.sourceAuthor ? <span>{editingPrompt.sourceAuthor}</span> : null}
                  {editingPrompt.sourceLicense ? (
                    <Badge variant="outline">{editingPrompt.sourceLicense}</Badge>
                  ) : null}
                  {editingPrompt.importedAt ? (
                    <span>导入于 {formatPromptDate(editingPrompt.importedAt)}</span>
                  ) : null}
                  <a
                    href={editingPrompt.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    查看仓库
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ) : null}
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
                rows={10}
                className="max-h-64 min-h-48 overflow-y-auto resize-y"
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

      <AlertDialog
        open={!!pendingArchivePrompt}
        onOpenChange={(open) => {
          if (!open) {
            setPendingArchivePrompt(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认归档这个提示词？</AlertDialogTitle>
            <AlertDialogDescription>
              归档后该提示词将从当前列表移除，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeArchivePrompt()} disabled={archiving}>
              {archiving ? '归档中…' : '确认归档'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
