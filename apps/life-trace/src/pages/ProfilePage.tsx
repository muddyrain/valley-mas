import {
  Bell,
  BriefcaseBusiness,
  Camera,
  Car,
  ChevronRight,
  Clock,
  Disc3,
  Download,
  Heart,
  Leaf,
  Lightbulb,
  LogOut,
  MapPin,
  MessageSquareText,
  MoonStar,
  ReceiptText,
  RefreshCw,
  Repeat,
  Route,
  Share2,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { EntryCard } from '@/components/EntryCard';
import { FeedbackSheet } from '@/components/FeedbackSheet';
import { LocationPicker } from '@/components/LocationPicker';
import { PantryHouseholdDetailSheet } from '@/components/PantryHouseholdDetailSheet';
import { PantryHouseholdSheet } from '@/components/PantryHouseholdSheet';
import { ProfileAvatarSheet } from '@/components/ProfileAvatarSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { SettingInput, SettingToggle, SyncStatus } from '@/components/SettingsControls';
import { ThemeSelector } from '@/components/ThemeSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePantryHouseholdManager } from '@/hooks/usePantryHouseholdManager';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { APP_VERSION_LABEL } from '@/lib/appVersion';
import { gsap, useGSAP } from '@/lib/gsap';
import { getPwaShareFeedback } from '@/lib/pwa';
import { getWorkdayModeMeta } from '@/lib/reminderSettings';
import { getStoredTheme, setStoredTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Achievement, CommuteMethod, UserSettings } from '@/types';

const commuteMethods: CommuteMethod[] = ['开车', '地铁', '步行', '骑行', '远程'];
const canPreviewAchievementToast = import.meta.env.DEV;
const previewAchievementToastDurationMs = 4200;

const commuteIcons: Record<CommuteMethod, typeof Car> = {
  开车: Car,
  地铁: Route,
  步行: MapPin,
  骑行: Zap,
  远程: BriefcaseBusiness,
};

const buildPreviewAchievement = (): Achievement => ({
  code: 'preview_first_plan',
  title: '把想法落到日历上',
  description: '创建第一条生活计划。',
  category: 'plan',
  rarity: 'common',
  icon: 'calendar-plus',
  tone: 'plan',
  hidden: false,
  unlocked: true,
  unlockedAt: new Date().toISOString(),
  progress: 1,
  target: 1,
});

export function ProfilePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [householdSheetOpen, setHouseholdSheetOpen] = useState(false);
  const [householdDetailOpen, setHouseholdDetailOpen] = useState(false);
  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme);
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const settingsLoading = useLifeTraceStore((state) => state.settingsLoading);
  const settingsSaving = useLifeTraceStore((state) => state.settingsSaving);
  const settingsError = useLifeTraceStore((state) => state.settingsError);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const achievementSummary = useLifeTraceStore((state) => state.achievementSummary);
  const recentAchievements = useLifeTraceStore((state) => state.recentAchievements);
  const achievementsLoading = useLifeTraceStore((state) => state.achievementsLoading);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const signOut = useAuthStore((state) => state.signOut);
  const {
    canInstall,
    checkingUpdate,
    installed,
    iosInstallHint,
    refreshing,
    updateAvailable,
    checkForUpdate,
    promptInstall,
    refreshApp,
    shareApp,
  } = usePwaStatus();
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const {
    households,
    householdsLoaded,
    householdsLoading,
    householdError,
    householdMembers,
    householdMembersLoading,
    invitePayload,
    inviteLoading,
    activeHouseholdId,
    currentHousehold,
    loadHouseholds,
    loadHouseholdMembersFor,
    loadHouseholdInvite,
    handleSelectHousehold,
    handleCreateHousehold,
    handleJoinHousehold,
    handleCreateInvite,
    handleRevokeInvite,
    handleLeaveHousehold,
    handleTransferOwner,
    handleDissolveHousehold,
  } = usePantryHouseholdManager();
  const profileName = user?.nickname || user?.username || 'Life Trace 用户';
  const enabledSignals =
    Number(settings.weatherAlerts) +
    Number(settings.planReminders) +
    Number(settings.aiPersonalization);
  const workdayMeta = getWorkdayModeMeta(settings);
  const activePantrySpaceName = currentHousehold?.name || preferredPantryHouseholdName || '未设置';
  const activePantrySpaceMeta = currentHousehold
    ? currentHousehold.kind === 'personal'
      ? '个人空间'
      : `${currentHousehold.memberCount} 人共享`
    : '待同步';
  const ActiveCommuteIcon = commuteIcons[settings.commuteMethod];
  const planReminderMeta =
    settings.planReminderLeadMinutes === 0
      ? '准点提醒'
      : `提前 ${settings.planReminderLeadMinutes} 分钟`;
  const pantryReminderMeta = pantryPreferences.defaultReminderEnabled
    ? `${pantryPreferences.defaultReminderTime} · ${pantryPreferences.defaultReminderRules.length} 个节点`
    : '已关闭';
  const latestAchievement = recentAchievements[0];
  const achievementMeta =
    achievementSummary.total > 0
      ? `${achievementSummary.unlocked}/${achievementSummary.total} 枚`
      : achievementsLoading
        ? '同步中'
        : '待收集';

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

  const previewAchievementToast = () => {
    showToast('收集到「把想法落到日历上」', 'success', previewAchievementToastDurationMs, {
      achievement: buildPreviewAchievement(),
    });
  };

  return (
    <div ref={pageRef} className="space-y-6 px-5 pt-4 max-[360px]:px-4">
      <section
        data-profile-hero
        className="relative overflow-hidden rounded-[1.65rem] border border-border/70 bg-card/80 p-5 shadow-[0_18px_54px_rgba(71,58,42,0.075)] backdrop-blur max-[360px]:p-4"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,rgba(95,146,112,0.13),rgba(255,253,248,0.68),rgba(232,241,235,0.2))]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(104,86,55,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(104,86,55,0.02)_1px,transparent_1px)] bg-[size:24px_24px] opacity-80"
        />
        <div className="relative space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-life-trace">
              <Leaf className="size-4 shrink-0" />
              <span className="truncate">我的生活页</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSelector
                theme={theme}
                onThemeChange={(nextTheme) => {
                  setTheme(nextTheme);
                  setStoredTheme(nextTheme);
                }}
              />
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
          </div>

          <div className="flex items-center gap-[1.125rem] max-[360px]:gap-3.5">
            <button
              type="button"
              className="group relative shrink-0 text-left"
              onClick={() => setAvatarSheetOpen(true)}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={profileName}
                  className="size-[4.6rem] rounded-[1.45rem] border border-foreground/10 object-cover shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition duration-300 group-hover:scale-[1.03] max-[360px]:size-16"
                />
              ) : (
                <div className="grid size-[4.6rem] place-items-center rounded-[1.45rem] border border-life-ai/20 bg-life-ai text-2xl font-bold text-primary-foreground shadow-[0_16px_40px_rgba(95,146,112,0.18)] transition duration-300 group-hover:scale-[1.03] max-[360px]:size-16">
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
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-[1.72rem] font-semibold leading-tight transition hover:text-life-ai max-[360px]:text-[1.45rem]"
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
              <p className="mt-2 truncate text-[0.95rem] text-muted-foreground">今天也在好好生活</p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1.4fr] gap-3 max-[360px]:grid-cols-1">
            <div className="group relative overflow-hidden rounded-[1.35rem] border border-border/60 bg-card/80 p-4 shadow-[0_4px_18px_rgba(71,58,42,0.06)] transition duration-300 hover:border-foreground/15 hover:shadow-[0_8px_28px_rgba(71,58,42,0.1)] backdrop-blur">
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-life-plan/10 text-life-plan transition duration-200 group-hover:bg-life-plan/15">
                <Clock className="size-5" />
              </div>
              <p className="truncate text-base font-semibold leading-tight">
                {settings.workStart} - {settings.workEnd}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">工作时段</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
              <div className="group relative overflow-hidden rounded-[1.35rem] border border-border/60 bg-card/80 p-4 shadow-[0_4px_18px_rgba(71,58,42,0.06)] transition duration-300 hover:border-foreground/15 hover:shadow-[0_8px_28px_rgba(71,58,42,0.1)] backdrop-blur">
                <div className="mb-3 grid size-10 place-items-center rounded-xl bg-life-ai/10 text-life-ai transition duration-200 group-hover:bg-life-ai/15">
                  <ActiveCommuteIcon className="size-5" />
                </div>
                <p className="truncate text-base font-semibold leading-tight">
                  {settings.commuteMethod}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">通勤方式</p>
              </div>
              <div className="group relative overflow-hidden rounded-[1.35rem] border border-border/60 bg-card/80 p-4 shadow-[0_4px_18px_rgba(71,58,42,0.06)] transition duration-300 hover:border-foreground/15 hover:shadow-[0_8px_28px_rgba(71,58,42,0.1)] backdrop-blur">
                <div className="mb-3 grid size-10 place-items-center rounded-xl bg-life-trace/10 text-life-trace transition duration-200 group-hover:bg-life-trace/15">
                  <Heart className="size-5" />
                </div>
                <p className="truncate text-base font-semibold leading-tight">
                  {enabledSignals} 项
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">提醒开启</p>
              </div>
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

      <section data-profile-card className="space-y-3">
        <SectionHeader title="生活偏好" meta="城市 / 时间 / 通勤" />
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
                    天气与简报定位
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
          label="简报时间"
          value={settings.dailyBriefTime}
          icon={Bell}
          tone="trace"
          placeholder="08:10"
          type="time"
          onChange={(value) => update('dailyBriefTime', value)}
        />
        <div className="grid grid-cols-5 gap-2 max-[390px]:grid-cols-3">
          {commuteMethods.map((method) => {
            const Icon = commuteIcons[method];
            const active = settings.commuteMethod === method;

            return (
              <button
                key={method}
                type="button"
                className={cn(
                  'group grid min-h-16 place-items-center rounded-[1.1rem] border px-2 py-2 text-xs font-semibold transition duration-300',
                  active
                    ? 'border-life-ai/50 bg-life-ai text-background shadow-[0_14px_38px_rgba(6,182,212,0.14)]'
                    : 'border-border bg-card/80 text-muted-foreground hover:border-foreground/20 hover:bg-card',
                )}
                aria-pressed={active}
                onClick={() => update('commuteMethod', method)}
              >
                <Icon className="mb-1.5 size-5 transition group-hover:-translate-y-0.5 motion-reduce:transition-none" />
                {method}
              </button>
            );
          })}
        </div>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="提醒设置" meta="通知 / 节奏 / Pantry" />
        <Card className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">通知、节奏和库存提醒</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                统一管理提醒状态和通知方式。
              </p>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-plan/10 text-life-plan">
              <Bell className="size-5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <div className="rounded-[1.15rem] border border-border bg-secondary/55 p-3">
              <p className="text-xs font-semibold text-muted-foreground">计划提醒</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {settings.planReminders ? planReminderMeta : '已关闭'}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-border bg-secondary/55 p-3">
              <p className="text-xs font-semibold text-muted-foreground">提醒节奏</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{workdayMeta}</p>
            </div>
            <div className="rounded-[1.15rem] border border-border bg-secondary/55 p-3 max-[360px]:col-span-1 sm:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground">库存默认提醒</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{pantryReminderMeta}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={settings.weatherAlerts ? 'weather' : 'default'}>
              {settings.weatherAlerts ? '天气风险开启' : '天气风险关闭'}
            </Badge>
            <Badge tone={pantryPreferences.defaultReminderEnabled ? 'health' : 'default'}>
              {pantryPreferences.defaultReminderEnabled ? '库存提醒开启' : '库存提醒关闭'}
            </Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => navigate('/profile/reminders')}
          >
            打开提醒设置
            <ChevronRight className="size-4" />
          </Button>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="个人工具" meta="灵感 / 轻账本 / 订阅 / 采购" />
        <Card className="grid gap-3 p-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 text-left"
            onClick={() => navigate('/inbox')}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Lightbulb className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">灵感</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                写下一闪而过的想法、段落和链接。
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border pt-3 text-left"
            onClick={() => navigate('/places')}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-trace/10 text-life-trace">
              <MapPin className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">地点库</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                收藏常去地点，回看相关计划和踪迹。
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border pt-3 text-left"
            onClick={() => navigate('/ledger')}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <ReceiptText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">轻账本</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">记录支出、收入和退款。</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border pt-3 text-left"
            onClick={() => navigate('/recurring-payments')}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <Repeat className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">订阅与续费</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                统一管理周期性支出，到期前会发提醒。
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border pt-3 text-left"
            onClick={() => navigate('/shopping')}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <ShoppingBasket className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">采购清单</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                把要买的东西先记下来，逛超市或下单时一目了然。
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="智能偏好" meta={settings.aiPersonalization ? '已开启' : '已关闭'} />
        <SettingToggle
          label="AI 个性化"
          detail="根据计划和偏好生成今日建议"
          icon={Sparkles}
          active={settings.aiPersonalization}
          onToggle={() => update('aiPersonalization', !settings.aiPersonalization)}
        />
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="生活成就" meta={achievementMeta} />
        <Card className="relative overflow-hidden border-life-ai/20 p-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/70 to-transparent"
          />
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Trophy className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">生活徽章馆</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {latestAchievement
                  ? `最近收集到「${latestAchievement.title}」。`
                  : '慢慢收集日常里的小进展。'}
              </p>
            </div>
            <Badge tone={achievementSummary.unlocked > 0 ? 'ai' : 'default'}>
              {achievementSummary.unlocked} 枚
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">本月新增</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {achievementSummary.monthlyNew}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">少见成就</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {achievementSummary.rareUnlocked}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">已收集</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {achievementSummary.unlocked}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => navigate('/achievements')}
            >
              打开生活成就
              <ChevronRight className="size-4" />
            </Button>
            {canPreviewAchievementToast ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={previewAchievementToast}
              >
                预览收集提示
                <Sparkles className="size-4" />
              </Button>
            ) : null}
          </div>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="库存与家庭" meta={activePantrySpaceName} />
        <Card id="space-management" className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">库存与家庭空间</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                当前库存、家庭成员和共享提醒。
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
                    : '打开家庭设置后会同步完整空间信息。'}
                </p>
              </div>
              {householdsLoading ? <Badge tone="ai">同步中</Badge> : null}
            </div>
          </div>

          {householdError ? (
            <p className="text-sm text-life-alert">{householdError}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              创建家庭、邀请家人、切换空间。
            </p>
          )}

          <div
            className={cn(
              'grid gap-2 max-[360px]:grid-cols-1',
              currentHousehold?.kind === 'shared' && currentHousehold.status === 'active'
                ? 'grid-cols-3'
                : 'grid-cols-2',
            )}
          >
            <Button type="button" variant="ai" onClick={() => setHouseholdSheetOpen(true)}>
              <Users className="size-4" />
              管理空间
            </Button>
            {currentHousehold?.kind === 'shared' && currentHousehold.status === 'active' ? (
              <Button type="button" variant="outline" onClick={() => setHouseholdDetailOpen(true)}>
                查看空间详情
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate('/pantry')}>
              查看当前库存
            </Button>
          </div>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="衣橱与穿搭" meta="日用搭配" />
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-life-ai/20 bg-card p-4 text-left transition hover:border-life-ai/35 hover:bg-card/95"
          onClick={() => navigate('/closet')}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Shirt className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">衣橱</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                单品、共享衣物池和今日穿搭
              </span>
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="书影音" meta="日记" />
        <EntryCard
          icon={Disc3}
          badge="打开"
          title="书影音日记"
          description="书籍、电影、剧集、动漫和音乐"
          tone="trace"
          onClick={() => navigate('/media-diary')}
        />
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
              ) : (
                <Smartphone className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">安装和分享 Life Trace</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {updateAvailable
                  ? '有新内容可用，刷新后会立即同步到当前设备。'
                  : installed
                    ? '当前已以应用模式运行，可以继续检查更新或分享给其他用户。'
                    : canInstall
                      ? '放到桌面后可以更快打开。'
                      : iosInstallHint
                        ? '从浏览器分享菜单添加到主屏幕。'
                        : '浏览器访问和分享都可继续使用。'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={installed ? 'trace' : 'default'}>
              {installed ? '已安装' : '浏览器模式'}
            </Badge>
            <Badge tone={updateAvailable ? 'ai' : 'default'}>
              {updateAvailable ? '发现更新' : '暂无更新'}
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
                {refreshing ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
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
                {checkingUpdate ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
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
                  : '遇到页面内容没有更新时，点“检查更新”或“立即更新”刷新到最新版本。'}
              </span>
            </span>
          </div>
        </Card>
      </section>

      <section data-profile-card className="space-y-3">
        <SectionHeader title="反馈" meta="Life Trace" />
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-border bg-card p-4 text-left transition hover:border-life-ai/35 hover:bg-card/95"
          onClick={() => setFeedbackSheetOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <MessageSquareText className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">问题反馈</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                发内容和截图，管理员会在后台处理。
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-life-ai/25 bg-life-ai/10 px-3 py-1 text-xs font-semibold text-life-ai">
            反馈
          </span>
        </button>
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
        householdsLoading={householdsLoading}
        onSelectHousehold={handleSelectHousehold}
        onCreateHousehold={async (name) => {
          await handleCreateHousehold(name);
        }}
        onJoinHousehold={async (inviteCode) => {
          await handleJoinHousehold(inviteCode);
        }}
      />
      <PantryHouseholdDetailSheet
        open={householdDetailOpen}
        onOpenChange={setHouseholdDetailOpen}
        household={currentHousehold?.kind === 'shared' ? currentHousehold : null}
        members={householdMembers}
        membersLoading={householdMembersLoading}
        invitePayload={invitePayload}
        inviteLoading={inviteLoading}
        onLoadInvite={loadHouseholdInvite}
        onCreateInvite={async (householdId) => {
          await handleCreateInvite(householdId);
        }}
        onRevokeInvite={async (householdId) => {
          await handleRevokeInvite(householdId);
        }}
        onRefreshMembers={loadHouseholdMembersFor}
        onTransferOwner={handleTransferOwner}
        onLeaveHousehold={handleLeaveHousehold}
        onDissolveHousehold={handleDissolveHousehold}
      />
      <FeedbackSheet open={feedbackSheetOpen} onOpenChange={setFeedbackSheetOpen} />
    </div>
  );
}
