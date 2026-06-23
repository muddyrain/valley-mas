import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reducedMotionMock = vi.hoisted(() => ({ value: false as boolean | null }));

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => reducedMotionMock.value,
  };
});

import { PlushFade, PlushPop, PlushPresence, PlushSlide } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
});

describe('PlushMotion 原语', () => {
  it('PlushPresence + PlushPop open 时输出 data-state="enter" 与 data-motion-presence="pop"', () => {
    const html = renderToStaticMarkup(
      <PlushPresence>
        <PlushPop open>hello</PlushPop>
      </PlushPresence>,
    );
    expect(html).toContain('data-state="enter"');
    expect(html).toContain('data-motion-presence="pop"');
    expect(html).toContain('hello');
  });

  it('PlushPop open=false 输出 data-state="exit"', () => {
    const html = renderToStaticMarkup(<PlushPop open={false}>hello</PlushPop>);
    expect(html).toContain('data-state="exit"');
  });

  it('reducedMotion=true 时 PlushFade 输出 data-motion-duration="0"', () => {
    reducedMotionMock.value = true;
    const html = renderToStaticMarkup(<PlushFade open>x</PlushFade>);
    expect(html).toContain('data-motion-duration="0"');
    expect(html).toContain('data-motion-presence="fade"');
  });

  it('PlushSlide 透传 from 方向到 data-from 属性', () => {
    const html = renderToStaticMarkup(
      <PlushSlide open from="right">
        x
      </PlushSlide>,
    );
    expect(html).toContain('data-from="right"');
    expect(html).toContain('data-motion-presence="slide"');
  });

  it('PlushPop reduced=true + open=false 直接 return null,不渲染', () => {
    reducedMotionMock.value = true;
    const html = renderToStaticMarkup(<PlushPop open={false}>hello</PlushPop>);
    expect(html).toBe('');
  });

  it('PlushFade 非 reduced 下 data-motion-duration 为空字符串', () => {
    const html = renderToStaticMarkup(<PlushFade open>x</PlushFade>);
    expect(html).toContain('data-motion-duration=""');
  });

  it('PlushSlide reduced=true + open=true 输出 data-motion-duration="0"', () => {
    reducedMotionMock.value = true;
    const html = renderToStaticMarkup(
      <PlushSlide open from="left">
        x
      </PlushSlide>,
    );
    expect(html).toContain('data-motion-duration="0"');
    expect(html).toContain('data-from="left"');
  });
});
