/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** 脑内会议室（AI Mind Arena）部署地址，未配置时回退到 http://localhost:5175 */
  readonly VITE_MIND_ARENA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
