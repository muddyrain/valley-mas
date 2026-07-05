import { Check, ChevronDown } from 'lucide-react';
import type { Group } from '@/api/blog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PostGroupDropdownProps {
  groups: Group[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}

export default function PostGroupDropdown({
  groups,
  value,
  onChange,
  allLabel,
  placeholder = '选择分组',
  disabled = false,
  triggerClassName,
  contentClassName,
}: PostGroupDropdownProps) {
  const selectedLabel = value
    ? groups.find((group) => group.id === value)?.name || placeholder
    : allLabel || placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-border bg-card/92 px-4 text-sm font-medium text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:border-primary/35 hover:bg-accent/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName,
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={cn(
          'w-[min(20rem,calc(100vw-2rem))] min-w-[16rem] rounded-[22px] border border-border bg-card/96 p-2 shadow-[0_22px_56px_rgba(15,23,42,0.14)] backdrop-blur-xl',
          contentClassName,
        )}
      >
        {allLabel ? (
          <DropdownMenuItem
            onClick={() => onChange('')}
            className={cn(
              'rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition',
              value === '' ? 'bg-accent text-primary' : 'hover:bg-accent/55 hover:text-primary',
            )}
          >
            <span className="mr-2 inline-flex w-4 justify-center">
              {value === '' ? <Check className="h-4 w-4" /> : null}
            </span>
            <span className="truncate">{allLabel}</span>
          </DropdownMenuItem>
        ) : null}

        {groups.map((group) => {
          const selected = group.id === value;
          return (
            <DropdownMenuItem
              key={group.id}
              onClick={() => onChange(group.id)}
              className={cn(
                'rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition',
                selected ? 'bg-accent text-primary' : 'hover:bg-accent/55 hover:text-primary',
              )}
            >
              <span className="mr-2 inline-flex w-4 justify-center">
                {selected ? <Check className="h-4 w-4" /> : null}
              </span>
              <span className="truncate">{group.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
