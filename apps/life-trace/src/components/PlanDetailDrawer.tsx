import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getVisiblePlanNote } from '@/lib/advicePlan';
import { getPlanDisplayTimeParts } from '@/lib/planReminder';
import { cn } from '@/lib/utils';
import type { Plan, PlanSource, PlanType } from '@/types';

const typeTone: Record<PlanType, 'plan' | 'health' | 'trace' | 'weather' | 'ai' | 'alert'> = {
  电影: 'plan',
  吃饭: 'health',
  运动: 'trace',
  阅读: 'weather',
  聚会: 'ai',
  普通事项: 'alert',
};

const sourceLabel: Record<PlanSource, { title: string; detail: string }> = {
  manual: { title: '手动创建', detail: '由你主动记录的生活安排' },
  weather_advice: { title: '天气建议', detail: '来自今日天气与通勤建议' },
  ai_advice: { title: 'AI 今日建议', detail: '由 Life Trace 结合今日状态生成' },
  image_ai: { title: '图片分析', detail: '由图片内容分析后生成' },
};

function formatDateTime(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type PlanDetailDrawerProps = {
  open: boolean;
  plan: Plan | null;
  completing?: boolean;
  deleting?: boolean;
  onClose: () => void;
  onComplete: (plan: Plan) => void;
  onEdit: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
};

export function PlanDetailDrawer({
  open,
  plan,
  completing = false,
  deleting = false,
  onClose,
  onComplete,
  onEdit,
  onDelete,
}: PlanDetailDrawerProps) {
  const titleId = useId();
  const [renderedPlan, setRenderedPlan] = useState<Plan | null>(plan);
  const busy = completing || deleting;

  useEffect(() => {
    if (open && plan) {
      setRenderedPlan(plan);
      return;
    }

    if (!open) {
      setRenderedPlan(null);
    }
  }, [open, plan]);

  useEffect(() => {
    if (!open || busy) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose, open]);

  if (!renderedPlan) {
    return null;
  }

  const { dateText, timeText } = getPlanDisplayTimeParts(renderedPlan);
  const ReminderIcon = renderedPlan.reminder ? Bell : BellOff;
  const visibleNote = getVisiblePlanNote(renderedPlan.note);
  const source = sourceLabel[renderedPlan.source ?? 'manual'];
  const completedText = formatDateTime(renderedPlan.completedAt);

  return (
    <BottomSheet
      open={Boolean(renderedPlan)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setRenderedPlan(null);
          onClose();
        }
      }}
      overlayLabel="关闭计划详情"
      closeDisabled={busy}
      zIndexClassName="z-[60]"
      portal
      className="will-change-transform"
    >
      <div className="mb-5 flex items-start justify-between gap-4" data-plan-detail-item>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={typeTone[renderedPlan.type]}>{renderedPlan.type}</Badge>
            <Badge tone={renderedPlan.reminder ? 'health' : 'default'}>
              {renderedPlan.reminder ? '已提醒' : '未提醒'}
            </Badge>
            {renderedPlan.completed ? <Badge tone="trace">已完成</Badge> : null}
          </div>
          <h2 id={titleId} className="mt-3 text-2xl font-semibold leading-tight">
            {renderedPlan.title}
          </h2>
          {renderedPlan.completed && completedText ? (
            <p className="mt-2 text-sm text-muted-foreground">完成于 {completedText}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={() => {
            setRenderedPlan(null);
            onClose();
          }}
        >
          <X className="size-5" />
        </Button>
      </div>

      {renderedPlan.imageUrl ? (
        <div
          className="mb-5 overflow-hidden rounded-2xl border border-border bg-secondary"
          data-plan-detail-item
        >
          <img
            src={renderedPlan.imageUrl}
            alt={renderedPlan.title}
            className="h-40 w-full object-cover opacity-90"
          />
        </div>
      ) : (
        <div
          className="mb-5 flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 text-muted-foreground"
          data-plan-detail-item
        >
          <Sparkles className="size-5 text-life-ai" />
          <p className="text-sm">还没有封面。后续可以为电影、饭局或活动补充图片。</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1" data-plan-detail-item>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="size-4" />
            日期
          </div>
          <p className="mt-2 text-lg font-semibold">{dateText}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock className="size-4" />
            时间
          </div>
          <p className="mt-2 text-lg font-semibold">{timeText}</p>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 max-[360px]:grid-cols-1" data-plan-detail-item>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ReminderIcon className={cn('size-4', renderedPlan.reminder && 'text-life-health')} />
            提醒状态
          </div>
          <p className="mt-2 text-sm font-semibold">
            {renderedPlan.reminder ? '会提醒你' : '未开启提醒'}
          </p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-muted-foreground">来源</div>
          <p className="mt-2 text-sm font-semibold">{source.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {source.detail}
          </p>
        </Card>
      </div>

      {renderedPlan.location ? (
        <Card className="mt-3 p-4" data-plan-detail-item>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <MapPin className="size-4" />
            地点
          </div>
          <p className="mt-2 text-sm font-semibold">{renderedPlan.location}</p>
        </Card>
      ) : null}

      <Card className="mt-3 p-4" data-plan-detail-item>
        <div className="text-xs font-semibold text-muted-foreground">备注</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {visibleNote || '还没有备注。可以编辑计划，补充期待、地址或需要准备的东西。'}
        </p>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-3 max-[360px]:grid-cols-1" data-plan-detail-item>
        <Button
          type="button"
          variant={renderedPlan.completed ? 'secondary' : 'outline'}
          disabled={busy}
          onClick={() => onComplete(renderedPlan)}
        >
          {completing ? (
            <ActionLoadingIcon tone="trace" />
          ) : renderedPlan.completed ? (
            <RotateCcw className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
          {completing ? '更新中' : renderedPlan.completed ? '取消完成' : '完成计划'}
        </Button>
        {!renderedPlan.completed ? (
          <Button type="button" variant="ai" disabled={busy} onClick={() => onEdit(renderedPlan)}>
            <Pencil className="size-4" />
            编辑计划
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled>
            已完成
          </Button>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-3 w-full text-life-alert hover:bg-life-alert/10 hover:text-life-alert"
        disabled={busy}
        onClick={() => onDelete(renderedPlan)}
        data-plan-detail-item
      >
        {deleting ? <ActionLoadingIcon tone="alert" /> : <Trash2 className="size-4" />}
        {deleting ? '删除中' : '删除计划'}
      </Button>
    </BottomSheet>
  );
}
