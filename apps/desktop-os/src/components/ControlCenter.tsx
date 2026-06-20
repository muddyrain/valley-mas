import { useEffect, useRef } from 'react';
import { useControlCenterStore } from '../store/controlCenterStore';
import Slider from '../ui/Slider';
import ToggleSwitch from '../ui/ToggleSwitch';
import './ControlCenter.css';

export default function ControlCenter() {
  const isOpen = useControlCenterStore((s) => s.isOpen);

  if (!isOpen) return null;

  return <ControlCenterPanel />;
}

function ControlCenterPanel() {
  const close = useControlCenterStore((s) => s.close);
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

  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={panelRef} className="control-center" role="dialog" aria-label="控制中心">
      <div className="control-center__group">
        <StatusTile
          icon="📶"
          label="网络"
          subtitle={isOnline ? '在线' : '离线'}
          active={isOnline}
        />
        <ActionTile
          icon="🔷"
          label="蓝牙"
          subtitle={bluetoothLabel(bluetoothStatus)}
          active={bluetoothStatus === 'connected'}
          disabled={bluetoothStatus === 'unsupported'}
          onAction={requestBluetoothDevice}
        />
        <ActionTile
          icon="📤"
          label="分享"
          subtitle={shareLabel(shareStatus)}
          active={shareStatus === 'shared'}
          disabled={shareStatus === 'unsupported'}
          onAction={shareDesktop}
        />
      </div>

      <div className="control-center__group">
        <DndTile active={dnd} onToggle={setDoNotDisturb} />
      </div>

      <div className="control-center__sliders">
        <div className="control-center__slider-label">桌面亮度</div>
        <Slider value={brightness} onChange={setBrightness} icon="☀️" ariaLabel="桌面亮度" />
        <div className="control-center__slider-label">站内声音</div>
        <Slider value={volume} onChange={setVolume} icon="🔈" ariaLabel="站内声音" />
      </div>
    </div>
  );
}

interface TileBaseProps {
  icon: string;
  label: string;
  subtitle: string;
  active: boolean;
}

function StatusTile({ icon, label, subtitle, active }: TileBaseProps) {
  return (
    <div className={`cc-tile cc-tile--static ${active ? 'is-active' : ''}`}>
      <span className={`cc-tile__icon ${active ? 'is-active' : ''}`} aria-hidden>
        {icon}
      </span>
      <span className="cc-tile__text">
        <span className="cc-tile__label">{label}</span>
        <span className="cc-tile__subtitle">{subtitle}</span>
      </span>
    </div>
  );
}

interface ActionTileProps extends TileBaseProps {
  disabled?: boolean;
  onAction: () => void;
}

function ActionTile({ icon, label, subtitle, active, disabled, onAction }: ActionTileProps) {
  return (
    <button
      type="button"
      className={`cc-tile ${active ? 'is-active' : ''}`}
      onClick={onAction}
      disabled={disabled}
    >
      <span className={`cc-tile__icon ${active ? 'is-active' : ''}`} aria-hidden>
        {icon}
      </span>
      <span className="cc-tile__text">
        <span className="cc-tile__label">{label}</span>
        <span className="cc-tile__subtitle">{subtitle}</span>
      </span>
    </button>
  );
}

function DndTile({ active, onToggle }: { active: boolean; onToggle: (next: boolean) => void }) {
  return (
    <button
      type="button"
      className={`cc-tile ${active ? 'is-active' : ''}`}
      onClick={() => onToggle(!active)}
    >
      <span className={`cc-tile__icon ${active ? 'is-active' : ''}`} aria-hidden>
        🌙
      </span>
      <span className="cc-tile__text">
        <span className="cc-tile__label">勿扰</span>
        <span className="cc-tile__subtitle">{active ? '已开启' : '已关闭'}</span>
      </span>
      <ToggleSwitch active={active} onChange={onToggle} ariaLabel="勿扰" />
    </button>
  );
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
