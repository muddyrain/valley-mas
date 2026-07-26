import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ErrorHandlingPropertyFormProps {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  retryAllowed: boolean;
}

export function ErrorHandlingPropertyForm({
  value,
  onChange,
  retryAllowed,
}: ErrorHandlingPropertyFormProps) {
  const policy = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const retryCount = retryAllowed ? Number(policy.retryCount || 0) : 0;
  const retryDelayMs = Number(policy.retryDelayMs || 0);
  const strategy = policy.strategy === 'continue' ? 'continue' : 'fail';
  const update = (changes: Record<string, unknown>) =>
    onChange({
      retryCount,
      retryDelayMs,
      strategy,
      ...changes,
    });

  return (
    <EditorSection
      title="重试与错误处理"
      description="节点失败时可有限重试，或输出错误信息后继续执行下游节点。"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="workflow-retry-count">重试次数</Label>
          <Input
            id="workflow-retry-count"
            type="number"
            min={0}
            max={3}
            disabled={!retryAllowed}
            value={retryCount}
            onChange={(event) =>
              update({
                retryCount: retryAllowed
                  ? Math.max(0, Math.min(3, Number(event.target.value) || 0))
                  : 0,
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workflow-retry-delay">重试间隔（毫秒）</Label>
          <Input
            id="workflow-retry-delay"
            type="number"
            min={0}
            max={5000}
            step={100}
            disabled={!retryAllowed || retryCount === 0}
            value={retryDelayMs}
            onChange={(event) =>
              update({
                retryDelayMs: Math.max(0, Math.min(5000, Number(event.target.value) || 0)),
              })
            }
          />
        </div>
      </div>
      {!retryAllowed ? (
        <p className="text-xs text-muted-foreground">
          该节点可能写入数据、保存图片或自行重试，不能自动重放。
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label>最终失败后</Label>
        <Select value={strategy} onValueChange={(next) => update({ strategy: next })}>
          <SelectTrigger aria-label="最终失败处理方式">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fail">终止工作流</SelectItem>
            <SelectItem value="continue">记录错误并继续</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        配置后可引用 _failed、_error、_errorCode 和 _attempts。
      </p>
    </EditorSection>
  );
}
