import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PromptLibraryDialog } from './PromptLibraryDialog';

interface PromptLibraryInsertButtonProps {
  onInsert: (content: string) => void;
  targetLabel?: string;
  showText?: boolean;
  size?: 'default' | 'sm' | 'xs' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  className?: string;
}

// Keeps prompt-library selection behavior reusable across editable workflow fields.
export function PromptLibraryInsertButton({
  onInsert,
  targetLabel = '提示词',
  showText = true,
  size = 'sm',
  variant = 'outline',
  className,
}: PromptLibraryInsertButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
        className={className}
      >
        <BookOpen className={showText ? 'mr-2 size-3.5' : 'size-3.5'} />
        {showText ? '提示词库' : <span className="sr-only">提示词库</span>}
      </Button>
      <PromptLibraryDialog
        open={open}
        onOpenChange={setOpen}
        onInsert={onInsert}
        targetLabel={targetLabel}
      />
    </>
  );
}
