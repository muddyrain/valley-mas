import type {
  AnnotationColor,
  AnnotationMosaicSize,
  AnnotationStrokeWidth,
  AnnotationTextScale,
} from './annotation';
import {
  getDefaultRecordingOptions,
  parseRecordingConfiguration,
  type RecordingConfiguration,
} from './recording-options';

export type AnnotationPreferences = {
  color: AnnotationColor;
  strokeWidth: AnnotationStrokeWidth;
  mosaicSize: AnnotationMosaicSize;
  textScale: AnnotationTextScale;
};
export type CapturePreferences = {
  recording: RecordingConfiguration;
  annotation: AnnotationPreferences;
};

export function getDefaultCapturePreferences(platform: NodeJS.Platform): CapturePreferences {
  return {
    recording: { container: 'mp4', options: getDefaultRecordingOptions(platform) },
    annotation: { color: '#2563eb', strokeWidth: 4, mosaicSize: 16, textScale: 1 },
  };
}

export function parseAnnotationPreferences(value: unknown): AnnotationPreferences {
  if (!value || typeof value !== 'object') throw new Error('标注偏好无效');
  const source = value as Record<string, unknown>;
  if (
    !['#2563eb', '#ef4444', '#111827', '#ffffff'].includes(source.color as string) ||
    ![2, 4, 8].includes(source.strokeWidth as number) ||
    ![8, 16, 24].includes(source.mosaicSize as number) ||
    ![1, 1.5, 2].includes(source.textScale as number)
  )
    throw new Error('标注偏好无效');
  return {
    color: source.color as AnnotationColor,
    strokeWidth: source.strokeWidth as AnnotationStrokeWidth,
    mosaicSize: source.mosaicSize as AnnotationMosaicSize,
    textScale: source.textScale as AnnotationTextScale,
  };
}

export function parseCapturePreferences(
  value: unknown,
  platform: NodeJS.Platform,
): CapturePreferences {
  const defaults = getDefaultCapturePreferences(platform);
  if (!value || typeof value !== 'object') return defaults;
  const source = value as Record<string, unknown>;
  try {
    defaults.recording = parseRecordingConfiguration(source.recording, platform);
  } catch {
    /* Keep platform defaults. */
  }
  try {
    defaults.annotation = parseAnnotationPreferences(source.annotation);
  } catch {
    /* Keep safe styles. */
  }
  return defaults;
}
