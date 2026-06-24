/**
 * 可种子化 PRNG。Phase 2 用于地图生成的可复现性，后续模拟内核也会复用同一函数。
 */

export interface RandomSource {
  /** 返回 [0, 1) 之间的伪随机数 */
  next(): number;
  /** 返回 [min, max) 之间的伪随机数 */
  range(min: number, max: number): number;
  /** 返回 [min, max] 之间的整数 */
  intRange(min: number, max: number): number;
  /** 当前内部状态，用于回放/调试 */
  state(): number;
}

/**
 * mulberry32：极简、确定性、可序列化的 32 位 PRNG。
 */
export function createMulberry32(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    intRange(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return Math.floor(next() * (hi - lo + 1)) + lo;
    },
    state() {
      return state >>> 0;
    },
  };
}

/**
 * 把任意字符串映射为 32 位无符号整数（FNV-1a 变体）。
 * 用于 UI 输入的种子字符串 → PRNG 初始 state。
 */
export function hashSeedString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 给定字符串种子，返回一个 mulberry32 PRNG。
 */
export function createPrngFromSeed(seed: string): RandomSource {
  return createMulberry32(hashSeedString(seed));
}
