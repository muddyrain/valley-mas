import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';
import { WorkflowOutputFieldList } from './WorkflowOutputFieldList';

interface KeyValuePair {
  name: string;
  value: string;
}

const outputFields = [
  ['body', 'string'],
  ['statusCode', 'number'],
  ['headers', 'object'],
] as const;

function pairs(value: unknown): KeyValuePair[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        item && typeof item === 'object'
          ? [
              {
                name: String((item as KeyValuePair).name || ''),
                value: String((item as KeyValuePair).value || ''),
              },
            ]
          : [],
      )
    : [];
}

function parseCurl(input: string): Partial<Record<string, unknown>> | null {
  const tokens =
    input
      .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
      ?.map((token) => token.replace(/^("|')|("|')$/g, '')) || [];
  if (tokens[0] !== 'curl') return null;

  let method = 'GET';
  let url = '';
  let body = '';
  const headers: KeyValuePair[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if ((token === '-X' || token === '--request') && tokens[index + 1]) {
      method = tokens[++index].toUpperCase();
    } else if ((token === '-H' || token === '--header') && tokens[index + 1]) {
      const raw = tokens[++index];
      const separator = raw.indexOf(':');
      if (separator > 0) {
        headers.push({
          name: raw.slice(0, separator).trim(),
          value: raw.slice(separator + 1).trim(),
        });
      }
    } else if (
      (token === '-d' || token === '--data' || token === '--data-raw') &&
      tokens[index + 1]
    ) {
      body = tokens[++index];
      if (method === 'GET') method = 'POST';
    } else if (/^https?:\/\//i.test(token)) {
      url = token;
    }
  }
  if (!url) return null;
  return { method, url, headers, bodyType: body ? 'json' : 'none', body };
}

function KeyValueSection({
  title,
  value,
  onChange,
  namePlaceholder,
}: {
  title: string;
  value: KeyValuePair[];
  onChange: (next: KeyValuePair[]) => void;
  namePlaceholder: string;
}) {
  return (
    <EditorSection
      title={title}
      action={
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onChange([...value, { name: '', value: '' }])}
        >
          <Plus className="size-4" />
        </Button>
      }
    >
      {value.length ? (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex gap-2">
              <Input
                value={item.name}
                placeholder={namePlaceholder}
                onChange={(event) =>
                  onChange(
                    value.map((pair, pairIndex) =>
                      pairIndex === index ? { ...pair, name: event.target.value } : pair,
                    ),
                  )
                }
              />
              <Input
                value={item.value}
                placeholder="值，可使用 {{变量}}"
                onChange={(event) =>
                  onChange(
                    value.map((pair, pairIndex) =>
                      pairIndex === index ? { ...pair, value: event.target.value } : pair,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(value.filter((_, pairIndex) => pairIndex !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无配置</p>
      )}
    </EditorSection>
  );
}

export function HTTPPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
  fieldErrors = {},
}: PropertyFormProps) {
  const [curl, setCurl] = useState('');
  const [curlError, setCurlError] = useState('');
  const params = pairs(config.params);
  const headers = pairs(config.headers);
  const method = String(config.method || 'GET').toUpperCase();
  const bodyType = config.bodyType === 'json' ? 'json' : 'none';

  const importCurl = () => {
    const parsed = parseCurl(curl);
    if (!parsed) {
      setCurlError('仅支持包含 URL 的 curl -X/-H/-d 命令');
      return;
    }
    setCurlError('');
    onUpdateConfig(parsed);
  };

  return (
    <div className="space-y-4">
      <EditorSection
        title="API"
        action={
          <Button type="button" variant="outline" size="sm" onClick={importCurl}>
            导入 cURL
          </Button>
        }
      >
        <div className="space-y-2">
          <Label>请求方法</Label>
          <Select value={method} onValueChange={(value) => onUpdateConfig({ method: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>请求 URL</Label>
          <VariableTokenEditor
            value={String(config.url || '')}
            onChange={(url) => onUpdateConfig({ url })}
            options={variableOptions}
            placeholder="请输入接口 URL，可使用 {{变量}}"
          />
          {fieldErrors.url ? <p className="text-xs text-destructive">{fieldErrors.url}</p> : null}
        </div>
        <div className="space-y-2">
          <Label>cURL 命令</Label>
          <Textarea
            value={curl}
            onChange={(event) => setCurl(event.target.value)}
            placeholder="curl -X POST https://api.example.com -H 'Content-Type: application/json' -d '{...}'"
          />
          {curlError ? <p className="text-xs text-destructive">{curlError}</p> : null}
        </div>
      </EditorSection>

      <KeyValueSection
        title="请求参数"
        value={params}
        onChange={(next) => onUpdateConfig({ params: next })}
        namePlaceholder="参数名"
      />
      <KeyValueSection
        title="请求头"
        value={headers}
        onChange={(next) => onUpdateConfig({ headers: next })}
        namePlaceholder="请求头名称"
      />

      <EditorSection
        title="鉴权"
        description="首期仅支持无凭据请求，密钥管理将在专用凭据能力中提供。"
      >
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span>使用凭据</span>
          <Switch checked={false} disabled />
        </div>
      </EditorSection>

      <EditorSection title="请求体">
        <Select value={bodyType} onValueChange={(value) => onUpdateConfig({ bodyType: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
          </SelectContent>
        </Select>
        {bodyType === 'json' ? (
          <Textarea
            value={String(config.body || '')}
            onChange={(event) => onUpdateConfig({ body: event.target.value })}
            placeholder='{"key": "value"}'
            className="min-h-32 font-mono text-xs"
          />
        ) : null}
      </EditorSection>

      <EditorSection title="超时设置（秒）">
        <Input
          type="number"
          min={1}
          max={60}
          value={Number(config.timeoutSeconds || 30)}
          onChange={(event) => onUpdateConfig({ timeoutSeconds: Number(event.target.value) })}
        />
      </EditorSection>
      <EditorSection title="重试次数">
        <Input
          type="number"
          min={0}
          max={3}
          value={Number(config.retryCount || 0)}
          onChange={(event) => onUpdateConfig({ retryCount: Number(event.target.value) })}
        />
      </EditorSection>
      <EditorSection title="输出" description="下游节点可引用这些响应字段。">
        <WorkflowOutputFieldList outputs={outputFields} />
      </EditorSection>
      <EditorSection
        title="异常忽略"
        description="开启后，网络错误和非 2xx 响应会以空结果继续执行。"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">忽略异常</span>
          <Switch
            checked={config.ignoreError === true}
            onCheckedChange={(ignoreError) => onUpdateConfig({ ignoreError })}
          />
        </div>
      </EditorSection>
    </div>
  );
}
