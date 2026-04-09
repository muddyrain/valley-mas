import { Hash, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  aiMatchResourceTags,
  aiSuggestResourceTags,
  createResourceTag,
  getResourceTags,
  type ResourceTag,
} from '@/api/resource';
import ResourceTagUpsertDialog from '@/components/ResourceTagUpsertDialog';

/**
 * 资源标签选择组件说明
 * 这个组件统一了资源标签的三类能力：关键词搜索、AI 自动匹配、现场新增标签。
 * 上传资源和编辑资源都可以复用同一套交互，避免页面之间出现重复逻辑。
 * 交互策略如下：
 * 先通过关键词筛选已有标签，再按需点击加入或移除。
 * 当标签不够用时，支持在当前弹层内直接新增标签，并可调用 AI 生成描述。
 * AI 匹配会根据已上传资源或上传前预览信息给出推荐标签，结果直接覆盖当前已选标签。
 * 为避免失控，组件始终限制最大标签数量，并在触达上限时给出明确提示。
 */
export interface ResourceTagSelectorProps {
  value: ResourceTag[];
  onChange: (tags: ResourceTag[]) => void;
  maxCount?: number;
  resourceId?: string;
  aiPreUpload?: {
    imageBase64?: string;
    type: string;
    title?: string;
    description?: string;
  };
  allowCreateTag?: boolean;
  onTagCreated?: (tag: ResourceTag) => void;
}

export default function ResourceTagSelector({
  value,
  onChange,
  maxCount = 10,
  resourceId,
  aiPreUpload,
  allowCreateTag = false,
  onTagCreated,
}: ResourceTagSelectorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [tagKeyword, setTagKeyword] = useState('');
  const [tagResults, setTagResults] = useState<ResourceTag[]>([]);
  const [tagSearching, setTagSearching] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTagKeyword = (keyword: string) => {
    setTagKeyword(keyword);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!keyword.trim()) {
      setTagResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setTagSearching(true);
        const result = await getResourceTags({ keyword: keyword.trim(), pageSize: 20 });
        setTagResults(result.list ?? []);
      } catch {
        // request.ts already handles errors
      } finally {
        setTagSearching(false);
      }
    }, 300);
  };

  const handleAiMatch = async () => {
    const canUseAi = resourceId || aiPreUpload;
    if (!canUseAi) return;

    try {
      setAiLoading(true);
      let result: { tags: ResourceTag[] };
      if (resourceId) {
        result = await aiMatchResourceTags(resourceId);
      } else {
        result = await aiSuggestResourceTags(aiPreUpload!);
      }
      onChange(result.tags);
      toast.success(`AI 已匹配 ${result.tags.length} 个标签`);
    } catch {
      // request.ts already handles errors
    } finally {
      setAiLoading(false);
    }
  };

  const removeTag = (id: string) => onChange(value.filter((tag) => tag.id !== id));
  const addTag = (tag: ResourceTag) => {
    if (value.length >= maxCount) return;
    if (value.some((item) => item.id === tag.id)) return;
    onChange([...value, tag]);
  };

  const handleCreatedTag = (tag: ResourceTag) => {
    setTagResults((prev) => (prev.some((item) => item.id === tag.id) ? prev : [tag, ...prev]));
    if (!value.some((item) => item.id === tag.id) && value.length < maxCount) {
      onChange([...value, tag]);
    }
    onTagCreated?.(tag);
  };

  const canAi = !!(resourceId || aiPreUpload);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          标签
          {value.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-medium normal-case tracking-normal ${value.length >= maxCount ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'}`}
            >
              {value.length}/{maxCount}
            </span>
          )}
        </label>

        <div className="flex items-center gap-2">
          {allowCreateTag && (
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-theme-soft-strong bg-white px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-soft"
            >
              <Plus className="h-3 w-3" />
              新增标签
            </button>
          )}
          {canAi && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleAiMatch}
              className="inline-flex items-center gap-1.5 rounded-lg border border-theme-primary/25 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:border-theme-primary hover:bg-theme-primary hover:text-white hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {aiLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {aiLoading ? 'AI 匹配中...' : 'AI 自动匹配'}
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-8 flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
        {value.length === 0 ? (
          <span className="text-xs text-slate-400">
            {canAi ? '搜索后添加标签，或使用 AI 自动匹配' : '搜索并添加标签'}
          </span>
        ) : (
          value.map((tag) => (
            <span
              key={tag.id}
              onClick={() => removeTag(tag.id)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-theme-soft-strong bg-theme-soft px-2.5 py-0.5 text-xs font-medium text-theme-primary transition hover:opacity-70"
            >
              <Hash className="h-2.5 w-2.5" />
              {tag.name}
              <X className="ml-0.5 h-2.5 w-2.5 opacity-60" />
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={tagKeyword}
          onChange={(event) => handleTagKeyword(event.target.value)}
          placeholder="搜索标签..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
        />
        {tagSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {tagResults.length > 0 && (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2">
          {value.length >= maxCount && (
            <p className="w-full px-1 py-0.5 text-xs text-red-400">
              已达上限（最多 {maxCount} 个标签），请先移除部分标签
            </p>
          )}
          {tagResults.map((tag) => {
            const selected = value.some((item) => item.id === tag.id);
            const reachedLimit = !selected && value.length >= maxCount;
            return (
              <span
                key={tag.id}
                title={tag.description || tag.name}
                onClick={() => {
                  if (selected) removeTag(tag.id);
                  else if (!reachedLimit) addTag(tag);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${reachedLimit ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'} ${selected ? 'border border-theme-soft-strong bg-theme-soft text-theme-primary' : 'border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Hash className="h-2.5 w-2.5" />
                {tag.name}
              </span>
            );
          })}
        </div>
      )}

      {tagKeyword && !tagSearching && tagResults.length === 0 && (
        <p className="px-1 text-xs text-slate-400">未找到匹配的标签</p>
      )}

      <ResourceTagUpsertDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        onSubmit={(payload) => createResourceTag(payload)}
        successMessage="标签已新增"
        onSuccess={handleCreatedTag}
      />
    </div>
  );
}
