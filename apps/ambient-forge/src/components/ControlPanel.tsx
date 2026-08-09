import {
  Camera,
  CloudFog,
  CloudRain,
  Expand,
  Gauge,
  Leaf,
  Map as MapIcon,
  Minimize,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Route,
  Snowflake,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { WeatherMode } from '../core/ambient-inputs';
import { CAMERA_VIEW_PRESETS, type CameraTourState, type CameraViewId } from '../core/camera-tour';
import { ENVIRONMENT_PRESETS, type EnvironmentPresetId } from '../core/environment-presets';
import type { AmbientPreferences } from '../core/preferences';
import type { QualityLevel } from '../core/quality';

interface ControlPanelProps {
  preferences: AmbientPreferences;
  displayTime: number;
  fullscreen: boolean;
  fullscreenSupported: boolean;
  audioControls: ReactNode;
  recordingControls: ReactNode;
  onChange: (changes: Partial<AmbientPreferences>) => void;
  onEnvironmentToggle: (enabled: boolean) => void;
  onFullscreen: () => void;
  onReset: () => void;
  cameraState: CameraTourState;
  onCameraView: (view: CameraViewId) => void;
  onAutoTour: (enabled: boolean) => void;
  onPhotoMode: () => void;
  activeEnvironmentPreset: EnvironmentPresetId | null;
  onEnvironmentPreset: (preset: EnvironmentPresetId) => void;
}

const weatherOptions: ReadonlyArray<{
  value: WeatherMode;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'clear', label: '晴', icon: Sun },
  { value: 'rain', label: '雨', icon: CloudRain },
  { value: 'snow', label: '雪', icon: Snowflake },
  { value: 'fog', label: '雾', icon: CloudFog },
];

const qualityOptions: ReadonlyArray<{ value: QualityLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const cameraOptions: readonly CameraViewId[] = [
  'overview',
  'observatory',
  'cavern',
  'garden',
  'crystal',
  'ruins',
  'harbor',
  'greenhouse',
];

const environmentPresetOptions: readonly EnvironmentPresetId[] = [
  'drizzle',
  'thunderstorm',
  'blizzard',
  'morning-mist',
  'golden-hour',
];

const formatHour = (time: number): string => {
  const hour = Math.floor(time) % 24;
  const minute = Math.floor((time - Math.floor(time)) * 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export function ControlPanel({
  preferences,
  displayTime,
  fullscreen,
  fullscreenSupported,
  audioControls,
  recordingControls,
  onChange,
  onEnvironmentToggle,
  onFullscreen,
  onReset,
  cameraState,
  onCameraView,
  onAutoTour,
  onPhotoMode,
  activeEnvironmentPreset,
  onEnvironmentPreset,
}: ControlPanelProps) {
  if (!preferences.panelOpen) {
    return (
      <button
        type="button"
        className="panel-reopen"
        aria-label="打开环境控制面板"
        onClick={() => onChange({ panelOpen: true })}
      >
        <PanelRightOpen size={18} />
        <span>调整环境</span>
      </button>
    );
  }

  return (
    <aside className="control-panel" aria-label="环境控制面板">
      <div className="panel-header">
        <div>
          <span className="eyebrow">AMBIENT FORGE</span>
          <p>浮空群岛天气世界</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="收起环境控制面板"
          onClick={() => onChange({ panelOpen: false })}
        >
          <PanelRightClose size={17} />
        </button>
      </div>

      <div className="panel-scroll">
        <section className="panel-section" aria-labelledby="time-heading">
          <div className="section-heading">
            <Sun size={15} aria-hidden="true" />
            <h2 id="time-heading">时间</h2>
            <output className="section-value">{formatHour(displayTime)}</output>
          </div>
          <button
            type="button"
            className="switch-row"
            role="switch"
            aria-checked={preferences.followRealTime}
            onClick={() => onChange({ followRealTime: !preferences.followRealTime })}
          >
            <span>跟随现实时间</span>
            <span className="switch-track" aria-hidden="true">
              <span />
            </span>
          </button>
          <label className="range-field">
            <span>
              手动时间 <output>{formatHour(preferences.manualTime)}</output>
            </span>
            <input
              type="range"
              min="0"
              max="24"
              step="0.05"
              value={preferences.manualTime}
              disabled={preferences.followRealTime}
              onChange={(event) => onChange({ manualTime: Number(event.target.value) })}
            />
          </label>
        </section>

        <section className="panel-section" aria-labelledby="camera-heading">
          <div className="section-heading">
            <MapIcon size={15} aria-hidden="true" />
            <h2 id="camera-heading">镜头</h2>
            <output className="section-value">{CAMERA_VIEW_PRESETS[cameraState.view].label}</output>
          </div>
          <div className="segmented camera-segmented" role="group" aria-label="镜头地标">
            {cameraOptions.map((view) => (
              <button
                key={view}
                type="button"
                className={cameraState.view === view ? 'active' : undefined}
                aria-pressed={cameraState.view === view}
                onClick={() => onCameraView(view)}
              >
                {CAMERA_VIEW_PRESETS[view].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="switch-row camera-tour-switch"
            role="switch"
            aria-checked={cameraState.enabled}
            onClick={() => onAutoTour(!cameraState.enabled)}
          >
            <span className="switch-label">
              <Route size={15} aria-hidden="true" />
              {cameraState.enabled ? '巡游中' : '自动巡游'}
            </span>
            <span className="switch-track" aria-hidden="true">
              <span />
            </span>
          </button>
          <button type="button" className="wide-button photo-entry-button" onClick={onPhotoMode}>
            <Camera size={15} aria-hidden="true" />
            摄影模式
          </button>
        </section>

        <section className="panel-section" aria-labelledby="weather-heading">
          <div className="section-heading">
            <CloudRain size={15} aria-hidden="true" />
            <h2 id="weather-heading">天气</h2>
          </div>
          <div className="segmented weather-segmented" role="group" aria-label="模拟天气">
            {weatherOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={preferences.weather === value ? 'active' : undefined}
                aria-pressed={preferences.weather === value}
                onClick={() => onChange({ weather: value })}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className="environment-presets" role="group" aria-label="天气预设">
            {environmentPresetOptions.map((preset) => (
              <button
                key={preset}
                type="button"
                className={activeEnvironmentPreset === preset ? 'active' : undefined}
                aria-pressed={activeEnvironmentPreset === preset}
                onClick={() => onEnvironmentPreset(preset)}
              >
                {ENVIRONMENT_PRESETS[preset].label}
              </button>
            ))}
          </div>
          <label className="range-field">
            <span>
              天气强度 <output>{Math.round(preferences.weatherIntensity * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={preferences.weatherIntensity}
              onChange={(event) => onChange({ weatherIntensity: Number(event.target.value) })}
            />
          </label>
          <label className="range-field">
            <span>
              风力 <output>{Math.round(preferences.wind * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={preferences.wind}
              onChange={(event) => onChange({ wind: Number(event.target.value) })}
            />
          </label>
        </section>

        {audioControls}

        <section className="panel-section" aria-labelledby="soundscape-heading">
          <div className="section-heading">
            <Leaf size={15} aria-hidden="true" />
            <h2 id="soundscape-heading">环境声</h2>
          </div>
          <button
            type="button"
            className="switch-row"
            role="switch"
            aria-checked={preferences.environmentEnabled}
            onClick={() => onEnvironmentToggle(!preferences.environmentEnabled)}
          >
            <span className="switch-label">
              {preferences.environmentEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {preferences.environmentEnabled ? '环境声已开启' : '开启环境声'}
            </span>
            <span className="switch-track" aria-hidden="true">
              <span />
            </span>
          </button>
          <label className="range-field">
            <span>
              环境音量 <output>{Math.round(preferences.environmentVolume * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              disabled={!preferences.environmentEnabled}
              value={preferences.environmentVolume}
              onChange={(event) => onChange({ environmentVolume: Number(event.target.value) })}
            />
          </label>
        </section>

        <section className="panel-section" aria-labelledby="quality-heading">
          <div className="section-heading">
            <Gauge size={15} aria-hidden="true" />
            <h2 id="quality-heading">画面质量</h2>
          </div>
          <div className="segmented" role="group" aria-label="画面质量">
            {qualityOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={preferences.quality === value ? 'active' : undefined}
                aria-pressed={preferences.quality === value}
                onClick={() => onChange({ quality: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {recordingControls}

        <section className="panel-section panel-footer-actions" aria-label="其他操作">
          <button
            type="button"
            className="wide-button"
            disabled={!fullscreenSupported}
            onClick={onFullscreen}
          >
            {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
            {fullscreen ? '退出全屏' : '进入全屏'}
          </button>
          <button type="button" className="wide-button secondary" onClick={onReset}>
            <RotateCcw size={16} />
            恢复默认
          </button>
        </section>
      </div>
    </aside>
  );
}
