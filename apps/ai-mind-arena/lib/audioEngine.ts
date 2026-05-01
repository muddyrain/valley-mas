/**
 * Web Audio API 合成音效引擎
 *
 * 背景音乐：复古游戏风格（Chiptune）
 * - 160 BPM，C 大调，欢快动感
 * - 方波旋律 + 三角波低音 + 轻量和声
 * - 短促 staccato 音符，基于事件调度，无持续振荡嗡嗡声
 */

// ─── 背景音乐状态 ────────────────────────────────────────────────────
let bgCtx: AudioContext | null = null;
let bgMasterGain: GainNode | null = null;
let bgSchedulerId: ReturnType<typeof setInterval> | null = null;
let bgRunning = false;
let bgNextPatternStart = 0;

const BPM = 120;
const S16 = 60 / BPM / 4; // 16 分音符时长 ≈ 0.09375 s
const LOOKAHEAD = S16 * 32 * 2; // 提前 2 个 pattern 的窗口
const SCHEDULE_INTERVAL_MS = 1400;

// ─── 音符频率 ─────────────────────────────────────────────────────────
const G2 = 98.0;
const C3 = 130.81;
const D3 = 146.83;
const G3 = 196.0;
const E4 = 329.63;
const G4 = 392.0;
const B4 = 493.88;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;

// Step = [频率(0=休止符), 时长(16分音符数)]
type Step = [number, number];

/**
 * 旋律声部：C 大调活泼旋律，32 步 = 2 小节
 */
const MELODY_SEQ: Step[] = [
  // Bar 1
  [C5, 1],
  [0, 1],
  [E5, 1],
  [0, 1],
  [G5, 1],
  [E5, 1],
  [C5, 1],
  [0, 1],
  [E5, 1],
  [G5, 1],
  [A5, 1],
  [G5, 1],
  [E5, 1],
  [D5, 1],
  [C5, 1],
  [0, 1],
  // Bar 2
  [G4, 1],
  [0, 1],
  [B4, 1],
  [0, 1],
  [D5, 1],
  [B4, 1],
  [G4, 1],
  [0, 1],
  [B4, 1],
  [D5, 1],
  [G5, 1],
  [D5, 1],
  [B4, 1],
  [0, 1],
  [G4, 2],
];

/**
 * 低音声部：根音 + 五音交替，32 步
 */
const BASS_SEQ: Step[] = [
  [C3, 2],
  [G3, 2],
  [C3, 2],
  [G3, 2],
  [C3, 2],
  [G3, 2],
  [C3, 2],
  [G3, 2],
  [G2, 2],
  [D3, 2],
  [G2, 2],
  [D3, 2],
  [G2, 2],
  [D3, 2],
  [G2, 2],
  [D3, 2],
];

/**
 * 和声声部（轻微三度），32 步
 */
const HARMONY_SEQ: Step[] = [
  [E4, 2],
  [0, 2],
  [E4, 2],
  [0, 2],
  [G4, 2],
  [E4, 2],
  [0, 4],
  [B4, 2],
  [0, 2],
  [B4, 2],
  [0, 2],
  [G4, 2],
  [0, 6],
];

const PATTERN_DUR = 32 * S16;

// ─── 预编译为带时间偏移的事件列表 ─────────────────────────────────────
type NoteEvent = { t: number; freq: number; dur16: number };

function buildEvents(seq: Step[]): NoteEvent[] {
  const events: NoteEvent[] = [];
  let cursor = 0;
  for (const [freq, count] of seq) {
    if (freq > 0) events.push({ t: cursor * S16, freq, dur16: count });
    cursor += count;
  }
  return events;
}

const MELODY_EVENTS = buildEvents(MELODY_SEQ);
const BASS_EVENTS = buildEvents(BASS_SEQ);
const HARMONY_EVENTS = buildEvents(HARMONY_SEQ);

function getCtx(): AudioContext {
  if (!bgCtx) bgCtx = new AudioContext();
  return bgCtx;
}

/**
 * 调度一组音符到指定的 patternStart 时刻
 * staccato：实际发音占 duration 的比例，控制欢快感
 */
function scheduleVoice(
  ctx: AudioContext,
  dest: AudioNode,
  events: NoteEvent[],
  patternStart: number,
  type: OscillatorType,
  peakVol: number,
  staccato: number,
) {
  const now = ctx.currentTime;
  for (const ev of events) {
    const start = patternStart + ev.t;
    // 跳过已经过去的音符（避免 AudioContext 报错）
    if (start < now - 0.01) continue;

    const noteDur = ev.dur16 * S16 * staccato;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = ev.freq;

    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peakVol, start + 0.005); // 5ms attack
    env.gain.setValueAtTime(peakVol, start + Math.max(noteDur - 0.008, 0.005));
    env.gain.linearRampToValueAtTime(0, start + noteDur); // clean release

    osc.connect(env);
    env.connect(dest);
    osc.start(start);
    osc.stop(start + noteDur + 0.01);
  }
}

/** 启动背景音乐 */
export function startBgMusic() {
  if (bgRunning) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.connect(ctx.destination);
  bgMasterGain = master;

  // 低通滤波：保留 chiptune 质感，软化方波刺耳泛音
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 2400;
  lpf.Q.value = 0.5;
  lpf.connect(master);

  bgRunning = true;
  bgNextPatternStart = ctx.currentTime + 0.05;

  // 2s 淡入，最终音量 0.1
  master.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1);

  function schedule() {
    if (!bgRunning || !bgCtx) return;
    while (bgNextPatternStart < ctx.currentTime + LOOKAHEAD) {
      scheduleVoice(ctx, lpf, MELODY_EVENTS, bgNextPatternStart, 'square', 0.16, 0.72);
      scheduleVoice(ctx, lpf, BASS_EVENTS, bgNextPatternStart, 'triangle', 0.22, 0.48);
      scheduleVoice(ctx, lpf, HARMONY_EVENTS, bgNextPatternStart, 'square', 0.06, 0.68);
      bgNextPatternStart += PATTERN_DUR;
    }
  }

  schedule();
  bgSchedulerId = setInterval(schedule, SCHEDULE_INTERVAL_MS);
}

/** 停止背景音乐（淡出） */
export function stopBgMusic() {
  if (!bgRunning) return;
  bgRunning = false;
  if (bgSchedulerId !== null) {
    clearInterval(bgSchedulerId);
    bgSchedulerId = null;
  }
  if (bgMasterGain && bgCtx) {
    bgMasterGain.gain.linearRampToValueAtTime(0, bgCtx.currentTime + 1.5);
  }
  bgMasterGain = null;
}

/** 人格登场音效：上升音阶+微颤 */
export function playEntranceSound() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.22;
  masterGain.connect(ctx.destination);

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
    // 颤音
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 5;
    vibratoGain.gain.value = 4;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(ctx.currentTime + i * 0.1);
    vibrato.stop(ctx.currentTime + i * 0.1 + 0.5);

    env.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
    env.gain.linearRampToValueAtTime(1, ctx.currentTime + i * 0.1 + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.55);

    osc.connect(env);
    env.connect(masterGain);
    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + i * 0.1 + 0.55);
  });
}

/** 发言提示音：简短双音提示 */
export function playSpeakSound() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const pairs = [
    { freq: 880, delay: 0 },
    { freq: 1046.5, delay: 0.08 },
  ];

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.14;
  masterGain.connect(ctx.destination);

  pairs.forEach(({ freq, delay }) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, ctx.currentTime + delay);
    env.gain.linearRampToValueAtTime(1, ctx.currentTime + delay + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
    osc.connect(env);
    env.connect(masterGain);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.2);
  });
}

/** 快门音效 */
export function playShutterSound() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // 白噪声模拟快门
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) ** 2;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.35;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}
