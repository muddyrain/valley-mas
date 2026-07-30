import { useNavigate } from 'react-router-dom';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { PromptLibraryInsertButton } from '@/components/ai-workbench/PromptLibraryInsertButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toWorkflowValueType } from '../TypedVariableValueEditor';
import { useWorkflowCapabilities } from '../useWorkflowCapabilities';
import { WorkflowVariableBindingField } from '../WorkflowVariableBindingField';
import { getWorkflowSideEffectLabel } from '../workflowSideEffects';
import type { PropertyFormProps } from './index';
import { WorkflowIOField } from './WorkflowIOField';
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
  'content.extractDocument': {
    order: ['text', 'pages', 'format', 'pageCount', 'characterCount'],
    labels: {
      text: '文档正文',
      pages: '分页文本',
      format: '文档格式',
      pageCount: '页数',
      characterCount: '字符数',
    },
  },
  'content.extractStructured': {
    order: ['data', 'model', 'tokenUsage'],
    labels: {
      data: '提取数据',
      model: '文本模型',
      tokenUsage: 'Token 用量',
    },
  },
  'knowledge.retrieve': {
    order: ['context', 'references'],
    labels: { context: '检索上下文', references: '来源引用' },
  },
  'knowledge.formatReferences': {
    order: ['citationText', 'referenceList', 'count'],
    labels: {
      citationText: '引用文本',
      referenceList: '结构化引用',
      count: '引用数量',
    },
  },
  'data.parseJSON': {
    order: ['value'],
    labels: { value: 'JSON 对象' },
  },
  'data.chunkList': {
    order: ['batches', 'batchCount', 'itemCount'],
    labels: {
      batches: '批次数组',
      batchCount: '批次数',
      itemCount: '项目数',
    },
    descriptions: {
      batches: '交给循环节点逐批处理',
    },
  },
  'data.processList': {
    order: ['items', 'count', 'originalCount'],
    labels: {
      items: '处理结果',
      count: '结果数量',
      originalCount: '原始数量',
    },
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
      cover: '封面地址',
      url: '图片地址（兼容）',
      model: '生成模型',
      size: '图片尺寸',
    },
    descriptions: {
      imageUrl: '下游节点可直接引用',
      cover: '可直接绑定到博客草稿的封面地址',
    },
  },
  'image.generate': {
    order: ['generationId', 'imageUrl', 'url', 'width', 'height', 'model', 'size'],
    labels: {
      generationId: '生成记录 ID',
      imageUrl: '图片地址',
      url: '图片地址（兼容）',
      width: '实际宽度',
      height: '实际高度',
      model: '生成模型',
      size: '请求尺寸',
    },
  },
  'image.understand': {
    order: ['text', 'model', 'tokenUsage'],
    labels: {
      text: '理解结果',
      model: '视觉模型',
      tokenUsage: 'Token 用量',
    },
  },
  'image.saveGeneratedResource': {
    order: ['resourceId', 'title', 'tags', 'url', 'visibility', 'model'],
    labels: {
      resourceId: '资源 ID',
      title: '资源标题',
      tags: '资源标签',
      url: '图片地址',
      visibility: '可见范围',
      model: '识别模型',
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
  'notification.send': {
    order: ['notificationId', 'delivered', 'status', 'path'],
    labels: {
      notificationId: '通知 ID',
      delivered: '发送成功',
      status: '通知状态',
      path: '站内跳转',
    },
  },
};

const toolEnumLabels: Record<string, Record<string, Record<string, string>>> = {
  'data.processList': {
    operation: {
      filter: '筛选',
      map: '字段映射',
      sort: '排序',
      dedupe: '去重',
    },
    operator: {
      equals: '等于',
      notEquals: '不等于',
      contains: '包含',
      greaterThan: '大于',
      greaterOrEqual: '大于等于',
      lessThan: '小于',
      lessOrEqual: '小于等于',
      isEmpty: '为空',
      notEmpty: '不为空',
    },
    direction: {
      asc: '升序',
      desc: '降序',
    },
  },
  'notification.send': {
    status: {
      info: '普通提醒',
      success: '成功',
      error: '失败',
      waiting_approval: '等待审批',
    },
  },
};

const listOperationFields: Record<string, string[]> = {
  filter: ['items', 'operation', 'field', 'operator', 'value'],
  map: ['items', 'operation', 'field'],
  sort: ['items', 'operation', 'field', 'direction'],
  dedupe: ['items', 'operation', 'field'],
};

const toolInputOrders: Record<string, string[]> = {
  'notification.send': ['status', 'title', 'content', 'path'],
};

function ToolPropertyFormLoadingSkeleton() {
  return (
    <EditorSection title="工具配置">
      <div className="space-y-4" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </EditorSection>
  );
}

export function ToolPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
  fieldErrors = {},
}: PropertyFormProps) {
  const navigate = useNavigate();
  const capabilities = useWorkflowCapabilities();
  const capability = capabilities.toolCapabilities.find((item) => item.id === config.capabilityId);
  const inputs = (config.inputs as Record<string, unknown>) || {};
  const sideEffectLabel = getWorkflowSideEffectLabel(capability?.sideEffect);

  if (capabilities.loading) return <ToolPropertyFormLoadingSkeleton />;

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
  const inputPropertyMap = capability.inputSchema.properties || {};
  const inputProperties = Object.entries(inputPropertyMap);
  const listOperation = String(inputs.operation || 'filter');
  const visibleInputProperties =
    capability.id === 'data.processList'
      ? (listOperationFields[listOperation] || listOperationFields.filter).flatMap((name) => {
          const schema = inputPropertyMap[name];
          return schema ? ([[name, schema]] as const) : [];
        })
      : toolInputOrders[capability.id]
        ? toolInputOrders[capability.id].flatMap((name) => {
            const schema = inputPropertyMap[name];
            return schema ? ([[name, schema]] as const) : [];
          })
        : inputProperties;
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
      <EditorSection title="输入" description={capability.description}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{capability.name}</Badge>
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
        {visibleInputProperties.map(([name, schema]) => {
          if (schema.modelCapability) {
            return (
              <WorkflowIOField
                key={name}
                name={name}
                label={schema.title}
                type="model"
                required={capability.inputSchema.required?.includes(name)}
                description={schema.description}
                error={fieldErrors[name]}
                valueControl={
                  <ModelPicker
                    value={typeof inputs[name] === 'string' ? inputs[name] : undefined}
                    onValueChange={(modelId) =>
                      onUpdateConfig({ inputs: { ...inputs, [name]: modelId } })
                    }
                    capability={schema.modelCapability}
                    label={schema.title || '模型'}
                    compact
                    compactTrigger
                  />
                }
              />
            );
          }
          if (schema.enum?.length) {
            return (
              <WorkflowIOField
                key={name}
                name={name}
                label={schema.title}
                type={toWorkflowValueType(schema.type)}
                required={capability.inputSchema.required?.includes(name)}
                description={schema.description}
                error={fieldErrors[name]}
                valueControl={
                  <Select
                    value={String(inputs[name] ?? schema.default ?? '')}
                    onValueChange={(value) =>
                      onUpdateConfig({ inputs: { ...inputs, [name]: value } })
                    }
                  >
                    <SelectTrigger aria-label={schema.title || name}>
                      <SelectValue>
                        {toolEnumLabels[capability.id]?.[name]?.[
                          String(inputs[name] ?? schema.default ?? '')
                        ] || String(inputs[name] ?? schema.default ?? '')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {schema.enum.map((option) => (
                        <SelectItem key={option} value={option}>
                          {toolEnumLabels[capability.id]?.[name]?.[option] || option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            );
          }
          const type = toWorkflowValueType(schema.type);
          const isImagePrompt = capability.id === 'image.generate' && name === 'prompt';
          const label = isImagePrompt ? '提示词描述' : schema.title || name;
          return (
            <WorkflowVariableBindingField
              key={name}
              name={name}
              label={label}
              type={type}
              value={inputs[name]}
              onChange={(value) => onUpdateConfig({ inputs: { ...inputs, [name]: value } })}
              options={variableOptions}
              description={schema.description}
              required={capability.inputSchema.required?.includes(name)}
              error={fieldErrors[name]}
              ariaLabel={`${label} 输入值`}
              allowFixed={schema.allowFixedValue}
              fixedPlaceholder={schema.placeholder}
              multiline={isImagePrompt}
              layout={isImagePrompt ? 'editor' : 'default'}
              actions={
                isImagePrompt ? (
                  <PromptLibraryInsertButton
                    targetLabel={label}
                    onInsert={(content) => {
                      const current = typeof inputs[name] === 'string' ? inputs[name].trim() : '';
                      onUpdateConfig({
                        inputs: {
                          ...inputs,
                          [name]: [current, content.trim()].filter(Boolean).join('\n\n'),
                        },
                      });
                    }}
                  />
                ) : undefined
              }
            />
          );
        })}
      </EditorSection>
      {capability.id === 'image.generate' ? (
        <EditorSection title="超时设置（秒）" description="60 到 600 秒，默认 240 秒。">
          <Input
            aria-label="图片生成超时（秒）"
            type="number"
            min={60}
            max={600}
            step={1}
            value={Number(config.timeoutSeconds || 240)}
            onChange={(event) =>
              onUpdateConfig({ timeoutSeconds: Number(event.target.value) || 240 })
            }
          />
        </EditorSection>
      ) : null}
      <EditorSection title="输出" description="输出字段由工具能力固定，下游节点可直接引用。">
        <WorkflowOutputFieldList
          outputs={outputs}
          labels={outputPresentation?.labels}
          descriptions={outputPresentation?.descriptions}
        />
      </EditorSection>
    </div>
  );
}
