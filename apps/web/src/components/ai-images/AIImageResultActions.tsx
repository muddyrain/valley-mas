import { Download, RefreshCw, Save, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIImageResultActionsProps {
  onRegenerate: () => void;
  onDownload: () => void;
  onContinueEdit: () => void;
  onSave: () => void;
  regenerating?: boolean;
  saving?: boolean;
  saved?: boolean;
  className?: string;
}

export function AIImageResultActions({
  onRegenerate,
  onDownload,
  onContinueEdit,
  onSave,
  regenerating = false,
  saving = false,
  saved = false,
  className,
}: AIImageResultActionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={onRegenerate}
        disabled={regenerating}
      >
        <RefreshCw className={cn(regenerating && 'animate-spin')} />
        {regenerating ? '生成中' : '重新生成'}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onDownload}>
        <Download />
        下载
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onContinueEdit}>
        <WandSparkles />
        继续编辑
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onSave} disabled={saved || saving}>
        <Save />
        {saved ? '已保存' : saving ? '保存中' : '保存资源'}
      </Button>
    </div>
  );
}
