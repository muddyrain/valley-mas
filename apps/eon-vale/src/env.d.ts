/// <reference types="vite/client" />

import type { RuntimeMetrics } from './render/EonValeEngine';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    __EON_METRICS__?: RuntimeMetrics & {
      population: number;
      userAgent: string;
      viewport: string;
      devicePixelRatio: number;
    };
  }
}
