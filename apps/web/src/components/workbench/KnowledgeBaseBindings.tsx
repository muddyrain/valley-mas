import type { AIKnowledgeBase } from '@/api/aiWorkbench';
import { Checkbox } from '@/components/ui/checkbox';

interface KnowledgeBaseBindingsProps {
  knowledgeBases: AIKnowledgeBase[];
  boundKnowledgeBaseIDs: string[];
  disabled?: boolean;
  onChange: (knowledgeBaseIDs: string[]) => void;
}

export function KnowledgeBaseBindings({
  knowledgeBases,
  boundKnowledgeBaseIDs,
  disabled = false,
  onChange,
}: KnowledgeBaseBindingsProps) {
  if (knowledgeBases.length === 0) {
    return <p className="text-sm text-muted-foreground">还没有可绑定的资料库</p>;
  }

  return (
    <div className="space-y-2">
      {knowledgeBases.map((knowledgeBase) => {
        const checked = boundKnowledgeBaseIDs.includes(knowledgeBase.id);
        return (
          <label
            key={knowledgeBase.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl bg-background/70 px-3 py-2.5"
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(nextChecked) => {
                onChange(
                  nextChecked
                    ? [...boundKnowledgeBaseIDs, knowledgeBase.id]
                    : boundKnowledgeBaseIDs.filter((id) => id !== knowledgeBase.id),
                );
              }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{knowledgeBase.name}</span>
              {knowledgeBase.description && (
                <span className="block truncate text-xs text-muted-foreground">
                  {knowledgeBase.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
