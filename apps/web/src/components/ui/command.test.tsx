/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Command, CommandDialog, CommandItem, CommandList } from './command';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLElement.prototype.scrollIntoView = () => {};

describe('CommandItem', () => {
  it('applies the active surface only when cmdk marks an item selected', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Command>
          <CommandList>
            <CommandItem value="first">First</CommandItem>
            <CommandItem value="second">Second</CommandItem>
          </CommandList>
        </Command>,
      ),
    );

    const items = Array.from(container.querySelectorAll('[cmdk-item]'));
    expect(items.map((item) => item.getAttribute('data-selected'))).toEqual(['true', 'false']);
    expect(items[0].className).toContain('data-[selected=true]:bg-muted');
    expect(items[0].className).not.toContain('data-selected:bg-muted');

    act(() => root.unmount());
    container.remove();
  });
});

describe('CommandDialog', () => {
  it('declares interruptible enter and exit motion with a reduced-motion fallback', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <CommandDialog open onOpenChange={() => {}}>
          <Command>
            <CommandList>
              <CommandItem value="first">First</CommandItem>
            </CommandList>
          </Command>
        </CommandDialog>,
      ),
    );

    const popup = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    const backdrop = document.body.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;

    expect(popup.className).toContain('transition-[scale,opacity,filter]');
    expect(popup.className).toContain('data-starting-style:scale-[0.97]');
    expect(popup.className).toContain('data-ending-style:scale-[0.985]');
    expect(popup.className).toContain('motion-reduce:transition-none');
    expect(backdrop.className).toContain('transition-opacity');
    expect(backdrop.className).toContain('data-ending-style:opacity-0');

    act(() => root.unmount());
    container.remove();
  });
});
