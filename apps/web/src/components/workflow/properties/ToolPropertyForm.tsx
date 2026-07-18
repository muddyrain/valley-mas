import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflowCapabilities } from '../useWorkflowCapabilities';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

export function ToolPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const capabilities = useWorkflowCapabilities();
  const capability = capabilities.toolCapabilities.find((item) => item.id === config.capabilityId);
  const inputs = (config.inputs as Record<string, unknown>) || {};
  if (!capability)
    return (
      <EditorSection title="工具配置" description="该工具能力当前不可用。">
        <p className="text-sm text-destructive">
          无法识别 {String(config.capabilityId || '未配置')}，请删除此节点后重新选择。
        </p>
      </EditorSection>
    );
  return (
    <EditorSection title={capability.name} description={capability.description}>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{capability.id}</Badge>
        {capability.sideEffect !== 'none' ? (
          <Badge variant="secondary">
            {capability.sideEffect === 'read'
              ? '只读'
              : capability.sideEffect === 'write'
                ? '写入'
                : 'AI 能力'}
          </Badge>
        ) : null}
      </div>
      {Object.entries(capability.inputSchema.properties || {}).map(([name, schema]) => (
        <div key={name} className="space-y-1.5">
          <Label>
            {schema.title || name}
            {capability.inputSchema.required?.includes(name) ? ' *' : ''}
          </Label>
          {schema.type === 'number' ? (
            <Input
              type="number"
              value={String(inputs[name] ?? '')}
              onChange={(event) =>
                onUpdateConfig({ inputs: { ...inputs, [name]: Number(event.target.value) } })
              }
            />
          ) : (
            <VariableTokenEditor
              value={String(inputs[name] ?? '')}
              onChange={(value) => onUpdateConfig({ inputs: { ...inputs, [name]: value } })}
              options={variableOptions}
              placeholder={`设置 ${name}`}
            />
          )}
        </div>
      ))}
    </EditorSection>
  );
}
