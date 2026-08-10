import type { Rectangle } from './geometry';
import type { RecordingContainer } from './mime';

export type RecordingOptions = {
  systemAudio: boolean;
  microphone: boolean;
  camera: boolean;
  cursor: boolean;
  audioGain: number;
};

export type RecordingConfiguration = {
  container: RecordingContainer;
  options: RecordingOptions;
};

export type RecordingCapabilities = Record<
  'systemAudio' | 'microphone' | 'camera' | 'cursor',
  boolean
>;

export const DEFAULT_RECORDING_OPTIONS: RecordingOptions = {
  systemAudio: false,
  microphone: false,
  camera: false,
  cursor: true,
  audioGain: 1,
};

export function getDefaultRecordingOptions(platform: string): RecordingOptions {
  return {
    ...DEFAULT_RECORDING_OPTIONS,
    systemAudio: platform === 'win32',
  };
}

export function getMediaDeviceAvailability(devices: readonly { kind: string }[]): {
  camera: boolean;
  microphone: boolean;
} {
  return {
    camera: devices.some((device) => device.kind === 'videoinput'),
    microphone: devices.some((device) => device.kind === 'audioinput'),
  };
}

export function getMediaDeviceState(
  key: 'camera' | 'microphone',
  availability: { camera: boolean; microphone: boolean } | undefined,
): 'checking' | 'missing' | 'available' {
  if (!availability) return 'checking';
  return availability[key] ? 'available' : 'missing';
}

export function getRecordingCapabilities(platform: NodeJS.Platform): RecordingCapabilities {
  return {
    systemAudio: platform === 'win32',
    microphone: platform === 'win32' || platform === 'darwin',
    camera: platform === 'win32' || platform === 'darwin',
    cursor: platform === 'win32' || platform === 'darwin',
  };
}

export function parseRecordingConfiguration(
  value: unknown,
  platform: NodeJS.Platform,
): RecordingConfiguration {
  if (!value || typeof value !== 'object') throw new Error('录制配置无效');
  const source = value as Record<string, unknown>;
  if (source.container !== 'webm' && source.container !== 'mp4') {
    throw new Error('录制格式无效');
  }
  const options = source.options;
  if (!options || typeof options !== 'object') throw new Error('录制配置无效');
  const optionSource = options as Record<string, unknown>;
  const names = ['systemAudio', 'microphone', 'camera', 'cursor'] as const;
  if (names.some((name) => typeof optionSource[name] !== 'boolean')) {
    throw new Error('录制配置无效');
  }
  const parsed = Object.fromEntries(names.map((name) => [name, optionSource[name]])) as Omit<
    RecordingOptions,
    'audioGain'
  >;
  const audioGain = optionSource.audioGain;
  if (
    typeof audioGain !== 'number' ||
    !Number.isFinite(audioGain) ||
    audioGain < 0 ||
    audioGain > 1
  ) {
    throw new Error('录制音量无效');
  }
  const capabilities = getRecordingCapabilities(platform);
  if (parsed.systemAudio && !capabilities.systemAudio) {
    throw new Error('当前系统不支持直接录制系统声音');
  }
  if (parsed.microphone && !capabilities.microphone) throw new Error('当前系统不支持麦克风录制');
  if (parsed.camera && !capabilities.camera) throw new Error('当前系统不支持摄像头录制');
  if (parsed.cursor && !capabilities.cursor) throw new Error('当前系统不支持鼠标录制');
  return { container: source.container, options: { ...parsed, audioGain } };
}

export function getCameraOverlayRect(output: { width: number; height: number }): Rectangle {
  const width = Math.min(400, Math.max(160, Math.round(output.width * 0.22)));
  const height = Math.round((width * 9) / 16);
  const margin = Math.max(16, Math.round(output.width / 60));
  return {
    x: Math.max(0, output.width - width - margin),
    y: Math.max(0, output.height - height - margin),
    width,
    height,
  };
}
