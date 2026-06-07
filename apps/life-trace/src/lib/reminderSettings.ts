import type { UserSettings, WorkdayMode } from '@/types';

export const weekdayOptions = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
  { value: '3', label: '三' },
  { value: '4', label: '四' },
  { value: '5', label: '五' },
  { value: '6', label: '六' },
  { value: '7', label: '日' },
] as const;

export const workdayModeOptions: Array<{
  value: WorkdayMode;
  label: string;
  detail: string;
}> = [
  { value: 'legal', label: '法定', detail: '跟随节假日' },
  { value: 'custom', label: '自定义', detail: '按周选择' },
  { value: 'daily', label: '每天', detail: '每日生效' },
];

export const reminderLeadOptions = [0, 5, 10, 15, 30, 60] as const;

export function getSelectedWorkdayLabels(workdays: string[]) {
  return weekdayOptions
    .filter((option) => workdays.includes(option.value))
    .map((option) => option.label)
    .join('、');
}

export function getWorkdayModeMeta(settings: Pick<UserSettings, 'workdayMode' | 'workdays'>) {
  const selectedWorkdayLabels = getSelectedWorkdayLabels(settings.workdays);
  if (settings.workdayMode === 'legal') {
    return '法定工作日';
  }
  if (settings.workdayMode === 'daily') {
    return '每天生效';
  }
  return selectedWorkdayLabels || '未选择';
}
