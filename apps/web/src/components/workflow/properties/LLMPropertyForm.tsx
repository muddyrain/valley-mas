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

interface LLMPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function LLMPropertyForm({ config, onUpdateConfig }: LLMPropertyFormProps) {
  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">LLM 配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>模型</Label>
          <Select
            value={(config.model as string) || ''}
            onValueChange={(v) => onUpdateConfig({ model: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              <SelectItem value="doubao-pro-32k">Doubao Pro 32K</SelectItem>
              <SelectItem value="doubao-pro-128k">Doubao Pro 128K</SelectItem>
              <SelectItem value="doubao-lite-32k">Doubao Lite 32K</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>系统提示词</Label>
          <Textarea
            value={(config.systemPrompt as string) || ''}
            onChange={(e) => onUpdateConfig({ systemPrompt: e.target.value })}
            placeholder="你是一个专业的助手..."
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Temperature: {String(config.temperature ?? 0.7)}</Label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={(config.temperature as number) ?? 0.7}
            onChange={(e) => onUpdateConfig({ temperature: parseFloat(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label>最大 Token 数</Label>
          <Input
            type="number"
            value={(config.maxTokens as number) ?? 2048}
            onChange={(e) => onUpdateConfig({ maxTokens: parseInt(e.target.value, 10) || 2048 })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
