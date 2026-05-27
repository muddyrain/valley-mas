import {
  Bell,
  BriefcaseBusiness,
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
  ShieldCheck,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { CommuteMethod, UserSettings } from '@/types';

const commuteMethods: CommuteMethod[] = ['开车', '地铁', '步行', '骑行', '远程'];
const habitOptions = ['喝水', '休息', '运动', '护肤', '早睡', '吃药'];

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
          <input
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 h-7 w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
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
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoading = useLifeTraceStore((state) => state.settingsLoading);
  const settingsSaving = useLifeTraceStore((state) => state.settingsSaving);
  const settingsError = useLifeTraceStore((state) => state.settingsError);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { canInstall, installed, serviceWorkerReady, promptInstall } = usePwaStatus();
  const profileName = user?.nickname || user?.username || 'Life Trace 用户';
  const enabledSignals =
    Number(settings.weatherAlerts) +
    Number(settings.planReminders) +
    Number(settings.aiPersonalization);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    updateSettings({ [key]: value });
  };

  const toggleHabit = (habit: string) => {
    const nextHabits = settings.habits.includes(habit)
      ? settings.habits.filter((item) => item !== habit)
      : [...settings.habits, habit];

    update('habits', nextHabits);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-life-ai/20 bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
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
              <p className="text-sm font-semibold text-life-ai">Life Trace Profile</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight">我的生活参数</h1>
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
              <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-background bg-life-trace text-background">
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

          <div className="grid grid-cols-3 gap-2">
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

      <section className="space-y-3">
        <SectionHeader title="生活偏好" meta="云端同步" />
        <SettingInput
          label="天气城市"
          value={settings.city}
          icon={MapPin}
          tone="ai"
          placeholder="例如：上海"
          onChange={(value) => update('city', value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <SettingInput
            label="上班时间"
            value={settings.workStart}
            icon={BriefcaseBusiness}
            tone="plan"
            placeholder="09:30"
            onChange={(value) => update('workStart', value)}
          />
          <SettingInput
            label="下班时间"
            value={settings.workEnd}
            icon={Clock}
            tone="health"
            placeholder="18:30"
            onChange={(value) => update('workEnd', value)}
          />
        </div>
        <SettingInput
          label="每日简报"
          value={settings.dailyBriefTime}
          icon={Bell}
          tone="trace"
          placeholder="08:10"
          onChange={(value) => update('dailyBriefTime', value)}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="通勤方式" meta={settings.commuteMethod} />
        <div className="grid grid-cols-5 gap-2">
          {commuteMethods.map((method) => {
            const Icon = commuteIcons[method];
            const active = settings.commuteMethod === method;

            return (
              <button
                key={method}
                type="button"
                className={cn(
                  'group grid min-h-20 place-items-center rounded-[1.25rem] border px-2 py-3 text-xs font-semibold transition duration-300',
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

      <section className="space-y-3">
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
        <SettingToggle
          label="AI 个性化"
          detail="根据计划、打卡和偏好生成今日建议"
          icon={Sparkles}
          active={settings.aiPersonalization}
          onToggle={() => update('aiPersonalization', !settings.aiPersonalization)}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="每日打卡" meta={`${settings.habits.length} 项已开启`} />
        <div className="grid grid-cols-2 gap-3">
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

      <section className="space-y-3">
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
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <MoonStar className="size-4 text-life-plan" />
              {serviceWorkerReady ? '离线缓存已准备好' : '离线缓存准备中'}
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
