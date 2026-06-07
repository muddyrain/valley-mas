import {
  Bell,
  CalendarCheck,
  Clock,
  CloudSun,
  MoonStar,
  Sparkles,
  TimerReset,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { previewDailyBriefPush } from '@/api/push';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { SectionHeader } from '@/components/SectionHeader';
import {
  SegmentedOption,
  SettingInput,
  SettingToggle,
  SyncStatus,
} from '@/components/SettingsControls';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { pantryReminderRuleLabels } from '@/lib/pantry';
import {
  getSelectedWorkdayLabels,
  getWorkdayModeMeta,
  reminderLeadOptions,
  weekdayOptions,
  workdayModeOptions,
} from '@/lib/reminderSettings';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { PantryReminderRule, UserSettings } from '@/types';

const pantryReminderRuleOptions: PantryReminderRule[] = ['7d', '3d', 'same-day', 'expired'];

export function ReminderSettingsPage() {
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const [dailyBriefPreviewing, setDailyBriefPreviewing] = useState(false);
  const [notificationTesting, setNotificationTesting] = useState(false);
  const [serverPushTesting, setServerPushTesting] = useState(false);
  const [serverPushBinding, setServerPushBinding] = useState(false);
  const [notificationTestMessage, setNotificationTestMessage] = useState('');
  const token = useAuthStore((state) => state.token);
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoading = useLifeTraceStore((state) => state.settingsLoading);
  const settingsSaving = useLifeTraceStore((state) => state.settingsSaving);
  const settingsError = useLifeTraceStore((state) => state.settingsError);
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const updatePantryPreferences = useLifeTraceStore((state) => state.updatePantryPreferences);
  const notification = useNotificationPermission(token);

  const workdayMeta = getWorkdayModeMeta(settings);
  const selectedWorkdayLabels = getSelectedWorkdayLabels(settings.workdays) || '未选择';
  const planReminderMeta =
    settings.planReminderLeadMinutes === 0
      ? '准点提醒'
      : `提前 ${settings.planReminderLeadMinutes} 分钟`;
  const pantryReminderOverviewMeta = pantryPreferences.defaultReminderEnabled
    ? `${pantryPreferences.defaultReminderTime} · ${pantryPreferences.defaultReminderRules.length} 个节点`
    : '已关闭';
  const enabledSignals = Number(settings.weatherAlerts) + Number(settings.planReminders);
  const serviceWorkerLabel = !notification.secureContext
    ? '需要 HTTPS / localhost'
    : 'serviceWorker' in navigator
      ? '已就绪'
      : '不可用';

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    updateSettings({ [key]: value });
  };

  const toggleWorkday = (day: string) => {
    const nextWorkdays = settings.workdays.includes(day)
      ? settings.workdays.filter((item) => item !== day)
      : [...settings.workdays, day].sort();

    update('workdays', nextWorkdays.length > 0 ? nextWorkdays : ['1', '2', '3', '4', '5']);
  };

  const handleRequestPermission = async () => {
    setPermissionRequesting(true);
    setNotificationTestMessage('');

    try {
      await notification.requestPermission();
    } finally {
      setPermissionRequesting(false);
    }
  };

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

  const handleServerPushTest = async () => {
    setServerPushTesting(true);
    setNotificationTestMessage('');
    try {
      const result = await notification.showServerTestNotification();
      setNotificationTestMessage(
        result.sent
          ? result.rebound
            ? '服务端测试通知已送出，设备已重新绑定。'
            : '服务端测试通知已送出，请看设备是否收到。'
          : result.error || '服务端测试通知失败。',
      );
    } finally {
      setServerPushTesting(false);
    }
  };

  const handlePreviewDailyBrief = async () => {
    if (!token) {
      setNotificationTestMessage('未登录，暂时无法预览每日简报通知。');
      return;
    }

    setDailyBriefPreviewing(true);
    setNotificationTestMessage('');

    try {
      let permission = notification.permission;
      if (permission !== 'granted') {
        permission = await notification.requestPermission();
      }
      if (permission !== 'granted') {
        setNotificationTestMessage('请先开启系统通知，才能预览每日简报。');
        return;
      }

      const payload = await previewDailyBriefPush(token);
      const sent = await notification.showPreviewNotification(payload);
      setNotificationTestMessage(
        sent ? '简报预览已发送，请查看系统通知。' : '当前环境还不能发送简报通知。',
      );
    } catch (error) {
      setNotificationTestMessage(error instanceof Error ? error.message : '预览简报通知失败');
    } finally {
      setDailyBriefPreviewing(false);
    }
  };

  return (
    <SubPageShell title="提醒设置" eyebrow="通知 / 节奏 / Pantry" backTo="/profile">
      <div className="space-y-6 pb-2">
        <section className="space-y-3">
          <Card className="relative space-y-4 overflow-hidden border-life-ai/20 bg-card/90 p-4">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/80 to-transparent"
            />
            <div className="relative flex flex-col gap-3 min-[391px]:flex-row min-[391px]:items-start min-[391px]:justify-between">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-life-ai/20 bg-life-ai/10 px-3 py-1 text-xs font-semibold text-life-ai">
                  <Sparkles className="size-3.5" />
                  提醒总览
                </div>
                <h2 className="mt-3 text-lg font-semibold">把“什么时候提醒”和“哪天提醒”拆开看</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  计划提前提醒只控制开始前多久提醒，工作日和周末节奏控制的是哪天触发，不再混在一个块里。
                </p>
              </div>
              <div className="min-[391px]:shrink-0">
                <SyncStatus
                  loading={settingsLoading}
                  saving={settingsSaving}
                  error={settingsError}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 max-[390px]:grid-cols-2">
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3">
                <p className="text-xs font-semibold text-muted-foreground">计划提醒</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {settings.planReminders ? planReminderMeta : '已关闭'}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3">
                <p className="text-xs font-semibold text-muted-foreground">提醒节奏</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{workdayMeta}</p>
              </div>
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3 max-[390px]:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground">库存默认提醒</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {pantryReminderOverviewMeta}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="通知诊断" meta="权限 / SW / Push" />
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3">
                <p className="text-xs font-semibold text-muted-foreground">权限状态</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{notification.label}</p>
              </div>
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Service Worker</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{serviceWorkerLabel}</p>
              </div>
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Push 绑定</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {notification.serverPushLabel}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-border bg-secondary/55 p-3">
                <p className="text-xs font-semibold text-muted-foreground">最近测试</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {notificationTestMessage || '还没跑过测试'}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="提醒类型" meta={`${enabledSignals}/2 已开启`} />
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
        </section>

        <section className="space-y-3">
          <SectionHeader title="每日简报" meta={`${settings.dailyBriefTime} 推送`} />
          <Card className="space-y-4 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              这条通知会组合天气城市、今天计划和打卡进度来生成。现在就可以按当前设置发一条出来，看实际长什么样。
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="weather">天气城市：{settings.city}</Badge>
              <Badge tone="plan">简报时间：{settings.dailyBriefTime}</Badge>
              <Badge tone="trace">打卡清单：{settings.habits.length} 项</Badge>
            </div>
            <Button
              type="button"
              variant="ai"
              size="sm"
              disabled={dailyBriefPreviewing}
              onClick={() => void handlePreviewDailyBrief()}
            >
              {dailyBriefPreviewing ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : (
                <Bell className="size-4" />
              )}
              {dailyBriefPreviewing ? '发送中' : '立即预览简报通知'}
            </Button>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="计划提醒" meta={planReminderMeta} />
          <Card className="space-y-4 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              这里只控制计划开始前多久提醒，不区分工作日还是周末。
            </p>
            <div className="grid grid-cols-6 gap-2 max-[390px]:grid-cols-3">
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
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="提醒节奏" meta={workdayMeta} />
          <Card className="space-y-4 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              这组设置决定哪些日期会进入提醒节奏，不会改变计划的提前提醒时机。
            </p>
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
            <SettingToggle
              label="同步法定节假日"
              detail="已内置 2026 年中国法定节假日与调休，节奏判断会优先读取。"
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
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="勿扰时间" meta={`${settings.quietStart} - ${settings.quietEnd}`} />
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
        </section>

        <section className="space-y-3">
          <SectionHeader
            title="库存提醒"
            meta={pantryPreferences.defaultReminderEnabled ? '默认开启' : '默认关闭'}
          />
          <Card className="space-y-4 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              新增商品时会先继承这里，单个商品仍然可以在编辑页覆盖。
            </p>
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
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="系统通知" meta={notification.granted ? '系统通知已开' : '待开启'} />
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={notification.granted ? 'trace' : 'default'}>{notification.label}</Badge>
              <Badge tone={notification.serverPushReady ? 'ai' : 'default'}>
                {notification.serverPushLabel}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              iPhone 需要通过 HTTPS 打开并添加到主屏幕后，再从桌面图标进入开启通知。
            </p>
            {notificationTestMessage ? (
              <p className="text-sm leading-6 text-life-ai">{notificationTestMessage}</p>
            ) : null}
            <div className="grid grid-cols-3 gap-2 max-[390px]:grid-cols-1">
              <Button
                type="button"
                variant={notification.granted ? 'secondary' : 'ai'}
                size="sm"
                disabled={!notification.supported || notification.granted || permissionRequesting}
                onClick={() => void handleRequestPermission()}
              >
                {permissionRequesting ? <ActionLoadingIcon className="size-4" tone="ai" /> : null}
                {notification.granted ? '已开启' : permissionRequesting ? '开启中' : '开启通知'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!notification.granted || notificationTesting}
                onClick={() => void handleTestNotification()}
              >
                {notificationTesting ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <Bell className="size-4" />
                )}
                {notificationTesting ? '测试中' : '本地测试'}
              </Button>
              <Button
                type="button"
                variant={notification.serverPushReady ? 'secondary' : 'ai'}
                size="sm"
                disabled={!notification.pushSupported || serverPushBinding}
                onClick={() => void handleEnableServerPush()}
              >
                {serverPushBinding ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <Wifi className="size-4" />
                )}
                {serverPushBinding
                  ? '绑定中'
                  : notification.serverPushReady
                    ? '重新绑定'
                    : '绑定推送'}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!notification.serverPushReady || serverPushTesting}
              onClick={() => void handleServerPushTest()}
            >
              {serverPushTesting ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : (
                <Wifi className="size-4" />
              )}
              {serverPushTesting ? '测试中' : '服务端测试'}
            </Button>
          </Card>
        </section>
      </div>
    </SubPageShell>
  );
}
