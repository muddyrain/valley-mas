import { apiRequest } from '@/api/request';

export type LifeTraceImageUpload = {
  url: string;
  storageKey: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  extension?: string;
  contentType?: string;
};

const LIFE_TRACE_IMAGE_UPLOAD_TIMEOUT_MS = 30000;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function uploadLifeTraceImage(
  token: string,
  file: File,
  options: { signal?: AbortSignal } = {},
) {
  const formData = new FormData();
  formData.append('file', file);

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    LIFE_TRACE_IMAGE_UPLOAD_TIMEOUT_MS,
  );
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<LifeTraceImageUpload>('/life-trace/uploads/image', token, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  })
    .catch((error) => {
      if (isAbortError(error) || controller.signal.aborted) {
        throw new Error('图片上传超过 30 秒，请检查网络后重试。');
      }
      throw error;
    })
    .finally(() => globalThis.clearTimeout(timeout));
}
