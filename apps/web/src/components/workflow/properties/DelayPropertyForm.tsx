import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PropertyFormProps } from './index';

export function DelayPropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  return (
    <EditorSection title="延时" description="最长等待 5 分钟，取消运行会立即结束等待。">
      <div className="space-y-1.5">
        <Label htmlFor="workflow-delay-ms">等待时间（毫秒）</Label>
        <Input
          id="workflow-delay-ms"
          type="number"
          min={0}
          max={300000}
          step={100}
          value={Number(config.delayMs || 0)}
          onChange={(event) =>
            onUpdateConfig({
              delayMs: Math.max(0, Math.min(300000, Number(event.target.value) || 0)),
            })
          }
        />
      </div>
    </EditorSection>
  );
}
