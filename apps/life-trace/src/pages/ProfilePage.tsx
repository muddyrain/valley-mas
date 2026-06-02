import {
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  CloudSun,
  Download,
  Heart,
  LoaderCircle,
  LogOut,
  type LucideIcon,
  MapPin,
  MoonStar,
  Route,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TimerReset,
  Wifi,
  Zap,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { gsap, useGSAP } from '@/lib/gsap';
import { pantryReminderRuleLabels } from '@/lib/pantry';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { CommuteMethod, PantryReminderRule, UserSettings, WorkdayMode } from '@/types';

const commuteMethods: CommuteMethod[] = ['开车', '地铁', '步行', '骑行', '远程'];
const habitOptions = ['喝水', '休息', '运动', '护肤', '早睡', '吃药'];
const weekdayOptions = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
  { value: '3', label: '三' },
  { value: '4', label: '四' },
  { value: '5', label: '五' },
  { value: '6', label: '六' },
  { value: '7', label: '日' },
];
const workdayModeOptions: Array<{ value: WorkdayMode; label: string; detail: string }> = [
  { value: 'legal', label: '法定', detail: '跟随节假日' },
  { value: 'custom', label: '自定义', detail: '按周选择' },
  { value: 'daily', label: '每天', detail: '每日生效' },
];
const reminderLeadOptions = [0, 5, 10, 15, 30, 60];
const pantryReminderRuleOptions: PantryReminderRule[] = ['7d', '3d', 'same-day', 'expired'];

const commuteIcons: Record<CommuteMethod, LucideIcon> = {
  开车: Car,
  地铁: Route,
  步行: MapPin,
  骑行: Zap,
  远程: BriefcaseBusiness,
};

type SettingInputProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'ai' | 'trace' | 'health' | 'plan';
  placeholder?: string;
  type?: 'text' | 'time';
  onChange: (value: string) => void;
};

const toneClasses = {
  ai: {
    icon: 'bg-life-ai/10 text-life-ai',
    border: 'focus-within:border-life-ai/60 focus-within:shadow-[0_0_28px_rgba(6,182,212,0.12)]',
  },
  trace: {
    icon: 'bg-life-trace/10 text-life-trace',
    border:
      'focus-within:border-life-trace/60 focus-within:shadow-[0_0_28px_rgba(16,185,129,0.12)]',
  },
  health: {
    icon: 'bg-life-health/10 text-life-health',
    border:
      'focus-within:border-life-health/60 focus-within:shadow-[0_0_28px_rgba(245,158,11,0.12)]',
  },
  plan: {
    icon: 'bg-life-plan/10 text-life-plan',
    border: 'focus-within:border-life-plan/60 focus-within:shadow-[0_0_28px_rgba(139,92,246,0.12)]',
  },
};

function SettingInput({
  label,
  value,
  icon: Icon,
  tone,
  placeholder,
  type = 'text',
  onChange,
}: SettingInputProps) {
  return (
    <label
      className={cn(
        'group block rounded-[1.35rem] border border-border bg-card/80 p-4 transition duration-300',
        'hover:border-foreground/20 hover:bg-card',
        toneClasses[tone].border,
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-2xl transition group-focus-within:scale-105',
            toneClasses[tone].icon,
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
          {type === 'time' ? (
            <span className="relative mt-1 block h-7">
              <span className="block h-7 truncate text-base font-semibold text-foreground">
                {value || placeholder}
              </span>
              <input
                type="time"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                step={60}
                className="absolute inset-0 h-7 w-full cursor-pointer opacity-0"
              />
            </span>
          ) : (
            <input
              type={type}
              value={value}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
              className="mt-1 h-7 w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
          )}
        </span>
      </span>
    </label>
  );
}

function SettingToggle({
  label,
  detail,
  active,
  icon: Icon,
  onToggle,
}: {
  label: string;
  detail: string;
  active: boolean;
  icon: LucideIcon;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-center justify-between gap-4 rounded-[1.35rem] border p-4 text-left transition duration-300',
        active
          ? 'border-life-trace/35 bg-life-trace/10 shadow-[0_18px_52px_rgba(16,185,129,0.08)]'
          : 'border-border bg-card/80 hover:border-foreground/20 hover:bg-card',
      )}
      onClick={onToggle}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-2xl transition duration-300 group-hover:scale-105',
            active ? 'bg-life-trace text-background' : 'bg-secondary text-muted-foreground',
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{label}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>
        </span>
      </span>
      <span
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full p-1 transition duration-300',
          active ? 'bg-life-trace' : 'bg-secondary',
        )}
      >
        <span
          className={cn(
            'block size-6 rounded-full bg-foreground transition duration-300',
            active ? 'translate-x-6 bg-background shadow-[0_0_18px_rgba(250,250,250,0.25)]' : '',
          )}
        />
      </span>
    </button>
  );
}

function SegmentedOption<T extends string>({
  value,
  label,
  detail,
  active,
  onSelect,
}: {
  value: T;
  label: string;
  detail?: string;
  active: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'min-h-16 rounded-[1.1rem] border px-3 py-2 text-left transition duration-300',
        active
          ? 'border-life-ai/45 bg-life-ai/10 text-life-ai shadow-[0_14px_42px_rgba(6,182,212,0.08)]'
          : 'border-border bg-card/80 text-muted-foreground hover:border-foreground/20 hover:bg-card',
      )}
      aria-pressed={active}
      onClick={() => onSelect(value)}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {detail ? (
        <span className="mt-1 block text-xs leading-4 text-muted-foreground">{detail}</span>
      ) : null}
    </button>
  );
}

function SyncStatus({
  loading,
  saving,
  error,
}: {
  loading: boolean;
  saving: boolean;
  error: string;
}) {
  if (!loading && !saving && !error) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-life-trace/25 bg-life-trace/10 px-3 py-1.5 text-xs font-semibold text-life-trace">
        <CheckCircle2 className="size-3.5" />
        云端已同步
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full border px-3 py-1.5 text-xs font-semibold',
        error
          ? 'border-life-alert/35 bg-life-alert/10 text-life-alert'
          : 'border-life-ai/30 bg-life-ai/10 text-life-ai',
      )}
    >
      {!error ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 -left-1/2 w-1/2 animate-[life-profile-sheen_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/15 to-transparent motion-reduce:animate-none"
        />
      ) : null}
      <span className="relative flex items-center gap-2">
        {error ? null : <ActionLoadingIcon tone="ai" />}
        {error ? error : loading ? '同步云端偏好' : '保存偏好中'}
      </span>
    </div>
  );
}

export function ProfilePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [notificationTesting, setNotificationTesting] = useState(false);
  const [serverPushTesting, setServerPushTesting] = useState(false);
  const [notificationTestMessage, setNotificationTestMessage] = useState('');
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoading = useLifeTraceStore((state) => state.settingsLoading);
  const settingsSaving = useLifeTraceStore((state) => state.settingsSaving);
  const settingsError = useLifeTraceStore((state) => state.settingsError);
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const updatePantryPreferences = useLifeTraceStore((state) => state.updatePantryPreferences);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { canInstall, installed, serviceWorkerReady, promptInstall } = usePwaStatus();
  const notification = useNotificationPermission(token);
  const profileName = user?.nickname || user?.username || 'Life Trace 用户';
  const enabledSignals =
    Number(settings.weatherAlerts) +
    Number(settings.planReminders) +
    Number(settings.aiPersonalization);
  const signalProgress = Math.round((enabledSignals / 3) * 100);
  const selectedWorkdayLabels = weekdayOptions
    .filter((option) => settings.workdays.includes(option.value))
    .map((option) => option.label)
    .join('、');
  const workdayMeta =
    settings.workdayMode === 'legal'
      ? '法定工作日'
      : settings.workdayMode === 'daily'
        ? '每天生效'
        : selectedWorkdayLabels || '未选择';
  const notificationDiagnostics = [
    { label: 'HTTPS', ok: notification.secureContext },
    { label: 'PWA', ok: installed },
    { label: 'SW', ok: serviceWorkerReady },
    { label: '权限', ok: notification.granted },
    { label: '服务端', ok: notification.serverPushReady },
  ];

  const handleTestNotification = async () => {
    setNotificationTesting(true);
    setNotificationTestMessage('');

    try {
      const sent = await notification.showTestNotification();
      setNotificationTestMessage(
        sent ? '测试通知已发送，请查看系统通知。' : '当前环境还不能发送通知。',
      );
    } catch (error) {
      setNotificationTestMessage(error instanceof Error ? error.message : '测试通知发送失败');
    } finally {
      setNotificationTesting(false);
    }
  };

  const handleEnableServerPush = async () => {
    setServerPushTesting(true);
    setNotificationTestMessage('');

    try {
      const bound = await notification.enableServerPush();
      setNotificationTestMessage(
        bound ? '服务端推送已绑定，计划到点后即使应用关闭也能提醒。' : '暂时无法绑定服务端推送。',
      );
    } finally {
      setServerPushTesting(false);
    }
  };

  const handleTestServerPush = async () => {
    setServerPushTesting(true);
    setNotificationTestMessage('');

    try {
      const sent = await notification.showServerTestNotification();
      setNotificationTestMessage(sent ? '服务端测试推送已发送。' : '服务端测试推送未发送。');
    } finally {
      setServerPushTesting(false);
    }
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline();

        timeline
          .from('[data-profile-hero]', {
            autoAlpha: 0,
            y: 18,
            scale: 0.985,
            duration: 0.48,
          })
          .from(
            '[data-profile-card]',
            {
              autoAlpha: 0,
              y: 16,
              scale: 0.985,
              stagger: 0.06,
              duration: 0.42,
            },
            '-=0.24',
          );

        gsap.to('[data-profile-pulse]', {
          scale: 1.08,
          autoAlpha: 0.68,
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      return () => mm.revert();
    },
    { scope: pageRef },
  );

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    updateSettings({ [key]: value });
  };

  const toggleHabit = (habit: string) => {
    const nextHabits = settings.habits.includes(habit)
      ? settings.habits.filter((item) => item !== habit)
      : [...settings.habits, habit];

    update('habits', nextHabits);
  };

  const toggleWorkday = (day: string) => {
    const nextWorkdays = settings.workdays.includes(day)
      ? settings.workdays.filter((item) => item !== day)
      : [...settings.workdays, day].sort();

    update('workdays', nextWorkdays.length > 0 ? nextWorkdays : ['1', '2', '3', '4', '5']);
  };

  return (
    <div ref={pageRef} className="space-y-6">
      <section
        data-profile-hero
        className="relative overflow-hidden rounded-[2rem] border border-life-ai/20 bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] max-[360px]:p-4"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(6,182,212,0.24),rgba(16,185,129,0.14),rgba(139,92,246,0.18))]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(250,250,250,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(250,250,250,0.035)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50"
        />
        <div className="relative space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-life-ai/25 bg-life-ai/10 px-3 py-1 text-xs font-semibold text-life-ai">
                <Settings2 className="size-3.5" />
                Life Trace Settings
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight max-[360px]:text-2xl">
                我的生活参数
              </h1>
              <p className="mt-4 max-w-[24ch] text-sm leading-7 text-muted-foreground">
                城市、通勤、提醒和习惯会组成你的每日简报。
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative z-10 rounded-2xl bg-background/30 text-muted-foreground backdrop-blur hover:bg-background/50"
              aria-label="退出登录"
              onClick={() => void signOut()}
            >
              <LogOut className="size-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={profileName}
                  className="size-16 rounded-[1.4rem] border border-foreground/10 object-cover shadow-[0_16px_40px_rgba(0,0,0,0.24)]"
                />
              ) : (
                <div className="grid size-16 place-items-center rounded-[1.4rem] border border-life-ai/20 bg-life-ai text-2xl font-bold text-background shadow-[0_16px_40px_rgba(6,182,212,0.18)]">
                  {profileName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span
                data-profile-pulse
                className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-background bg-life-trace text-background"
              >
                <ShieldCheck className="size-3.5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold">{profileName}</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {settings.city} · {settings.commuteMethod}通勤 · {settings.dailyBriefTime} 简报
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
            <div className="rounded-2xl border border-foreground/10 bg-background/35 p-3 backdrop-blur">
              <CloudSun className="mb-2 size-4 text-life-weather" />
              <p className="truncate text-sm font-semibold">{settings.city}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">天气城市</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-background/35 p-3 backdrop-blur">
              <Bell className="mb-2 size-4 text-life-ai" />
              <p className="truncate text-sm font-semibold">{settings.dailyBriefTime}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">每日简报</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-background/35 p-3 backdrop-blur">
              <Heart className="mb-2 size-4 text-life-trace" />
              <p className="truncate text-sm font-semibold">{settings.habits.length} 项</p>
              <p className="mt-1 text-[11px] text-muted-foreground">打卡开启</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <SyncStatus loading={settingsLoading} saving={settingsSaving} error={settingsError} />
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-secondary text-life-plan">
                <Sparkles className="size-3.5" />
              </span>
              {enabledSignals}/3 智能信号
            </div>
          </div>
        </div>
      </section>

      <section data-profile-card className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
        <div className="rounded-[1.35rem] border border-life-ai/20 bg-life-ai/10 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Sparkles className="size-4 text-life-ai" />
            <span className="text-xs font-semibold text-life-ai">{signalProgress}%</span>
          </div>
          <p className="text-sm font-semibold">智能建议</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{enabledSignals} 项开启</p>
        </div>
        <div className="rounded-[1.35rem] border border-life-health/20 bg-life-health/10 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Bell className="size-4 text-life-health" />
            <span className="text-xs font-semibold text-life-health">
              {notification.granted ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-sm font-semibold">系统通知</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {notification.granted ? '已授权' : '待开启'}
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-life-plan/20 bg-life-plan/10 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Smartphone className="size-4 text-life-plan" />
            <span className="text-xs font-semibold text-life-plan">
              {installed ? 'APP' : 'WEB'}
            </span>
          </div>
          <p className="text-sm font-semibold">使用模式</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {installed ? '桌面应用' : '浏览器'}
          </p>
        </div>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="生活偏好" meta="云端同步" />
        <SettingInput
          label="天气城市"
          value={settings.city}
          icon={MapPin}
          tone="ai"
          placeholder="例如：上海"
          onChange={(value) => update('city', value)}
        />
        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <SettingInput
            label="上班时间"
            value={settings.workStart}
            icon={BriefcaseBusiness}
            tone="plan"
            placeholder="09:30"
            type="time"
            onChange={(value) => update('workStart', value)}
          />
          <SettingInput
            label="下班时间"
            value={settings.workEnd}
            icon={Clock}
            tone="health"
            placeholder="18:30"
            type="time"
            onChange={(value) => update('workEnd', value)}
          />
        </div>
        <SettingInput
          label="每日简报"
          value={settings.dailyBriefTime}
          icon={Bell}
          tone="trace"
          placeholder="08:10"
          type="time"
          onChange={(value) => update('dailyBriefTime', value)}
        />
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="工作日与提醒策略" meta={workdayMeta} />
        <Card className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-plan/10 text-life-plan">
              <CalendarCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">工作日规则</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                用来决定通勤、上班提醒和每日简报的默认节奏。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
            {workdayModeOptions.map((option) => (
              <SegmentedOption
                key={option.value}
                value={option.value}
                label={option.label}
                detail={option.detail}
                active={settings.workdayMode === option.value}
                onSelect={(value) => update('workdayMode', value)}
              />
            ))}
          </div>
          {settings.workdayMode === 'custom' ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">自定义上班日</p>
                <span className="text-xs text-muted-foreground">{selectedWorkdayLabels}</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {weekdayOptions.map((option) => {
                  const active = settings.workdays.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'grid min-h-10 place-items-center rounded-xl border text-sm font-semibold transition',
                        active
                          ? 'border-life-plan/45 bg-life-plan/10 text-life-plan'
                          : 'border-border bg-secondary text-muted-foreground',
                      )}
                      aria-pressed={active}
                      onClick={() => toggleWorkday(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <TimerReset className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">提醒节奏</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                后续计划提醒、每日简报和天气预警都会优先读取这里。
              </p>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">计划提前提醒</p>
              <span className="text-xs text-muted-foreground">
                {settings.planReminderLeadMinutes === 0
                  ? '准点提醒'
                  : `提前 ${settings.planReminderLeadMinutes} 分钟`}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-[390px]:grid-cols-3">
              {reminderLeadOptions.map((minutes) => {
                const active = settings.planReminderLeadMinutes === minutes;

                return (
                  <button
                    key={minutes}
                    type="button"
                    className={cn(
                      'min-h-10 rounded-xl border px-2 text-sm font-semibold transition',
                      active
                        ? 'border-life-health/45 bg-life-health/10 text-life-health'
                        : 'border-border bg-secondary text-muted-foreground',
                    )}
                    aria-pressed={active}
                    onClick={() => update('planReminderLeadMinutes', minutes)}
                  >
                    {minutes === 0 ? '准点' : `${minutes}m`}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <SettingInput
              label="勿扰开始"
              value={settings.quietStart}
              icon={MoonStar}
              tone="plan"
              placeholder="22:30"
              type="time"
              onChange={(value) => update('quietStart', value)}
            />
            <SettingInput
              label="勿扰结束"
              value={settings.quietEnd}
              icon={Clock}
              tone="health"
              placeholder="07:30"
              type="time"
              onChange={(value) => update('quietEnd', value)}
            />
          </div>
        </Card>
        <SettingToggle
          label="同步法定节假日"
          detail="已内置 2026 年中国法定节假日与调休，上班提醒会优先读取。"
          icon={CalendarCheck}
          active={settings.holidaySync}
          onToggle={() => update('holidaySync', !settings.holidaySync)}
        />
        <SettingToggle
          label="周末也提醒"
          detail="适合周末仍需要计划、运动或家庭事务提醒。"
          icon={Bell}
          active={settings.weekendReminders}
          onToggle={() => update('weekendReminders', !settings.weekendReminders)}
        />
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="通勤方式" meta={settings.commuteMethod} />
        <div className="grid grid-cols-5 gap-2 max-[390px]:grid-cols-3">
          {commuteMethods.map((method) => {
            const Icon = commuteIcons[method];
            const active = settings.commuteMethod === method;

            return (
              <button
                key={method}
                type="button"
                className={cn(
                  'group grid min-h-20 place-items-center rounded-[1.25rem] border px-2 py-3 text-xs font-semibold transition duration-300 max-[390px]:min-h-16',
                  active
                    ? 'border-life-ai/50 bg-life-ai text-background shadow-[0_18px_50px_rgba(6,182,212,0.16)]'
                    : 'border-border bg-card/80 text-muted-foreground hover:border-foreground/20 hover:bg-card',
                )}
                onClick={() => update('commuteMethod', method)}
              >
                <Icon className="mb-2 size-5 transition group-hover:-translate-y-0.5 motion-reduce:transition-none" />
                {method}
              </button>
            );
          })}
        </div>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="提醒偏好" meta={`${enabledSignals} 项开启`} />
        <SettingToggle
          label="天气风险提醒"
          detail="降雨、温差、紫外线变化时提醒"
          icon={CloudSun}
          active={settings.weatherAlerts}
          onToggle={() => update('weatherAlerts', !settings.weatherAlerts)}
        />
        <SettingToggle
          label="计划提醒"
          detail="计划开始前提醒，并可完成后生成踪迹"
          icon={Bell}
          active={settings.planReminders}
          onToggle={() => update('planReminders', !settings.planReminders)}
        />
        <Card className="p-4">
          <div className="flex items-start gap-3 max-[360px]:gap-2">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <Bell className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">系统通知</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{notification.label}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {notification.serverPushLabel}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {notificationDiagnostics.map((item) => (
                  <Badge key={item.label} tone={item.ok ? 'trace' : 'default'}>
                    {item.label} {item.ok ? 'OK' : '待确认'}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                iPhone 需要通过 HTTPS 打开并添加到主屏幕后，从桌面图标进入再开启通知。
                远程测试用于确认服务端能主动推送，不是当前页面本地弹窗。
              </p>
              {notificationTestMessage ? (
                <p className="mt-2 text-xs leading-5 text-life-ai">{notificationTestMessage}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
            <Button
              type="button"
              variant={notification.granted ? 'secondary' : 'ai'}
              size="sm"
              disabled={!notification.supported || notification.granted}
              onClick={() => void notification.requestPermission()}
            >
              {notification.granted ? '已开启' : '开启通知'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!notification.granted || notificationTesting}
              onClick={() => void handleTestNotification()}
            >
              {notificationTesting ? <ActionLoadingIcon tone="ai" /> : <Bell className="size-4" />}
              本地测试
            </Button>
            <Button
              type="button"
              variant={notification.serverPushReady ? 'secondary' : 'ai'}
              size="sm"
              disabled={!notification.pushSupported || serverPushTesting}
              onClick={() => void handleEnableServerPush()}
            >
              {serverPushTesting && !notification.serverPushReady ? (
                <ActionLoadingIcon tone="ai" />
              ) : (
                <Wifi className="size-4" />
              )}
              {notification.serverPushReady ? '已绑定' : '绑定推送'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!notification.serverPushReady || serverPushTesting}
              onClick={() => void handleTestServerPush()}
            >
              {serverPushTesting && notification.serverPushReady ? (
                <ActionLoadingIcon tone="ai" />
              ) : (
                <Bell className="size-4" />
              )}
              远程测试
            </Button>
          </div>
        </Card>
        <Card className="border-life-ai/15 bg-life-ai/5 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">真机提醒验收</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                先用 HTTPS preview 在手机上完成安装和授权，再创建一个 1-2
                分钟后到期的计划，等待系统通知并点击回到计划页。
              </p>
            </div>
          </div>
        </Card>
        <SettingToggle
          label="AI 个性化"
          detail="根据计划、打卡和偏好生成今日建议"
          icon={Sparkles}
          active={settings.aiPersonalization}
          onToggle={() => update('aiPersonalization', !settings.aiPersonalization)}
        />
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="家庭库存提醒" meta="本机默认" />
        <Card className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <Bell className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">库存默认提醒</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                新增商品时会先继承这里。单个商品仍然可以在编辑页覆盖。
              </p>
            </div>
          </div>
          <SettingToggle
            label="默认开启库存提醒"
            detail="默认会在临期、到期和已过期时提醒你。"
            icon={Bell}
            active={pantryPreferences.defaultReminderEnabled}
            onToggle={() =>
              updatePantryPreferences({
                defaultReminderEnabled: !pantryPreferences.defaultReminderEnabled,
              })
            }
          />
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">默认提醒节点</p>
              <span className="text-xs text-muted-foreground">
                {pantryPreferences.defaultReminderRules
                  .map((rule) => pantryReminderRuleLabels[rule])
                  .join(' / ')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2">
              {pantryReminderRuleOptions.map((rule) => {
                const active = pantryPreferences.defaultReminderRules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    className={cn(
                      'h-10 rounded-2xl border px-2 text-sm font-semibold transition',
                      active
                        ? 'border-life-health/45 bg-life-health/10 text-life-health'
                        : 'border-border bg-secondary text-muted-foreground',
                    )}
                    onClick={() =>
                      updatePantryPreferences({
                        defaultReminderRules: active
                          ? pantryPreferences.defaultReminderRules.filter((item) => item !== rule)
                          : [...pantryPreferences.defaultReminderRules, rule],
                      })
                    }
                  >
                    {pantryReminderRuleLabels[rule]}
                  </button>
                );
              })}
            </div>
          </div>
          <SettingInput
            label="库存提醒时间"
            value={pantryPreferences.defaultReminderTime}
            icon={TimerReset}
            tone="health"
            placeholder="09:00"
            type="time"
            onChange={(value) => updatePantryPreferences({ defaultReminderTime: value })}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            这组库存规则会跟随 Life Trace 账户同步，新设备登录后也能继续沿用。
          </p>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="每日打卡" meta={`${settings.habits.length} 项已开启`} />
        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          {habitOptions.map((habit) => {
            const active = settings.habits.includes(habit);

            return (
              <button
                key={habit}
                type="button"
                className={cn(
                  'group relative min-h-20 overflow-hidden rounded-[1.35rem] border p-4 text-left transition duration-300',
                  active
                    ? 'border-life-trace/35 bg-life-trace/10 text-life-trace shadow-[0_16px_45px_rgba(16,185,129,0.08)]'
                    : 'border-border bg-card/80 text-muted-foreground hover:border-foreground/20 hover:bg-card',
                )}
                onClick={() => toggleHabit(habit)}
              >
                <span className="relative flex items-center justify-between gap-3">
                  <span className="font-semibold">{habit}</span>
                  <Heart
                    className={cn(
                      'size-4 transition group-hover:scale-110 motion-reduce:transition-none',
                      active ? 'fill-current' : '',
                    )}
                  />
                </span>
                <span className="relative mt-3 block h-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-all duration-500',
                      active ? 'w-full bg-life-trace' : 'w-1/3 bg-muted-foreground/30',
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="安装体验" />
        <Card className="relative overflow-hidden border-life-ai/20 bg-card/90 p-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/80 to-transparent"
          />
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              {serviceWorkerReady ? (
                <Wifi className="size-5" />
              ) : (
                <LoaderCircle className="size-5 animate-spin" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">添加到手机桌面</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {installed
                  ? '当前已以应用模式运行。'
                  : canInstall
                    ? '当前浏览器支持一键安装。'
                    : 'iPhone 可通过浏览器分享菜单添加到主屏幕。'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary/70 px-3 py-2 text-sm text-muted-foreground max-[360px]:items-start">
            <span className="flex min-w-0 items-center gap-2">
              <MoonStar className="size-4 text-life-plan" />
              <span className="truncate">
                {serviceWorkerReady ? '离线缓存已准备好' : '离线缓存准备中'}
              </span>
            </span>
            {canInstall ? (
              <Button type="button" variant="ai" size="sm" onClick={promptInstall}>
                <Download className="size-4" />
                安装
              </Button>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
