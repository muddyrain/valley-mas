import { describe, expect, it } from 'vitest';
import {
  validateOpenTargetRequest,
  validatePid,
  validateStopExecuteRequest,
  validateStopPrepareRequest,
} from './validators';

describe('IPC runtime validators', () => {
  it('accepts safe PID values and rejects non-integers, booleans and protected zero', () => {
    expect(validatePid(42)).toBe(42);
    expect(() => validatePid('42')).toThrow('PID');
    expect(() => validatePid(true)).toThrow('PID');
    expect(() => validatePid(0)).toThrow('PID');
    expect(() => validatePid(42.2)).toThrow('PID');
  });

  it('allows only explicit stop scopes', () => {
    expect(validateStopPrepareRequest({ pid: 42, scope: 'tree' })).toEqual({
      pid: 42,
      scope: 'tree',
    });
    expect(() => validateStopPrepareRequest({ pid: 42, scope: 'all-node' })).toThrow('停止范围');
  });

  it('requires a bounded plan id and unique confirmed PID list', () => {
    expect(validateStopExecuteRequest({ planId: 'plan-123', confirmedPids: [43, 42] })).toEqual({
      planId: 'plan-123',
      confirmedPids: [43, 42],
    });
    expect(() =>
      validateStopExecuteRequest({ planId: 'plan-123', confirmedPids: [42, 42] }),
    ).toThrow('重复');
    expect(() => validateStopExecuteRequest({ planId: '', confirmedPids: [42] })).toThrow(
      '确认标识',
    );
  });

  it('does not accept arbitrary paths from the renderer', () => {
    expect(validateOpenTargetRequest({ pid: 42, kind: 'project' })).toEqual({
      pid: 42,
      kind: 'project',
    });
    expect(() => validateOpenTargetRequest({ pid: 42, kind: '/tmp' })).toThrow('目录类型');
    expect(() => validateOpenTargetRequest({ pid: 42, kind: 'project', path: '/tmp' })).toThrow(
      '字段',
    );
  });
});
