import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

export function BlogParsePropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Markdown 配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="markdown-file-input">文件输入</Label>
        <VariableTokenEditor
          id="markdown-file-input"
          value={(config.fileInput as string) || '{{start.output.markdownFile}}'}
          onChange={(fileInput) => onUpdateConfig({ fileInput })}
          options={variableOptions}
          compact
        />
      </CardContent>
    </Card>
  );
}
