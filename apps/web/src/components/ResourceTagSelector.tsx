/**
 * ResourceTagSelector
 * 资源标签选择器（搜索 + AI 自动匹配），可复用于编辑弹框和上传弹框。
 *
 * 两种 AI 模式：
 *  - resourceId 模式：资源已存在，调用 ai-match（后端直接用资源 URL + 标题）
 *  - preUpload 模式：资源尚未上传，传 imageBase64 + type + title 调用 suggest-tags
 */
import { Hash, Loader2, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  aiMatchResourceTags,
  aiSuggestResourceTags,
  getResourceTags,
  type ResourceTag,
} from '@/api/resource';

export interface ResourceTagSelectorProps {
  /** 当前已选标签 */
  value: ResourceTag[];
  /** 标签变更回调 */
  onChange: (tags: ResourceTag[]) => void;
  /** 最多几个标签，默认 10 */
  maxCount?: number;

  // ── AI 模式二选一 ──────────────────────────────
  /** 模式 A：资源已存在，传 resourceId，AI 直接用已上传图片 */
  resourceId?: string;
  /** 模式 B：上传前，传图片 base64 + 类型 + 标题，AI 本地推理 */
  aiPreUpload?: {
    imageBase64?: string; // 可选，有图时精度更高
    type: string;
    title?: string;
    description?: string;
  };
}

export default function ResourceTagSelector({
  value,
  onChange,
  maxCount = 10,
  resourceId,
  aiPreUpload,
}: ResourceTagSelectorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [tagKeyword, setTagKeyword] = useState('');
  const [tagResults, setTagResults] = useState<ResourceTag[]>([]);
  const [tagSearching, setTagSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 搜索（300ms 防抖）────────────────────────────────────────────────────
  const handleTagKeyword = (kw: string) => {
    setTagKeyword(kw);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!kw.trim()) {
      setTagResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setTagSearching(true);
        const res = await getResourceTags({ keyword: kw.trim(), pageSize: 20 });
        setTagResults(res.list ?? []);
      } catch {
        // 静默失败
      } finally {
        setTagSearching(false);
      }
    }, 300);
  };

  // ── AI 匹配 ──────────────────────────────────────────────────────────────
  const handleAiMatch = async () => {
    const canAi = resourceId || aiPreUpload;
    if (!canAi) return;
    try {
      setAiLoading(true);
      let result: { tags: ResourceTag[] };
      if (resourceId) {
        result = await aiMatchResourceTags(resourceId);
      } else {
        result = await aiSuggestResourceTags(aiPreUpload!);
      }
      onChange(result.tags);
      toast.success(`AI 匹配了 ${result.tags.length} 个标签`);
    } catch {
      // 错误已由 request 拦截器 toast
    } finally {
      setAiLoading(false);
    }
  };

  const removeTag = (id: string) => onChange(value.filter((t) => t.id !== id));
  const addTag = (tag: ResourceTag) => {
    if (value.length >= maxCount) return;
    if (value.some((t) => t.id === tag.id)) return;
    onChange([...value, tag]);
  };

  const canAi = !!(resourceId || aiPreUpload);

  return (
    <div className="space-y-2">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          标签
          {value.length > 0 && (
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded-full normal-case tracking-normal ${value.length >= maxCount ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'}`}
            >
              {value.length}/{maxCount}
            </span>
          )}
        </label>
        {canAi && (
          <button
            type="button"
            disabled={aiLoading}
            onClick={handleAiMatch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] border border-theme-primary/25 px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-primary hover:text-white hover:border-theme-primary hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)] disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading ? 'AI 匹配中…' : 'AI 自动匹配'}
          </button>
        )}
      </div>

      {/* 已选标签 */}
      <div className="flex min-h-8 flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
        {value.length === 0 ? (
          <span className="text-xs text-slate-400">
            {canAi ? '搜索并添加标签，或使用 AI 自动匹配' : '搜索并添加标签'}
          </span>
        ) : (
          value.map((tag) => (
            <span
              key={tag.id}
              onClick={() => removeTag(tag.id)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-70 bg-theme-soft text-theme-primary border border-theme-soft-strong"
            >
              <Hash className="h-2.5 w-2.5" />
              {tag.name}
              <X className="h-2.5 w-2.5 ml-0.5 opacity-60" />
            </span>
          ))
        )}
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={tagKeyword}
          onChange={(e) => handleTagKeyword(e.target.value)}
          placeholder="搜索标签…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 pr-8"
        />
        {tagSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 animate-spin" />
        )}
      </div>

      {/* 搜索结果 */}
      {tagResults.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-white p-2 max-h-28 overflow-y-auto">
          {value.length >= maxCount && (
            <p className="w-full text-xs text-red-400 px-1 py-0.5">
              已达上限（最多 {maxCount} 个标签），请先移除部分标签
            </p>
          )}
          {tagResults.map((tag) => {
            const selected = value.some((t) => t.id === tag.id);
            const reachedLimit = !selected && value.length >= maxCount;
            return (
              <span
                key={tag.id}
                title={tag.description || tag.name}
                onClick={() => {
                  if (selected) removeTag(tag.id);
                  else if (!reachedLimit) addTag(tag);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${reachedLimit ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'} ${selected ? 'bg-theme-soft text-theme-primary border border-theme-soft-strong' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
              >
                <Hash className="h-2.5 w-2.5" />
                {tag.name}
              </span>
            );
          })}
        </div>
      )}
      {tagKeyword && !tagSearching && tagResults.length === 0 && (
        <p className="text-xs text-slate-400 px-1">未找到匹配的标签</p>
      )}
    </div>
  );
}
