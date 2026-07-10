import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DATA_SOURCES } from '@/components/workflow/dataSources';
import type { VariableDef } from '@/components/workflow/RunPanel';

interface StartPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function StartPropertyForm({ config, onUpdateConfig }: StartPropertyFormProps) {
  const variables = (config.variables as VariableDef[]) || [];

  const updateVariables = (vars: VariableDef[]) => {
    onUpdateConfig({ variables: vars });
  };

  const updateVariable = (index: number, updates: Partial<VariableDef>) => {
    const next = [...variables];
    next[index] = { ...next[index], ...updates };
    updateVariables(next);
  };

  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">输入参数</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">定义工作流运行时需要填写的输入参数</p>
        {variables.map((v, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={v.name}
                onChange={(e) => updateVariable(i, { name: e.target.value })}
                placeholder="参数名"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateVariables(variables.filter((_, j) => j !== i))}
                className="h-8 w-8 flex-shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={v.type}
                onValueChange={(val) => {
                  const updates: Partial<VariableDef> = { type: val as VariableDef['type'] };
                  if (val === 'select') {
                    updates.allowCustom = true;
                  } else {
                    updates.dataSource = undefined;
                    updates.options = undefined;
                    updates.allowCustom = undefined;
                  }
                  updateVariable(i, updates);
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={v.required}
                  onCheckedChange={(checked) => updateVariable(i, { required: !!checked })}
                />
                <Label className="text-xs text-muted-foreground">必填</Label>
              </div>
            </div>
            {v.type === 'select' && (
              <div className="space-y-2 pl-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">数据源</Label>
                  <Select
                    value={
                      v.dataSource
                        ? (Object.entries(DATA_SOURCES).find(
                            ([, ds]) => ds.api === v.dataSource?.api,
                          )?.[0] ?? '')
                        : ''
                    }
                    onValueChange={(key) => {
                      if (key === '_custom') {
                        updateVariable(i, { dataSource: undefined });
                        return;
                      }
                      const ds = DATA_SOURCES[key as keyof typeof DATA_SOURCES];
                      if (ds) {
                        updateVariable(i, {
                          dataSource: {
                            api: ds.api,
                            labelField: ds.labelField,
                            valueField: ds.valueField,
                          },
                          options: undefined,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择数据源" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DATA_SOURCES).map(([key, ds]) => (
                        <SelectItem key={key} value={key}>
                          {ds.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="_custom">自定义选项</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={v.allowCustom !== false}
                    onCheckedChange={(checked) => updateVariable(i, { allowCustom: !!checked })}
                  />
                  <Label className="text-xs text-muted-foreground">允许手动输入</Label>
                </div>
                {!v.dataSource && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">选项列表</Label>
                    {(v.options || []).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-1.5">
                        <Input
                          value={opt.label}
                          onChange={(e) => {
                            const newOptions = [...(v.options || [])];
                            newOptions[oi] = { ...newOptions[oi], label: e.target.value };
                            updateVariable(i, { options: newOptions });
                          }}
                          placeholder="显示名"
                          className="flex-1"
                        />
                        <Input
                          value={opt.value}
                          onChange={(e) => {
                            const newOptions = [...(v.options || [])];
                            newOptions[oi] = { ...newOptions[oi], value: e.target.value };
                            updateVariable(i, { options: newOptions });
                          }}
                          placeholder="值"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            const newOptions = (v.options || []).filter((_, j) => j !== oi);
                            updateVariable(i, { options: newOptions });
                          }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateVariable(i, {
                          options: [...(v.options || []), { label: '', value: '' }],
                        })
                      }
                    >
                      <Plus className="h-2.5 w-2.5 mr-1" /> 添加选项
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateVariables([...variables, { name: '', type: 'string', required: false }])
          }
        >
          <Plus className="h-3 w-3 mr-1" /> 添加参数
        </Button>
      </CardContent>
    </Card>
  );
}
