import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PropertyFormProps } from './index';

const fields = [
  ['title', '标题'],
  ['content', '正文'],
  ['excerpt', '摘要'],
  ['cover', '封面'],
  ['tags', '手选标签'],
  ['suggestedTags', '建议标签'],
  ['visibility', '可见范围'],
] as const;

export function BlogCreateDraftPropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">博客草稿配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`draft-${key}`}>{label}</Label>
            <Input
              id={`draft-${key}`}
              value={(config[key] as string) || ''}
              onChange={(event) => onUpdateConfig({ [key]: event.target.value })}
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>标签策略</Label>
          <Select
            value={(config.tagMode as string) || 'merge'}
            onValueChange={(tagMode) => onUpdateConfig({ tagMode })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">合并建议标签</SelectItem>
              <SelectItem value="manual_only">仅使用手选标签</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
