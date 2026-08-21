export interface ScrollFrame {
  direction: -1 | 0 | 1;
  limit: number;
  progress: number;
  scroll: number;
  velocity: number;
  viewportHeight: number;
}

export interface PointerFrame {
  deltaX: number;
  deltaY: number;
  inside: boolean;
  lastMoveAt: number;
  sequence: number;
  speed: number;
  x: number;
  y: number;
}

interface StageRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

type Listener = () => void;

function createStore<T extends object>(initial: T) {
  const frame = { ...initial };
  let snapshot = Object.freeze({ ...initial });
  const listeners = new Set<Listener>();

  const publish = (next: T) => {
    Object.assign(frame, next);
    snapshot = Object.freeze({ ...next });
    for (const listener of listeners) listener();
  };

  return {
    frame,
    getSnapshot: () => snapshot,
    publish,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createScrollBus() {
  const store = createStore<ScrollFrame>({
    direction: 0,
    limit: 0,
    progress: 0,
    scroll: 0,
    velocity: 0,
    viewportHeight: 0,
  });

  return {
    frame: store.frame,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    write: store.publish,
  };
}

export function createPointerBus() {
  const center: PointerFrame = {
    deltaX: 0,
    deltaY: 0,
    inside: false,
    lastMoveAt: 0,
    sequence: 0,
    speed: 0,
    x: 0.5,
    y: 0.5,
  };
  const store = createStore<PointerFrame>(center);
  let sampled = false;
  let sequence = 0;
  let lastTimestamp = 0;

  return {
    frame: store.frame,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    move: (clientX: number, clientY: number, rect: StageRect, timestamp = performance.now()) => {
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const deltaX = sampled ? x - store.frame.x : 0;
      const deltaY = sampled ? y - store.frame.y : 0;
      const elapsed = sampled ? Math.max(timestamp - lastTimestamp, 1) : 0;
      const speed = elapsed > 0 ? (Math.hypot(deltaX, deltaY) * 1_000) / elapsed : 0;

      sampled = true;
      lastTimestamp = timestamp;
      sequence += 1;
      store.publish({
        deltaX,
        deltaY,
        inside: true,
        lastMoveAt: timestamp,
        sequence,
        speed,
        x,
        y,
      });
    },
    reset: () => {
      sampled = false;
      lastTimestamp = 0;
      sequence += 1;
      store.publish({ ...center, sequence });
    },
  };
}

export type ScrollBus = ReturnType<typeof createScrollBus>;
export type PointerBus = ReturnType<typeof createPointerBus>;
