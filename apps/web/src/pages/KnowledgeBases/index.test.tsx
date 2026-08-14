/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/ai', () => ({
  listAvailableAIModels: vi.fn().mockResolvedValue({ list: [] }),
}));
vi.mock('@/api/aiWorkbench', () => ({
  createAIKnowledgeBase: vi.fn(),
  deleteAIKnowledgeDocument: vi.fn(),
  getAPIErrorMessage: (_error: unknown, fallback: string) => fallback,
  listAIKnowledgeBases: vi.fn().mockResolvedValue({
    list: [
      {
        id: 'knowledge-1',
        name: '博客资料',
        description: '写作时使用的资料',
        documentCount: 1,
        createdAt: '2026-08-14T08:00:00.000Z',
        updatedAt: '2026-08-14T09:00:00.000Z',
      },
    ],
  }),
  listAIKnowledgeDocumentChunks: vi.fn(),
  listAIKnowledgeDocuments: vi.fn().mockResolvedValue({
    list: [
      {
        id: 'document-1',
        knowledgeBaseId: 'knowledge-1',
        name: '写作指南.md',
        status: 'ready',
        errorCode: '',
        indexProgress: 100,
        chunkCount: 2,
        mimeType: 'text/markdown',
        sizeBytes: 2048,
        source: 'upload',
        createdAt: '2026-08-14T08:00:00.000Z',
        updatedAt: '2026-08-14T09:00:00.000Z',
      },
    ],
  }),
  retryAIKnowledgeDocument: vi.fn(),
  testAIKnowledgeRetrieval: vi.fn(),
  uploadAIKnowledgeDocument: vi.fn(),
}));

import KnowledgeBases from './index';

describe('KnowledgeBases', () => {
  it('uses the shared collection workspace and restores both search queries', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            '/workbench/resources?tab=knowledge&knowledge_base=%E5%8D%9A%E5%AE%A2&knowledge_document=%E6%8C%87%E5%8D%97',
          ]}
        >
          <KnowledgeBases embedded />
        </MemoryRouter>,
      );
    });

    expect(
      container.querySelector('[data-slot="private-lab-collection-workspace"]'),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder="搜索知识库"]')?.value,
    ).toBe('博客');
    expect(container.querySelector<HTMLInputElement>('input[placeholder="搜索文档"]')?.value).toBe(
      '指南',
    );
    expect(container.textContent).toContain('博客资料');
    expect(container.textContent).toContain('写作指南.md');
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')?.hidden).toBe(true);

    act(() => root.unmount());
    container.remove();
  });
});
