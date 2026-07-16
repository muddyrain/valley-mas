import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

const originalFetch = globalThis.fetch;

try {
  const { streamAIAppConversation } = await vite.ssrLoadModule('/src/api/aiWorkbench.ts');
  const terminalEvent = {
    type: 'done',
    run: { id: 'run-1' },
    conversation: { id: 'conversation-1' },
    userMessage: { id: 'message-1' },
    assistantMessage: { id: 'message-2' },
  };
  globalThis.fetch = async () =>
    new Response(`data: ${JSON.stringify(terminalEvent)}`, {
      headers: { 'content-type': 'text/event-stream' },
    });

  let delivered = false;
  await streamAIAppConversation('app-1', 'conversation-1', 'hello', {
    onDelta: () => undefined,
    onDone: () => {
      delivered = true;
    },
    onError: (message) => {
      throw new Error(`unexpected SSE error: ${message}`);
    },
  });

  assert.equal(delivered, true, 'must deliver the terminal SSE event buffered at EOF');
} finally {
  globalThis.fetch = originalFetch;
  await vite.close();
}
