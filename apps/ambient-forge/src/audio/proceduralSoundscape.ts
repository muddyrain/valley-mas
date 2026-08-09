import { clamp, type WeatherMode } from '../core/ambient-inputs';

export class ProceduralSoundscape {
  private readonly windGain: GainNode;
  private readonly rainGain: GainNode;
  private readonly nightGain: GainNode;
  private readonly outputGain: GainNode;
  private readonly sources: AudioBufferSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private disposed = false;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
  ) {
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const data = buffer.getChannelData(0);
    let filtered = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      filtered = filtered * 0.985 + white * 0.015;
      data[index] = filtered * 0.7 + white * 0.09;
    }

    this.outputGain = context.createGain();
    this.outputGain.gain.value = 0;
    this.outputGain.connect(destination);

    this.windGain = context.createGain();
    this.rainGain = context.createGain();
    this.nightGain = context.createGain();
    this.windGain.gain.value = 0;
    this.rainGain.gain.value = 0;
    this.nightGain.gain.value = 0;
    this.windGain.connect(this.outputGain);
    this.rainGain.connect(this.outputGain);
    this.nightGain.connect(this.outputGain);

    this.createNoiseLayer(buffer, 'lowpass', 720, 0.55, this.windGain, 0.88);
    this.createNoiseLayer(buffer, 'bandpass', 3200, 0.45, this.rainGain, 1.14);
    this.createNoiseLayer(buffer, 'bandpass', 5100, 1.8, this.nightGain, 0.72);
    this.nodes.push(this.outputGain, this.windGain, this.rainGain, this.nightGain);
  }

  private createNoiseLayer(
    buffer: AudioBuffer,
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
    destination: AudioNode,
    rate: number,
  ): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = rate;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    source.connect(filter);
    filter.connect(destination);
    source.start();
    this.sources.push(source);
    this.nodes.push(source, filter);
  }

  setMix(mode: WeatherMode, intensity: number, night: number, volume: number): void {
    if (this.disposed) return;
    const now = this.context.currentTime;
    const weatherIntensity = clamp(intensity);
    const master = clamp(volume) * 0.48;
    const rain = mode === 'rain' ? 0.2 + weatherIntensity * 0.54 : 0;
    const wind = 0.08 + (mode === 'fog' ? 0.08 : 0) + weatherIntensity * 0.12;
    const nightAir = clamp(night) * (mode === 'rain' ? 0.018 : 0.045);
    this.outputGain.gain.setTargetAtTime(master, now, 0.18);
    this.windGain.gain.setTargetAtTime(wind, now, 0.32);
    this.rainGain.gain.setTargetAtTime(rain, now, 0.22);
    this.nightGain.gain.setTargetAtTime(nightAir, now, 0.45);
  }

  fadeOut(): void {
    if (this.disposed) return;
    this.outputGain.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Source may already be stopped.
      }
    }
    for (const node of this.nodes) node.disconnect();
    this.sources.length = 0;
    this.nodes.length = 0;
  }
}
