import {
  Braces,
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  Globe2,
  type LucideIcon,
  Tags,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { WorkflowStartInputControl } from '../types';

interface StartInputControlPickerProps {
  value: WorkflowStartInputControl;
  onValueChange: (value: WorkflowStartInputControl) => void;
  compact?: boolean;
}

interface InputControlOption {
  value: WorkflowStartInputControl;
  label: string;
  description: string;
  icon: LucideIcon;
  preset?: boolean;
}

const inputControls: InputControlOption[] = [
  {
    value: 'default',
    label: '普通变量',
    description: '由调用方填写任意声明类型的值。',
    icon: Braces,
  },
  {
    value: 'markdown_file',
    label: 'Markdown 文件',
    description: '试运行时选择 Markdown 文件。',
    icon: FileText,
    preset: true,
  },
  {
    value: 'blog_tags',
    label: '博客标签',
    description: '从公共博客标签中多选。',
    icon: Tags,
    preset: true,
  },
  {
    value: 'blog_group',
    label: '博客分组',
    description: '从公共博客分组中选择一项。',
    icon: FolderOpen,
    preset: true,
  },
  {
    value: 'visibility',
    label: '可见范围',
    description: '在试运行时选择内容可见性。',
    icon: Globe2,
    preset: true,
  },
];

export function StartInputControlPicker({
  value,
  onValueChange,
  compact = false,
}: StartInputControlPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = inputControls.find((control) => control.value === value) || inputControls[0];
  const SelectedIcon = selected.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'rounded-lg border-dashed text-xs shadow-none transition-colors',
              compact ? 'size-8 p-0' : 'h-8 gap-1.5 px-2',
              selected.preset
                ? 'border-primary/35 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label={`选择 ${selected.label} 输入控件`}
          >
            <SelectedIcon className="size-3.5" />
            {!compact ? <span>{selected.label}</span> : null}
            {!compact ? <ChevronDown className="size-3.5 opacity-70" /> : null}
          </Button>
        }
      />
      {open ? (
        <PopoverContent
          align="start"
          className="w-[min(20rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl! border border-border p-0 shadow-md"
        >
          <PopoverHeader className="border-b border-border bg-muted/30 px-4 py-3">
            <PopoverTitle>选择输入控件</PopoverTitle>
            <PopoverDescription>预设控件会在试运行中提供对应的选择方式。</PopoverDescription>
          </PopoverHeader>
          <div className="p-1.5">
            {inputControls.map((control) => {
              const Icon = control.icon;
              const selectedControl = control.value === value;
              return (
                <button
                  key={control.value}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    'hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                    selectedControl && 'bg-primary/5',
                  )}
                  onClick={() => {
                    onValueChange(control.value);
                    setOpen(false);
                  }}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
                      control.preset && 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {control.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {control.description}
                    </span>
                  </span>
                  {selectedControl ? <Check className="size-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
