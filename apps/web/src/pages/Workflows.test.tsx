/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/workflow', () => ({
  deleteWorkflow: vi.fn(),
  listWorkflows: vi.fn().mockResolvedValue({
    list: [
      {
        id: 'workflow-draft',
        userId: 'user-1',
        name: '发布博客草稿',
        description: '整理文章并生成发布草稿',
        graph: '{"nodes":[{},{}]}',
        revision: 1,
        status: 'draft',
        createdAt: '2026-08-14T08:00:00.000Z',
        updatedAt: '2026-08-14T09:00:00.000Z',
      },
      {
        id: 'workflow-published',
        userId: 'user-1',
        name: '整理图库',
        description: '批量整理图片信息',
        graph: '{"nodes":[]}',
        revision: 1,
        status: 'published',
        createdAt: '2026-08-13T08:00:00.000Z',
        updatedAt: '2026-08-13T09:00:00.000Z',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  }),
}));
vi.mock('@/components/workbench/AIWorkflowCreateDialog', () => ({
  AIWorkflowCreateDialog: () => null,
}));
vi.mock('@/components/workbench/WorkflowCreateDialog', () => ({
  WorkflowCreateDialog: () => null,
}));

import WorkflowsPage from './Workflows';

describe('WorkflowsPage', () => {
  it('uses one collection workspace and keeps URL-backed search and filtering', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            '/workbench/resources?tab=workflows&workflow_search=%E5%8F%91%E5%B8%83&workflow_filter=draft',
          ]}
        >
          <WorkflowsPage embedded />
        </MemoryRouter>,
      );
    });

    expect(
      container.querySelector('[data-slot="private-lab-collection-workspace"]'),
    ).not.toBeNull();
    const searchInputs = container.querySelectorAll<HTMLInputElement>(
      'input[placeholder="搜索工作流"]',
    );
    expect(searchInputs).toHaveLength(1);
    expect(searchInputs[0]?.value).toBe('发布');
    expect(container.textContent).toContain('发布博客草稿');
    expect(container.textContent).not.toContain('整理图库');

    act(() => root.unmount());
    container.remove();
  });
});
