import {
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  Camera,
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
  Plus,
  RefreshCw,
  Route,
  Settings2,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TimerReset,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { LocationPicker } from '@/components/LocationPicker';
import { PantryHouseholdSheet } from '@/components/PantryHouseholdSheet';
import { ProfileAvatarSheet } from '@/components/ProfileAvatarSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { usePantryHouseholdManager } from '@/hooks/usePantryHouseholdManager';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { APP_VERSION_LABEL } from '@/lib/appVersion';
import { gsap, useGSAP } from '@/lib/gsap';
import { formatLocationDisplay } from '@/lib/location';
import { pantryReminderRuleLabels } from '@/lib/pantry';
import { getPwaShareFeedback } from '@/lib/pwa';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { CommuteMethod, PantryReminderRule, UserSettings, WorkdayMode } from '@/types';

const commuteMethods: CommuteMethod[] = ['开车', '地铁', '步行', '骑行', '远程'];
const suggestedHabitOptions = ['喝水', '休息', '运动', '护肤', '早睡', '吃药'];
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
  const navigate = useNavigate();
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [householdSheetOpen, setHouseholdSheetOpen] = useState(false);
  const [habitDraft, setHabitDraft] = useState('');
  const [habitDraftError, setHabitDraftError] = useState('');
  const [notificationTesting, setNotificationTesting] = useState(false);
  const [serverPushBinding, setServerPushBinding] = useState(false);
  const [serverPushTesting, setServerPushTesting] = useState(false);
  const [notificationTestMessage, setNotificationTestMessage] = useState('');
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const settingsLoading = useLifeTraceStore((state) => state.settingsLoading);
  const settingsSaving = useLifeTraceStore((state) => state.settingsSaving);
  const settingsError = useLifeTraceStore((state) => state.settingsError);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const updatePantryPreferences = useLifeTraceStore((state) => state.updatePantryPreferences);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const signOut = useAuthStore((state) => state.signOut);
  const {
    canInstall,
    checkingUpdate,
    clipboardSupported,
    installed,
    iosInstallHint,
    refreshing,
    shareSupported,
    serviceWorkerReady,
    updateAvailable,
    checkForUpdate,
    promptInstall,
    refreshApp,
    shareApp,
  } = usePwaStatus();
  const notification = useNotificationPermission(token);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const {
    households,
    householdsLoaded,
    householdsLoading,
    householdError,
    householdMembers,
    householdMembersLoading,
    invitePayload,
    activeHouseholdId,
    currentHousehold,
    loadHouseholds,
    loadHouseholdMembersFor,
    handleSelectHousehold,
    handleCreateHousehold,
    handleJoinHousehold,
    handleCreateInvite,
    handleLeaveHousehold,
    handleTransferOwner,
    handleDissolveHousehold,
  } = usePantryHouseholdManager();
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
  const serverPushBusy = serverPushBinding || serverPushTesting;
  const notificationDiagnostics = [
    { label: 'HTTPS', ok: notification.secureContext },
    { label: 'PWA', ok: installed },
    { label: 'SW', ok: serviceWorkerReady },
    { label: '权限', ok: notification.granted },
    {
      label: '服务端',
      ok: notification.serverPushReady && !serverPushBusy,
      status: serverPushBinding
        ? '同步中'
        : serverPushTesting
          ? '测试中'
          : notification.serverPushReady
            ? 'OK'
            : '待确认',
    },
  ];
  const locationLabel = formatLocationDisplay(settings.city) || settings.city;
  const activePantrySpaceName = currentHousehold?.name || preferredPantryHouseholdName || '未设置';
  const activePantrySpaceMeta = currentHousehold
    ? currentHousehold.kind === 'personal'
      ? '个人空间'
      : `${currentHousehold.memberCount} 人共享`
    : '今日页和库存页会跟随这里';

  useEffect(() => {
    if (!token || !settingsLoaded || householdsLoaded || householdsLoading) {
      return;
    }

    void loadHouseholds();
  }, [householdsLoaded, householdsLoading, loadHouseholds, settingsLoaded, token]);

  useEffect(() => {
    if (!householdSheetOpen) {
      return;
    }

    void (async () => {
      const nextSelectedHouseholdId = await loadHouseholds();
      if (!nextSelectedHouseholdId) {
        return;
      }

      try {
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      } catch {
        // 成员同步失败时由弹层内部状态提示，无需打断打开流程
      }
    })();
  }, [householdSheetOpen, loadHouseholdMembersFor, loadHouseholds]);

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
    setServerPushBinding(true);
    setNotificationTestMessage('');

    try {
      const bound = await notification.enableServerPush();
      setNotificationTestMessage(
        bound ? '服务端推送已绑定，计划到点后即使应用关闭也能提醒。' : '暂时无法绑定服务端推送。',
      );
    } finally {
      setServerPushBinding(false);
    }
  };

  const handleTestServerPush = async () => {
    setServerPushTesting(true);
    setNotificationTestMessage('');

    try {
      const result = await notification.showServerTestNotification();
      setNotificationTestMessage(
        result.sent ? '服务端测试推送已发送。' : result.error || '服务端测试推送未发送。',
      );
    } finally {
      setServerPushTesting(false);
    }
  };

  const handleCheckPwaUpdate = async () => {
    try {
      const found = await checkForUpdate();
      showToast(
        found ? '发现新版本，可以立即更新' : '当前已经是最新版本',
        found ? 'info' : 'success',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : '检查更新失败，请稍后再试', 'error');
    }
  };

  const handleShareApp = async () => {
    try {
      const result = await shareApp();
      const feedback = getPwaShareFeedback(result);
      showToast(feedback.message, feedback.tone);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '分享失败，请稍后再试', 'error');
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

  const pushSaveMessage = (message: string) => {
    showToast(message);
  };

  const addHabit = (rawValue: string) => {
    const nextHabit = rawValue.trim();
    if (!nextHabit) {
      setHabitDraftError('先输入一个打卡项');
      return;
    }
    if (nextHabit.length > 40) {
      setHabitDraftError('打卡项最多 40 个字');
      return;
    }
    if (settings.habits.includes(nextHabit)) {
      setHabitDraftError('这个打卡项已经存在了');
      return;
    }

    update('habits', [...settings.habits, nextHabit]);
    setHabitDraft('');
    setHabitDraftError('');
  };

  const removeHabit = (habit: string) => {
    update(
      'habits',
      settings.habits.filter((item) => item !== habit),
    );
    setHabitDraftError('');
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
                城市、通勤、提醒和习惯会组成你的今日建议和每日简报。
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
            <button
              type="button"
              className="group relative shrink-0 text-left"
              onClick={() => setAvatarSheetOpen(true)}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={profileName}
                  className="size-16 rounded-[1.4rem] border border-foreground/10 object-cover shadow-[0_16px_40px_rgba(0,0,0,0.24)] transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="grid size-16 place-items-center rounded-[1.4rem] border border-life-ai/20 bg-life-ai text-2xl font-bold text-background shadow-[0_16px_40px_rgba(6,182,212,0.18)] transition duration-300 group-hover:scale-[1.03]">
                  {profileName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span
                data-profile-pulse
                className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-background bg-life-trace text-background"
              >
                <ShieldCheck className="size-3.5" />
              </span>
              <span className="absolute -top-1 -left-1 grid size-6 place-items-center rounded-full border border-background bg-background/90 text-life-ai shadow-lg backdrop-blur">
                <Camera className="size-3.5" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-xl font-semibold transition hover:text-life-ai"
                  onClick={() => setAvatarSheetOpen(true)}
                >
                  {profileName}
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-life-ai/20 bg-life-ai/10 px-2.5 py-1 text-[11px] font-semibold text-life-ai transition hover:bg-life-ai/15"
                  onClick={() => setAvatarSheetOpen(true)}
                >
                  编辑资料
                </button>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {locationLabel} · {settings.commuteMethod}通勤 · {settings.dailyBriefTime} 简报
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
            <LocationPicker value={settings.city} onChange={(value) => update('city', value)}>
              {({ displayValue, openPicker }) => (
                <button
                  type="button"
                  className="rounded-2xl border border-foreground/10 bg-background/35 p-3 text-left backdrop-blur transition hover:border-life-ai/25 hover:bg-background/45"
                  onClick={openPicker}
                >
                  <CloudSun className="mb-2 size-4 text-life-weather" />
                  <p className="truncate text-sm font-semibold">{displayValue}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">天气城市</p>
                </button>
              )}
            </LocationPicker>
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
        <LocationPicker value={settings.city} onChange={(value) => update('city', value)}>
          {({ displayValue, openPicker }) => (
            <button
              type="button"
              className={cn(
                'group flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-border bg-card/80 p-4 text-left transition duration-300',
                'hover:border-foreground/20 hover:bg-card',
              )}
              onClick={openPicker}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai transition group-hover:scale-105">
                  <MapPin className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-muted-foreground">
                    天气城市
                  </span>
                  <span className="mt-1 block truncate text-base font-semibold text-foreground">
                    {displayValue}
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">可改区县</span>
            </button>
          )}
        </LocationPicker>
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
                用来决定 AI 建议、通勤文案和每日简报的默认节奏。
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
                计划提醒、每日简报和库存提醒会参考这里的时间策略。
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
                    {item.label} {item.status ?? (item.ok ? 'OK' : '待确认')}
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
              disabled={!notification.pushSupported || serverPushBusy}
              onClick={() => void handleEnableServerPush()}
            >
              {serverPushBinding ? <ActionLoadingIcon tone="ai" /> : <Wifi className="size-4" />}
              {serverPushBinding ? '绑定中' : notification.serverPushReady ? '已绑定' : '绑定推送'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!notification.serverPushReady || serverPushBusy}
              onClick={() => void handleTestServerPush()}
            >
              {serverPushTesting ? <ActionLoadingIcon tone="ai" /> : <Bell className="size-4" />}
              {serverPushTesting ? '发送中' : '远程测试'}
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
        <SectionHeader title="空间管理" meta={activePantrySpaceName} />
        <Card id="space-management" className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">统一设置当前库存空间</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                在这里选好个人空间或共享家庭后，Today
                页的库存提醒和库存列表都会直接跟随，不需要每次进去再切。
              </p>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-life-ai/20 bg-life-ai/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-life-ai">当前激活空间</p>
                <p className="mt-2 truncate text-lg font-semibold text-foreground">
                  {activePantrySpaceName}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {householdsLoaded || currentHousehold
                    ? activePantrySpaceMeta
                    : '打开空间管理后会同步完整空间信息。'}
                </p>
              </div>
              {householdsLoading ? <Badge tone="ai">同步中</Badge> : null}
            </div>
          </div>

          {householdError ? (
            <p className="text-sm text-life-alert">{householdError}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              创建家庭、加入家庭、邀请家人和切换当前空间，都统一放在这个入口里。
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
            <Button type="button" variant="ai" onClick={() => setHouseholdSheetOpen(true)}>
              <Users className="size-4" />
              管理空间
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/pantry')}>
              查看当前库存
            </Button>
          </div>
        </Card>
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
        <Card className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-trace/10 text-life-trace">
              <Heart className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">自定义你的今日打卡</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                这里保存的是云端打卡清单。像喝药、维生素、遛狗、拉伸这类个人节奏，都可以自己加。
              </p>
            </div>
          </div>

          <div className="flex gap-2 max-[360px]:flex-col">
            <input
              type="text"
              value={habitDraft}
              maxLength={40}
              placeholder="例如：晚饭后吃维生素D"
              className="h-11 flex-1 rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-life-trace/50"
              onChange={(event) => {
                setHabitDraft(event.target.value);
                if (habitDraftError) {
                  setHabitDraftError('');
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addHabit(habitDraft);
                }
              }}
            />
            <Button type="button" variant="ai" onClick={() => addHabit(habitDraft)}>
              <Plus className="size-4" />
              添加
            </Button>
          </div>

          {habitDraftError ? (
            <p className="text-sm text-life-alert">{habitDraftError}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              新增或删除后会自动同步到云端，Today 页和 AI 简报会直接用这份清单。
            </p>
          )}

          {settings.habits.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {settings.habits.map((habit) => (
                <span
                  key={habit}
                  className="inline-flex items-center gap-2 rounded-full border border-life-trace/25 bg-life-trace/10 px-3 py-2 text-sm font-medium text-life-trace"
                >
                  <span className="max-w-[16rem] truncate">{habit}</span>
                  <button
                    type="button"
                    className="grid size-5 place-items-center rounded-full bg-background/60 text-life-trace transition hover:bg-background"
                    aria-label={`删除 ${habit}`}
                    onClick={() => removeHabit(habit)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm leading-6 text-muted-foreground">
              还没有自定义打卡项。先加一个最容易坚持的，比如喝药、喝水或睡前拉伸。
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">快速添加</p>
            <div className="flex flex-wrap gap-2">
              {suggestedHabitOptions
                .filter((habit) => !settings.habits.includes(habit))
                .map((habit) => (
                  <button
                    key={habit}
                    type="button"
                    className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-life-trace/30 hover:text-foreground"
                    onClick={() => addHabit(habit)}
                  >
                    + {habit}
                  </button>
                ))}
            </div>
          </div>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader
          title="应用安装与分享"
          meta={updateAvailable ? '有新版本' : installed ? '已安装' : '可安装'}
        />
        <Card className="relative overflow-hidden border-life-ai/20 bg-card/90 p-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/80 to-transparent"
          />
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              {updateAvailable ? (
                <RefreshCw className="size-5" />
              ) : serviceWorkerReady ? (
                <Smartphone className="size-5" />
              ) : (
                <LoaderCircle className="size-5 animate-spin" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">Life Trace PWA 控制台</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {updateAvailable
                  ? '开发者已发布新内容，刷新后会同步最新页面、名称和图标缓存。'
                  : installed
                    ? '当前已以应用模式运行，可继续检查更新或分享给其他用户。'
                    : canInstall
                      ? '当前浏览器支持一键安装，不必再从分享菜单里找入口。'
                      : iosInstallHint
                        ? 'iPhone 需要从浏览器分享菜单添加到主屏幕，安装后可在这里检查更新。'
                        : '当前浏览器可使用分享或复制链接把应用发给其他用户。'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={installed ? 'trace' : 'default'}>
              {installed ? '已安装' : '浏览器模式'}
            </Badge>
            <Badge tone={serviceWorkerReady ? 'trace' : 'default'}>
              {serviceWorkerReady ? '离线缓存 OK' : '缓存准备中'}
            </Badge>
            <Badge tone={updateAvailable ? 'ai' : 'default'}>
              {updateAvailable ? '发现更新' : '暂无更新'}
            </Badge>
            <Badge tone={shareSupported || clipboardSupported ? 'trace' : 'default'}>
              {shareSupported ? '系统分享' : clipboardSupported ? '可复制链接' : '分享受限'}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 max-[390px]:grid-cols-1">
            {canInstall && !installed ? (
              <Button type="button" variant="ai" size="sm" onClick={() => void promptInstall()}>
                <Download className="size-4" />
                一键安装
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" disabled={installed}>
                <Smartphone className="size-4" />
                {installed ? '已安装' : '添加桌面'}
              </Button>
            )}
            {updateAvailable ? (
              <Button
                type="button"
                variant="ai"
                size="sm"
                disabled={refreshing}
                onClick={() => void refreshApp()}
              >
                <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
                {refreshing ? '刷新中' : '立即更新'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={checkingUpdate}
                onClick={() => void handleCheckPwaUpdate()}
              >
                <RefreshCw className={cn('size-4', checkingUpdate && 'animate-spin')} />
                {checkingUpdate ? '检查中' : '检查更新'}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => void handleShareApp()}>
              <Share2 className="size-4" />
              分享应用
            </Button>
          </div>
          <div className="mt-4 rounded-2xl bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
            <span className="flex min-w-0 items-start gap-2">
              <MoonStar className="mt-0.5 size-4 shrink-0 text-life-plan" />
              <span className="min-w-0 leading-5">
                {iosInstallHint && !canInstall
                  ? 'iPhone 安装仍受 Safari/系统限制：点浏览器分享按钮，再选择“添加到主屏幕”。'
                  : '图标或应用名称变更后，点“检查更新/立即更新”可优先刷新 manifest 与图标缓存。'}
              </span>
            </span>
          </div>
        </Card>
      </section>

      <p className="pb-2 text-center text-xs font-medium text-muted-foreground/70">
        当前版本 {APP_VERSION_LABEL}
      </p>

      <ProfileAvatarSheet
        open={avatarSheetOpen}
        token={token}
        userName={profileName}
        avatarUrl={user?.avatar}
        onOpenChange={setAvatarSheetOpen}
        onProfileUpdated={(profile) => {
          updateUser(profile);
        }}
        onMessage={pushSaveMessage}
      />
      <PantryHouseholdSheet
        open={householdSheetOpen}
        onOpenChange={setHouseholdSheetOpen}
        households={households}
        selectedHouseholdId={activeHouseholdId}
        members={householdMembers}
        membersLoading={householdMembersLoading}
        householdsLoading={householdsLoading}
        invitePayload={invitePayload}
        onSelectHousehold={(householdId) => {
          handleSelectHousehold(householdId);
          void loadHouseholdMembersFor(householdId);
        }}
        onCreateHousehold={async (name) => {
          await handleCreateHousehold(name);
        }}
        onJoinHousehold={async (inviteCode) => {
          await handleJoinHousehold(inviteCode);
        }}
        onCreateInvite={async (householdId) => {
          await handleCreateInvite(householdId);
        }}
        onRefreshMembers={loadHouseholdMembersFor}
        onTransferOwner={handleTransferOwner}
        onLeaveHousehold={handleLeaveHousehold}
        onDissolveHousehold={handleDissolveHousehold}
      />
    </div>
  );
}
