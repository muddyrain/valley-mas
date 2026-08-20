export interface ScrollFrame {
  direction: -1 | 0 | 1;
  limit: number;
  progress: number;
  scroll: number;
  velocity: number;
  viewportHeight: number;
}

export interface PointerFrame {
  inside: boolean;
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
  const center: PointerFrame = { inside: false, x: 0.5, y: 0.5 };
  const store = createStore<PointerFrame>(center);

  return {
    frame: store.frame,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    move: (clientX: number, clientY: number, rect: StageRect) => {
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      store.publish({ inside: true, x, y });
    },
    reset: () => store.publish(center),
  };
}

export type ScrollBus = ReturnType<typeof createScrollBus>;
export type PointerBus = ReturnType<typeof createPointerBus>;
