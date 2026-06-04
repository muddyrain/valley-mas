import { describe, expect, it } from 'vitest';
import {
  getLifeTraceDiagnosticMessage,
  getLifeTraceErrorCode,
  getLifeTraceErrorMessage,
  getLifeTraceHttpErrorMessage,
  isAuthDependencyMessage,
  isNetworkFailureMessage,
  isPushRebindRequired,
  LIFE_TRACE_ERROR_CODES,
} from '../src/lib/error';

describe('life trace error helpers', () => {
  it('normalizes browser network failures', () => {
    expect(getLifeTraceErrorMessage(new Error('Load failed'), '读取失败')).toBe(
      '网络连接失败，请检查网络后重试',
    );
    expect(getLifeTraceErrorMessage(new Error('Failed to fetch'), '读取失败')).toBe(
      '网络连接失败，请检查网络后重试',
    );
    expect(isNetworkFailureMessage('Network request failed')).toBe(true);
  });

  it('normalizes auth dependency failures', () => {
    expect(getLifeTraceHttpErrorMessage(503, '认证服务暂时不可用，请稍后重试')).toBe(
      '云端登录校验暂时不可用，请重新加载重试',
    );
    expect(getLifeTraceErrorMessage(new Error('暂时无法验证登录状态'), '读取失败')).toBe(
      '云端登录校验暂时不可用，请重新加载重试',
    );
    expect(isAuthDependencyMessage('认证服务暂时不可用，请稍后重试')).toBe(true);
  });

  it('extracts machine-readable error codes from request errors', () => {
    const error = Object.assign(new Error('认证服务暂时不可用，请稍后重试'), {
      errorCode: LIFE_TRACE_ERROR_CODES.AUTH_USER_QUERY_FAILED,
    });

    expect(getLifeTraceErrorCode(error)).toBe(LIFE_TRACE_ERROR_CODES.AUTH_USER_QUERY_FAILED);
    expect(getLifeTraceDiagnosticMessage(error)).toBe('云端登录校验暂时不可用，请重新加载重试');
  });

  it('detects push rebind diagnostics from error codes and fallback messages', () => {
    const codedError = Object.assign(new Error('推送失败'), {
      errorCode: LIFE_TRACE_ERROR_CODES.PUSH_REBIND_REQUIRED,
    });

    expect(isPushRebindRequired(codedError)).toBe(true);
    expect(getLifeTraceDiagnosticMessage(codedError)).toBe(
      '推送密钥或设备订阅已失效，请重新绑定推送',
    );
    expect(isPushRebindRequired(new Error('web push failed: BadJwtToken'))).toBe(true);
  });

  it('preserves domain errors and falls back for unknown failures', () => {
    expect(getLifeTraceHttpErrorMessage(400, '邀请码已失效')).toBe('邀请码已失效');
    expect(getLifeTraceErrorMessage('unknown', '读取家庭空间失败')).toBe('读取家庭空间失败');
  });
});
