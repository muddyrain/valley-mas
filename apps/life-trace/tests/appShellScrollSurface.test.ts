import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appShellSource = readFileSync(resolve(process.cwd(), 'src/components/AppShell.tsx'), 'utf8');

describe('AppShell scroll memory surface', () => {
  it('captures scroll before navigation events can leave the current route', () => {
    expect(appShellSource).toContain('onPointerDownCapture={rememberCurrentScroll}');
    expect(appShellSource).toContain('onClickCapture={rememberCurrentScroll}');
  });

  it('does not save scroll memory from route cleanup after the next page has taken over', () => {
    const layoutEffectStart = appShellSource.indexOf('useLayoutEffect(() => {');
    const cleanupStart = appShellSource.indexOf('return () => {', layoutEffectStart);
    const cleanupEnd = appShellSource.indexOf('};', cleanupStart);
    const cleanupSource = appShellSource.slice(cleanupStart, cleanupEnd);

    expect(cleanupSource).not.toContain('captureScrollMemory');
    expect(cleanupSource).not.toContain('scrollMemoryRef.current.set');
  });

  it('guards passive scroll listeners from overwriting memory after route changes', () => {
    expect(appShellSource).toContain('const activeScrollRouteKeyRef = useRef(scrollRouteKey)');
    expect(appShellSource).toContain('activeScrollRouteKeyRef.current = scrollRouteKey');
    expect(appShellSource).toContain('const scrollListenerRouteKey = scrollRouteKey');
    expect(appShellSource).toContain('activeScrollRouteKeyRef.current !== scrollListenerRouteKey');
    expect(appShellSource).toContain('scrollMemoryRef.current.set(');
    expect(appShellSource).toContain('scrollListenerRouteKey,');
  });
});
