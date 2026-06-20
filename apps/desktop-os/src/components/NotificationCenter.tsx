import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { WeatherApiResponse } from '../api/weather';
import { getDefaultWindowOptions } from '../apps/desktopApps';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { getMusicTrack } from '../music/catalog';
import { formatDuration } from '../music/lyrics';
import { useAuthStore } from '../store/authStore';
import { useControlCenterStore } from '../store/controlCenterStore';
import { useMusicStore } from '../store/musicStore';
import { type Notification, useNotificationCenterStore } from '../store/notificationCenterStore';
import { FOCUS_LABELS, formatTimer, useToolStore } from '../store/toolStore';
import { useWeatherStore } from '../store/weatherStore';
import { useWindowStore } from '../store/windowStore';
import EmptyState from '../ui/EmptyState';
import { DESKTOP_WIDGETS, type DesktopWidget } from '../widgets/data';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const isOpen = useNotificationCenterStore((s) => s.isOpen);

  if (!isOpen) return null;

  return <NotificationCenterPanel />;
}

function NotificationCenterPanel() {
  const close = useNotificationCenterStore((s) => s.close);
  const notifications = useNotificationCenterStore((s) => s.notifications);
  const loading = useNotificationCenterStore((s) => s.loading);
  const error = useNotificationCenterStore((s) => s.error);
  const dismiss = useNotificationCenterStore((s) => s.dismiss);
  const clearAll = useNotificationCenterStore((s) => s.clearAll);
  const loadNotifications = useNotificationCenterStore((s) => s.loadNotifications);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const brightness = useControlCenterStore((s) => s.brightness);
  const dnd = useControlCenterStore((s) => s.doNotDisturb);
  const weather = useWeatherStore((s) => s.weather);
  const weatherLoading = useWeatherStore((s) => s.loading);
  const weatherLocating = useWeatherStore((s) => s.locating);
  const weatherError = useWeatherStore((s) => s.error);
  const loadWeather = useWeatherStore((s) => s.loadWeather);
  const currentMusicId = useMusicStore((s) => s.currentTrackId);
  const musicPlaying = useMusicStore((s) => s.isPlaying);
  const musicBuffering = useMusicStore((s) => s.isBuffering);
  const musicProgress = useMusicStore((s) => s.progress);
  const musicDuration = useMusicStore((s) => s.duration);
  const toggleMusic = useMusicStore((s) => s.togglePlay);
  const focusMode = useToolStore((s) => s.focusMode);
  const focusStatus = useToolStore((s) => s.focusStatus);
  const focusRemaining = useToolStore((s) => s.focusRemainingSeconds);
  const focusCompletedCount = useToolStore((s) => s.focusCompletedCount);
  const plushMatchBest = useToolStore((s) => s.plushMatchBest);
  const deskTidyBest = useToolStore((s) => s.deskTidyBest);
  const beadSortBest = useToolStore((s) => s.beadSortBest);
  const cloudBounceBest = useToolStore((s) => s.cloudBounceBest);
  const blockDropBest = useToolStore((s) => s.blockDropBest);
  const snakeBest = useToolStore((s) => s.snakeBest);
  const clipboardSnippets = useToolStore((s) => s.clipboardSnippets);
  const converterRecent = useToolStore((s) => s.converterRecent);
  const paletteColors = useToolStore((s) => s.paletteColors);
  const plushGarden = useToolStore((s) => s.plushGarden);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadWeather();
    if (isAuthenticated && token) void loadNotifications(token);
  }, [isAuthenticated, loadNotifications, loadWeather, token]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  const today = formatToday(new Date());
  const visibleNotifications = dnd ? [] : notifications.filter((item) => !item.isRead);
  const currentMusic = getMusicTrack(currentMusicId);
  const musicLoadingVisible = useDelayedFlag(musicBuffering);

  return (
    <div ref={panelRef} className="notification-center" role="dialog" aria-label="通知中心">
      <div className="nc__date">
        <span className="nc__date-week">{today.week}</span>
        <span className="nc__date-day">{today.day}</span>
        <span className="nc__date-month">{today.monthLong}</span>
      </div>

      <section className="nc__section">
        <header className="nc__section-header">
          <span>通知</span>
          {visibleNotifications.length > 0 && (
            <button type="button" className="nc__clear-all" onClick={() => void clearAll(token)}>
              全部清除
            </button>
          )}
        </header>
        {loading ? (
          <EmptyState className="nc__empty" icon="⌁" title="正在同步通知" description="请稍候" />
        ) : error ? (
          <EmptyState
            className="nc__empty"
            icon="!"
            title="通知同步失败"
            description={error}
            tone="danger"
          />
        ) : visibleNotifications.length === 0 ? (
          <EmptyState
            className="nc__empty"
            icon={dnd ? '☾' : '◇'}
            title={dnd ? '勿扰已开启' : '暂无新通知'}
            description={dnd ? '通知已静音' : '稍后再看'}
          />
        ) : (
          <ul className="nc__list">
            {visibleNotifications.map((n) => (
              <NotificationCard key={n.id} item={n} onDismiss={() => void dismiss(n.id, token)} />
            ))}
          </ul>
        )}
      </section>

      <section className="nc__section">
        <header className="nc__section-header">
          <span>小组件</span>
        </header>
        <div className="nc__widgets">
          {DESKTOP_WIDGETS.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              today={today}
              brightness={brightness}
              weather={weather}
              weatherLoading={weatherLoading}
              weatherLocating={weatherLocating}
              weatherError={weatherError}
              currentMusic={currentMusic}
              musicPlaying={musicPlaying}
              musicBuffering={musicLoadingVisible}
              musicProgress={musicProgress}
              musicDuration={musicDuration}
              focusMode={focusMode}
              focusStatus={focusStatus}
              focusRemaining={focusRemaining}
              focusCompletedCount={focusCompletedCount}
              plushMatchBest={plushMatchBest}
              deskTidyBest={deskTidyBest}
              beadSortBest={beadSortBest}
              cloudBounceBest={cloudBounceBest}
              blockDropBest={blockDropBest}
              snakeBest={snakeBest}
              clipboardSnippets={clipboardSnippets.length}
              converterRecent={converterRecent.length}
              paletteColors={paletteColors.length}
              plushGardenBlooms={plushGarden.blooms}
              onOpenWeather={() => {
                restoreOrFocus('weather', getDefaultWindowOptions('weather'));
                close();
              }}
              onRefreshWeather={() => loadWeather(true)}
              onOpenMusic={() => {
                restoreOrFocus('music', getDefaultWindowOptions('music'));
                close();
              }}
              onToggleMusic={toggleMusic}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface NotificationCardProps {
  item: Notification;
  onDismiss: () => void;
}

function NotificationCard({ item, onDismiss }: NotificationCardProps) {
  return (
    <li className="nc__card">
      <div className="nc__card-head">
        <span className="nc__card-app">{item.app}</span>
        <span className="nc__card-time">{relativeTime(item.createdAt)}</span>
        <button type="button" className="nc__card-close" onClick={onDismiss} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="nc__card-title">{item.title}</div>
      <div className="nc__card-body">{item.body}</div>
    </li>
  );
}

interface WidgetCardProps {
  widget: DesktopWidget;
  today: ReturnType<typeof formatToday>;
  brightness: number;
  weather: WeatherApiResponse | null;
  weatherLoading: boolean;
  weatherLocating: boolean;
  weatherError: string | null;
  currentMusic: ReturnType<typeof getMusicTrack>;
  musicPlaying: boolean;
  musicBuffering: boolean;
  musicProgress: number;
  musicDuration: number;
  focusMode: ReturnType<typeof useToolStore.getState>['focusMode'];
  focusStatus: ReturnType<typeof useToolStore.getState>['focusStatus'];
  focusRemaining: number;
  focusCompletedCount: number;
  plushMatchBest: ReturnType<typeof useToolStore.getState>['plushMatchBest'];
  deskTidyBest: ReturnType<typeof useToolStore.getState>['deskTidyBest'];
  beadSortBest: ReturnType<typeof useToolStore.getState>['beadSortBest'];
  cloudBounceBest: ReturnType<typeof useToolStore.getState>['cloudBounceBest'];
  blockDropBest: ReturnType<typeof useToolStore.getState>['blockDropBest'];
  snakeBest: ReturnType<typeof useToolStore.getState>['snakeBest'];
  clipboardSnippets: number;
  converterRecent: number;
  paletteColors: number;
  plushGardenBlooms: number;
  onOpenWeather: () => void;
  onRefreshWeather: () => void;
  onOpenMusic: () => void;
  onToggleMusic: () => void;
}

function WidgetCard({
  widget,
  today,
  brightness,
  weather,
  weatherLoading,
  weatherLocating,
  weatherError,
  currentMusic,
  musicPlaying,
  musicBuffering,
  musicProgress,
  musicDuration,
  focusMode,
  focusStatus,
  focusRemaining,
  focusCompletedCount,
  plushMatchBest,
  deskTidyBest,
  beadSortBest,
  cloudBounceBest,
  blockDropBest,
  snakeBest,
  clipboardSnippets,
  converterRecent,
  paletteColors,
  plushGardenBlooms,
  onOpenWeather,
  onRefreshWeather,
  onOpenMusic,
  onToggleMusic,
}: WidgetCardProps) {
  return (
    <div className={`widget widget--${widget.accent}`}>
      <img className="widget__bg" src={widget.image} alt="" aria-hidden />
      <div className="widget__header">
        <span className="widget__title">{widget.title}</span>
        <span className="widget__subtitle">{getWidgetSubtitle(widget, today, weather)}</span>
      </div>
      <div className="widget__body">
        <WidgetBody
          widget={widget}
          today={today}
          brightness={brightness}
          weather={weather}
          weatherLoading={weatherLoading}
          weatherLocating={weatherLocating}
          weatherError={weatherError}
          currentMusic={currentMusic}
          musicPlaying={musicPlaying}
          musicBuffering={musicBuffering}
          musicProgress={musicProgress}
          musicDuration={musicDuration}
          focusMode={focusMode}
          focusStatus={focusStatus}
          focusRemaining={focusRemaining}
          focusCompletedCount={focusCompletedCount}
          plushMatchBest={plushMatchBest}
          deskTidyBest={deskTidyBest}
          beadSortBest={beadSortBest}
          cloudBounceBest={cloudBounceBest}
          blockDropBest={blockDropBest}
          snakeBest={snakeBest}
          clipboardSnippets={clipboardSnippets}
          converterRecent={converterRecent}
          paletteColors={paletteColors}
          plushGardenBlooms={plushGardenBlooms}
          onOpenWeather={onOpenWeather}
          onRefreshWeather={onRefreshWeather}
          onOpenMusic={onOpenMusic}
          onToggleMusic={onToggleMusic}
        />
      </div>
    </div>
  );
}

function WidgetBody({
  widget,
  today,
  brightness,
  weather,
  weatherLoading,
  weatherLocating,
  weatherError,
  currentMusic,
  musicPlaying,
  musicBuffering,
  musicProgress,
  musicDuration,
  focusMode,
  focusStatus,
  focusRemaining,
  focusCompletedCount,
  plushMatchBest,
  deskTidyBest,
  beadSortBest,
  cloudBounceBest,
  blockDropBest,
  snakeBest,
  clipboardSnippets,
  converterRecent,
  paletteColors,
  plushGardenBlooms,
  onOpenWeather,
  onRefreshWeather,
  onOpenMusic,
  onToggleMusic,
}: WidgetCardProps) {
  switch (widget.kind) {
    case 'calendar':
      return (
        <div className="widget-calendar">
          <div className="widget-calendar__day">{today.day}</div>
          <div className="widget-calendar__hint">无日程安排</div>
        </div>
      );
    case 'weather':
      return (
        <div className="widget-weather">
          <div className="widget-weather__actions">
            <button type="button" onClick={onOpenWeather}>
              打开
            </button>
            <button
              type="button"
              onClick={onRefreshWeather}
              disabled={weatherLoading || weatherLocating}
              aria-label="刷新天气"
            >
              {weatherLoading || weatherLocating ? '更新中' : '刷新'}
            </button>
          </div>
          <div className="widget-weather__temp">{formatWeatherTemperature(weather?.now.temp)}</div>
          <div className="widget-weather__text">
            {getWeatherText(weather, weatherLocating, weatherLoading)}
          </div>
          <div className="widget-weather__hint">{getWeatherHint(weather, weatherError)}</div>
        </div>
      );
    case 'battery':
      return (
        <div className="widget-battery">
          <div className="widget-battery__pct">{Math.round(brightness)}%</div>
          <div className="widget-battery__hint">桌面亮度</div>
        </div>
      );
    case 'music':
      return (
        <div className="widget-music">
          <div className="widget-music__track">{currentMusic.title}</div>
          <div className="widget-music__artist">{currentMusic.artist}</div>
          <div className={`widget-music__state ${musicBuffering ? 'is-loading' : ''}`}>
            {musicBuffering ? (
              <>
                <LoaderCircle className="widget-music__loading-icon" aria-hidden />
                加载中
              </>
            ) : musicPlaying ? (
              '播放中'
            ) : (
              currentMusic.mood
            )}{' '}
            · {formatDuration(musicProgress)}
          </div>
          <div className="widget-music__bar">
            <div
              className="widget-music__bar-fill"
              style={{
                width: `${musicDuration > 0 ? Math.max((musicProgress / musicDuration) * 100, 4) : 4}%`,
              }}
            />
          </div>
          <div className="widget-music__actions">
            <button type="button" onClick={onToggleMusic}>
              {musicBuffering ? '加载中' : musicPlaying ? '暂停' : '播放'}
            </button>
            <button type="button" onClick={onOpenMusic}>
              打开
            </button>
          </div>
        </div>
      );
    case 'reminders':
      return (
        <div className="widget-reminders">
          <div className="widget-reminders__count">0</div>
          <div className="widget-reminders__hint">暂无提醒</div>
        </div>
      );
    case 'clock':
      return (
        <div className="widget-clock">
          <div className="widget-clock__time">
            {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="widget-clock__hint">本地时间</div>
        </div>
      );
    case 'focus':
      return (
        <div className="widget-focus">
          <div className="widget-focus__time">{formatTimer(focusRemaining)}</div>
          <div className="widget-focus__hint">
            {focusStatus === 'running' ? FOCUS_LABELS[focusMode] : `${focusCompletedCount} 次完成`}
          </div>
        </div>
      );
    case 'miniTools':
      return (
        <div className="widget-mini-tools">
          <div className="widget-mini-tools__count">{clipboardSnippets + paletteColors}</div>
          <div className="widget-mini-tools__hint">
            {converterRecent > 0 ? `${converterRecent} 条换算` : '等待片段'}
          </div>
        </div>
      );
    case 'games':
      return (
        <div className="widget-games">
          <div className="widget-games__score">
            {formatMiniGameScore(
              blockDropBest?.score,
              snakeBest?.score,
              cloudBounceBest?.score,
              deskTidyBest?.score,
            )}
          </div>
          <div className="widget-games__hint">
            {formatMiniGameHint(
              snakeBest?.length,
              beadSortBest?.moves,
              plushGardenBlooms,
              plushMatchBest?.moves,
            )}
          </div>
        </div>
      );
  }
}

function getWidgetSubtitle(
  widget: DesktopWidget,
  today: ReturnType<typeof formatToday>,
  weather: WeatherApiResponse | null,
) {
  if (widget.kind === 'calendar') return today.monthShort;
  if (widget.kind === 'weather') return weather?.city || widget.subtitle;
  return widget.subtitle;
}

function formatWeatherTemperature(value?: string) {
  if (!value) return '--°';
  return value.endsWith('°') ? value : `${value}°`;
}

function getWeatherText(weather: WeatherApiResponse | null, locating: boolean, loading: boolean) {
  if (weather?.now.text) return weather.now.text;
  if (locating) return '定位中';
  if (loading) return '更新中';
  return '天气暂不可用';
}

function getWeatherHint(weather: WeatherApiResponse | null, error: string | null) {
  if (!weather) return error || '等待更新';
  const high = formatWeatherTemperature(weather.now.high);
  const low = formatWeatherTemperature(weather.now.low);
  return `最高 ${high} / 最低 ${low}`;
}

function formatMiniGameScore(
  blockScore?: number,
  snakeScore?: number,
  cloudScore?: number,
  tidyScore?: number,
) {
  const score = blockScore ?? snakeScore ?? cloudScore ?? tidyScore;
  return score ? `${score} 分` : '暂无';
}

function formatMiniGameHint(
  snakeLength?: number,
  beadMoves?: number,
  gardenBlooms = 0,
  matchMoves?: number,
) {
  if (snakeLength) return `贪吃蛇 ${snakeLength} 节`;
  if (beadMoves) return `色珠 ${beadMoves} 步`;
  if (gardenBlooms > 0) return `花园 ${gardenBlooms} 朵`;
  if (matchMoves) return `配对 ${matchMoves} 步`;
  return '等待开局';
}

function relativeTime(createdAt: string) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

function formatToday(d: Date) {
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const monthZh = [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ];
  return {
    week: week[d.getDay()],
    day: String(d.getDate()),
    monthLong: monthZh[d.getMonth()],
    monthShort: `${d.getMonth() + 1}月`,
  };
}
