import type { NewPlanInput, PlanType } from '@/types';

type AdvicePlanInput = {
  id: string;
  title: string;
  detail: string;
  city: string;
};

const planMetaByAdviceId: Record<string, { prefix: string; type: PlanType; timeLabel: string }> = {
  wear: { prefix: '穿衣提醒', type: '普通事项', timeLabel: '今天 出门前' },
  skin: { prefix: '护肤提醒', type: '普通事项', timeLabel: '今天 出门前' },
  out: { prefix: '出门提醒', type: '普通事项', timeLabel: '今天 出门前' },
  commute: { prefix: '通勤提醒', type: '普通事项', timeLabel: '今天 上班前' },
  health: { prefix: '健康打卡', type: '运动', timeLabel: '今天 晚上' },
  plan: { prefix: '计划整理', type: '普通事项', timeLabel: '今天 晚上' },
};

export function createPlanFromAdvice(input: AdvicePlanInput): NewPlanInput {
  const meta = planMetaByAdviceId[input.id] ?? {
    prefix: input.title,
    type: '普通事项' as PlanType,
    timeLabel: '今天',
  };

  return {
    title: `${meta.prefix}：${input.detail}`,
    type: meta.type,
    timeLabel: meta.timeLabel,
    reminder: true,
    source: 'weather_advice',
    note: `来自今日建议「${input.title}」。城市：${input.city}。#advice:${input.id}`,
  };
}

export function hasAdvicePlan(plans: { note: string }[], adviceId: string) {
  return plans.some((plan) => plan.note.includes(`#advice:${adviceId}`));
}
