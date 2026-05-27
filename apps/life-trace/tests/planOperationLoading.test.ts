import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '../src/types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

const plan: Plan = {
  id: '101',
  title: '吃饭',
  type: '吃饭',
  timeLabel: '今天 19:30',
  reminder: true,
  note: '测试计划',
  completed: false,
};

describe('plan operation loading state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorage());
  });

  it('marks create plan as loading until the request finishes', async () => {
    const deferred = createDeferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => deferred.promise),
    );
    const { useAuthStore } = await import('../src/store/useAuthStore');
    const { useLifeTraceStore } = await import('../src/store/useLifeTraceStore');
    useAuthStore.setState({ token: 'token', status: 'authenticated' });

    const request = useLifeTraceStore.getState().addPlan({
      title: '喝水',
      type: '普通事项',
      timeLabel: '今天 10:00',
      reminder: true,
      note: '测试',
    });

    expect(useLifeTraceStore.getState().planCreating).toBe(true);

    deferred.resolve(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'success',
          data: { ...plan, id: '102', title: '喝水' },
        }),
      ),
    );
    await request;

    expect(useLifeTraceStore.getState().planCreating).toBe(false);
  });

  it('marks complete and delete operations by plan id', async () => {
    const completeDeferred = createDeferred<Response>();
    const traceDeferred = createDeferred<Response>();
    const deleteDeferred = createDeferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() => completeDeferred.promise)
        .mockImplementationOnce(() => traceDeferred.promise)
        .mockImplementationOnce(() => deleteDeferred.promise),
    );
    const { useAuthStore } = await import('../src/store/useAuthStore');
    const { useLifeTraceStore } = await import('../src/store/useLifeTraceStore');
    useAuthStore.setState({ token: 'token', status: 'authenticated' });
    useLifeTraceStore.setState({ plans: [plan], traces: [] });

    const completeRequest = useLifeTraceStore.getState().completePlan(plan.id);
    expect(useLifeTraceStore.getState().planCompletingById[plan.id]).toBe(true);

    completeDeferred.resolve(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'success',
          data: { ...plan, completed: true },
        }),
      ),
    );
    await Promise.resolve();
    expect(useLifeTraceStore.getState().planCompletingById[plan.id]).toBe(true);

    traceDeferred.resolve(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'success',
          data: {
            id: 'trace-1',
            title: '吃饭',
            summary: '已生成踪迹',
            timeLabel: '今天 19:30',
            mood: '满足',
            tags: ['吃饭'],
            source: '计划',
          },
        }),
      ),
    );
    await completeRequest;
    expect(useLifeTraceStore.getState().planCompletingById[plan.id]).toBe(false);

    const deleteRequest = useLifeTraceStore.getState().removePlan(plan.id);
    expect(useLifeTraceStore.getState().planDeletingById[plan.id]).toBe(true);

    deleteDeferred.resolve(
      new Response(JSON.stringify({ code: 0, message: 'success', data: { id: plan.id } })),
    );
    await deleteRequest;
    expect(useLifeTraceStore.getState().planDeletingById[plan.id]).toBe(false);
  });
});
