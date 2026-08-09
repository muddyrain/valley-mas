import { clamp, type WeatherMode } from '../core/ambient-inputs';
import { type AudioBands, calculateBandEnergies, smoothAudioBands } from '../core/audio-analysis';
import { ProceduralSoundscape } from './proceduralSoundscape';

export interface AudioUiState {
  fileName: string | null;
  playing: boolean;
  duration: number;
  currentTime: number;
  error: string | null;
}

const EMPTY_AUDIO_STATE: AudioUiState = {
  fileName: null,
  playing: false,
  duration: 0,
  currentTime: 0,
  error: null,
};

export class AudioEngine {
  private readonly audio = new Audio();
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private musicGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private soundscape: ProceduralSoundscape | null = null;
  private objectUrl: string | null = null;
  private fileName: string | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private smoothedBands: AudioBands = { low: 0, mid: 0, high: 0 };
  private environmentEnabled = false;
  private environmentDisposeTimer: number | null = null;
  private musicVolume = 0.75;
  private disposed = false;

  constructor(private readonly onStateChange: (state: AudioUiState) => void) {
    this.audio.preload = 'metadata';
    this.audio.addEventListener('play', this.emitState);
    this.audio.addEventListener('pause', this.emitState);
    this.audio.addEventListener('timeupdate', this.emitState);
    this.audio.addEventListener('durationchange', this.emitState);
    this.audio.addEventListener('ended', this.emitState);
    this.audio.addEventListener('error', this.handleError);
    this.emitState();
  }

  private readonly emitState = (): void => {
    this.onStateChange({
      fileName: this.fileName,
      playing: !this.audio.paused,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      currentTime: Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0,
      error: null,
    });
  };

  private readonly handleError = (): void => {
    this.onStateChange({
      ...EMPTY_AUDIO_STATE,
      fileName: this.fileName,
      error: '浏览器无法播放这个音频文件。',
    });
  };

  private async ensureGraph(): Promise<AudioContext> {
    if (this.disposed) throw new Error('音频引擎已关闭。');
    if (!this.context) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('当前浏览器不支持 Web Audio。');
      this.context = new AudioContextConstructor();
      this.outputGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.recordingDestination = this.context.createMediaStreamDestination();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0;
      this.musicGain.gain.value = this.musicVolume;
      this.outputGain.gain.value = 1;
      this.outputGain.connect(this.context.destination);
      this.outputGain.connect(this.recordingDestination);
      this.musicGain.connect(this.outputGain);
      this.frequencyData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    }
    if (!this.source && this.analyser && this.musicGain) {
      this.source = this.context.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.musicGain);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }

  loadFile(file: File): void {
    this.clearFile();
    this.objectUrl = URL.createObjectURL(file);
    this.fileName = file.name;
    this.audio.src = this.objectUrl;
    this.audio.load();
    this.emitState();
  }

  async togglePlayback(): Promise<void> {
    if (!this.objectUrl) throw new Error('请先选择一首本地音乐。');
    if (this.audio.paused) {
      await this.ensureGraph();
      await this.audio.play();
    } else {
      this.audio.pause();
    }
    this.emitState();
  }

  seek(progress: number): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
    this.audio.currentTime = clamp(progress) * this.audio.duration;
    this.emitState();
  }

  setMusicVolume(value: number): void {
    this.musicVolume = clamp(value);
    if (this.musicGain && this.context) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.03);
    }
  }

  sampleBands(): AudioBands {
    let target: AudioBands = { low: 0, mid: 0, high: 0 };
    if (this.analyser && this.frequencyData && this.context && !this.audio.paused) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      const raw = calculateBandEnergies(
        this.frequencyData,
        this.context.sampleRate / this.analyser.fftSize,
      );
      const normalize = (value: number): number => clamp((value - 0.025) / 0.42);
      target = { low: normalize(raw.low), mid: normalize(raw.mid), high: normalize(raw.high) };
    }
    this.smoothedBands = smoothAudioBands(this.smoothedBands, target, 0.16);
    return this.smoothedBands;
  }

  async setEnvironmentEnabled(
    enabled: boolean,
    mode: WeatherMode,
    intensity: number,
    night: number,
    volume: number,
  ): Promise<void> {
    this.environmentEnabled = enabled;
    if (this.environmentDisposeTimer !== null) {
      window.clearTimeout(this.environmentDisposeTimer);
      this.environmentDisposeTimer = null;
    }
    if (!enabled) {
      this.soundscape?.fadeOut();
      this.environmentDisposeTimer = window.setTimeout(() => {
        this.soundscape?.dispose();
        this.soundscape = null;
        this.environmentDisposeTimer = null;
      }, 450);
      return;
    }
    const context = await this.ensureGraph();
    if (!this.soundscape && this.outputGain) {
      this.soundscape = new ProceduralSoundscape(context, this.outputGain);
    }
    this.soundscape?.setMix(mode, intensity, night, volume);
  }

  updateSoundscape(mode: WeatherMode, intensity: number, night: number, volume: number): void {
    if (!this.environmentEnabled) return;
    this.soundscape?.setMix(mode, intensity, night, volume);
  }

  getRecordingAudioTrack(): MediaStreamTrack | null {
    if (
      !this.recordingDestination ||
      (!this.environmentEnabled && (this.audio.paused || !this.objectUrl))
    ) {
      return null;
    }
    return this.recordingDestination.stream.getAudioTracks()[0]?.clone() ?? null;
  }

  clearFile(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.fileName = null;
    this.smoothedBands = { low: 0, mid: 0, high: 0 };
    this.emitState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.environmentDisposeTimer !== null) window.clearTimeout(this.environmentDisposeTimer);
    this.clearFile();
    this.audio.removeEventListener('play', this.emitState);
    this.audio.removeEventListener('pause', this.emitState);
    this.audio.removeEventListener('timeupdate', this.emitState);
    this.audio.removeEventListener('durationchange', this.emitState);
    this.audio.removeEventListener('ended', this.emitState);
    this.audio.removeEventListener('error', this.handleError);
    this.soundscape?.dispose();
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.musicGain?.disconnect();
    this.outputGain?.disconnect();
    this.recordingDestination?.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close();
  }
}
