/// <reference types="vite/client" />

import type { RuntimeMetrics } from './render/EonValeEngine';

declare global {
  interface Window {
    __EON_METRICS__?: RuntimeMetrics & {
      population: number;
      userAgent: string;
      viewport: string;
      devicePixelRatio: number;
    };
  }
}
