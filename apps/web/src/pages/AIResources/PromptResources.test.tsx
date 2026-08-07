/** @vitest-environment jsdom */
import { act, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PromptResources from './PromptResources';

const { createAIPrompt, listAIPrompts, updateAIPrompt } = vi.hoisted(() => ({
  createAIPrompt: vi.fn(),
  listAIPrompts: vi.fn(),
  updateAIPrompt: vi.fn(),
}));

const MOCK_STYLE_SEEDS = [
  {
    name: '摄像画风',
    description: '电影化镜头表达，强调景深和运动感。',
    content:
      '构图采用电影摄影机位，使用电影镜头语言描绘 4K 高清二次元角色，景深分明，环境与主角呼吸同步，no text。',
    tags: ['生图', '电影', '镜头'],
  },
  {
    name: '动漫电影感',
    description: '叙事清晰，动作与场景更有电影张力。',
    content:
      '主角采用高质量二游角色设计，镜头略低，强调动作姿态和环境关系，具备动漫电影的叙事张力，no text。',
    tags: ['生图', '动画', '电影感'],
  },
  {
    name: '宫崎骏式风景',
    description: '自然光下的温柔治愈画面。',
    content: '使用宫崎骏风格的自然色彩与环境叙事，角色与风景协同，清晰层次，空气质感柔和，4K。',
    tags: ['生图', '宫崎骏', '温暖'],
  },
];

vi.mock('@/api/aiWorkbench', () => ({
  archiveAIPrompt: vi.fn(),
  createAIPrompt,
  getAPIErrorMessage: vi.fn(() => '失败'),
  listAIPrompts,
  updateAIPrompt,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/ai-workbench/PromptAssistantDialog', () => ({
  PromptAssistantDialog: () => <div>提示词优化弹窗</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'button'> & { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'button'> & { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogContent: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AlertDialogDescription: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'p'> & { children?: ReactNode }) => <p {...props}>{children}</p>,
  AlertDialogFooter: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AlertDialogHeader: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AlertDialogTitle: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'h2'> & { children?: ReactNode }) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: ComponentPropsWithoutRef<'span'> & { children?: ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'button'> & { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, ...props }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DialogContent: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DialogDescription: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'p'> & { children?: ReactNode }) => <p {...props}>{children}</p>,
  DialogFooter: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DialogHeader: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DialogTitle: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'h2'> & { children?: ReactNode }) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuContent: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'button'> & { children?: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuTrigger: ({
    render,
    children,
    ...props
  }: ComponentPropsWithoutRef<'div'> & { children?: ReactNode; render?: ReactNode }) => (
    <div {...props}>
      {render}
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    onChange,
    ...props
  }: ComponentPropsWithoutRef<'input'> & { onChange?: (event: Event) => void }) => (
    <input id={id} onInput={onChange} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: ComponentPropsWithoutRef<'label'> & { children?: ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div />,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: ComponentPropsWithoutRef<'table'> & { children?: ReactNode }) => (
    <table {...props}>{children}</table>
  ),
  TableBody: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'tbody'> & { children?: ReactNode }) => (
    <tbody {...props}>{children}</tbody>
  ),
  TableCell: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'td'> & { children?: ReactNode }) => <td {...props}>{children}</td>,
  TableHead: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'th'> & { children?: ReactNode }) => <th {...props}>{children}</th>,
  TableHeader: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'thead'> & { children?: ReactNode }) => (
    <thead {...props}>{children}</thead>
  ),
  TableRow: ({ children, ...props }: ComponentPropsWithoutRef<'tr'> & { children?: ReactNode }) => (
    <tr {...props}>{children}</tr>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ id, ...props }: ComponentPropsWithoutRef<'textarea'>) => (
    <textarea id={id} {...props} />
  ),
}));

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (node) => (node.textContent || '').trim() === label,
  );
}

function mockAIPrompt(seedIndex: number) {
  return {
    id: `existing-${seedIndex}`,
    name: MOCK_STYLE_SEEDS[seedIndex].name,
    description: MOCK_STYLE_SEEDS[seedIndex].description,
    content: MOCK_STYLE_SEEDS[seedIndex].content,
    tags: MOCK_STYLE_SEEDS[seedIndex].tags,
    createdAt: '2026-08-06T00:00:00Z',
    updatedAt: '2026-08-06T00:00:00Z',
  };
}

function mockPrompt(index: number, name: string) {
  return {
    id: `prompt-${index}`,
    name,
    description: `描述 ${name}`,
    content: `内容 ${name}`,
    tags: ['通用'],
    createdAt: '2026-08-06T00:00:00Z',
    updatedAt: '2026-08-06T00:00:00Z',
  };
}

function renderPromptResources(initialPath = '/workbench/resources?tab=prompts') {
  const rootElement = document.createElement('div');
  document.body.appendChild(rootElement);
  const root = createRoot(rootElement);
  root.render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PromptResources />
    </MemoryRouter>,
  );
  return { root, rootElement };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PromptResources', () => {
  it('supports pagination when prompts exceed one page', async () => {
    listAIPrompts.mockResolvedValueOnce({
      list: Array.from({ length: 12 }, (_, index) =>
        mockPrompt(index + 1, `第${index + 1}个提示词`),
      ),
    });

    const { root, rootElement } = renderPromptResources('/workbench/resources?tab=prompts');

    await act(async () => {
      await Promise.resolve();
    });

    expect(rootElement.textContent).toContain('第 1 / 2 页 · 共 12 个提示词');
    expect(rootElement.textContent).toContain('第1个提示词');
    expect(rootElement.textContent).toContain('第10个提示词');
    expect(rootElement.textContent).not.toContain('第11个提示词');

    const nextButton = findButton(rootElement, '下一页');
    expect(nextButton).not.toBeNull();

    await act(async () => {
      nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(rootElement.textContent).toContain('第 2 / 2 页 · 共 12 个提示词');
    expect(rootElement.textContent).toContain('第11个提示词');
    expect(rootElement.textContent).toContain('第12个提示词');
    expect(rootElement.textContent).not.toContain('第1个提示词');

    root.unmount();
    rootElement.remove();
  });

  it('blocks saving prompt when title already exists', async () => {
    listAIPrompts.mockResolvedValueOnce({
      list: [mockAIPrompt(0), mockPrompt(1, '新建提示词')],
    });

    const { root, rootElement } = renderPromptResources('/workbench/resources?tab=prompts');

    await act(async () => {
      await Promise.resolve();
    });

    const createButton = findButton(rootElement, '新建提示词');
    expect(createButton).not.toBeNull();
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const nameInput = rootElement.querySelector<HTMLInputElement>('#prompt-resource-name');
    expect(nameInput).not.toBeNull();
    if (!nameInput) {
      return;
    }

    await act(async () => {
      nameInput.value = '摄像画风';
      nameInput.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: '摄像画风',
        }),
      );
      await Promise.resolve();
    });
    expect(nameInput.value).toBe('摄像画风');

    await act(async () => {
      await Promise.resolve();
    });

    const saveButton = findButton(rootElement, '保存');
    expect(saveButton).not.toBeNull();
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(createAIPrompt).not.toHaveBeenCalled();
    expect(updateAIPrompt).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('提示词名称已存在，请使用其他名称');

    root.unmount();
    rootElement.remove();
  });

  it('imports style prompt resources and skips existing name matches', async () => {
    listAIPrompts.mockResolvedValueOnce({
      list: [mockAIPrompt(0)],
    });
    (globalThis.fetch as unknown as typeof fetch) = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_STYLE_SEEDS), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    createAIPrompt.mockImplementation(
      async (payload: { name: string; description?: string; content: string; tags: string[] }) => ({
        id: payload.name,
        name: payload.name,
        description: payload.description,
        content: payload.content,
        tags: payload.tags,
        createdAt: '2026-08-06T00:00:00Z',
        updatedAt: '2026-08-06T00:00:00Z',
      }),
    );

    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/workbench/resources?tab=prompts']}>
          <PromptResources />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const seedButton = findButton(rootElement, '导入 AI 生图风格提示词');
    expect(seedButton).not.toBeNull();

    await act(async () => {
      seedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const expectedCalls = MOCK_STYLE_SEEDS.length - 1;
    expect(createAIPrompt).toHaveBeenCalledTimes(expectedCalls);
    expect(createAIPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: MOCK_STYLE_SEEDS[1].name,
        description: MOCK_STYLE_SEEDS[1].description,
        content: MOCK_STYLE_SEEDS[1].content,
        tags: expect.arrayContaining(['生图', ...MOCK_STYLE_SEEDS[1].tags]),
      }),
    );

    root.unmount();
    rootElement.remove();
  });
});
