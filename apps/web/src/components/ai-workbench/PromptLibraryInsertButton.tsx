import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PromptLibraryDialog } from './PromptLibraryDialog';

interface PromptLibraryInsertButtonProps {
  onInsert: (content: string) => void;
  targetLabel?: string;
}

// Keeps prompt-library selection behavior reusable across editable workflow fields.
export function PromptLibraryInsertButton({
  onInsert,
  targetLabel = '提示词',
}: PromptLibraryInsertButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BookOpen className="mr-2 size-3.5" />
        提示词库
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
