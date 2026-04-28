import { FileStack, FileUp, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createPost,
  type Group,
  uploadBlogCover,
  uploadBlogCoverByUrl,
  type Visibility,
} from '@/api/blog';
import type { Resource } from '@/api/resource';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createAutoExcerpt, parseMarkdownImport } from '@/utils/blogImport';
import { PublicWallpaperPickerDialog } from './PublicWallpaperPickerDialog';

type BatchMarkdownItem = {
  fileName: string;
  title: string;
  content: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  applyCover?: boolean;
  cover?: string;
  coverStorageKey?: string;
  coverUploading?: boolean;
};

export interface BatchMarkdownImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  defaultGroupId?: string;
  defaultVisibility?: Visibility;
  onCreated?: (result: { successCount: number; errorCount: number }) => void | Promise<void>;
}

function getErrorText(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallback;
  }
  return fallback;
}

export function BatchMarkdownImportDialog({
  open,
  onOpenChange,
  groups,
  defaultGroupId = '',
  defaultVisibility = 'private',
  onCreated,
}: BatchMarkdownImportDialogProps) {
  const [batchPreparing, setBatchPreparing] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchMarkdownItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchGroupId, setBatchGroupId] = useState(defaultGroupId);
  const [batchVisibility, setBatchVisibility] = useState<Visibility>(defaultVisibility);
  const [batchCoverTargetIndex, setBatchCoverTargetIndex] = useState<number | null>(null);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const markdownBatchInputRef = useRef<HTMLInputElement | null>(null);
  const batchCoverUploadInputRef = useRef<HTMLInputElement | null>(null);

  const resetDialogState = () => {
    setBatchPreparing(false);
    setBatchItems([]);
    setBatchRunning(false);
    setBatchDone(false);
    setBatchCoverTargetIndex(null);
    setWallpaperPickerOpen(false);
    if (markdownBatchInputRef.current) {
      markdownBatchInputRef.current.value = '';
    }
    if (batchCoverUploadInputRef.current) {
      batchCoverUploadInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!open) {
      resetDialogState();
      return;
    }

    resetDialogState();
    setBatchGroupId(defaultGroupId);
    setBatchVisibility(defaultVisibility);
  }, [defaultGroupId, defaultVisibility, open]);

  const batchHasUploadedFiles = batchItems.length > 0;
  const currentBatchGroupName = useMemo(
    () => groups.find((item) => item.id === batchGroupId)?.name || '',
    [groups, batchGroupId],
  );

  const handleBatchSelectMarkdown = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      setBatchPreparing(true);
      const parsedItems = await Promise.all(
        files.map(async (file): Promise<BatchMarkdownItem> => {
          try {
            const rawText = await file.text();
            const parsed = parseMarkdownImport(file.name, rawText);
            if (!parsed.content.trim()) {
              return {
                fileName: file.name,
                title: parsed.title,
                content: '',
                status: 'error',
                error: '正文为空，已跳过',
              };
            }
            return {
              fileName: file.name,
              title: parsed.title.trim() || '未命名博客',
              content: parsed.content,
              status: 'pending',
            };
          } catch {
            return {
              fileName: file.name,
              title: file.name.replace(/\.[^.]+$/, '') || '未命名博客',
              content: '',
              status: 'error',
              error: '文件读取失败',
            };
          }
        }),
      );

      let totalCount = parsedItems.length;
      setBatchItems((prev) => {
        const next = [...prev, ...parsedItems];
        totalCount = next.length;
        return next;
      });
      toast.success(`本次识别 ${parsedItems.length} 篇，当前共 ${totalCount} 篇`);
      setBatchDone(false);
    } catch {
      toast.error('批量读取 MD 失败，请稍后重试');
    } finally {
      setBatchPreparing(false);
      event.target.value = '';
    }
  };

  const handleBatchTitleChange = (index: number, value: string) => {
    setBatchItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              title: value,
              status:
                item.status === 'success'
                  ? item.status
                  : item.content.trim()
                    ? 'pending'
                    : item.status,
              error: item.status === 'success' || !item.content.trim() ? item.error : undefined,
            }
          : item,
      ),
    );
  };

  const handleBatchImport = async (options?: { retryFailedOnly?: boolean }) => {
    const retryFailedOnly = options?.retryFailedOnly ?? false;
    const results = [...batchItems];
    const runnableIndexes = results
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (retryFailedOnly ? item.status === 'error' : item.status === 'pending'))
      .map(({ index }) => index);

    if (!runnableIndexes.length) {
      toast.error(retryFailedOnly ? '没有可重试的失败项' : '没有可创建的博客，请检查导入结果');
      return;
    }
    const invalidTitleIndex = runnableIndexes.find((index) => !results[index].title.trim());
    if (invalidTitleIndex !== undefined) {
      toast.error(`请先填写标题：${results[invalidTitleIndex].fileName}`);
      return;
    }
    const missingCoverIndexes = runnableIndexes.filter((index) => {
      const item = results[index];
      return Boolean(item.applyCover) && !item.cover;
    });
    if (missingCoverIndexes.length > 0) {
      toast.error('有已勾选封面的博客尚未选择图片，请先上传或选择资源壁纸');
      return;
    }

    try {
      setBatchRunning(true);
      setBatchDone(false);

      for (const index of runnableIndexes) {
        const item = results[index];
        results[index] = { ...item, status: 'running', error: undefined };
        setBatchItems([...results]);
        try {
          let resolvedItem = results[index];
          if (
            resolvedItem.applyCover &&
            resolvedItem.cover &&
            !resolvedItem.coverStorageKey &&
            !resolvedItem.coverUploading
          ) {
            results[index] = { ...resolvedItem, coverUploading: true, error: undefined };
            setBatchItems([...results]);

            const coverResult = await uploadBlogCoverByUrl({ url: resolvedItem.cover });
            resolvedItem = {
              ...resolvedItem,
              cover: coverResult.url,
              coverStorageKey: coverResult.storageKey,
              coverUploading: false,
            };
            results[index] = resolvedItem;
            setBatchItems([...results]);
          }

          await createPost({
            title: resolvedItem.title.trim(),
            postType: 'blog',
            content: resolvedItem.content,
            excerpt: createAutoExcerpt('', resolvedItem.content),
            groupId: batchGroupId || undefined,
            visibility: batchVisibility,
            cover: resolvedItem.applyCover ? resolvedItem.cover : undefined,
            coverStorageKey: resolvedItem.applyCover ? resolvedItem.coverStorageKey : undefined,
            status: 'published',
            publishNow: true,
          });
          results[index] = { ...resolvedItem, status: 'success', error: undefined };
        } catch (error) {
          results[index] = {
            ...results[index],
            status: 'error',
            coverUploading: false,
            error: getErrorText(error, '创建失败，请稍后重试'),
          };
        }
        setBatchItems([...results]);
      }

      setBatchDone(true);
      const successCount = results.filter((item) => item.status === 'success').length;
      const errorCount = results.filter((item) => item.status === 'error').length;
      if (successCount > 0) {
        toast.success(
          `批量创建完成：成功 ${successCount} 篇${errorCount ? `，失败 ${errorCount} 篇` : ''}`,
        );
        await onCreated?.({ successCount, errorCount });
      } else {
        toast.error('批量创建失败，请检查结果后重试');
      }
    } finally {
      setBatchRunning(false);
    }
  };

  const handleRemoveBatchItem = (index: number) => {
    if (batchRunning) return;
    const target = batchItems[index];
    if (!target || target.status === 'running' || target.status === 'success') return;
    const next = batchItems.filter((_, itemIndex) => itemIndex !== index);
    setBatchItems(next);
    if (next.length === 0) {
      setBatchDone(false);
    }
  };

  const handleBatchCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const index = batchCoverTargetIndex;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (index === null || !file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('封面仅支持图片');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('封面大小不能超过 30MB');
      return;
    }

    setBatchItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, coverUploading: true, applyCover: true } : item,
      ),
    );

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadBlogCover(formData);
      setBatchItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                applyCover: true,
                cover: result.url,
                coverStorageKey: result.storageKey,
                coverUploading: false,
              }
            : item,
        ),
      );
      toast.success('博客封面已上传');
    } catch {
      setBatchItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index ? { ...item, coverUploading: false } : item,
        ),
      );
      toast.error('封面上传失败，请重试');
    } finally {
      setBatchCoverTargetIndex(null);
    }
  };

  const handleBatchCoverToggle = (index: number, checked: boolean) => {
    setBatchItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, applyCover: checked } : item,
      ),
    );
  };

  const handleSelectPublicWallpaperCover = (resource: Resource) => {
    if (batchCoverTargetIndex === null) return;

    const selectedUrl = (resource.url || '').trim();
    const targetIndex = batchCoverTargetIndex;
    setBatchItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === targetIndex
          ? {
              ...item,
              applyCover: true,
              cover: selectedUrl,
              coverStorageKey: '',
              coverUploading: false,
            }
          : item,
      ),
    );
    setBatchCoverTargetIndex(null);
    setWallpaperPickerOpen(false);
    toast.success('已为该博客选择资源壁纸');
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (batchRunning) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetDialogState();
    }
  };

  const handleDirectClose = () => {
    if (batchRunning) return;
    onOpenChange(false);
    resetDialogState();
  };

  return (
    <>
      <PublicWallpaperPickerDialog
        open={wallpaperPickerOpen}
        onOpenChange={(nextOpen) => {
          if (batchRunning) return;
          setWallpaperPickerOpen(nextOpen);
          if (!nextOpen) {
            setBatchCoverTargetIndex(null);
          }
        }}
        currentCoverUrl={
          batchCoverTargetIndex !== null ? batchItems[batchCoverTargetIndex]?.cover || '' : ''
        }
        onSelect={handleSelectPublicWallpaperCover}
      />

      <Dialog open={open} onOpenChange={handleDialogOpenChange} disablePointerDismissal>
        <DialogContent className="w-[96vw] max-w-[96vw] overflow-hidden lg:max-w-[1320px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="text-theme-primary h-4 w-4" />
              批量导入博客 MD
            </DialogTitle>
            <DialogDescription>
              默认使用文件名作为标题，正文会完整保留；你也可以在创建前自由修改每篇标题。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-2xl border border-theme-primary/20 bg-theme-soft/60 p-3.5">
              <div className="mb-2 text-xs font-medium text-theme-primary">批量发布设置</div>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.85fr)]">
                <div className="rounded-2xl border border-theme-panel-border bg-white/70 p-3">
                  <div className="mb-1.5 text-xs text-slate-500">目标分组</div>
                  <div className="border-theme-panel-border bg-theme-soft/45 flex min-h-24 max-h-36 flex-wrap content-start gap-2 overflow-y-auto rounded-xl border p-2.5">
                    <button
                      type="button"
                      onClick={() => setBatchGroupId('')}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        !batchGroupId
                          ? 'bg-theme-primary text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      未分组
                    </button>
                    {groups.map((item) => (
                      <button
                        type="button"
                        key={`batch-${item.id}`}
                        onClick={() => setBatchGroupId(item.id)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          batchGroupId === item.id
                            ? 'bg-theme-primary text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-theme-panel-border bg-white/70 p-3">
                  <div className="mb-1.5 text-xs text-slate-500">可见范围</div>
                  <div className="border-theme-panel-border bg-theme-soft/45 flex min-h-24 flex-wrap content-start gap-2 rounded-xl border p-2.5">
                    {[
                      { label: '私密', value: 'private' as const },
                      { label: '共享', value: 'shared' as const },
                      { label: '公开', value: 'public' as const },
                    ].map((item) => (
                      <button
                        type="button"
                        key={`batch-visibility-${item.value}`}
                        onClick={() => setBatchVisibility(item.value)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          batchVisibility === item.value
                            ? 'bg-theme-primary text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-white/65 px-3 py-2 text-xs text-slate-500">
                当前将发布到：{currentBatchGroupName || '未分组'}，
                {batchVisibility === 'public'
                  ? '公开'
                  : batchVisibility === 'shared'
                    ? '共享'
                    : '私密'}
              </p>
            </div>

            {!batchHasUploadedFiles && (
              <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-theme-primary/35 bg-theme-soft/35 px-6 text-center">
                <FileUp className="text-theme-primary mb-3 h-10 w-10" />
                <p className="mb-1 text-sm font-medium text-slate-700">上传 Markdown 文件</p>
                <p className="mb-4 text-xs text-slate-500">
                  支持一次导入多个 `.md` 文件，默认用文件名作标题并完整保留正文。
                </p>
                <Button
                  type="button"
                  className="theme-btn-primary"
                  onClick={() => markdownBatchInputRef.current?.click()}
                  disabled={batchPreparing || batchRunning}
                >
                  {batchPreparing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      识别中…
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-1.5 h-4 w-4" />
                      上传文件
                    </>
                  )}
                </Button>
              </div>
            )}

            {batchHasUploadedFiles && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    识别结果（共 {batchItems.length} 篇）
                  </label>
                  {!batchRunning && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 transition hover:text-slate-600"
                      onClick={() => markdownBatchInputRef.current?.click()}
                    >
                      上传文件
                    </button>
                  )}
                </div>
                <div className="max-h-84 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                  {batchItems.map((item, index) => (
                    <div
                      key={`${item.fileName}-${index}`}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        item.status === 'success'
                          ? 'border-emerald-100 bg-emerald-50'
                          : item.status === 'error'
                            ? 'border-rose-100 bg-rose-50'
                            : item.status === 'running'
                              ? 'border-theme-primary/30 bg-theme-soft/50'
                              : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {item.status === 'running' ? (
                            <Loader2 className="text-theme-primary h-3.5 w-3.5 animate-spin" />
                          ) : item.status === 'success' ? (
                            <span className="inline-block h-3.5 w-3.5 rounded-full bg-emerald-500" />
                          ) : item.status === 'error' ? (
                            <span className="inline-block h-3.5 w-3.5 rounded-full bg-rose-500" />
                          ) : (
                            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <Input
                                value={item.title}
                                onChange={(event) =>
                                  handleBatchTitleChange(index, event.target.value)
                                }
                                placeholder="请输入博客标题"
                                disabled={batchRunning || item.status === 'running'}
                                className="h-9 rounded-xl border-theme-primary/20 bg-white"
                              />
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span className="truncate">文件名：{item.fileName}</span>
                                <span>正文 {item.content.trim().length} 字符</span>
                              </div>
                            </div>
                            {!batchRunning && item.status !== 'success' && (
                              <button
                                type="button"
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                onClick={() => handleRemoveBatchItem(index)}
                                aria-label={`移除 ${item.fileName}`}
                                title="移除此条"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {item.error || item.content.slice(0, 120) || '未识别到正文内容'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(item.applyCover)}
                                onChange={(event) =>
                                  handleBatchCoverToggle(index, event.target.checked)
                                }
                                disabled={
                                  batchRunning ||
                                  item.status === 'running' ||
                                  item.status === 'success'
                                }
                              />
                              设置封面
                            </label>
                            {item.applyCover && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-xs"
                                  disabled={
                                    batchRunning || item.coverUploading || item.status === 'success'
                                  }
                                  onClick={() => {
                                    setBatchCoverTargetIndex(index);
                                    batchCoverUploadInputRef.current?.click();
                                  }}
                                >
                                  {item.coverUploading ? (
                                    <>
                                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      上传中
                                    </>
                                  ) : (
                                    '上传图片'
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-xs"
                                  disabled={
                                    batchRunning || item.coverUploading || item.status === 'success'
                                  }
                                  onClick={() => {
                                    setBatchCoverTargetIndex(index);
                                    setWallpaperPickerOpen(true);
                                  }}
                                >
                                  选择资源壁纸
                                </Button>
                                <span className="text-slate-400">
                                  {item.cover ? '已设置封面' : '尚未选择图片'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {batchDone && (
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600">
                      成功 {batchItems.filter((item) => item.status === 'success').length}
                    </span>
                    {batchItems.filter((item) => item.status === 'error').length > 0 && (
                      <span className="text-rose-500">
                        失败 {batchItems.filter((item) => item.status === 'error').length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={batchRunning}
                onClick={handleDirectClose}
              >
                {batchDone ? '关闭' : '取消'}
              </Button>
              {batchDone && batchItems.some((item) => item.status === 'error') && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={batchRunning}
                  onClick={() => void handleBatchImport({ retryFailedOnly: true })}
                >
                  重试失败项
                </Button>
              )}
              {!batchDone && batchHasUploadedFiles && (
                <Button
                  type="button"
                  className="theme-btn-primary"
                  disabled={batchRunning || batchItems.every((item) => item.status !== 'pending')}
                  onClick={() => void handleBatchImport()}
                >
                  {batchRunning ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      创建中…
                    </>
                  ) : (
                    <>
                      <FileStack className="mr-1.5 h-4 w-4" />
                      确认创建
                    </>
                  )}
                </Button>
              )}
            </div>

            <input
              ref={markdownBatchInputRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              multiple
              className="hidden"
              onChange={(event) => void handleBatchSelectMarkdown(event)}
            />
            <input
              ref={batchCoverUploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleBatchCoverUpload(event)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
