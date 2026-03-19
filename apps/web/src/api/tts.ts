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
  audioUrl: string;
  durationSec: number;
  sampleRate: number;
  format: 'wav' | 'mp3';
  mode?: 'audio' | 'browser';
}

export const TTS_VOICE_PRESETS: TtsVoicePreset[] = [
  { id: 'bubu', name: '布布配音', style: '布布棕熊布', speedRange: [0.7, 1.4] },
];

export async function synthesizeTts(payload: TtsSynthesizePayload): Promise<TtsSynthesizeResult> {
  const useMock = import.meta.env.VITE_TTS_USE_MOCK === 'true';

  if (useMock) {
    const durationSec = Math.min(18, Math.max(2, Math.ceil(payload.text.length / 18)));
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      taskId: `mock-${Date.now()}`,
      audioUrl: '',
      durationSec,
      sampleRate: 0,
      format: 'wav',
      mode: 'browser',
    };
  }

  return request.post<unknown, TtsSynthesizeResult>('/public/tts/synthesize', payload, {
    // Local F5-TTS can take a long time on first run / CPU mode.
    timeout: 10 * 60 * 1000,
  });
}
