import { vi } from 'vitest';

Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => null),
});
