import { Badge } from '@/components/ui/badge';

interface WorkflowOutputFieldListProps {
  outputs: ReadonlyArray<readonly [string, string]>;
  labels?: Record<string, string>;
  descriptions?: Record<string, string>;
}

export function WorkflowOutputFieldList({
  outputs,
  labels = {},
  descriptions = {},
}: WorkflowOutputFieldListProps) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
      {outputs.map(([name, type]) => {
        const label = labels[name] || name;
        const description = descriptions[name];
        return (
          <div key={name} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {description ? `${name} · ${description}` : name}
              </p>
            </div>
            <Badge variant="secondary" className="font-mono">
              {type}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
