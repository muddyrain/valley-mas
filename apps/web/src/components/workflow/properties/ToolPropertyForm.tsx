import { useNavigate } from 'react-router-dom';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflowCapabilities } from '../useWorkflowCapabilities';
import { VariableValueEditor } from '../VariableReferencePicker';
import { getWorkflowSideEffectLabel } from '../workflowSideEffects';
import type { PropertyFormProps } from './index';
import { WorkflowOutputFieldList } from './WorkflowOutputFieldList';

const toolOutputPresentations: Record<
  string,
  { order: string[]; labels: Record<string, string>; descriptions?: Record<string, string> }
> = {
  'content.parseMarkdown': {
    order: ['title', 'content', 'excerpt', 'frontMatter', 'cover', 'tagNames'],
    labels: {
      title: '标题',
      content: '正文',
      excerpt: '摘要',
      frontMatter: '前置信息',
      cover: '封面信息',
      tagNames: '标签建议',
    },
  },
  'knowledge.retrieve': {
    order: ['context', 'references'],
    labels: { context: '检索上下文', references: '来源引用' },
  },
  'content.search': {
    order: ['count', 'items'],
    labels: { count: '结果数量', items: '结果列表' },
  },
  'notion.search': {
    order: ['count', 'results'],
    labels: { count: '结果数量', results: 'Notion 结果' },
  },
  'image.generateCover': {
    order: ['imageUrl', 'cover', 'url', 'model', 'size'],
    labels: {
      imageUrl: '图片地址',
      cover: '封面对象',
      url: '图片地址（兼容）',
      model: '生成模型',
      size: '图片尺寸',
    },
    descriptions: {
      imageUrl: '下游节点可直接引用',
      cover: '兼容博客草稿的封面字段',
    },
  },
  'blog.createDraft': {
    order: ['postId', 'title', 'editPath', 'tagIds'],
    labels: {
      postId: '草稿 ID',
      title: '草稿标题',
      editPath: '编辑地址',
      tagIds: '标签 ID',
    },
  },
};

export function ToolPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const navigate = useNavigate();
  const capabilities = useWorkflowCapabilities();
  const capability = capabilities.toolCapabilities.find((item) => item.id === config.capabilityId);
  const inputs = (config.inputs as Record<string, unknown>) || {};
  const sideEffectLabel = getWorkflowSideEffectLabel(capability?.sideEffect);
  if (!capability)
    return (
      <EditorSection title="工具配置" description="该工具能力当前不可用。">
        <p className="text-sm text-destructive">
          无法识别 {String(config.capabilityId || '未配置')}，请删除此节点后重新选择。
        </p>
      </EditorSection>
    );
  const outputPresentation = toolOutputPresentations[capability.id];
  const outputOrder = outputPresentation?.order || [];
  const outputs = Object.entries(capability.outputSchema).sort(([left], [right]) => {
    const leftIndex = outputOrder.indexOf(left);
    const rightIndex = outputOrder.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
  return (
    <div className="space-y-4">
      <EditorSection title={capability.name} description={capability.description}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{capability.id}</Badge>
          {sideEffectLabel ? <Badge variant="secondary">{sideEffectLabel}</Badge> : null}
        </div>
        {capability.id === 'notion.search' ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span>仅搜索已连接工作区中的页面和数据源。</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => navigate('/workbench/resources?tab=tools')}
            >
              管理 Notion 连接
            </Button>
          </div>
        ) : null}
        {Object.entries(capability.inputSchema.properties || {}).map(([name, schema]) => (
          <div key={name} className="space-y-1.5">
            <Label>
              {schema.title || name}
              {capability.inputSchema.required?.includes(name) ? ' *' : ''}
            </Label>
            {schema.description ? (
              <p className="text-xs text-muted-foreground">{schema.description}</p>
            ) : null}
            {schema.type === 'number' ? (
              <Input
                type="number"
                value={String(inputs[name] ?? '')}
                onChange={(event) =>
                  onUpdateConfig({ inputs: { ...inputs, [name]: Number(event.target.value) } })
                }
              />
            ) : (
              <VariableValueEditor
                ariaLabel={`${schema.title || name} 输入值`}
                value={String(inputs[name] ?? '')}
                onChange={(value) => onUpdateConfig({ inputs: { ...inputs, [name]: value } })}
                options={variableOptions}
                fixedPlaceholder={schema.placeholder || `设置 ${schema.title || name}`}
                defaultMode="fixed"
              />
            )}
          </div>
        ))}
      </EditorSection>
      <EditorSection title="输出变量" description="下游节点可直接引用这些字段。">
        <WorkflowOutputFieldList
          outputs={outputs}
          labels={outputPresentation?.labels}
          descriptions={outputPresentation?.descriptions}
        />
      </EditorSection>
    </div>
  );
}
