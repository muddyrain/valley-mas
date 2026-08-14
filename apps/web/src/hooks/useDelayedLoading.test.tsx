/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDelayedLoading } from './useDelayedLoading';

function Harness({ loading }: { loading: boolean }) {
  const visible = useDelayedLoading(loading);
  return <span data-visible={String(visible)} />;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedLoading', () => {
  it('waits 300ms before exposing a loading surface and hides it immediately on completion', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(<Harness loading />));
    expect(container.querySelector('span')?.dataset.visible).toBe('false');

    act(() => vi.advanceTimersByTime(299));
    expect(container.querySelector('span')?.dataset.visible).toBe('false');

    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('span')?.dataset.visible).toBe('true');

    act(() => root.render(<Harness loading={false} />));
    expect(container.querySelector('span')?.dataset.visible).toBe('false');

    act(() => root.unmount());
  });

  it('cancels the pending reveal when the request finishes quickly', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(<Harness loading />));
    act(() => root.render(<Harness loading={false} />));
    act(() => vi.advanceTimersByTime(400));

    expect(container.querySelector('span')?.dataset.visible).toBe('false');
    act(() => root.unmount());
  });
});
