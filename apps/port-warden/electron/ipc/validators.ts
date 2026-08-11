import type { StopScope } from '../../src/shared/domain';
import type { OpenTargetKind } from '../services/port-service';

type StopPrepareRequest = { pid: number; scope: StopScope };
type StopExecuteRequest = { planId: string; confirmedPids: number[] };
type OpenTargetRequest = { pid: number; kind: OpenTargetKind };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function validatePid(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2_147_483_647
  ) {
    throw new TypeError('PID 必须是有效的正整数');
  }
  return value;
}

export function validateStopPrepareRequest(value: unknown): StopPrepareRequest {
  if (!isPlainObject(value) || !hasExactKeys(value, ['pid', 'scope'])) {
    throw new TypeError('停止请求字段无效');
  }
  if (value.scope !== 'process' && value.scope !== 'tree') {
    throw new TypeError('停止范围无效');
  }
  return { pid: validatePid(value.pid), scope: value.scope };
}

export function validateStopExecuteRequest(value: unknown): StopExecuteRequest {
  if (!isPlainObject(value) || !hasExactKeys(value, ['planId', 'confirmedPids'])) {
    throw new TypeError('停止确认字段无效');
  }
  if (typeof value.planId !== 'string' || value.planId.length < 1 || value.planId.length > 128) {
    throw new TypeError('停止确认标识无效');
  }
  if (
    !Array.isArray(value.confirmedPids) ||
    value.confirmedPids.length < 1 ||
    value.confirmedPids.length > 512
  ) {
    throw new TypeError('确认的 PID 列表无效');
  }
  const confirmedPids = value.confirmedPids.map(validatePid);
  if (new Set(confirmedPids).size !== confirmedPids.length) {
    throw new TypeError('确认的 PID 列表包含重复项');
  }
  return { planId: value.planId, confirmedPids };
}

export function validateOpenTargetRequest(value: unknown): OpenTargetRequest {
  if (!isPlainObject(value) || !hasExactKeys(value, ['pid', 'kind'])) {
    throw new TypeError('打开目录请求字段无效');
  }
  if (value.kind !== 'project' && value.kind !== 'executable') {
    throw new TypeError('目录类型无效');
  }
  return { pid: validatePid(value.pid), kind: value.kind };
}
