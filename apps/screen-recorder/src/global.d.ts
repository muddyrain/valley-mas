import type { RecorderApi } from './shared/contracts';

declare module '*.svg' {
  const url: string;
  export default url;
}

declare global {
  interface Window {
    screenRecorder: RecorderApi;
  }
}
