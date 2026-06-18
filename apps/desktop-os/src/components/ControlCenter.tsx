import { useEffect, useRef } from 'react';
import { useControlCenterStore } from '../store/controlCenterStore';
import Slider from '../ui/Slider';
import ToggleSwitch from '../ui/ToggleSwitch';
import './ControlCenter.css';

export default function ControlCenter() {
  const isOpen = useControlCenterStore((s) => s.isOpen);
  const close = useControlCenterStore((s) => s.close);
  const wifi = useControlCenterStore((s) => s.wifi);
  const bluetooth = useControlCenterStore((s) => s.bluetooth);
  const airdrop = useControlCenterStore((s) => s.airdrop);
  const dnd = useControlCenterStore((s) => s.doNotDisturb);
  const brightness = useControlCenterStore((s) => s.brightness);
  const volume = useControlCenterStore((s) => s.volume);
  const setBoolean = useControlCenterStore((s) => s.setBoolean);
  const setBrightness = useControlCenterStore((s) => s.setBrightness);
  const setVolume = useControlCenterStore((s) => s.setVolume);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} className="control-center" role="dialog" aria-label="控制中心">
      <div className="control-center__group">
        <Tile
          icon="📶"
          label="无线局域网"
          subtitle={wifi ? '家里 WiFi' : '已关闭'}
          active={wifi}
          onToggle={(v) => setBoolean('wifi', v)}
        />
        <Tile
          icon="🔷"
          label="蓝牙"
          subtitle={bluetooth ? '已开启' : '已关闭'}
          active={bluetooth}
          onToggle={(v) => setBoolean('bluetooth', v)}
        />
        <Tile
          icon="📡"
          label="隔空投送"
          subtitle={airdrop ? '所有人' : '已关闭'}
          active={airdrop}
          onToggle={(v) => setBoolean('airdrop', v)}
        />
      </div>

      <div className="control-center__group">
        <Tile
          icon="🌙"
          label="勿扰"
          subtitle={dnd ? '至明早 7:00' : '已关闭'}
          active={dnd}
          onToggle={(v) => setBoolean('doNotDisturb', v)}
        />
      </div>

      <div className="control-center__sliders">
        <div className="control-center__slider-label">显示</div>
        <Slider value={brightness} onChange={setBrightness} icon="☀️" ariaLabel="亮度" />
        <div className="control-center__slider-label">声音</div>
        <Slider value={volume} onChange={setVolume} icon="🔈" ariaLabel="音量" />
      </div>
    </div>
  );
}

interface TileProps {
  icon: string;
  label: string;
  subtitle: string;
  active: boolean;
  onToggle: (next: boolean) => void;
}

function Tile({ icon, label, subtitle, active, onToggle }: TileProps) {
  return (
    <button
      type="button"
      className={`cc-tile ${active ? 'is-active' : ''}`}
      onClick={() => onToggle(!active)}
    >
      <span className={`cc-tile__icon ${active ? 'is-active' : ''}`} aria-hidden>
        {icon}
      </span>
      <span className="cc-tile__text">
        <span className="cc-tile__label">{label}</span>
        <span className="cc-tile__subtitle">{subtitle}</span>
      </span>
      <ToggleSwitch active={active} onChange={onToggle} ariaLabel={label} />
    </button>
  );
}
