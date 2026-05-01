interface PrototypeAudioController {
  setEnabled: (enabled: boolean) => void;
  playJump: () => void;
  playLand: () => void;
  playFall: () => void;
  playGoal: () => void;
  playBounce: () => void;
  playCheckpoint: () => void;
  playUnstableFall: () => void;
  dispose: () => void;
}

function createNoopAudioController(): PrototypeAudioController {
  return {
    setEnabled: () => undefined,
    playJump: () => undefined,
    playLand: () => undefined,
    playFall: () => undefined,
    playGoal: () => undefined,
    playBounce: () => undefined,
    playCheckpoint: () => undefined,
    playUnstableFall: () => undefined,
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

  // ── BGM：玩具风格循环旋律（Web Audio API 合成） ──────────────────────────
  // C大调简单旋律：C4 E4 G4 E4 | D4 F4 A4 F4 | E4 G4 B4 G4 | C5 ...
  const BGM_NOTES = [
    261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23, 329.63, 392.0, 493.88, 392.0,
    523.25, 392.0, 329.63, 261.63,
  ];
  const BGM_NOTE_DURATION = 0.28; // 每音符秒数
  let bgmNoteIndex = 0;
  let bgmNextNoteTime = 0;
  let bgmTimerId: ReturnType<typeof setInterval> | null = null;

  const scheduleBgmNote = () => {
    if (!enabled || disposed) return;
    const lookahead = 0.1;
    while (bgmNextNoteTime < context.currentTime + lookahead) {
      const freq = BGM_NOTES[bgmNoteIndex % BGM_NOTES.length] ?? 261.63;
      bgmNoteIndex++;
      const startTime = Math.max(bgmNextNoteTime, context.currentTime + 0.005);
      const dur = BGM_NOTE_DURATION * 0.75;

      const osc = context.createOscillator();
      const g = context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.linearRampToValueAtTime(0.018, startTime + 0.015);
      g.gain.setValueAtTime(0.014, startTime + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
      osc.connect(g);
      g.connect(context.destination);
      osc.start(startTime);
      osc.stop(startTime + dur);

      bgmNextNoteTime += BGM_NOTE_DURATION;
    }
  };

  const startBgm = () => {
    bgmNextNoteTime = context.currentTime + 0.05;
    bgmNoteIndex = 0;
    if (bgmTimerId !== null) clearInterval(bgmTimerId);
    bgmTimerId = setInterval(scheduleBgmNote, 50);
  };

  const stopBgm = () => {
    if (bgmTimerId !== null) {
      clearInterval(bgmTimerId);
      bgmTimerId = null;
    }
  };

  if (initialEnabled) startBgm();

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
      if (enabled) {
        ensureResumed();
        startBgm();
      } else {
        stopBgm();
      }
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
      window.setTimeout(() => trigger(1100, 200, 'triangle', 0.035), 200);
    },
    playBounce() {
      // 弹跳板：快速上扫音调
      trigger(300, 60, 'sine', 0.05);
      window.setTimeout(() => trigger(600, 80, 'triangle', 0.045), 40);
      window.setTimeout(() => trigger(900, 100, 'sine', 0.04), 90);
    },
    playCheckpoint() {
      // 存档点：叮~ 两声
      trigger(880, 100, 'triangle', 0.04);
      window.setTimeout(() => trigger(1100, 150, 'sine', 0.035), 110);
    },
    playUnstableFall() {
      // 不稳定平台坠落：低沉短促
      trigger(180, 120, 'sawtooth', 0.03);
      window.setTimeout(() => trigger(120, 100, 'square', 0.025), 80);
    },
    dispose() {
      disposed = true;
      stopBgm();
      void context.close();
    },
  };
}
