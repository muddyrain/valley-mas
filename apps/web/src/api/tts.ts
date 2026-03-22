import request from '@/utils/request';

export interface TtsVoicePreset {
  id: string;
  name: string;
  style: string;
  speedRange: [number, number];
}

export interface TtsSynthesizePayload {
  text: string;
  voiceId: string;
  speed: number;
}

export interface TtsSynthesizeResult {
  taskId: string;
  status?: string;
  progress?: number;
  message?: string;
  audioUrl: string;
  durationSec: number;
  sampleRate: number;
  format: 'wav' | 'mp3';
  mode?: 'audio' | 'browser';
}

export interface TtsAsyncSubmitResult {
  taskId: string;
  status: string;
  progress: number;
  message: string;
}

export interface TtsProgressResult {
  taskId: string;
  status: string;
  progress: number;
  message: string;
  audioUrl?: string;
  durationSec?: number;
  sampleRate?: number;
  format?: 'wav' | 'mp3';
}

export const TTS_VOICE_PRESETS: TtsVoicePreset[] = [
  { id: 'yier', name: '一二配音', style: '一二小白熊', speedRange: [0.7, 1.4] },
  { id: 'bubu', name: '布布配音', style: '布布棕熊布', speedRange: [0.7, 1.4] },
];

export async function synthesizeTts(payload: TtsSynthesizePayload): Promise<TtsSynthesizeResult> {
  return request.post<unknown, TtsSynthesizeResult>('/public/tts/synthesize', payload, {
    timeout: 10 * 60 * 1000,
  });
}

export async function synthesizeTtsAsync(
  payload: TtsSynthesizePayload,
): Promise<TtsAsyncSubmitResult> {
  return request.post<unknown, TtsAsyncSubmitResult>('/public/tts/synthesize-async', payload, {
    timeout: 30 * 1000,
  });
}

export async function getTtsProgress(taskId: string): Promise<TtsProgressResult> {
  return request.get<unknown, TtsProgressResult>(
    `/public/tts/progress/${encodeURIComponent(taskId)}`,
    {
      timeout: 30 * 1000,
    },
  );
}
