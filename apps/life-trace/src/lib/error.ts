const AUTH_DEPENDENCY_MESSAGE = '云端登录校验暂时不可用，请重新加载重试';
const NETWORK_FAILURE_MESSAGE = '网络连接失败，请检查网络后重试';
export const PUSH_REBIND_REQUIRED_MESSAGE = '推送密钥或设备订阅已失效，请重新绑定推送';

export const LIFE_TRACE_ERROR_CODES = {
  AUTH_DB_UNAVAILABLE: 'AUTH_DB_UNAVAILABLE',
  AUTH_USER_QUERY_FAILED: 'AUTH_USER_QUERY_FAILED',
  PUSH_REBIND_REQUIRED: 'PUSH_REBIND_REQUIRED',
} as const;

export type LifeTraceErrorCode =
  (typeof LIFE_TRACE_ERROR_CODES)[keyof typeof LIFE_TRACE_ERROR_CODES];

type ErrorWithCode = Error & {
  errorCode?: unknown;
};

export function isAuthDependencyMessage(message: string) {
  return message.includes('认证服务暂时不可用') || message.includes('暂时无法验证登录状态');
}

export function isNetworkFailureMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes('load failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed')
  );
}

export function getLifeTraceErrorCode(error: unknown): LifeTraceErrorCode | undefined {
  if (!(error instanceof Error) || !('errorCode' in error)) {
    return undefined;
  }

  const code = (error as ErrorWithCode).errorCode;
  if (typeof code !== 'string') {
    return undefined;
  }

  return Object.values(LIFE_TRACE_ERROR_CODES).includes(code as LifeTraceErrorCode)
    ? (code as LifeTraceErrorCode)
    : undefined;
}

export function isPushRebindRequired(error: unknown) {
  const code = getLifeTraceErrorCode(error);
  if (code === LIFE_TRACE_ERROR_CODES.PUSH_REBIND_REQUIRED) {
    return true;
  }

  const message = error instanceof Error ? error.message : '';
  return message.includes('重新绑定推送') || message.toLowerCase().includes('badjwttoken');
}

export function getLifeTraceDiagnosticMessage(error: unknown, fallback = '操作失败，请稍后重试') {
  const code = getLifeTraceErrorCode(error);
  if (
    code === LIFE_TRACE_ERROR_CODES.AUTH_DB_UNAVAILABLE ||
    code === LIFE_TRACE_ERROR_CODES.AUTH_USER_QUERY_FAILED
  ) {
    return AUTH_DEPENDENCY_MESSAGE;
  }
  if (code === LIFE_TRACE_ERROR_CODES.PUSH_REBIND_REQUIRED) {
    return PUSH_REBIND_REQUIRED_MESSAGE;
  }

  return getLifeTraceErrorMessage(error, fallback);
}

export function getLifeTraceErrorMessage(error: unknown, fallback = '操作失败，请稍后重试') {
  const message = error instanceof Error ? error.message : '';
  if (!message) {
    return fallback;
  }
  if (isAuthDependencyMessage(message)) {
    return AUTH_DEPENDENCY_MESSAGE;
  }
  if (isNetworkFailureMessage(message)) {
    return NETWORK_FAILURE_MESSAGE;
  }
  return message;
}

export function getLifeTraceHttpErrorMessage(status?: number, backendMessage?: string) {
  const message = backendMessage?.trim();
  if (message && isAuthDependencyMessage(message)) {
    return AUTH_DEPENDENCY_MESSAGE;
  }
  if (message && isNetworkFailureMessage(message)) {
    return NETWORK_FAILURE_MESSAGE;
  }
  if (message) {
    return message;
  }

  if (status === 401) return '登录状态已失效，请重新登录';
  if (status === 403) return '没有权限执行此操作';
  if (status === 404) return '请求的内容不存在';
  if (status === 500) return '服务器内部错误';
  if (status === 502) return '网关错误，请稍后重试';
  if (status === 503) return '云端服务暂时不可用，请稍后重试';
  if (status === 504) return '云端响应超时，请稍后重试';
  if (status && status >= 500) return '服务端发生错误，请稍后重试';
  return '请求失败，请稍后重试';
}
