interface PrototypeAudioController {
  setEnabled: (enabled: boolean) => void;
  playJump: () => void;
  playLand: () => void;
  playFall: () => void;
  playGoal: () => void;
  dispose: () => void;
}

function createNoopAudioController(): PrototypeAudioController {
  return {
    setEnabled: () => undefined,
    playJump: () => undefined,
    playLand: () => undefined,
    playFall: () => undefined,
    playGoal: () => undefined,
    dispose: () => undefined,
  };
}

export function createPrototypeAudio(initialEnabled: boolean): PrototypeAudioController {
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return createNoopAudioController();
  }

  const context = new Ctor();
  let enabled = initialEnabled;
  let disposed = false;

  const ensureResumed = () => {
    if (context.state === 'suspended') {
      void context.resume();
    }
  };

  const trigger = (
    frequency: number,
    durationMs: number,
    type: OscillatorType,
    gainAmount: number,
  ) => {
    if (!enabled || disposed) return;
    ensureResumed();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainAmount, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationMs / 1000);
  };

  return {
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      if (enabled) ensureResumed();
    },
    playJump() {
      trigger(520, 110, 'triangle', 0.045);
    },
    playLand() {
      trigger(280, 120, 'sine', 0.04);
    },
    playFall() {
      trigger(170, 180, 'square', 0.035);
    },
    playGoal() {
      trigger(660, 120, 'triangle', 0.045);
      window.setTimeout(() => trigger(880, 170, 'sine', 0.04), 90);
    },
    dispose() {
      disposed = true;
      void context.close();
    },
  };
}
