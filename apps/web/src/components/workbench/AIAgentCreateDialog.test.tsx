import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it } from 'vitest';
import {
  AGENT_PROFILE_FIELDS,
  AIAgentCreateDialog,
  createDefaultAgentConfig,
} from './AIAgentCreateDialog';

describe('AIAgentCreateDialog', () => {
  it('uses the four profile files instead of legacy conversation copy', () => {
    const config = createDefaultAgentConfig();
    assert.deepEqual(
      AGENT_PROFILE_FIELDS.map(([, label]) => label),
      ['IDENTITY.md', 'USER.md', 'SOUL.md', 'AGENTS.md'],
    );
    assert.match(config.identity || '', /IDENTITY\.md/);
    assert.equal(config.systemPrompt, '');
    assert.equal(config.openingMessage, '');
    assert.deepEqual(config.exampleQuestions, []);
  });

  it('renders safely while closed', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIAgentCreateDialog open={false} onOpenChange={() => undefined} />
      </MemoryRouter>,
    );
    assert.equal(html, '');
  });
});
