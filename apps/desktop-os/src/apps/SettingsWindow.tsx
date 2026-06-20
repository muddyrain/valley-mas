import { useControlCenterStore } from '../store/controlCenterStore';
import {
  useDesktopPreferencesStore,
  WALLPAPER_OPTIONS,
  type WallpaperOption,
} from '../store/desktopPreferencesStore';
import type { DockItemConfig } from '../store/dockStore';
import { useDockStore } from '../store/dockStore';
import Slider from '../ui/Slider';
import ToggleSwitch from '../ui/ToggleSwitch';
import './DockAppWindows.css';

export default function SettingsWindow() {
  const isOnline = useControlCenterStore((s) => s.isOnline);
  const bluetoothStatus = useControlCenterStore((s) => s.bluetoothStatus);
  const shareStatus = useControlCenterStore((s) => s.shareStatus);
  const dnd = useControlCenterStore((s) => s.doNotDisturb);
  const brightness = useControlCenterStore((s) => s.brightness);
  const volume = useControlCenterStore((s) => s.volume);
  const requestBluetoothDevice = useControlCenterStore((s) => s.requestBluetoothDevice);
  const shareDesktop = useControlCenterStore((s) => s.shareDesktop);
  const setDoNotDisturb = useControlCenterStore((s) => s.setDoNotDisturb);
  const setBrightness = useControlCenterStore((s) => s.setBrightness);
  const setVolume = useControlCenterStore((s) => s.setVolume);

  const wallpaperId = useDesktopPreferencesStore((s) => s.wallpaperId);
  const setWallpaper = useDesktopPreferencesStore((s) => s.setWallpaper);

  const dockItems = useDockStore((s) => s.items);
  const iconSize = useDockStore((s) => s.iconSize);
  const spacing = useDockStore((s) => s.spacing);
  const magnification = useDockStore((s) => s.magnification);
  const autoHide = useDockStore((s) => s.autoHide);
  const dockSaving = useDockStore((s) => s.isSaving);
  const dockError = useDockStore((s) => s.error);
  const dockSyncToken = useDockStore((s) => s.syncToken);
  const setIconSize = useDockStore((s) => s.setIconSize);
  const setSpacing = useDockStore((s) => s.setSpacing);
  const setMagnification = useDockStore((s) => s.setMagnification);
  const setAutoHide = useDockStore((s) => s.setAutoHide);
  const showDockItem = useDockStore((s) => s.showItem);
  const hideDockItem = useDockStore((s) => s.hideItem);
  const resetDockItems = useDockStore((s) => s.resetItems);

  return (
    <div className="dock-app-window settings-window">
      <header className="settings-window__header">
        <div>
          <div className="dock-app-window__eyebrow">系统设置</div>
          <h2>网络、显示与 Dock</h2>
          <p>浏览器可用的系统能力与桌面偏好。</p>
        </div>
        <span className="dock-app-window__badge">{dnd ? '勿扰' : onlineLabel(isOnline)}</span>
      </header>

      <section className="settings-window__grid" aria-label="连接与分享">
        <SettingsStatus icon="📶" title="网络" subtitle={onlineLabel(isOnline)} active={isOnline} />
        <SettingsAction
          icon="🔷"
          title="蓝牙"
          subtitle={bluetoothLabel(bluetoothStatus)}
          active={bluetoothStatus === 'connected'}
          disabled={bluetoothStatus === 'unsupported'}
          onAction={requestBluetoothDevice}
        />
        <SettingsAction
          icon="📤"
          title="分享"
          subtitle={shareLabel(shareStatus)}
          active={shareStatus === 'shared'}
          disabled={shareStatus === 'unsupported'}
          onAction={shareDesktop}
        />
        <SettingsToggle
          icon="🌙"
          title="勿扰"
          subtitle={dnd ? '已开启' : '已关闭'}
          active={dnd}
          onChange={setDoNotDisturb}
        />
      </section>

      <section className="settings-window__sliders" aria-label="显示与声音">
        <div className="settings-slider">
          <div className="settings-slider__label">桌面亮度</div>
          <Slider value={brightness} onChange={setBrightness} icon="☀️" ariaLabel="桌面亮度" />
        </div>
        <div className="settings-slider">
          <div className="settings-slider__label">站内声音</div>
          <Slider value={volume} onChange={setVolume} icon="🔈" ariaLabel="站内声音" />
        </div>
      </section>

      <section className="settings-window__wallpaper" aria-label="壁纸">
        <div className="settings-window__section-title">壁纸</div>
        <div className="wallpaper-picker">
          {WALLPAPER_OPTIONS.map((option) => (
            <WallpaperChoice
              key={option.id}
              option={option}
              active={option.id === wallpaperId}
              onSelect={() => setWallpaper(option.id)}
            />
          ))}
        </div>
      </section>

      <section className="settings-window__dock" aria-label="Dock 设置">
        <div className="settings-window__section-row">
          <div className="settings-window__section-title">Dock</div>
          <span className={`settings-window__sync ${dockError ? 'is-error' : ''}`}>
            {dockError ? '同步失败' : dockSaving ? '同步中' : dockSyncToken ? '已同步' : '本地保存'}
          </span>
          <button type="button" className="settings-window__plain-action" onClick={resetDockItems}>
            恢复默认
          </button>
        </div>
        <div className="settings-window__sliders">
          <div className="settings-slider">
            <div className="settings-slider__label">图标大小</div>
            <Slider
              value={sizeToPercent(iconSize)}
              onChange={(value) => setIconSize(percentToSize(value))}
              icon="□"
              ariaLabel="Dock 图标大小"
            />
          </div>
          <div className="settings-slider">
            <div className="settings-slider__label">间距</div>
            <Slider
              value={spacingToPercent(spacing)}
              onChange={(value) => setSpacing(percentToSpacing(value))}
              icon="↔"
              ariaLabel="Dock 间距"
            />
          </div>
        </div>
        <div className="settings-window__grid">
          <SettingsToggle
            icon="🔎"
            title="放大"
            subtitle={magnification ? '已开启' : '已关闭'}
            active={magnification}
            onChange={setMagnification}
          />
          <SettingsToggle
            icon="▁"
            title="自动隐藏"
            subtitle={autoHide ? '已开启' : '已关闭'}
            active={autoHide}
            onChange={setAutoHide}
          />
        </div>
        <ul className="dock-item-list" aria-label="Dock 项目">
          {dockItems.map((item) => (
            <DockItemToggle
              key={item.id}
              item={item}
              onShow={() => showDockItem(item.id)}
              onHide={() => hideDockItem(item.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

interface SettingsBaseProps {
  icon: string;
  title: string;
  subtitle: string;
  active: boolean;
}

function SettingsStatus({ icon, title, subtitle, active }: SettingsBaseProps) {
  return (
    <div className={`settings-card ${active ? 'is-active' : ''}`}>
      <SettingsCardText icon={icon} title={title} subtitle={subtitle} />
    </div>
  );
}

interface SettingsActionProps extends SettingsBaseProps {
  disabled?: boolean;
  onAction: () => void;
}

function SettingsAction({
  icon,
  title,
  subtitle,
  active,
  disabled,
  onAction,
}: SettingsActionProps) {
  return (
    <button
      type="button"
      className={`settings-card ${active ? 'is-active' : ''}`}
      onClick={onAction}
      disabled={disabled}
    >
      <SettingsCardText icon={icon} title={title} subtitle={subtitle} />
    </button>
  );
}

interface SettingsToggleProps extends SettingsBaseProps {
  onChange: (next: boolean) => void;
}

function SettingsToggle({ icon, title, subtitle, active, onChange }: SettingsToggleProps) {
  return (
    <div className={`settings-card ${active ? 'is-active' : ''}`}>
      <SettingsCardText icon={icon} title={title} subtitle={subtitle} />
      <ToggleSwitch active={active} onChange={onChange} ariaLabel={title} />
    </div>
  );
}

function WallpaperChoice({
  option,
  active,
  onSelect,
}: {
  option: WallpaperOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`wallpaper-choice ${active ? 'is-active' : ''}`}
      onClick={onSelect}
    >
      <span className={`wallpaper-choice__preview wallpaper-choice__preview--${option.kind}`}>
        {option.kind === 'image' && option.source ? <img src={option.source} alt="" /> : null}
      </span>
      <span className="wallpaper-choice__label">{option.label}</span>
    </button>
  );
}

function DockItemToggle({
  item,
  onShow,
  onHide,
}: {
  item: DockItemConfig;
  onShow: () => void;
  onHide: () => void;
}) {
  const disabled = item.required;

  return (
    <li className="dock-item-toggle">
      <img className="dock-item-toggle__icon" src={item.icon} alt="" />
      <div className="dock-item-toggle__text">
        <span className="dock-item-toggle__label">{item.label}</span>
        <span className="dock-item-toggle__state">{item.visible ? '已显示' : '已隐藏'}</span>
      </div>
      <ToggleSwitch
        active={item.visible}
        onChange={(next) => (next ? onShow() : onHide())}
        ariaLabel={item.label}
        disabled={disabled}
      />
    </li>
  );
}

function SettingsCardText({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <span className="settings-card__icon" aria-hidden>
        {icon}
      </span>
      <span className="settings-card__text">
        <span className="settings-card__title">{title}</span>
        <span className="settings-card__subtitle">{subtitle}</span>
      </span>
    </>
  );
}

function onlineLabel(isOnline: boolean) {
  return isOnline ? '在线' : '离线';
}

function bluetoothLabel(status: string) {
  switch (status) {
    case 'ready':
      return '可连接设备';
    case 'connected':
      return '已连接';
    case 'denied':
      return '未连接';
    default:
      return '浏览器不支持';
  }
}

function shareLabel(status: string) {
  switch (status) {
    case 'ready':
      return '系统分享';
    case 'shared':
      return '已分享';
    case 'cancelled':
      return '未分享';
    default:
      return '浏览器不支持';
  }
}

function sizeToPercent(size: number) {
  return ((size - 44) / 28) * 100;
}

function percentToSize(value: number) {
  return 44 + (value / 100) * 28;
}

function spacingToPercent(spacing: number) {
  return ((spacing - 2) / 14) * 100;
}

function percentToSpacing(value: number) {
  return 2 + (value / 100) * 14;
}
