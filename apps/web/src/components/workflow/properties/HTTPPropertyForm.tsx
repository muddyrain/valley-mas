import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

interface HTTPPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function HTTPPropertyForm({ config, onUpdateConfig }: HTTPPropertyFormProps) {
  const headers = (config.headers as Array<{ key: string; value: string }>) || [];

  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">HTTP 请求配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="w-24">
            <Label>方法</Label>
            <Select
              value={(config.method as string) || 'GET'}
              onValueChange={(v) => onUpdateConfig({ method: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>URL</Label>
            <Input
              value={(config.url as string) || ''}
              onChange={(e) => onUpdateConfig({ url: e.target.value })}
              placeholder="https://api.example.com/data"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>请求头</Label>
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={h.key}
                onChange={(e) => {
                  const next = [...headers];
                  next[i] = { ...next[i], key: e.target.value };
                  onUpdateConfig({ headers: next });
                }}
                placeholder="Key"
                className="flex-1"
              />
              <Input
                value={h.value}
                onChange={(e) => {
                  const next = [...headers];
                  next[i] = { ...next[i], value: e.target.value };
                  onUpdateConfig({ headers: next });
                }}
                placeholder="Value"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdateConfig({ headers: headers.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateConfig({ headers: [...headers, { key: '', value: '' }] })}
          >
            <Plus className="h-3 w-3 mr-1" /> 添加请求头
          </Button>
        </div>
        <div className="space-y-2">
          <Label>请求体 (JSON)</Label>
          <Textarea
            value={(config.body as string) || ''}
            onChange={(e) => onUpdateConfig({ body: e.target.value })}
            placeholder='{"key": "value"}'
            rows={4}
            className="font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
