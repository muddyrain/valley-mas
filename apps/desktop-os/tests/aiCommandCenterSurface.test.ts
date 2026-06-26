import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('AI Command Center surface', () => {
  it('registers AI Command Center as a real Desktop OS app', () => {
    const desktopApps = readSource('src/apps/desktopApps.ts');
    const appRenderers = readSource('src/apps/appRenderers.tsx');
    const windowSizing = readSource('src/store/windowSizing.ts');

    expect(desktopApps).toContain("| 'aiTools'");
    expect(desktopApps).toContain("id: 'aiTools'");
    expect(desktopApps).toContain("title: 'AI Command Center'");
    expect(desktopApps).toContain('width: 1180');
    expect(desktopApps).toContain('height: 720');
    expect(desktopApps).toContain("'summary'");
    expect(desktopApps).toContain("'translate'");
    expect(desktopApps).toContain("'prompt'");
    expect(appRenderers).toContain('AICommandCenterWindow');
    expect(appRenderers).toContain('aiTools: () => <AICommandCenterWindow />');
    expect(windowSizing).toContain('AI_COMMAND_PROFILE');
    expect(windowSizing).toContain('aiTools: AI_COMMAND_PROFILE');
  });

  it('uses cloud-backed private AI agents instead of local chat history as the main storage', () => {
    const api = readSource('src/api/ai.ts');
    const windowSource = readSource('src/apps/AICommandCenterWindow.tsx');
    const historySource = readSource('src/apps/aiCommandCenterHistory.ts');

    expect(api).toContain('AIAgent');
    expect(api).toContain('AIConversation');
    expect(api).toContain('AIMessage');
    expect(api).toContain('listAIAgents');
    expect(api).toContain('createAIAgent');
    expect(api).toContain('updateAIAgent');
    expect(api).toContain('deleteAIAgent');
    expect(api).toContain('postAIAgentChat');
    expect(api).toContain('streamAIAgentChat');
    expect(api).toContain('stream: true');
    expect(api).toContain("'/ai/agents'");
    expect(api).toContain('AIChatMessage');
    expect(windowSource).toContain('streamAIAgentChat');
    expect(windowSource).toContain('loadAgents');
    expect(windowSource).toContain('handleCreateAgent');
    expect(windowSource).toContain('isCreateDialogOpen');
    expect(windowSource).toContain('handleSaveAgent');
    expect(windowSource).toContain('handleDeleteAgent');
    expect(windowSource).toContain('useAuthStore');
    expect(windowSource).toContain('isInspectorOpen');
    expect(windowSource).toContain('登录后使用');
    expect(historySource).not.toContain('AI_COMMAND_HISTORY_STORAGE_KEY');
    expect(windowSource).toContain('总结');
    expect(windowSource).toContain('翻译');
    expect(windowSource).toContain('改写');
    expect(windowSource).toContain('Prompt Lab');
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

    expect(windowSource).toContain('ai-command-center__agent-list');
    expect(windowSource).toContain('ai-command-center__agent-card');
    expect(windowSource).toContain('ai-command-center__stage');
    expect(windowSource).toContain('ai-command-center__detail-card');
    expect(windowSource).toContain('ai-command-center__suggestion-row');
    expect(windowSource).toContain('ai-command-center__ability-tags');
    expect(windowSource).toContain('getAgentIcon');
    expect(windowSource).toContain('新对话');
    expect(windowSource).toContain('ai-command-center__conversation-list');
    expect(windowSource).toContain('activeMessages');
    expect(windowSource).toContain('threadScrollRef');
    expect(windowSource).toContain('scrollTo');
    expect(windowSource).toContain('scrollHeight');
    expect(windowSource).toContain('智能体资料');
    expect(windowSource).toContain('isThreadSwitching');
    expect(windowSource).toContain('handleSelectConversation');
    expect(windowSource).toContain('handleDeleteConversation');
    expect(css).toContain('grid-template-columns: 280px minmax(360px, 1fr) 320px');
    expect(css).toContain('height: 100%');
    expect(css).toContain('max-height: 100%');
    expect(css).toContain('.window__body-content:has(> .ai-command-center)');
    expect(css).toContain('.ai-command-center__rail-section--agents');
    expect(css).toContain('.ai-command-center__rail-section--threads');
    expect(css).toContain('.ai-command-center__agent-avatar');
    expect(css).toContain('.ai-command-center__detail-card');
    expect(css).toContain('.ai-command-center__suggestion-pill');
    expect(css).toContain('.ai-command-center__ability-tags');
    expect(css).toContain('.ai-command-center__inspector');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('.ai-command-center__dialog-backdrop');
    expect(css).not.toContain('@keyframes ai-command-thread-in');
    expect(css).not.toContain('@keyframes ai-command-message-in');
    expect(css).not.toContain('@keyframes ai-command-inspector-in');
    expect(css).not.toContain('@keyframes ai-command-dialog-in');
    expect(css).not.toContain('@keyframes ai-command-fade-in');
    expect(css).toContain('.ai-command-center__message--assistant');
    expect(css).toContain('.ai-command-center__composer-shell');
    expect(css).toContain('.ai-command-center__composer-shell:focus-within');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('documents the AI Command Center direction after removing AI pets', () => {
    const plan = readSource('docs/PLAN.md');

    expect(plan).toContain('AI Command Center');
    expect(plan).toContain('云端私有多智能体');
    expect(plan).toContain('/ai/agents');
    expect(plan).toContain('个人私有');
    expect(plan).toContain('总结');
    expect(plan).toContain('翻译');
    expect(plan).toContain('Prompt Lab');
    expect(plan).toContain('AI 宠物已移除');
    expect(plan).toContain('毛绒三栏');
    expect(plan).toContain('参考图式');
  });
});
