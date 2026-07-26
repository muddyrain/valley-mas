import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PropertyFormProps } from './index';

export function ApprovalPropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  return (
    <EditorSection title="人工审批" description="运行会暂停，所有者处理后从冻结版本继续。">
      <div className="space-y-1.5">
        <Label htmlFor="workflow-approval-title">审批标题</Label>
        <Input
          id="workflow-approval-title"
          value={String(config.title || '')}
          onChange={(event) => onUpdateConfig({ title: event.target.value })}
          placeholder="例如：确认创建内容草稿"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workflow-approval-description">说明</Label>
        <Textarea
          id="workflow-approval-description"
          value={String(config.description || '')}
          onChange={(event) => onUpdateConfig({ description: event.target.value })}
          placeholder="说明批准后会执行的操作"
          rows={4}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        为避免恢复时重放上游操作，审批节点必须是开始后的第一步，且工作流不能声明运行输入。
      </p>
    </EditorSection>
  );
}
