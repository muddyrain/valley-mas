import {
  type ApiResponse,
  createFetchRequest,
  isTransientFailure,
  type ApiRequestInit as SharedApiRequestInit,
} from '@valley/shared-fetch-request';
import { getLifeTraceErrorMessage, getLifeTraceHttpErrorMessage } from '@/lib/error';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export type ApiRequestInit = SharedApiRequestInit;
export type { ApiResponse };

function showErrorToast(message: string, init: SharedApiRequestInit) {
  if (init.suppressErrorToast) {
    return;
  }

  useFeedbackToastStore.getState().showToast(init.errorToastMessage || message, 'error', 3200);
}

const apiRequestWithOptions = createFetchRequest<ApiRequestError>({
  baseURL: API_BASE,
  requireResponseData: true,
  showError: (message, init) => {
    showErrorToast(message, init);
  },
  createError: (message, _init, context) => new ApiRequestError(message, context?.errorCode),
  resolveNetworkMessage: (error, fallback) => getLifeTraceErrorMessage(error, fallback),
  resolveHttpMessage: (status, payloadMessage) =>
    getLifeTraceHttpErrorMessage(status, payloadMessage),
  resolveBusinessMessage: (payload, fallback) =>
    getLifeTraceHttpErrorMessage(undefined, payload.message || fallback),
  shouldRetry: ({ init, attempt, status }) => isTransientFailure(init, attempt, status),
});

export function apiRequest<T>(path: string, token: string, init: ApiRequestInit = {}) {
  return apiRequestWithOptions<T>(path, { ...init, token });
}
