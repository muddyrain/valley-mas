import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface KnowledgePropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function KnowledgePropertyForm({ config, onUpdateConfig }: KnowledgePropertyFormProps) {
  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">知识检索</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>检索问题</Label>
          <Input
            value={(config.query as string) || ''}
            onChange={(e) => onUpdateConfig({ query: e.target.value })}
            placeholder="{{start.output.topic}}"
          />
        </div>
      </CardContent>
    </Card>
  );
}
