import {
  Bell,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  Cloud,
  Droplets,
  Film,
  Heart,
  MapPin,
  Shirt,
  Sparkles,
  Sun,
  Utensils,
  Wind,
} from 'lucide-react';
import type { Advice, Plan, Trace } from '@/types';

export const weatherMetrics = [
  { label: '降水', value: '20%', icon: Droplets, tone: 'text-life-weather' },
  { label: '湿度', value: '58%', icon: Droplets, tone: 'text-life-ai' },
  { label: '空气', value: '良', icon: Wind, tone: 'text-life-trace' },
  { label: '风力', value: '3级', icon: Wind, tone: 'text-muted-foreground' },
  { label: '紫外线', value: '中等', icon: Sun, tone: 'text-life-health' },
  { label: '体感', value: '21°', icon: Bell, tone: 'text-life-alert' },
];

export const hourlyWeather = [
  { time: '现在', temp: '22°', icon: Cloud, active: true },
  { time: '14时', temp: '24°', icon: Sun },
  { time: '15时', temp: '25°', icon: Sun },
  { time: '16时', temp: '26°', icon: Cloud },
  { time: '17时', temp: '24°', icon: Cloud },
  { time: '18时', temp: '22°', icon: Cloud },
  { time: '19时', temp: '20°', icon: Cloud },
];

export const todayAdvice: Advice[] = [
  { id: 'wear', title: '穿衣', detail: '早晚偏凉，薄外套', tone: 'plan', icon: Shirt },
  { id: 'skin', title: '护肤', detail: '紫外线中等，注意防晒', tone: 'health', icon: Droplets },
  { id: 'out', title: '出门', detail: '午后云量增加，带伞', tone: 'weather', icon: Cloud },
  { id: 'commute', title: '通勤', detail: '路况正常，提前10分钟', tone: 'ai', icon: Car },
  { id: 'health', title: '健康', detail: '空气良好，适合轻运动', tone: 'trace', icon: Heart },
  { id: 'plan', title: '今日计划', detail: '晚上有1个生活计划', tone: 'alert', icon: CalendarDays },
];

export const initialPlans: Plan[] = [
  {
    id: 'plan-movie',
    title: '周六晚上看《沙丘》',
    type: '电影',
    timeLabel: '周六 19:30',
    reminder: true,
    imageUrl:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80',
    location: '万达影城',
    note: '适合周末晚上沉浸观看，完成后生成观影踪迹。',
    completed: false,
  },
  {
    id: 'plan-food',
    title: '周五晚上吃日料',
    type: '吃饭',
    timeLabel: '周五 19:30',
    reminder: true,
    location: '山目日料',
    note: '下班后的放松晚餐。',
    completed: false,
  },
  {
    id: 'plan-run',
    title: '明早 7:30 跑步',
    type: '运动',
    timeLabel: '明天 07:30',
    reminder: true,
    note: '天气适合轻运动。',
    completed: false,
  },
  {
    id: 'plan-book',
    title: '读完《认知觉醒》',
    type: '阅读',
    timeLabel: '周日 20:00',
    reminder: false,
    note: '睡前阅读 40 分钟。',
    completed: false,
  },
  {
    id: 'plan-party',
    title: '周末和朋友聚餐',
    type: '聚会',
    timeLabel: '周日 18:00',
    reminder: true,
    note: '提前确认餐厅位置。',
    completed: false,
  },
];

export const initialTraces: Trace[] = [
  {
    id: 'trace-cinema',
    title: '周六夜晚的《沙丘》',
    summary: '周六晚上看了《沙丘》，一场适合沉浸在周末夜晚的科幻电影。',
    timeLabel: '2024-01-20 19:30',
    location: '万达影城',
    imageUrl:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80',
    mood: '放松',
    tags: ['电影', '周末', '科幻', '放松'],
    source: '计划',
  },
  {
    id: 'trace-food',
    title: '下班后的日料晚餐',
    summary: '今天吃了日料，是一次下班后的放松晚餐。',
    timeLabel: '2024-01-19 18:45',
    location: '山目日料',
    imageUrl:
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80',
    mood: '满足',
    tags: ['美食', '晚餐', '下班后', '生活奖励'],
    source: '计划',
  },
  {
    id: 'trace-run',
    title: '晨跑让一天开始得很好',
    summary: '今天完成了晨跑，给一天留下了很好的开始。',
    timeLabel: '2024-01-18 07:40',
    imageUrl:
      'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=900&q=80',
    mood: '活力',
    tags: ['运动', '清晨', '健康'],
    source: '手动',
  },
];

export const aiQuickActions = [
  { label: '生成今日建议', icon: Sun, tone: 'text-life-health' },
  { label: '创建计划', icon: CalendarDays, tone: 'text-life-plan' },
  { label: '智能菜谱', icon: Utensils, tone: 'text-life-health' },
  { label: '拍照分析商品', icon: Camera, tone: 'text-life-ai' },
  { label: '分析图片', icon: Camera, tone: 'text-life-trace' },
  { label: '生成踪迹', icon: Sparkles, tone: 'text-life-ai' },
  { label: '每周回顾', icon: CheckCircle2, tone: 'text-life-weather' },
];

export const suggestedPrompts = [
  { title: '周末想看电影，帮我安排一下', type: '计划', icon: Film },
  { title: '明晚提醒我吃日料', type: '提醒', icon: Utensils },
  { title: '帮我看看这张图片适合记录成什么', type: '分析', icon: Camera },
  { title: '总结一下我这周的生活踪迹', type: '回顾', icon: Sparkles },
];

export const profileSettings = [
  { label: '天气城市', value: '上海', icon: MapPin },
  { label: '上班时间', value: '09:30', icon: CalendarDays },
  { label: '通勤方式', value: '开车', icon: Car },
  { label: '每日简报', value: '08:10 推送', icon: Bell },
  { label: 'AI 个性化', value: '已开启', icon: Sparkles },
];
