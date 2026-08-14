/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value }: { children?: ReactNode; value: string }) => (
    <div data-active-tab={value}>{children}</div>
  ),
  TabsList: ({ children }: { children?: ReactNode }) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: { children?: ReactNode; value: string }) => (
    <button type="button" role="tab" data-value={value}>
      {children}
    </button>
  ),
}));
vi.mock('@/pages/KnowledgeBases', () => ({ default: () => <section>知识库内容</section> }));
vi.mock('@/pages/Workflows', () => ({ default: () => <section>工作流内容</section> }));
vi.mock('./PromptResources', () => ({ default: () => <section>提示词内容</section> }));
vi.mock('./SkillResources', () => ({ default: () => <section>技能内容</section> }));
vi.mock('./ToolResources', () => ({ default: () => <section>工具内容</section> }));

import AIResources from './index';

describe('AIResources', () => {
  it('uses the shared lab frame while preserving the selected resource tab', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/workbench/resources?tab=skills']}>
          <AIResources />
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-slot="private-lab-page"]')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('AI 资源');
    expect(container.querySelector('[data-active-tab="skills"]')).not.toBeNull();
    expect(container.textContent).toContain('技能内容');

    act(() => root.unmount());
    container.remove();
  });
});
