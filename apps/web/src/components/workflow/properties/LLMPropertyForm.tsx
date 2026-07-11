import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PropertyFormProps } from './index';

export function LLMPropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">大模型配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>模型配置</Label>
          <Input value="ARK 默认文本模型" disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="llm-system-prompt">系统提示词</Label>
          <Textarea
            id="llm-system-prompt"
            value={(config.systemPrompt as string) || ''}
            onChange={(event) =>
              onUpdateConfig({ systemPrompt: event.target.value, modelProfile: 'ark-text-default' })
            }
            rows={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="llm-prompt">提示词</Label>
          <Textarea
            id="llm-prompt"
            value={(config.prompt as string) || ''}
            onChange={(event) => onUpdateConfig({ prompt: event.target.value })}
            rows={5}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="llm-temperature">Temperature</Label>
            <Input
              id="llm-temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={(config.temperature as number) ?? 0.4}
              onChange={(event) => onUpdateConfig({ temperature: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="llm-max-tokens">最大 Token</Label>
            <Input
              id="llm-max-tokens"
              type="number"
              min="1"
              max="4096"
              value={(config.maxOutputTokens as number) ?? 512}
              onChange={(event) => onUpdateConfig({ maxOutputTokens: Number(event.target.value) })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
