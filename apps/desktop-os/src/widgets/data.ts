export type WidgetAccent = 'terracotta' | 'sky' | 'sage' | 'butter';
export type WidgetKind =
  | 'calendar'
  | 'weather'
  | 'battery'
  | 'music'
  | 'reminders'
  | 'clock'
  | 'focus'
  | 'miniTools'
  | 'games';

export interface DesktopWidget {
  id: string;
  kind: WidgetKind;
  title: string;
  subtitle: string;
  accent: WidgetAccent;
  image: string;
}

export const DESKTOP_WIDGETS: DesktopWidget[] = [
  {
    id: 'calendar',
    kind: 'calendar',
    title: '日历',
    subtitle: '今日',
    accent: 'terracotta',
    image: '/widgets/calendar.png',
  },
  {
    id: 'weather',
    kind: 'weather',
    title: '天气',
    subtitle: '晴朗',
    accent: 'sky',
    image: '/widgets/weather.png',
  },
  {
    id: 'battery',
    kind: 'battery',
    title: '电池',
    subtitle: '桌面状态',
    accent: 'sage',
    image: '/widgets/battery.png',
  },
  {
    id: 'music',
    kind: 'music',
    title: '正在播放',
    subtitle: '音乐',
    accent: 'butter',
    image: '/widgets/music.png',
  },
  {
    id: 'reminders',
    kind: 'reminders',
    title: '提醒事项',
    subtitle: '待办',
    accent: 'sage',
    image: '/widgets/reminders.png',
  },
  {
    id: 'clock',
    kind: 'clock',
    title: '时钟',
    subtitle: '本地时间',
    accent: 'sky',
    image: '/widgets/clock.png',
  },
  {
    id: 'focus',
    kind: 'focus',
    title: '专注钟',
    subtitle: '今日',
    accent: 'sage',
    image: '/widgets/clock.png',
  },
  {
    id: 'mini-tools',
    kind: 'miniTools',
    title: '工具',
    subtitle: '最近',
    accent: 'sky',
    image: '/widgets/reminders.png',
  },
  {
    id: 'games',
    kind: 'games',
    title: '小游戏',
    subtitle: '最佳',
    accent: 'terracotta',
    image: '/widgets/reminders.png',
  },
];
