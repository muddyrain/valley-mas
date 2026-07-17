import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

const originalFetch = globalThis.fetch;

try {
  const { createPromptAssistantSuggestion, streamAIAppConversation } =
    await vite.ssrLoadModule('/src/api/aiWorkbench.ts');
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
    onError: ({ message }) => {
      throw new Error(`unexpected SSE error: ${message}`);
    },
  });

  assert.equal(delivered, true, 'must deliver the terminal SSE event buffered at EOF');

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: 503,
        errorCode: 'ARK_EMBEDDING_NOT_CONFIGURED',
        message: '知识库向量模型未配置',
        data: {
          run: { id: 'run-failed', status: 'failed' },
          userMessage: { id: 'message-user', role: 'user' },
        },
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  let failure;
  await streamAIAppConversation('app-1', 'conversation-1', 'hello', {
    onDelta: () => undefined,
    onDone: () => assert.fail('must not complete failed conversation'),
    onError: (payload) => {
      failure = payload;
    },
  });
  assert.deepEqual(failure, {
    message: '知识库向量模型未配置',
    errorCode: 'ARK_EMBEDDING_NOT_CONFIGURED',
    run: { id: 'run-failed', status: 'failed' },
    userMessage: { id: 'message-user', role: 'user' },
  });

  const promptSuggestion = {
    optimizedPrompt: '优化后的提示词',
    summary: ['补齐边界'],
  };
  globalThis.fetch = async () =>
    new Response(
      `data: ${JSON.stringify({ type: 'delta', chunk: '{"optimized' })}\n\ndata: ${JSON.stringify({ type: 'done', suggestion: promptSuggestion })}`,
      { headers: { 'content-type': 'text/event-stream' } },
    );
  const promptResult = await createPromptAssistantSuggestion(
    { target: 'agent', mode: 'auto', currentPrompt: '原提示词' },
    undefined,
  );
  assert.deepEqual(promptResult.suggestion, promptSuggestion);

  const descriptionSuggestion = {
    optimizedPrompt: '',
    description: '帮助用户练习真实英语对话。',
    summary: ['突出练习场景'],
  };
  let fieldRequest;
  globalThis.fetch = async (_input, init) => {
    fieldRequest = JSON.parse(init.body);
    return new Response(
      `data: ${JSON.stringify({ type: 'done', suggestion: descriptionSuggestion })}`,
      { headers: { 'content-type': 'text/event-stream' } },
    );
  };
  const descriptionResult = await createPromptAssistantSuggestion({
    target: 'agent',
    field: 'description',
    mode: 'auto',
    currentPrompt: '',
    agentContext: {
      name: '英语训练智能体',
      description: '',
      systemPrompt: '你是一位英语教练',
      openingMessage: '',
      exampleQuestions: [],
    },
  });
  assert.equal(fieldRequest.field, 'description');
  assert.equal(fieldRequest.agentContext.name, '英语训练智能体');
  assert.deepEqual(descriptionResult.suggestion, descriptionSuggestion);
} finally {
  globalThis.fetch = originalFetch;
  await vite.close();
}
