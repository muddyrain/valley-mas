import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dockSource = readFileSync('apps/desktop-os/src/components/Dock.tsx', 'utf8');
const dockStyles = readFileSync('apps/desktop-os/src/components/Dock.css', 'utf8');

describe('dock context menu surface', () => {
  it('uses a macOS-style grouped menu vocabulary', () => {
    expect(dockSource).toContain('显示启动台');
    expect(dockSource).toContain('隐藏启动台');
    expect(dockSource).toContain('显示');
    expect(dockSource).toContain('选项');
    expect(dockSource).toContain('›');
    expect(dockSource).toContain('在 Dock 中保留');
    expect(dockSource).toContain('从 Dock 中移除');
    expect(dockSource).toContain('Dock 设置');
    expect(dockSource).toContain('hasPrimaryMenuAction');
    expect(dockSource).toContain('dock-menu__submenu');
    expect(dockSource).toContain('dock-menu__item--submenu-trigger');
    expect(dockSource).toContain('dock-menu__separator');
    expect(dockSource).not.toContain('dock-menu__section-title');
  });

  it('styles the menu like an animated compact system context menu', () => {
    expect(dockStyles).toContain('dock-menu__separator');
    expect(dockStyles).toContain('dock-menu__submenu');
    expect(dockStyles).toContain('@keyframes dock-menu-pop');
    expect(dockStyles).toContain('@keyframes dock-submenu-pop');
    expect(dockStyles).toContain('prefers-reduced-motion');
    expect(dockStyles).toContain('rgba(0, 122, 255');
    expect(dockStyles).toContain('min-width: 168px');
  });
});
