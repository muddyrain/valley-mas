import {
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

const suggestedPromptTags = ['通用', '智能体', '工作流', '生图', '写作', '博客'];

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
  const [tagText, setTagText] = useState('');
  const keyword = searchParams.get('prompt_search') || '';
  const activeTag = searchParams.get('prompt_tag') || '';

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
    setSearchParams(next, { replace: true });
  };

  const toggleEditorTag = (tag: string) => {
    const tags = parsePromptTags(tagText);
    setTagText(
      formatPromptTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]),
    );
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
        <div className="flex items-center gap-2">
          <Button onClick={() => openEditor(null)}>
            <Plus className="mr-2 size-4" />
            新建提示词
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
