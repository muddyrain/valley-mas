import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AIAppEditor, {
  agentToolOptions,
  parseAIAppAgentConfig,
  saveAIAppCapabilities,
} from './index';

describe('AIAppEditor', () => {
  it('renders a loading shell with accessible busy state', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workbench/apps/12/settings']}>
        <Routes>
          <Route path="/workbench/apps/:appId/settings" element={<AIAppEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(html).toContain('aria-busy="true"');
  });

  it('migrates a legacy system prompt into IDENTITY.md and supplies all profile defaults', () => {
    const config = parseAIAppAgentConfig({
      id: '1',
      appId: '2',
      number: 1,
      config: JSON.stringify({ systemPrompt: '你是一位旅行伙伴', skillIds: [] }),
      createdAt: '2026-08-02T00:00:00Z',
    });
    expect(config.identity).toBe('你是一位旅行伙伴');
    expect(config.userProfile).toContain('USER.md');
    expect(config.soul).toContain('SOUL.md');
    expect(config.agentInstructions).toContain('AGENTS.md');
  });

  it('ignores the retired separate vision model setting', () => {
    const config = parseAIAppAgentConfig({
      id: '1',
      appId: '2',
      number: 1,
      config: JSON.stringify({ modelId: 'chat-model', visionModelId: 'legacy-vision-model' }),
      createdAt: '2026-08-02T00:00:00Z',
    });

    expect(config.modelId).toBe('chat-model');
    expect(config.visionModelId).toBeUndefined();
  });

  it('offers image and document conversion tools in the agent editor', () => {
    expect(agentToolOptions.map((tool) => tool.name)).toEqual([
      'content.search',
      'file.create',
      'image.generate',
      'image.convert',
      'document.convert',
      'document.export',
      'document.save',
      'document.overwrite',
      'blog.publish',
    ]);
  });

  it('returns the final draft version after saving tools and knowledge bases', async () => {
    const calls: string[] = [];
    const replaceTools = async () => {
      calls.push('tools');
      return { tools: ['image.convert'], bindings: [], version: { id: 'tool-version' } };
    };
    const replaceKnowledgeBases = async () => {
      calls.push('knowledge-bases');
      return { knowledgeBaseIds: [], version: { id: 'final-version' } };
    };

    const versionID = await saveAIAppCapabilities(
      {
        appId: 'app-1',
        tools: ['image.convert'],
        bindings: [],
        knowledgeBaseIds: [],
      },
      { replaceTools, replaceKnowledgeBases },
    );

    expect(calls).toEqual(['tools', 'knowledge-bases']);
    expect(versionID).toBe('final-version');
  });
});
