import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { cn } from '@/lib/utils';

interface PanelLoadingOverlayProps {
  show: boolean;
  title?: string;
  hint?: string;
  className?: string;
}

export default function PanelLoadingOverlay({
  show,
  title = '正在同步内容...',
  hint = '请稍候，马上就好',
  className,
}: PanelLoadingOverlayProps) {
  return (
    <BoxLoadingOverlay
      show={show}
      title={title}
      hint={hint}
      className={cn('pointer-events-none rounded-[inherit]', className)}
    />
  );
}
