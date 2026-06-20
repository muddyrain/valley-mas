import { type FormEvent, type KeyboardEvent, useMemo, useState } from 'react';
import { type AIChatMessage, postAIChat } from '../api/ai';
import { useAuthStore } from '../store/authStore';
import {
  type AICommandConversation,
  type AICommandHistoryState,
  createAICommandConversation,
  createAICommandMessage,
  deleteAICommandConversation,
  deriveAICommandTitle,
  readAICommandHistory,
  setActiveAICommandConversation,
  upsertAICommandConversation,
  writeAICommandHistory,
} from './aiCommandCenterHistory';
import './AICommandCenterWindow.css';

type CommandMode = 'chat' | 'summary' | 'translate' | 'rewrite' | 'prompt';

interface CommandPreset {
  id: CommandMode;
  label: string;
  helper: string;
  placeholder: string;
  compose: (input: string) => string;
}

const COMMAND_PRESETS: CommandPreset[] = [
  {
    id: 'chat',
    label: 'Chat',
    helper: '直接问',
    placeholder: '输入消息，Enter 发送，Shift+Enter 换行',
    compose: (input) => input,
  },
  {
    id: 'summary',
    label: '总结',
    helper: '提炼要点',
    placeholder: '粘贴文章、会议记录或长文本',
    compose: (input) => `请用简体中文把以下内容总结为 3-5 个要点，只输出结果：\n\n${input}`,
  },
  {
    id: 'translate',
    label: '翻译',
    helper: '转成中文',
    placeholder: '粘贴需要翻译的内容',
    compose: (input) => `请把以下内容翻译成自然、准确的简体中文，只输出译文：\n\n${input}`,
  },
  {
    id: 'rewrite',
    label: '改写',
    helper: '更清晰',
    placeholder: '粘贴需要改写的文案',
    compose: (input) =>
      `请把以下内容改写得更清晰、更短、更有行动感，保持原意，只输出改写结果：\n\n${input}`,
  },
  {
    id: 'prompt',
    label: 'Prompt Lab',
    helper: '整理提示词',
    placeholder: '描述你想让 AI 完成的任务',
    compose: (input) =>
      `请把以下目标整理成一段可直接复制的高质量提示词，包含角色、任务、输入、约束和输出格式：\n\n${input}`,
  },
];

function toChatHistory(conversation: AICommandConversation): AIChatMessage[] {
  return conversation.messages.map(({ role, content }) => ({ role, content }));
}

function touchConversation(conversation: AICommandConversation): AICommandConversation {
  return {
    ...conversation,
    updatedAt: new Date().toISOString(),
  };
}

function formatConversationTime(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AICommandCenterWindow() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mode, setMode] = useState<CommandMode>('chat');
  const [draft, setDraft] = useState('');
  const [historyState, setHistoryState] = useState<AICommandHistoryState>(() =>
    readAICommandHistory(),
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const activePreset = useMemo(
    () => COMMAND_PRESETS.find((item) => item.id === mode) ?? COMMAND_PRESETS[0],
    [mode],
  );
  const activeConversation =
    historyState.conversations.find((item) => item.id === historyState.activeConversationId) ??
    historyState.conversations[0];
  const status = isSending ? '生成中' : isAuthenticated ? '就绪' : '登录后使用';

  function commitHistory(nextState: AICommandHistoryState) {
    setHistoryState(nextState);
    writeAICommandHistory(nextState);
  }

  function handleNewConversation() {
    const conversation = createAICommandConversation();
    commitHistory({
      activeConversationId: conversation.id,
      conversations: [conversation, ...historyState.conversations],
    });
    setDraft('');
    setError('');
  }

  function handleSelectConversation(conversationId: string) {
    commitHistory(setActiveAICommandConversation(historyState, conversationId));
    setDraft('');
    setError('');
  }

  function handleDeleteConversation(conversationId: string) {
    commitHistory(deleteAICommandConversation(historyState, conversationId));
    setDraft('');
    setError('');
  }

  function handleClearConversation() {
    const nextConversation = touchConversation({
      ...activeConversation,
      title: '新对话',
      messages: [],
    });
    commitHistory(
      upsertAICommandConversation(
        { ...historyState, activeConversationId: activeConversation.id },
        nextConversation,
      ),
    );
    setDraft('');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = draft.trim();
    if (!input || isSending) return;

    if (!isAuthenticated || !token) {
      setError('登录后使用 AI 工具');
      return;
    }

    const userMessage = createAICommandMessage('user', input);
    const nextConversation = touchConversation({
      ...activeConversation,
      title:
        activeConversation.messages.length === 0
          ? deriveAICommandTitle(input)
          : activeConversation.title,
      messages: [...activeConversation.messages, userMessage],
    });
    const nextHistoryState = upsertAICommandConversation(
      { ...historyState, activeConversationId: activeConversation.id },
      nextConversation,
    );
    commitHistory(nextHistoryState);
    setDraft('');
    setError('');
    setIsSending(true);

    try {
      const result = await postAIChat(
        {
          message: activePreset.compose(input),
          history: toChatHistory(activeConversation),
        },
        token,
      );
      const latestState = readAICommandHistory();
      const latestConversation =
        latestState.conversations.find((item) => item.id === activeConversation.id) ??
        nextConversation;
      commitHistory(
        upsertAICommandConversation(latestState, {
          ...touchConversation(latestConversation),
          messages: [
            ...latestConversation.messages,
            createAICommandMessage('assistant', result.reply),
          ],
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 请求失败');
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="dock-app-window ai-command-center">
      <aside className="ai-command-center__rail" aria-label="AI 会话历史">
        <div className="ai-command-center__rail-head">
          <strong>AI Command</strong>
          <button type="button" onClick={handleNewConversation}>
            新对话
          </button>
        </div>

        <div className="ai-command-center__conversation-list">
          {historyState.conversations.map((conversation) => {
            const active = conversation.id === activeConversation.id;
            return (
              <div
                key={conversation.id}
                className={`ai-command-center__conversation${active ? ' is-active' : ''}`}
              >
                <button type="button" onClick={() => handleSelectConversation(conversation.id)}>
                  <span>{conversation.title || '新对话'}</span>
                  <small>{formatConversationTime(conversation.updatedAt)}</small>
                </button>
                <button
                  type="button"
                  aria-label="删除对话"
                  onClick={() => handleDeleteConversation(conversation.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="ai-command-center__chat">
        <header className="ai-command-center__header">
          <div>
            <div className="dock-app-window__eyebrow">AI 工具</div>
            <h2>{activeConversation.title || 'AI Command Center'}</h2>
          </div>
          <span className="dock-app-window__badge">{status}</span>
        </header>

        <div className="ai-command-center__mode-row">
          {COMMAND_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={preset.id === mode ? 'is-active' : ''}
              onClick={() => {
                setMode(preset.id);
                setError('');
              }}
            >
              <strong>{preset.label}</strong>
              <span>{preset.helper}</span>
            </button>
          ))}
        </div>

        <section className="ai-command-center__thread" aria-live="polite">
          {activeConversation.messages.length === 0 ? (
            <div className="ai-command-center__empty">
              <strong>有什么想处理的？</strong>
              <span>总结、翻译、改写或直接提问。</span>
            </div>
          ) : (
            activeConversation.messages.map((message) => (
              <article
                key={message.id}
                className={`ai-command-center__message ai-command-center__message--${message.role}`}
              >
                <div className="ai-command-center__avatar">
                  {message.role === 'user' ? '你' : 'AI'}
                </div>
                <div className="ai-command-center__bubble">
                  <div>{message.role === 'user' ? 'You' : 'AI'}</div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          )}
        </section>

        <form className="ai-command-center__composer-shell" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={activePreset.placeholder}
            spellCheck={false}
          />
          <div className="ai-command-center__actions">
            {error ? <span className="ai-command-center__error">{error}</span> : <span />}
            <button type="button" onClick={handleClearConversation}>
              清空
            </button>
            <button type="submit" disabled={!draft.trim() || isSending}>
              发送
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
