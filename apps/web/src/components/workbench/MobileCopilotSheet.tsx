import { MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface MobileCopilotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  triggerLabel?: string;
  title?: string;
}

export function MobileCopilotSheet({
  open,
  onOpenChange,
  children,
  triggerLabel = 'AI 协作',
  title = 'AI 协作',
}: MobileCopilotSheetProps) {
  return (
    <>
      <Button
        type="button"
        className="fixed right-4 bottom-4 z-40 gap-2 rounded-full shadow-lg md:hidden"
        onClick={() => onOpenChange(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MessageCircle className="h-4 w-4" />
        {triggerLabel}
      </Button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-none gap-0 p-0 sm:max-w-none"
          showCloseButton
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>与当前草稿协作</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden pt-12">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
