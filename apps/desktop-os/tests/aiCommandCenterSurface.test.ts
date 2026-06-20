import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('AI Command Center surface', () => {
  it('registers AI Command Center as a real Desktop OS app', () => {
    const desktopApps = readSource('src/apps/desktopApps.ts');
    const appRenderers = readSource('src/apps/appRenderers.tsx');

    expect(desktopApps).toContain("| 'aiTools'");
    expect(desktopApps).toContain("id: 'aiTools'");
    expect(desktopApps).toContain("title: 'AI Command Center'");
    expect(desktopApps).toContain("'summary'");
    expect(desktopApps).toContain("'translate'");
    expect(desktopApps).toContain("'prompt'");
    expect(appRenderers).toContain('AICommandCenterWindow');
    expect(appRenderers).toContain('aiTools: () => <AICommandCenterWindow />');
  });

  it('provides a first-pass command center backed by the existing AI chat API', () => {
    const api = readSource('src/api/ai.ts');
    const windowSource = readSource('src/apps/AICommandCenterWindow.tsx');
    const historySource = readSource('src/apps/aiCommandCenterHistory.ts');

    expect(api).toContain('AIChatMessage');
    expect(api).toContain('postAIChat');
    expect(api).toContain("'/ai/chat'");
    expect(windowSource).toContain('postAIChat');
    expect(windowSource).toContain('useAuthStore');
    expect(windowSource).toContain('readAICommandHistory');
    expect(windowSource).toContain('writeAICommandHistory');
    expect(historySource).toContain('AI_COMMAND_HISTORY_STORAGE_KEY');
    expect(historySource).toContain('createAICommandConversation');
    expect(historySource).toContain('deleteAICommandConversation');
    expect(windowSource).toContain('总结');
    expect(windowSource).toContain('翻译');
    expect(windowSource).toContain('改写');
    expect(windowSource).toContain('Prompt Lab');
    expect(windowSource).toContain('登录后使用');
  });

  it('sends on Enter and keeps Shift+Enter for new lines', () => {
    const windowSource = readSource('src/apps/AICommandCenterWindow.tsx');

    expect(windowSource).toContain('handleComposerKeyDown');
    expect(windowSource).toContain("event.key !== 'Enter'");
    expect(windowSource).toContain('event.shiftKey');
    expect(windowSource).toContain('event.preventDefault()');
    expect(windowSource).toContain('event.currentTarget.form?.requestSubmit()');
    expect(windowSource).toContain('onKeyDown={handleComposerKeyDown}');
  });

  it('uses a mainstream AI chat layout with conversation history', () => {
    const windowSource = readSource('src/apps/AICommandCenterWindow.tsx');
    const css = readSource('src/apps/AICommandCenterWindow.css');

    expect(windowSource).toContain('ai-command-center__rail');
    expect(windowSource).toContain('新对话');
    expect(windowSource).toContain('ai-command-center__conversation-list');
    expect(windowSource).toContain('activeConversation.messages');
    expect(windowSource).toContain('handleSelectConversation');
    expect(windowSource).toContain('handleDeleteConversation');
    expect(css).toContain('grid-template-columns: 220px minmax(0, 1fr)');
    expect(css).toContain('.ai-command-center__message--assistant');
    expect(css).toContain('.ai-command-center__composer-shell');
  });

  it('documents the AI Command Center direction after removing AI pets', () => {
    const plan = readSource('docs/PLAN.md');

    expect(plan).toContain('AI Command Center');
    expect(plan).toContain('本地会话历史');
    expect(plan).toContain('/ai/chat');
    expect(plan).toContain('总结');
    expect(plan).toContain('翻译');
    expect(plan).toContain('Prompt Lab');
    expect(plan).toContain('AI 宠物已移除');
  });
});
