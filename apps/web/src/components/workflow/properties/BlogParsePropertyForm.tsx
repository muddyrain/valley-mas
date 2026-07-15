import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PropertyFormProps } from './index';

export function BlogParsePropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Markdown 配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="markdown-file-input">文件输入</Label>
        <Input
          id="markdown-file-input"
          value={(config.fileInput as string) || '{{start.output.markdownFile}}'}
          onChange={(event) => onUpdateConfig({ fileInput: event.target.value })}
        />
      </CardContent>
    </Card>
  );
}
