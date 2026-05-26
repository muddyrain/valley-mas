import {
  Bell,
  BriefcaseBusiness,
  Car,
  Clock,
  Download,
  Heart,
  MapPin,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { CommuteMethod, UserSettings } from '@/types';

const commuteMethods: CommuteMethod[] = ['开车', '地铁', '步行', '骑行', '远程'];
const habitOptions = ['喝水', '休息', '运动', '护肤', '早睡', '吃药'];

type SettingInputProps = {
  label: string;
  value: string;
  icon: typeof MapPin;
  placeholder?: string;
  onChange: (value: string) => void;
};

function SettingInput({ label, value, icon: Icon, placeholder, onChange }: SettingInputProps) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-secondary text-life-ai">
          <Icon className="size-5" />
        </div>
        <span className="font-semibold">{label}</span>
      </div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
      />
    </Card>
  );
}

function SettingToggle({
  label,
  detail,
  active,
  onToggle,
}: {
  label: string;
  detail: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <h3 className="font-semibold">{label}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
      <button
        type="button"
        className={`h-7 w-12 rounded-full p-1 transition ${active ? 'bg-life-trace' : 'bg-secondary'}`}
        onClick={onToggle}
      >
        <span
          className={`block size-5 rounded-full bg-foreground transition ${
            active ? 'translate-x-5 bg-background' : 'translate-x-0'
          }`}
        />
      </button>
    </Card>
  );
}

export function ProfilePage() {
  const settings = useLifeTraceStore((state) => state.settings);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const { canInstall, installed, serviceWorkerReady, promptInstall } = usePwaStatus();

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
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">我的</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          设置城市、通勤、提醒和打卡偏好，让今日简报更像为你准备。
        </p>
      </header>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-life-ai text-xl font-bold text-background">
            L
          </div>
          <div>
            <h2 className="text-xl font-semibold">Life Trace 用户</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings.city} · {settings.commuteMethod}通勤 · {settings.dailyBriefTime} 简报
            </p>
          </div>
        </div>
      </Card>

      <section>
        <SectionHeader title="生活偏好" />
        <div className="space-y-3">
          <SettingInput
            label="天气城市"
            value={settings.city}
            icon={MapPin}
            placeholder="例如：上海"
            onChange={(value) => update('city', value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <SettingInput
              label="上班时间"
              value={settings.workStart}
              icon={BriefcaseBusiness}
              placeholder="09:30"
              onChange={(value) => update('workStart', value)}
            />
            <SettingInput
              label="下班时间"
              value={settings.workEnd}
              icon={Clock}
              placeholder="18:30"
              onChange={(value) => update('workEnd', value)}
            />
          </div>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-secondary text-life-ai">
                <Car className="size-5" />
              </div>
              <span className="font-semibold">通勤方式</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {commuteMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                    settings.commuteMethod === method
                      ? 'bg-life-ai text-background'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                  onClick={() => update('commuteMethod', method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </Card>
          <SettingInput
            label="每日简报"
            value={settings.dailyBriefTime}
            icon={Bell}
            placeholder="08:10"
            onChange={(value) => update('dailyBriefTime', value)}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="提醒偏好" />
        <div className="space-y-3">
          <SettingToggle
            label="天气风险提醒"
            detail="降雨、温差、紫外线变化时提醒"
            active={settings.weatherAlerts}
            onToggle={() => update('weatherAlerts', !settings.weatherAlerts)}
          />
          <SettingToggle
            label="计划提醒"
            detail="计划开始前提醒，并可完成后生成踪迹"
            active={settings.planReminders}
            onToggle={() => update('planReminders', !settings.planReminders)}
          />
          <SettingToggle
            label="AI 个性化"
            detail="根据计划、打卡和偏好生成今日建议"
            active={settings.aiPersonalization}
            onToggle={() => update('aiPersonalization', !settings.aiPersonalization)}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="每日打卡" meta={`${settings.habits.length} 项已开启`} />
        <div className="grid grid-cols-2 gap-3">
          {habitOptions.map((habit) => {
            const active = settings.habits.includes(habit);

            return (
              <button
                key={habit}
                type="button"
                className={`flex items-center justify-between rounded-[1.25rem] border p-4 transition ${
                  active
                    ? 'border-life-trace/30 bg-life-trace/10 text-life-trace'
                    : 'border-border bg-card text-muted-foreground'
                }`}
                onClick={() => toggleHabit(habit)}
              >
                <span className="font-semibold">{habit}</span>
                <Heart className="size-4" />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="安装体验" />
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Download className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">添加到手机桌面</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {installed
                  ? '当前已以应用模式运行。'
                  : canInstall
                    ? '当前浏览器支持一键安装。'
                    : 'iPhone 可通过浏览器分享菜单添加到主屏幕。'}
              </p>
            </div>
          </div>
          {canInstall ? (
            <Button type="button" variant="ai" className="w-full" onClick={promptInstall}>
              安装 Life Trace
            </Button>
          ) : null}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wifi className={serviceWorkerReady ? 'size-4 text-life-trace' : 'size-4'} />
            {serviceWorkerReady ? '离线缓存已准备好' : '离线缓存准备中'}
          </div>
        </Card>
      </section>

      <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <Sparkles className="size-5 text-life-ai" />
        这些设置已保存在本机浏览器，后续接入账号后可同步到云端。
      </Card>
    </div>
  );
}
