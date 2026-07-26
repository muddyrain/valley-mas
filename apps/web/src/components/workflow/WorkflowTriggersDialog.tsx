import {
  CalendarClock,
  Copy,
  Loader2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
  Webhook,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import {
  createWorkflowTrigger,
  deleteWorkflowTrigger,
  getWorkflowWebhookURL,
  listWorkflowTriggers,
  rotateWorkflowWebhookSecret,
  updateWorkflowTrigger,
  type WorkflowTrigger,
} from '@/api/workflow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkflowTriggersDialogProps {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TriggerType = WorkflowTrigger['type'];

const TRIGGER_META: Record<
  TriggerType,
  { label: string; description: string; icon: typeof CalendarClock }
> = {
  cron: { label: '定时', description: '按 Cron 计划自动运行', icon: CalendarClock },
  webhook: { label: 'Webhook', description: '由外部系统投递 JSON 数据', icon: Webhook },
  event: { label: '内部事件', description: '响应当前账号下的业务事件', icon: Radio },
};

export function WorkflowTriggersDialog({
  workflowId,
  open,
  onOpenChange,
}: WorkflowTriggersDialogProps) {
  const [items, setItems] = useState<WorkflowTrigger[]>([]);
  const [triggerType, setTriggerType] = useState<TriggerType>('cron');
  const [cronExpression, setCronExpression] = useState('0 9 * * 1-5');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [eventKey, setEventKey] = useState('content.ready');
  const [credential, setCredential] = useState<WorkflowTrigger | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<WorkflowTrigger | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listWorkflowTriggers(workflowId);
      setItems(result.list);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载触发器失败'));
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const create = async () => {
    setSaving(true);
    try {
      const created = await createWorkflowTrigger(
        workflowId,
        triggerType === 'cron'
          ? { type: 'cron', cronExpression, timezone }
          : triggerType === 'webhook'
            ? { type: 'webhook' }
            : { type: 'event', eventKey },
      );
      setItems((current) => [created, ...current]);
      if (created.webhookSecret) setCredential(created);
      toast.success(`${TRIGGER_META[created.type].label}触发已启用`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建触发器失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (trigger: WorkflowTrigger) => {
    try {
      const updated = await updateWorkflowTrigger(
        workflowId,
        trigger.id,
        trigger.status === 'active' ? 'disabled' : 'active',
      );
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '更新触发器失败'));
    }
  };

  const remove = async (trigger: WorkflowTrigger) => {
    try {
      await deleteWorkflowTrigger(workflowId, trigger.id);
      setItems((current) => current.filter((item) => item.id !== trigger.id));
      if (credential?.id === trigger.id) setCredential(null);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除触发器失败'));
    }
  };

  const rotateSecret = async (trigger: WorkflowTrigger) => {
    setRotateTarget(null);
    setRotatingId(trigger.id);
    try {
      const updated = await rotateWorkflowWebhookSecret(workflowId, trigger.id);
      setCredential(updated);
      toast.success('Webhook 密钥已轮换');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '轮换 Webhook 密钥失败'));
    } finally {
      setRotatingId(null);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}已复制`);
    } catch {
      toast.error(`复制${label}失败`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>工作流触发器</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              触发任务始终使用当前已发布版本；重新发布后，新任务自动使用新版本。
            </p>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <div className="space-y-1.5">
                  <Label>触发方式</Label>
                  <Select
                    value={triggerType}
                    onValueChange={(value) => setTriggerType(value as TriggerType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{TRIGGER_META[triggerType].label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_META).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {triggerType === 'cron' ? (
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-cron">Cron</Label>
                      <Input
                        id="workflow-cron"
                        value={cronExpression}
                        onChange={(event) => setCronExpression(event.target.value)}
                        placeholder="0 9 * * 1-5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-timezone">时区</Label>
                      <Input
                        id="workflow-timezone"
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        placeholder="Asia/Shanghai"
                      />
                    </div>
                  </div>
                ) : triggerType === 'event' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="workflow-event-key">事件键</Label>
                    <Input
                      id="workflow-event-key"
                      value={eventKey}
                      onChange={(event) => setEventKey(event.target.value)}
                      placeholder="content.ready"
                    />
                  </div>
                ) : (
                  <div className="self-end pb-2 text-sm text-muted-foreground">
                    创建后显示调用地址和密钥。
                  </div>
                )}

                <Button
                  className="w-full self-end md:w-auto"
                  disabled={saving}
                  onClick={() => void create()}
                >
                  {saving ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 size-4" />
                  )}
                  添加
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {TRIGGER_META[triggerType].description}
              </p>
            </div>

            {credential?.webhookSecret ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">保存 Webhook 密钥</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    密钥只在本次创建或轮换后显示。调用时同时提供 Bearer 密钥和唯一的
                    X-Valley-Delivery。
                  </p>
                </div>
                <CredentialRow
                  label="调用地址"
                  value={getWorkflowWebhookURL(credential.id)}
                  onCopy={(value) => void copy(value, '调用地址')}
                />
                <CredentialRow
                  label="Bearer 密钥"
                  value={credential.webhookSecret}
                  onCopy={(value) => void copy(value, '密钥')}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : items.length ? (
                items.map((trigger) => {
                  const meta = TRIGGER_META[trigger.type];
                  const Icon = meta.icon;
                  const value =
                    trigger.type === 'cron'
                      ? `${trigger.cronExpression} · ${trigger.timezone}`
                      : trigger.type === 'event'
                        ? trigger.eventKey
                        : getWorkflowWebhookURL(trigger.id);
                  return (
                    <div
                      key={trigger.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{meta.label}</span>
                          <Badge variant={trigger.status === 'active' ? 'secondary' : 'outline'}>
                            {trigger.status === 'active' ? '运行中' : '已停用'}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {value}
                        </p>
                        {trigger.type === 'cron' ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {trigger.nextRunAt
                              ? `下次：${new Date(trigger.nextRunAt).toLocaleString('zh-CN')}`
                              : '当前没有下次运行时间'}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {trigger.type === 'webhook' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="复制 Webhook 地址"
                              onClick={() =>
                                void copy(getWorkflowWebhookURL(trigger.id), '调用地址')
                              }
                            >
                              <Copy />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="轮换 Webhook 密钥"
                              disabled={rotatingId === trigger.id}
                              onClick={() => setRotateTarget(trigger)}
                            >
                              {rotatingId === trigger.id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <RefreshCw />
                              )}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={trigger.status === 'active' ? '停用触发器' : '启用触发器'}
                          onClick={() => void toggle(trigger)}
                        >
                          {trigger.status === 'active' ? <Pause /> : <Play />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="删除触发器"
                          onClick={() => void remove(trigger)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  暂无触发器
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={rotateTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRotateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>轮换 Webhook 密钥？</AlertDialogTitle>
            <AlertDialogDescription>
              旧密钥会立即失效。请在轮换后更新调用方保存的 Bearer 密钥。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rotateTarget) void rotateSecret(rotateTarget);
              }}
            >
              确认轮换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <code className="min-w-0 truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground">
        {value}
      </code>
      <Button variant="outline" size="sm" onClick={() => onCopy(value)}>
        <Copy className="mr-1.5 size-3.5" />
        复制
      </Button>
    </div>
  );
}
