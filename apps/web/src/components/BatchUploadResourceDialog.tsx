/**
 * BatchUploadResourceDialog
 * 批量上传资源弹窗
 *
 * 操作流程：
 *   1. 选择多张图片文件
 *   2. 统一设置资源类型和可见范围
 *   3. 可对每项单独编辑标题，也可点「AI 批量起名」一键生成
 *   4. 可对每项单独 AI 识别标签，也可点「AI 批量识别标签」批量处理
 *   5. 点「开始批量上传」逐项上传，实时展示进度
 */
import {
  FileStack,
  FileUp,
  Hash,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  aiSuggestResourceTags,
  type ResourceTag,
  type ResourceVisibility,
  setResourceTags,
  suggestResourceTitle,
  uploadResource,
} from '@/api/resource';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const RESOURCE_TYPE_OPTIONS = [
  { value: 'wallpaper' as const, icon: '🖼️', label: '壁纸' },
  { value: 'avatar' as const, icon: '🙂', label: '头像' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'private' as const, icon: '🔒', label: '私密' },
  { value: 'shared' as const, icon: '🔗', label: '共享' },
  { value: 'public' as const, icon: '🌐', label: '公开' },
] as const;

// ─── 类型 ─────────────────────────────────────────────────────────────────────

type BatchResourceItem = {
  file: File;
  previewUrl: string;
  base64: string;
  title: string;
  tags: ResourceTag[];
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  aiNaming?: boolean;
  aiTagging?: boolean;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BatchUploadResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function resizeImageForAI(file: File, maxSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function resolveItemTitle(item: BatchResourceItem) {
  return item.title.trim() || item.file.name.replace(/\.[^/.]+$/, '');
}

function getErrorText(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  }
  return fallback;
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

export default function BatchUploadResourceDialog({
  open,
  onOpenChange,
  onSuccess,
}: BatchUploadResourceDialogProps) {
  const [items, setItems] = useState<BatchResourceItem[]>([]);
  const [uploadType, setUploadType] = useState<'wallpaper' | 'avatar'>('wallpaper');
  const [visibility, setVisibility] = useState<ResourceVisibility>('private');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [batchAiNaming, setBatchAiNaming] = useState(false);
  const [batchAiTagging, setBatchAiTagging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 重置 ────────────────────────────────────────────────────────────────────
  const reset = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
    setUploadType('wallpaper');
    setVisibility('private');
    setUploading(false);
    setDone(false);
    setPreparing(false);
    setBatchAiNaming(false);
    setBatchAiTagging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 选择文件 ────────────────────────────────────────────────────────────────
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    const validFiles = selected.filter((f) => {
      if (!f.type.startsWith('image/')) {
        toast.error(`${f.name} 不是图片文件，已跳过`);
        return false;
      }
      if (f.size > 30 * 1024 * 1024) {
        toast.error(`${f.name} 超过 30MB 限制，已跳过`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    try {
      setPreparing(true);
      const newItems = await Promise.all(
        validFiles.map(async (file): Promise<BatchResourceItem> => {
          const previewUrl = URL.createObjectURL(file);
          const base64 = await resizeImageForAI(file, 512).catch(() => '');
          return {
            file,
            previewUrl,
            base64,
            title: file.name.replace(/\.[^/.]+$/, ''),
            tags: [],
            status: 'pending',
          };
        }),
      );
      setItems((prev) => [...prev, ...newItems]);
      setDone(false);
    } finally {
      setPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    // 模拟 input change
    const dt = new DataTransfer();
    for (const f of files) {
      dt.items.add(f);
    }
    const fakeInput = {
      target: { files: dt.files },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await handleFilesChange(fakeInput);
  };

  // ── 更新单项 ────────────────────────────────────────────────────────────────
  const updateItem = (index: number, patch: Partial<BatchResourceItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  // ── 删除单项 ────────────────────────────────────────────────────────────────
  const removeItem = (index: number) => {
    setItems((prev) => {
      if (!prev[index]) return prev;
      URL.revokeObjectURL(prev[index].previewUrl);
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setDone(false);
      }
      return next;
    });
  };

  const uploadSingleItem = async (index: number) => {
    const item = items[index];
    if (!item) return false;

    try {
      updateItem(index, { status: 'running', error: undefined });
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('type', uploadType);
      formData.append('visibility', visibility);
      formData.append('title', resolveItemTitle(item));
      const { resource } = await uploadResource(formData);
      if (item.tags.length > 0 && resource?.id) {
        await setResourceTags(
          resource.id,
          item.tags.map((tag) => tag.id),
        ).catch(() => {
          /* 静默 */
        });
      }
      updateItem(index, { status: 'success', error: undefined });
      return true;
    } catch (error) {
      updateItem(index, { status: 'error', error: getErrorText(error, '上传失败') });
      return false;
    }
  };

  // ── 单项 AI 起名 ─────────────────────────────────────────────────────────────
  const handleAiNameItem = async (index: number) => {
    const item = items[index];
    if (!item.base64) {
      toast.error('图片未准备好，请稍后重试');
      return;
    }
    try {
      updateItem(index, { aiNaming: true });
      const result = await suggestResourceTitle(item.base64, uploadType);
      if (result.titles?.length) {
        updateItem(index, { title: result.titles[0], aiNaming: false });
        toast.success(`「${result.titles[0]}」已应用`);
      } else {
        updateItem(index, { aiNaming: false });
        toast.error('AI 未返回有效名称');
      }
    } catch {
      updateItem(index, { aiNaming: false });
      toast.error('AI 起名失败');
    }
  };

  // ── 单项 AI 识别标签 ─────────────────────────────────────────────────────────
  const handleAiTagItem = async (index: number) => {
    const item = items[index];
    try {
      updateItem(index, { aiTagging: true });
      const result = await aiSuggestResourceTags({
        imageBase64: item.base64,
        type: uploadType,
        title: item.title,
      });
      if (result.tags?.length) {
        updateItem(index, { tags: result.tags, aiTagging: false });
        toast.success(`已识别 ${result.tags.length} 个标签`);
      } else {
        updateItem(index, { aiTagging: false });
        toast.error('AI 未识别到标签');
      }
    } catch {
      updateItem(index, { aiTagging: false });
      toast.error('AI 标签识别失败');
    }
  };

  // ── 批量 AI 起名 ─────────────────────────────────────────────────────────────
  const handleBatchAiName = async () => {
    const pendingIndexes = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.status === 'pending' && item.base64)
      .map(({ i }) => i);

    if (!pendingIndexes.length) {
      toast.info('没有待处理的图片');
      return;
    }

    setBatchAiNaming(true);
    try {
      // 逐个处理，避免并发过多
      for (const index of pendingIndexes) {
        const item = items[index];
        try {
          updateItem(index, { aiNaming: true });
          const result = await suggestResourceTitle(item.base64, uploadType);
          if (result.titles?.length) {
            updateItem(index, { title: result.titles[0], aiNaming: false });
          } else {
            updateItem(index, { aiNaming: false });
          }
        } catch {
          updateItem(index, { aiNaming: false });
        }
        // 小延迟，避免接口过载
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success('AI 批量起名完成');
    } finally {
      setBatchAiNaming(false);
    }
  };

  // ── 批量 AI 识别标签 ─────────────────────────────────────────────────────────
  const handleBatchAiTag = async () => {
    const pendingIndexes = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.status === 'pending' && item.base64)
      .map(({ i }) => i);

    if (!pendingIndexes.length) {
      toast.info('没有待处理的图片');
      return;
    }

    setBatchAiTagging(true);
    try {
      for (const index of pendingIndexes) {
        const item = items[index];
        try {
          updateItem(index, { aiTagging: true });
          const result = await aiSuggestResourceTags({
            imageBase64: item.base64,
            type: uploadType,
            title: item.title,
          });
          if (result.tags?.length) {
            updateItem(index, { tags: result.tags, aiTagging: false });
          } else {
            updateItem(index, { aiTagging: false });
          }
        } catch {
          updateItem(index, { aiTagging: false });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success('AI 批量标签识别完成');
    } finally {
      setBatchAiTagging(false);
    }
  };

  // ── 批量上传 ─────────────────────────────────────────────────────────────────
  const handleBatchUpload = async ({ retryFailedOnly = false } = {}) => {
    const targetIndexes = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => (retryFailedOnly ? item.status === 'error' : item.status === 'pending'))
      .map(({ i }) => i);

    if (!targetIndexes.length) {
      toast.info(retryFailedOnly ? '没有可重试的失败项' : '没有待上传的文件');
      return;
    }

    setUploading(true);
    setDone(false);
    let successCount = 0;
    let errorCount = 0;

    for (const index of targetIndexes) {
      const success = await uploadSingleItem(index);
      if (success) successCount += 1;
      else errorCount += 1;
    }

    setUploading(false);
    setDone(true);
    if (successCount > 0) onSuccess?.();

    if (successCount > 0) {
      toast.success(
        `批量上传完成：成功 ${successCount} 项${errorCount ? `，失败 ${errorCount} 项` : ''}`,
      );
    } else {
      toast.error(
        retryFailedOnly ? '重试失败，请检查错误后再试' : '批量上传失败，请检查结果后重试',
      );
    }
  };

  const handleRetryItem = async (index: number) => {
    const item = items[index];
    if (!item || item.status !== 'error' || uploading) return;

    setUploading(true);
    const displayTitle = resolveItemTitle(item);
    const success = await uploadSingleItem(index);
    setUploading(false);
    setDone(true);

    if (success) {
      onSuccess?.();
      toast.success(`已重新上传「${displayTitle}」`);
    } else {
      toast.error(`「${displayTitle}」重新上传失败`);
    }
  };

  const isBusy = uploading || batchAiNaming || batchAiTagging || preparing;
  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const successCount = items.filter((item) => item.status === 'success').length;
  const errorCount = items.filter((item) => item.status === 'error').length;

  // ── 渲染 ─────────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isBusy) {
          onOpenChange(next);
          if (!next) reset();
        }
      }}
    >
      <DialogContent className="max-w-3xl! max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
        {/* 标题栏 */}
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10)_0%,rgba(var(--theme-primary-rgb),0.03)_100%)] px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileStack className="h-4 w-4 text-theme-primary" />
            批量上传资源
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-slate-500">
            一次选择多张图片，可批量设置 AI 名称和标签后统一上传。
          </DialogDescription>
        </DialogHeader>

        {/* 全局设置 */}
        <div className="shrink-0 border-b border-slate-100 bg-theme-soft/40 px-6 py-3">
          <div className="flex flex-wrap items-center gap-4">
            {/* 资源类型 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                资源类型
              </span>
              <div className="flex gap-1.5">
                {RESOURCE_TYPE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    disabled={isBusy}
                    onClick={() => setUploadType(opt.value)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                      uploadType === opt.value
                        ? 'bg-theme-primary text-white border-theme-primary shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-theme-primary hover:text-theme-primary'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 可见范围 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                可见范围
              </span>
              <div className="flex gap-1.5">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    disabled={isBusy}
                    onClick={() => setVisibility(opt.value)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                      visibility === opt.value
                        ? 'bg-theme-primary text-white border-theme-primary shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-theme-primary hover:text-theme-primary'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 空态：拖拽选择区 */}
          {items.length === 0 && (
            <div
              className="flex min-h-72 flex-col items-center justify-center m-6 rounded-2xl border-2 border-dashed border-theme-primary/35 bg-theme-soft/30 px-6 text-center cursor-pointer group transition-all hover:border-theme-primary hover:bg-theme-soft/50"
              onDrop={(e) => void handleDrop(e)}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-theme-primary/8 ring-1 ring-theme-primary/12 transition-all group-hover:scale-110 group-hover:bg-theme-primary/14">
                <FileUp className="h-7 w-7 text-theme-primary/60 group-hover:text-theme-primary transition-colors" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                {preparing ? '正在解析图片…' : '拖拽图片到这里，或点击选择'}
              </p>
              <p className="text-xs text-slate-400 mb-4">支持 JPG、PNG、WebP，单张最大 30MB</p>
              {preparing ? (
                <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
              ) : (
                <Button type="button" className="theme-btn-primary" disabled={preparing}>
                  <Upload className="mr-1.5 h-4 w-4" />
                  选择图片
                </Button>
              )}
            </div>
          )}

          {/* 已选文件列表 */}
          {items.length > 0 && (
            <div className="p-4 space-y-2">
              {/* 工具栏 */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500">
                  共 {items.length} 张图片
                  {pendingCount > 0 && (
                    <span className="ml-1 text-slate-400">（{pendingCount} 待上传）</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy || pendingCount === 0}
                    onClick={() => void handleBatchAiName()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-theme-primary/25 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-primary hover:text-white hover:border-theme-primary hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)] disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    {batchAiNaming ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {batchAiNaming ? '起名中…' : 'AI 批量起名'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || pendingCount === 0}
                    onClick={() => void handleBatchAiTag()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-theme-primary/25 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-primary hover:text-white hover:border-theme-primary hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)] disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    {batchAiTagging ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Hash className="h-3 w-3" />
                    )}
                    {batchAiTagging ? '识别中…' : 'AI 批量识别标签'}
                  </button>
                  {!uploading && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-400 hover:text-slate-600 transition"
                    >
                      继续添加
                    </button>
                  )}
                </div>
              </div>

              {/* 逐项列表 */}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    className={`flex gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                      item.status === 'success'
                        ? 'border-emerald-100 bg-emerald-50'
                        : item.status === 'error'
                          ? 'border-rose-100 bg-rose-50'
                          : item.status === 'running'
                            ? 'border-theme-primary/30 bg-theme-soft/50'
                            : 'border-slate-100 bg-white'
                    }`}
                  >
                    {/* 缩略图 */}
                    <div className="shrink-0 relative h-16 w-16 rounded-lg overflow-hidden ring-1 ring-slate-200">
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {/* 状态覆盖 */}
                      {item.status === 'running' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                      {item.status === 'success' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                          <span className="text-lg">✓</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
                          <span className="text-lg">✗</span>
                        </div>
                      )}
                    </div>

                    {/* 信息区 */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* 标题行 */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateItem(index, { title: e.target.value })}
                          disabled={
                            item.status === 'running' || item.status === 'success' || uploading
                          }
                          placeholder="资源名称"
                          maxLength={100}
                          className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {/* 单项 AI 起名 */}
                        <button
                          type="button"
                          disabled={
                            item.status !== 'pending' || item.aiNaming || uploading || batchAiNaming
                          }
                          onClick={() => void handleAiNameItem(index)}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-theme-primary/20 bg-theme-soft/60 px-2 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-primary hover:text-white hover:border-theme-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          title="AI 起名"
                        >
                          {item.aiNaming ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                        </button>
                        {/* 单项 AI 标签 */}
                        <button
                          type="button"
                          disabled={
                            item.status !== 'pending' ||
                            item.aiTagging ||
                            uploading ||
                            batchAiTagging
                          }
                          onClick={() => void handleAiTagItem(index)}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-theme-primary/20 bg-theme-soft/60 px-2 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-primary hover:text-white hover:border-theme-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          title="AI 识别标签"
                        >
                          {item.aiTagging ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Hash className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {/* 标签行 */}
                      <div className="flex flex-wrap items-center gap-1">
                        {item.aiTagging ? (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> 识别标签中…
                          </span>
                        ) : item.tags.length > 0 ? (
                          <>
                            {item.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="group inline-flex items-center gap-1 rounded-full border border-theme-primary/20 bg-theme-soft/60 px-2 py-0.5 text-xs font-medium text-theme-primary"
                              >
                                <Hash className="h-2.5 w-2.5 opacity-60" />
                                {tag.name}
                                {item.status === 'pending' && !uploading && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItem(index, {
                                        tags: item.tags.filter((t) => t.id !== tag.id),
                                      })
                                    }
                                    className="ml-0.5 rounded-full opacity-50 hover:opacity-100 transition"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">
                            暂无标签，点击 <Hash className="inline h-2.5 w-2.5" /> 按钮识别
                          </span>
                        )}
                      </div>

                      {/* 状态/错误信息 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {formatSize(item.file.size)}
                        </span>
                        {item.status === 'success' && (
                          <span className="text-[10px] font-medium text-emerald-600">
                            ✓ 上传成功
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-[10px] font-medium text-rose-500">
                            ✗ {item.error || '上传失败'}
                          </span>
                        )}
                        {item.status === 'running' && (
                          <span className="text-[10px] text-theme-primary">上传中…</span>
                        )}
                        {item.status === 'error' && !uploading && (
                          <button
                            type="button"
                            onClick={() => void handleRetryItem(index)}
                            className="inline-flex items-center gap-1 rounded-md border border-theme-primary/20 bg-theme-soft/70 px-2 py-0.5 text-[10px] font-medium text-theme-primary transition-all hover:border-theme-primary hover:bg-theme-primary hover:text-white"
                          >
                            <RefreshCw className="h-2.5 w-2.5" />
                            重新上传
                          </button>
                        )}
                        {item.status !== 'running' && item.status !== 'success' && !uploading && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            移除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 完成统计 */}
              {done && (
                <div className="flex gap-3 pt-1 text-xs">
                  {successCount > 0 && (
                    <span className="text-emerald-600">✓ 成功 {successCount} 项</span>
                  )}
                  {errorCount > 0 && <span className="text-rose-500">✗ 失败 {errorCount} 项</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="text-xs text-slate-400">
            {items.length > 0
              ? `${items.length} 张图片 · ${uploadType === 'wallpaper' ? '壁纸' : '头像'} · ${visibility === 'private' ? '私密' : visibility === 'shared' ? '共享' : '公开'}`
              : '选择图片后即可批量上传'}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              className="rounded-xl"
              onClick={() => {
                if (!uploading) {
                  reset();
                  onOpenChange(false);
                }
              }}
            >
              {done ? '关闭' : '取消'}
            </Button>
            {done && errorCount > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                className="rounded-xl"
                onClick={() => void handleBatchUpload({ retryFailedOnly: true })}
              >
                重试失败项
              </Button>
            )}
            {!done && items.length > 0 && (
              <Button
                type="button"
                disabled={isBusy || pendingCount === 0}
                className="rounded-xl theme-btn-primary font-semibold shadow-[0_4px_16px_rgba(var(--theme-primary-rgb),0.28)] disabled:shadow-none transition-all"
                onClick={() => void handleBatchUpload()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    上传中…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    开始批量上传（{pendingCount}）
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 隐藏文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFilesChange(e)}
        />
      </DialogContent>
    </Dialog>
  );
}
