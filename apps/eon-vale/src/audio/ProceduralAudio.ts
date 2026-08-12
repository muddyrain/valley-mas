export type AudioCue = 'create' | 'power' | 'danger' | 'select';

export interface ToneProfile {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
}

const TONES: Record<AudioCue, ToneProfile> = {
  create: { frequency: 420, endFrequency: 620, duration: 0.34, gain: 0.045, wave: 'sine' },
  power: { frequency: 680, endFrequency: 390, duration: 0.42, gain: 0.055, wave: 'triangle' },
  danger: { frequency: 130, endFrequency: 88, duration: 0.52, gain: 0.065, wave: 'sawtooth' },
  select: { frequency: 520, endFrequency: 580, duration: 0.12, gain: 0.025, wave: 'sine' },
};

export function toneProfile(cue: AudioCue): ToneProfile {
  return { ...TONES[cue] };
}

export class ProceduralAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private enabled = true;

  async unlock(): Promise<void> {
    if (!this.enabled) return;
    if (!this.context) this.createContext();
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master)
      this.master.gain.setTargetAtTime(enabled ? 1 : 0, this.context?.currentTime ?? 0, 0.05);
  }

  play(cue: AudioCue): void {
    if (!this.enabled || !this.context || !this.master || this.context.state !== 'running') return;
    const profile = toneProfile(cue);
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = profile.wave;
    oscillator.frequency.setValueAtTime(profile.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(profile.endFrequency, now + profile.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + profile.duration + 0.02);
  }

  dispose(): void {
    this.ambientSource?.stop();
    this.ambientSource?.disconnect();
    this.master?.disconnect();
    void this.context?.close();
    this.ambientSource = null;
    this.master = null;
    this.context = null;
  }

  private createContext(): void {
    this.context = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.context.destination);

    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 2,
      this.context.sampleRate,
    );
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    gain.gain.value = 0.012;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.ambientSource = source;
  }
}
