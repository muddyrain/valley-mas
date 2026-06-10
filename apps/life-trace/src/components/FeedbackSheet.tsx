import { ImagePlus, MessageSquareText, Send, Trash2 } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { createLifeTraceFeedback } from '@/api/feedback';
import { uploadLifeTraceImage } from '@/api/upload';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, SheetHeader } from '@/components/FormItem';
import { ImagePreview } from '@/components/ImagePreview';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';

type FeedbackSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImageSizeMB = 10;
const maxFeedbackImageCount = 9;
const maxFeedbackContentLength = 2000;

function formatImageSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const token = useAuthStore((state) => state.token);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMeta, setUploadMeta] = useState('');
  const [error, setError] = useState('');

  const busy = uploading || submitting;
  const contentLength = [...content.trim()].length;
  const canAddImage = imageUrls.length < maxFeedbackImageCount;

  const reset = () => {
    setContent('');
    setImageUrls([]);
    setUploadMeta('');
    setError('');
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }
    if (!token) {
      setError('请先登录后再上传图片。');
      return;
    }
    if (imageUrls.length + files.length > maxFeedbackImageCount) {
      setError(`反馈图片最多上传 ${maxFeedbackImageCount} 张。`);
      return;
    }

    const invalidFile = files.find(
      (file) => !acceptedImageTypes.includes(file.type) || file.size > maxImageSizeMB * 1024 * 1024,
    );
    if (invalidFile) {
      setError(`${invalidFile.name} 不符合要求，请上传 10MB 内的 JPG、PNG 或 WebP 图片。`);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const uploadedUrls: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadMeta(`正在上传 ${index + 1}/${files.length}：${file.name}`);
        const result = await uploadLifeTraceImage(token, file);
        uploadedUrls.push(result.url);
        setUploadMeta(`${result.fileName} · ${formatImageSize(result.size)}`);
      }
      setImageUrls((prev) => [...prev, ...uploadedUrls]);
      showToast('图片已上传', 'success');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败，请稍后再试。');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const nextContent = content.trim();
    if (!nextContent) {
      setError('请先写下反馈内容。');
      return;
    }
    if (contentLength > maxFeedbackContentLength) {
      setError(`反馈内容不能超过 ${maxFeedbackContentLength} 个字。`);
      return;
    }
    if (!token) {
      setError('请先登录后再提交反馈。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createLifeTraceFeedback(token, {
        app: 'life-trace',
        content: nextContent,
        imageUrls,
      });
      showToast('反馈已提交，谢谢你帮 Life Trace 变好', 'success');
      reset();
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '反馈提交失败，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) {
          setError('');
        }
        onOpenChange(nextOpen);
      }}
      overlayLabel="关闭问题反馈"
      closeDisabled={busy}
      portal
    >
      <div className="space-y-5">
        <SheetHeader
          title="问题反馈"
          description="告诉我哪里卡住了，截图也可以一起发来。"
          icon={MessageSquareText}
          closeDisabled={busy}
          onClose={() => onOpenChange(false)}
          className="mb-0"
        />

        <FormItem label="反馈内容">
          <Textarea
            value={content}
            disabled={busy}
            maxLength={maxFeedbackContentLength}
            placeholder="比如：某个按钮点了没反应、上传图片失败、提醒时间不对..."
            className="min-h-36 bg-secondary/80 leading-6"
            onChange={(event) => {
              setContent(event.target.value);
              if (error) {
                setError('');
              }
            }}
          />
          <span
            className={cn(
              'block text-right text-xs',
              contentLength > maxFeedbackContentLength
                ? 'text-life-alert'
                : 'text-muted-foreground',
            )}
          >
            {contentLength}/{maxFeedbackContentLength}
          </span>
        </FormItem>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">反馈图片</p>
              <p className="mt-1 text-xs text-muted-foreground">支持 JPG、PNG、WebP，最多 9 张。</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !canAddImage}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <ActionLoadingIcon tone="ai" /> : <ImagePlus className="size-4" />}
              {uploading ? '上传中' : '添加图片'}
            </Button>
          </div>

          {imageUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url) => (
                <div
                  key={url}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-secondary"
                >
                  <ImagePreview
                    src={url}
                    alt="反馈截图"
                    title="反馈截图"
                    imageClassName="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-background/80 text-foreground opacity-90 backdrop-blur transition hover:bg-background"
                    disabled={busy}
                    aria-label="移除反馈图片"
                    onClick={() => setImageUrls((prev) => prev.filter((item) => item !== url))}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-border bg-secondary/70 p-4 text-sm text-muted-foreground transition hover:border-life-ai/40 hover:bg-life-ai/5 disabled:cursor-default disabled:opacity-60"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-5 text-life-ai" />
              上传截图或照片
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={busy || !canAddImage}
            onChange={handleUpload}
          />
          {uploadMeta ? <p className="text-xs text-muted-foreground">{uploadMeta}</p> : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-life-alert/25 bg-life-alert/10 px-4 py-3 text-sm text-life-alert">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          variant="ai"
          className="h-12 w-full rounded-2xl"
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          {submitting ? <ActionLoadingIcon tone="ai" /> : <Send className="size-4" />}
          {submitting ? '提交中' : '提交反馈'}
        </Button>
      </div>
    </BottomSheet>
  );
}
