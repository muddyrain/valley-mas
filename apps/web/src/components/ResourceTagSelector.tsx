import { Hash, Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { aiSuggestResourceTags } from '@/api/resource';

/**
 * 资源标签选择组件（去表化版）
 * - 标签不再有独立实体表，直接作为字符串数组挂在资源上。
 * - 支持三种录入方式：输入回车、粘贴逗号分隔文本、点击 AI 生成候选后勾选。
 */
export interface ResourceTagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxCount?: number;
  aiPreUpload?: {
    imageBase64?: string;
    type: string;
    title?: string;
    description?: string;
  };
}

const MAX_TAG_LEN = 20;

function normalizeTag(raw: string): string {
  return raw.trim().slice(0, MAX_TAG_LEN);
}

export default function ResourceTagSelector({
  value,
  onChange,
  maxCount = 10,
  aiPreUpload,
}: ResourceTagSelectorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const canAi = !!aiPreUpload;

  const addTags = (raws: string[]) => {
    const normalized = raws.map(normalizeTag).filter((tag) => tag.length > 0);
    if (normalized.length === 0) return;
    const merged = [...value];
    for (const tag of normalized) {
      if (merged.length >= maxCount) break;
      if (!merged.includes(tag)) merged.push(tag);
    }
    onChange(merged);
  };

  const removeTag = (tag: string) => onChange(value.filter((item) => item !== tag));

  const handleInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault();
      if (!input.trim()) return;
      const parts = input.split(/[,，]/);
      addTags(parts);
      setInput('');
    } else if (event.key === 'Backspace' && input.length === 0 && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const handleAiMatch = async () => {
    if (!aiPreUpload) return;
    try {
      setAiLoading(true);
      const result = await aiSuggestResourceTags(aiPreUpload);
      const list = (result.tags ?? []).map(normalizeTag).filter((tag) => tag.length > 0);
      if (list.length === 0) {
        toast.warning('AI 未生成候选标签');
        setCandidates([]);
        return;
      }
      setCandidates(list);
      toast.success(`AI 生成 ${list.length} 个候选标签，点击勾选`);
    } catch {
      // request.ts 已处理错误
    } finally {
      setAiLoading(false);
    }
  };

  const toggleCandidate = (tag: string) => {
    if (value.includes(tag)) {
      removeTag(tag);
      return;
    }
    if (value.length >= maxCount) return;
    onChange([...value, tag]);
  };

  const clearCandidates = () => setCandidates([]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          标签
          {value.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-medium normal-case tracking-normal ${
                value.length >= maxCount ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'
              }`}
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-theme-primary/25 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:border-theme-primary hover:bg-theme-primary hover:text-white hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading ? 'AI 生成中...' : 'AI 生成候选'}
          </button>
        )}
      </div>

      <div className="flex min-h-8 flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
        {value.length === 0 ? (
          <span className="text-xs text-slate-400">
            {canAi ? '输入标签后回车，或使用 AI 生成候选' : '输入标签后回车'}
          </span>
        ) : (
          value.map((tag) => (
            <span
              key={tag}
              onClick={() => removeTag(tag)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-theme-soft-strong bg-theme-soft px-2.5 py-0.5 text-xs font-medium text-theme-primary transition hover:opacity-70"
            >
              <Hash className="h-2.5 w-2.5" />
              {tag}
              <X className="ml-0.5 h-2.5 w-2.5 opacity-60" />
            </span>
          ))
        )}
      </div>

      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleInputKey}
        placeholder="输入标签名后回车（可用逗号分隔）"
        maxLength={MAX_TAG_LEN}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
      />

      {candidates.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-2">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-xs text-slate-400">AI 候选（点击勾选）</span>
            <button
              type="button"
              onClick={clearCandidates}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              清空
            </button>
          </div>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {value.length >= maxCount && (
              <p className="w-full px-1 py-0.5 text-xs text-red-400">
                已达上限（最多 {maxCount} 个标签），请先移除部分标签
              </p>
            )}
            {candidates.map((tag) => {
              const selected = value.includes(tag);
              const reachedLimit = !selected && value.length >= maxCount;
              return (
                <span
                  key={tag}
                  onClick={() => {
                    if (!reachedLimit) toggleCandidate(tag);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                    reachedLimit ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                  } ${
                    selected
                      ? 'border border-theme-soft-strong bg-theme-soft text-theme-primary'
                      : 'border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Hash className="h-2.5 w-2.5" />
                  {tag}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
