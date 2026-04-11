/**
 * UploadResourceDialog
 * 上传资源弹窗（封面、壁纸、头像等图片资源）
 *
 * 用法：
 *   <UploadResourceDialog
 *     open={uploadOpen}
 *     onOpenChange={setUploadOpen}
 *     onSuccess={() => loadResources()}
 *   />
 */
import { Image as ImageIcon, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type ResourceTag,
  type ResourceVisibility,
  setResourceTags,
  suggestResourceTitle,
  uploadResource,
} from '@/api/resource';
import ResourceTagSelector from '@/components/ResourceTagSelector';
import { Button } from '@/components/ui/button';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const RESOURCE_TYPE_OPTIONS = [
  { value: 'wallpaper' as const, icon: '🖼️', label: '壁纸', desc: '横版大图' },
  { value: 'avatar' as const, icon: '🙂', label: '头像', desc: '方形裁切' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'private' as const, icon: '🔒', label: '私密', desc: '仅自己可见' },
  { value: 'shared' as const, icon: '🔗', label: '共享', desc: '有链接可见' },
  { value: 'public' as const, icon: '🌐', label: '公开', desc: '所有人可见' },
] as const;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── 图片压缩（给 AI 起名用） ─────────────────────────────────────────────────

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
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UploadResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 上传成功后的回调，父组件用来刷新列表等 */
  onSuccess?: () => void;
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

export default function UploadResourceDialog({
  open,
  onOpenChange,
  onSuccess,
}: UploadResourceDialogProps) {
  const [uploadType, setUploadType] = useState<'wallpaper' | 'avatar'>('wallpaper');
  const [uploadVisibility, setUploadVisibility] = useState<ResourceVisibility>('private');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiNaming, setAiNaming] = useState(false);
  const [aiTitles, setAiTitles] = useState<string[]>([]);
  // 标签预选（上传前选好，上传成功后立即绑定）
  const [selectedTags, setSelectedTags] = useState<ResourceTag[]>([]);
  // 压缩后的 base64（AI 起名和 AI 标签共用）
  const [previewBase64, setPreviewBase64] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeConfirmToastIdRef = useRef<string | number | null>(null);
  const closeConfirmTimeoutRef = useRef<number | null>(null);

  const clearCloseConfirmGuard = () => {
    closeConfirmToastIdRef.current = null;
    if (closeConfirmTimeoutRef.current !== null) {
      window.clearTimeout(closeConfirmTimeoutRef.current);
      closeConfirmTimeoutRef.current = null;
    }
  };

  // ── 重置 ────────────────────────────────────────────────────────────────────
  const reset = () => {
    setUploadFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadType('wallpaper');
    setUploadVisibility('private');
    setUploadTitle('');
    setUploadDesc('');
    setAiTitles([]);
    setSelectedTags([]);
    setPreviewBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 文件校验 ────────────────────────────────────────────────────────────────
  const applyFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('仅支持图片文件');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('文件大小不能超过 30MB');
      return;
    }
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    // 同步生成压缩 base64，供 AI 起名和 AI 标签复用
    resizeImageForAI(file, 512)
      .then((b64) => setPreviewBase64(b64))
      .catch(() => {
        /* 静默失败，AI 功能降级为仅文本模式 */
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  // ── AI 起名 ─────────────────────────────────────────────────────────────────
  const handleAiSuggestTitle = async () => {
    if (!uploadFile) {
      toast.error('请先选择图片');
      return;
    }
    try {
      setAiNaming(true);
      setAiTitles([]);
      // 复用已生成的 base64，没有则现场生成
      const base64 = previewBase64 || (await resizeImageForAI(uploadFile, 512));
      const result = await suggestResourceTitle(base64, uploadType);
      if (result.titles && result.titles.length > 0) {
        setAiTitles(result.titles);
        setUploadTitle(result.titles[0]);
        toast.success('AI 已生成名称建议，点击选用');
      } else {
        toast.error('AI 未返回有效名称');
      }
    } catch {
      toast.error('AI 起名失败，请稍后重试');
    } finally {
      setAiNaming(false);
    }
  };

  // ── 提交 ────────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('请先选择文件');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadType);
      formData.append('visibility', uploadVisibility);
      formData.append('title', uploadTitle.trim());
      formData.append('description', uploadDesc.trim());
      const { resource } = await uploadResource(formData);
      // 上传完成后若有预选标签，立即绑定（静默处理失败，不影响上传成功提示）
      if (selectedTags.length > 0 && resource?.id) {
        setResourceTags(
          resource.id,
          selectedTags.map((t) => t.id),
        ).catch(() => {
          /* 静默 */
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onOpenChange(false);
      toast.success('上传成功');
      onSuccess?.();
      await new Promise((resolve) => setTimeout(resolve, 500));
      reset();
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setUploading(false);
    }
  };

  const requestDialogClose = () => {
    if (uploading) return;
    if (closeConfirmToastIdRef.current !== null) return;
    closeConfirmToastIdRef.current = openConfirmToast({
      title: '确认关闭上传弹窗？',
      description: '关闭后，当前已填写的上传信息将不会保留。',
      confirmText: '确认关闭',
      cancelText: '继续编辑',
      onConfirm: () => {
        clearCloseConfirmGuard();
        reset();
        onOpenChange(false);
      },
      onCancel: clearCloseConfirmGuard,
    });
    closeConfirmTimeoutRef.current = window.setTimeout(() => {
      clearCloseConfirmGuard();
    }, 8200);
  };

  // ── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          clearCloseConfirmGuard();
          onOpenChange(true);
          return;
        }
        requestDialogClose();
      }}
    >
      <DialogContent className="flex h-[90vh] w-[90vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* 顶部标题栏 */}
        <div className="shrink-0 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10)_0%,rgba(var(--theme-primary-rgb),0.03)_100%)] px-6 py-4 flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-theme-primary/10 flex items-center justify-center shadow-[0_4px_12px_rgba(var(--theme-primary-rgb),0.18)]">
            <Upload className="h-4.5 w-4.5 text-theme-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-semibold text-slate-900 leading-tight">
              上传新资源
            </DialogTitle>
            <p className="mt-0.5 text-xs text-slate-500">支持壁纸、头像等图片资源，最大 30MB</p>
          </div>
        </div>

        {/* 左右双栏 */}
        <div className="flex min-h-0 flex-1 divide-x divide-slate-100 overflow-hidden">
          {/* ── 左栏：图片拖拽 & 预览 ── */}
          <div className="flex w-[52%] shrink-0 flex-col gap-4 p-6 bg-slate-50/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              图片文件
            </p>

            {/* 拖拽区 */}
            <div
              className={`relative flex-1 min-h-0 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer group overflow-hidden ${
                previewUrl
                  ? 'border-theme-primary'
                  : 'border-slate-200 hover:border-theme-primary bg-white hover:bg-theme-soft/20'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="relative h-full w-full">
                  <img
                    src={previewUrl}
                    alt="预览"
                    className="h-full w-full object-contain rounded-2xl"
                  />
                  {/* 底部信息条 */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between rounded-b-2xl bg-black/50 px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon className="h-3.5 w-3.5 text-white/70 shrink-0" />
                      <span className="text-xs text-white/90 truncate">{uploadFile?.name}</span>
                      <span className="text-xs text-white/50 shrink-0">
                        {formatSize(uploadFile?.size ?? 0)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ml-2 shrink-0 p-1 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {/* 重新选择遮罩 */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow">
                      点击重新选择
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-theme-primary/8 ring-1 ring-theme-primary/12 transition-all group-hover:scale-110 group-hover:bg-theme-primary/14">
                    <Upload className="h-7 w-7 text-theme-primary/60 group-hover:text-theme-primary transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    拖拽图片到这里，或点击选择
                  </p>
                  <p className="text-xs text-slate-400">JPG、PNG、WebP · 最大 30MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* ── 右栏：表单 ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 资源类型 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  资源类型
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOURCE_TYPE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setUploadType(opt.value)}
                      className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition-all duration-150 ${
                        uploadType === opt.value
                          ? 'border-theme-primary bg-theme-soft shadow-[0_0_0_3px_rgba(var(--theme-primary-rgb),0.10)]'
                          : 'border-slate-200 bg-white hover:border-theme-shell-border hover:bg-theme-soft/40'
                      }`}
                    >
                      <span className="text-xl leading-none">{opt.icon}</span>
                      <span
                        className={`text-sm font-semibold leading-none ${uploadType === opt.value ? 'text-theme-primary' : 'text-slate-700'}`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">{opt.desc}</span>
                      {uploadType === opt.value && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-theme-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 可见范围 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  可见范围
                </label>
                <div className="flex flex-col gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setUploadVisibility(opt.value)}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all duration-150 ${
                        uploadVisibility === opt.value
                          ? 'border-theme-primary bg-theme-soft shadow-[0_0_0_3px_rgba(var(--theme-primary-rgb),0.10)]'
                          : 'border-slate-200 bg-white hover:border-theme-shell-border hover:bg-theme-soft/40'
                      }`}
                    >
                      <span className="text-base leading-none">{opt.icon}</span>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold leading-none ${uploadVisibility === opt.value ? 'text-theme-primary' : 'text-slate-700'}`}
                        >
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 资源标题 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    资源标题{' '}
                    <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAiSuggestTitle}
                    disabled={!uploadFile || aiNaming}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] border border-theme-primary/25 px-2.5 py-1 text-xs font-medium text-theme-primary transition-all
                      hover:bg-theme-primary hover:text-white hover:border-theme-primary hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)]
                      disabled:opacity-35 disabled:cursor-not-allowed"
                    title={uploadFile ? 'AI 根据图片内容自动起名' : '请先选择图片'}
                  >
                    {aiNaming ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {aiNaming ? '生成中…' : 'AI 起名'}
                  </button>
                </div>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="给这个资源起个名字，如「蓝色星空壁纸」"
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                />
                {/* AI 建议 chips */}
                {aiTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {aiTitles.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setUploadTitle(t)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                          t === uploadTitle
                            ? 'bg-theme-primary text-white border-theme-primary shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)]'
                            : 'bg-theme-primary/6 border-theme-primary/25 text-theme-primary hover:bg-theme-primary hover:text-white hover:border-theme-primary'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAiTitles([])}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      清除
                    </button>
                  </div>
                )}
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  描述{' '}
                  <span className="normal-case tracking-normal font-normal text-slate-400">
                    （可选）
                  </span>
                </label>
                <textarea
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="简单描述一下这个资源的用途、风格或来源…"
                  maxLength={255}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                />
              </div>

              {/* 标签 */}
              <ResourceTagSelector
                value={selectedTags}
                onChange={setSelectedTags}
                allowCreateTag
                aiPreUpload={{
                  imageBase64: previewBase64,
                  type: uploadType,
                  title: uploadTitle,
                  description: uploadDesc,
                }}
              />
            </div>

            {/* 底部操作栏 */}
            <div className="shrink-0 flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                className="flex-1 rounded-xl"
                disabled={uploading}
              >
                取消
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex-2 rounded-xl theme-btn-primary font-semibold shadow-[0_4px_16px_rgba(var(--theme-primary-rgb),0.28)] disabled:shadow-none transition-all"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    上传中…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    确认上传
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
