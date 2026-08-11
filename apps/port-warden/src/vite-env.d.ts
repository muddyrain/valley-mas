/// <reference types="vite/client" />

import type { PortWardenApi } from './shared/contracts';

declare global {
  interface Window {
    portWarden?: PortWardenApi;
  }
}
