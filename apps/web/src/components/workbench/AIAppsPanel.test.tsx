/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { listAIApps } = vi.hoisted(() => ({
  listAIApps: vi.fn(),
}));

vi.mock('@/api/aiWorkbench', () => ({
  deleteAIApp: vi.fn(),
  listAIApps,
}));
vi.mock('@/components/ai-workbench/AgentAvatar', () => ({
  AgentAvatar: () => <span aria-hidden="true">头像</span>,
}));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DropdownMenuTrigger: ({ render }: { render?: ReactNode }) => render,
}));
vi.mock('./AIAgentCreateDialog', () => ({
  AIAgentCreateDialog: ({ open }: { open: boolean }) => (
    <output data-testid="create-dialog-open">{String(open)}</output>
  ),
}));

import { AIAppsPanel } from './AIAppsPanel';

beforeEach(() => {
  listAIApps.mockResolvedValue({ list: [] });
});

describe('AIAppsPanel', () => {
  it('uses the page heading for the agent collection and opens creation from it', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AIAppsPanel />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('h1')?.textContent).toBe('智能体');
    expect(
      Array.from(container.querySelectorAll('h2')).some(
        (heading) => heading.textContent === '智能体',
      ),
    ).toBe(false);
    expect(container.querySelector('[data-testid="create-dialog-open"]')?.textContent).toBe(
      'false',
    );

    act(() => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="create-dialog-open"]')?.textContent).toBe('true');

    act(() => root.unmount());
    container.remove();
  });
});
