import {
  Mic,
  MicOff,
  MousePointer,
  MousePointer2,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isRecordingContainerSupported, type RecordingContainer } from './core/mime';
import {
  DEFAULT_RECORDING_OPTIONS,
  getDefaultRecordingOptions,
  getMediaDeviceAvailability,
  getMediaDeviceState,
  type RecordingOptions,
} from './core/recording-options';
import type { RecorderSnapshot } from './shared/contracts';

export function RecordingSetup() {
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [container, setContainer] = useState<RecordingContainer>('webm');
  const [options, setOptions] = useState<RecordingOptions>(DEFAULT_RECORDING_OPTIONS);
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [deviceAvailability, setDeviceAvailability] = useState<{
    camera: boolean;
    microphone: boolean;
  }>();
  const defaultsAppliedRef = useRef(false);
  const mp4Supported =
    typeof MediaRecorder !== 'undefined' &&
    isRecordingContainerSupported('mp4', (mime) => MediaRecorder.isTypeSupported(mime));

  useEffect(() => {
    const applySnapshot = (next: RecorderSnapshot) => {
      setSnapshot(next);
      if (!defaultsAppliedRef.current) {
        defaultsAppliedRef.current = true;
        setOptions(getDefaultRecordingOptions(next.platform));
      }
    };
    void window.screenRecorder.getSnapshot().then(applySnapshot);
    const disposeSnapshot = window.screenRecorder.onSnapshot(applySnapshot);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void window.screenRecorder.cancelConfiguredRecording();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      disposeSnapshot();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        if (!active) return;
        const availability = getMediaDeviceAvailability(devices);
        setDeviceAvailability(availability);
        setOptions((current) => ({
          ...current,
          camera: availability.camera ? current.camera : false,
          microphone: availability.microphone ? current.microphone : false,
        }));
      })
      .catch(() => {
        if (!active) return;
        setDeviceAvailability({ camera: false, microphone: false });
        setError('无法检测摄像头或麦克风');
      });
    return () => {
      active = false;
    };
  }, []);

  const start = async () => {
    if (options.camera && deviceAvailability?.camera === false) {
      setError('未检测到摄像头');
      return;
    }
    setStarting(true);
    setError(undefined);
    try {
      await window.screenRecorder.startConfiguredRecording({ container, options });
    } catch (caught) {
      setStarting(false);
      setError(caught instanceof Error ? caught.message : '无法开始录屏');
    }
  };

  const cancelFromRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    void window.screenRecorder.cancelConfiguredRecording();
  };

  const capabilities = snapshot?.recordingCapabilities;
  const optionItems = [
    {
      key: 'systemAudio' as const,
      label: '系统声音',
      enabledIcon: Volume2,
      disabledIcon: VolumeX,
    },
    { key: 'microphone' as const, label: '麦克风', enabledIcon: Mic, disabledIcon: MicOff },
    { key: 'camera' as const, label: '摄像头', enabledIcon: Video, disabledIcon: VideoOff },
    {
      key: 'cursor' as const,
      label: '鼠标',
      enabledIcon: MousePointer2,
      disabledIcon: MousePointer,
    },
  ];

  return (
    <main className="recording-setup-card" onContextMenu={cancelFromRightClick}>
      <button
        type="button"
        className="recording-setup-start"
        disabled={starting}
        onClick={() => void start()}
      >
        {starting ? '正在准备…' : '开始录制'}
      </button>

      <div className="recording-format-row">
        <span>录制格式</span>
        <div className="recording-format-options" role="radiogroup" aria-label="录制格式">
          {(['webm', 'mp4'] as const).map((value) => {
            const disabled = value === 'mp4' && !mp4Supported;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={container === value}
                disabled={disabled}
                title={disabled ? '当前设备不支持原生 MP4 录制' : undefined}
                onClick={() => setContainer(value)}
              >
                <i /> {value === 'mp4' ? 'MP4' : 'WebM'}
              </button>
            );
          })}
        </div>
        <span className="recording-format-note">30 fps</span>
      </div>

      <div className="recording-option-grid">
        {optionItems.map(({ key, label, enabledIcon, disabledIcon }) => {
          const deviceState =
            key === 'camera' || key === 'microphone'
              ? getMediaDeviceState(key, deviceAvailability)
              : 'available';
          const missingDevice = deviceState === 'missing';
          const checkingDevice = deviceState === 'checking';
          const supported = (capabilities?.[key] ?? false) && !missingDevice && !checkingDevice;
          const enabled = options[key] && supported;
          const Icon = enabled ? enabledIcon : disabledIcon;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={enabled}
              disabled={!supported || starting}
              title={
                checkingDevice
                  ? '正在检测设备'
                  : missingDevice
                    ? `未检测到${key === 'camera' ? '摄像头' : '麦克风'}`
                    : !supported && key === 'systemAudio'
                      ? 'macOS 暂不支持直接录制系统声音'
                      : undefined
              }
              onClick={() => setOptions((current) => ({ ...current, [key]: !current[key] }))}
            >
              <Icon className="recording-option-icon" aria-hidden="true" strokeWidth={1.8} />
              <strong>{label}</strong>
              <small>
                {checkingDevice
                  ? '检测中'
                  : missingDevice
                    ? '未检测到设备'
                    : supported
                      ? enabled
                        ? '开启'
                        : '关闭'
                      : '不可用'}
              </small>
            </button>
          );
        })}
      </div>

      <label className="recording-volume-row">
        <span>
          电脑声音 <strong>{Math.round(options.audioGain * 100)}%</strong>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(options.audioGain * 100)}
          disabled={!options.systemAudio || starting}
          onChange={(event) =>
            setOptions((current) => ({
              ...current,
              audioGain: Number(event.target.value) / 100,
            }))
          }
        />
      </label>

      <button
        type="button"
        className="recording-setup-cancel"
        aria-label="取消录屏"
        onClick={() => void window.screenRecorder.cancelConfiguredRecording()}
      >
        <X aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      {error && <div className="recording-setup-error">{error}</div>}
    </main>
  );
}
