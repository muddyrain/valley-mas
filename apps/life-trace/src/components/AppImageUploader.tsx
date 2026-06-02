import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { uploadLifeTraceImage } from '@/api/upload';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

type AppImageUploaderProps = {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  onUploadingChange?: (uploading: boolean) => void;
  cameraAndLibrary?: boolean;
};

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImageSizeMB = 10;

function formatImageSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export function AppImageUploader({
  value,
  onChange,
  label = '图片',
  description = '支持 JPG、PNG、WebP，最大 10MB。',
  disabled = false,
  className,
  onUploadingChange,
  cameraAndLibrary = false,
}: AppImageUploaderProps) {
  const token = useAuthStore((state) => state.token);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileMeta, setFileMeta] = useState('');

  const updateUploading = (nextUploading: boolean) => {
    setUploading(nextUploading);
    onUploadingChange?.(nextUploading);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!acceptedImageTypes.includes(file.type)) {
      setError('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }

    if (file.size > maxImageSizeMB * 1024 * 1024) {
      setError(`图片不能超过 ${maxImageSizeMB}MB。`);
      return;
    }

    if (!token) {
      setError('请先登录后再上传图片。');
      return;
    }

    updateUploading(true);
    setError('');
    setFileMeta(`${file.name} · ${formatImageSize(file.size)}`);
    try {
      const result = await uploadLifeTraceImage(token, file);
      onChange(result.url);
      setFileMeta(`${result.fileName} · ${formatImageSize(result.size)}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败，请稍后再试。');
    } finally {
      updateUploading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => {
              onChange('');
              setError('');
              setFileMeta('');
            }}
          >
            <Trash2 className="size-4" />
            移除
          </Button>
        ) : null}
      </div>

      {value ? (
        <div className="overflow-hidden rounded-[1.25rem] border border-border bg-secondary">
          <img src={value} alt="已上传图片" className="aspect-video w-full object-cover" />
        </div>
      ) : cameraAndLibrary ? (
        <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border bg-secondary p-4">
          <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <span className="grid size-11 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              {uploading ? <ActionLoadingIcon tone="ai" /> : <ImagePlus className="size-5" />}
            </span>
            <span className="font-semibold text-foreground">
              {uploading ? '正在上传到云端' : '上传生活图片'}
            </span>
            <span className="text-xs">可以直接拍照，或从相册选择。</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ai"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => cameraInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              拍照
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud className="size-4" />
              相册
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-border bg-secondary p-4 text-center text-sm text-muted-foreground transition hover:border-life-ai/40 hover:bg-life-ai/5 disabled:cursor-default disabled:opacity-60"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
            {uploading ? <ActionLoadingIcon tone="ai" /> : <ImagePlus className="size-5" />}
          </span>
          <span className="font-semibold text-foreground">
            {uploading ? '正在上传到云端' : '上传生活图片'}
          </span>
          <span className="text-xs">上传后会自动填入图片地址。</span>
        </button>
      )}

      {value ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <ActionLoadingIcon tone="ai" /> : <UploadCloud className="size-4" />}
          {uploading ? '上传中' : '替换图片'}
        </Button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />
      {cameraAndLibrary ? (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          disabled={disabled || uploading}
          onChange={handleFileChange}
        />
      ) : null}

      {fileMeta ? <p className="text-xs text-muted-foreground">{fileMeta}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
