import type { AxiosError } from 'axios';
import { getUploadResourceStatus, type MyResource } from '@/api/resource';

const UPLOAD_STATUS_CHECK_INTERVAL_MS = 2000;
const UPLOAD_STATUS_MAX_ATTEMPTS = 5;

export type UploadConfirmationResult =
  | { status: 'success'; resource: MyResource }
  | { status: 'confirming' };

export function createUploadKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `upload-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function shouldConfirmUploadResult(error: unknown) {
  const axiosError = error as AxiosError | undefined;
  if (!axiosError || axiosError.response) {
    return false;
  }

  return (
    axiosError.code === 'ECONNABORTED' ||
    axiosError.code === 'ERR_NETWORK' ||
    axiosError.code === 'ERR_CANCELED'
  );
}

export async function confirmUploadResult(uploadKey: string): Promise<UploadConfirmationResult> {
  for (let attempt = 0; attempt < UPLOAD_STATUS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await getUploadResourceStatus(uploadKey, {
        suppressErrorToast: true,
        timeout: 10000,
      });
      if (result.found && result.resource) {
        return { status: 'success', resource: result.resource };
      }
    } catch {
      // 这里保持静默，避免确认中阶段重复打断用户。
    }

    if (attempt < UPLOAD_STATUS_MAX_ATTEMPTS - 1) {
      await sleep(UPLOAD_STATUS_CHECK_INTERVAL_MS);
    }
  }

  return { status: 'confirming' };
}

export const uploadConfirmingMessage = '上传结果确认中，请稍后刷新资源列表确认，避免重复上传';

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
