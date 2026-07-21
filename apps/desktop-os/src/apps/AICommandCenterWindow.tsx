import {
  Check,
  ChevronRight,
  MessageSquarePlus,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Pin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type AIAgent,
  type AIConversation,
  type AIMessage,
  type AvailableAIModel,
  createAIAgent,
  createAIConversation,
  deleteAIAgent,
  deleteAIConversation,
  getAIConversation,
  listAIAgents,
  listAIConversations,
  listAvailableAIModels,
  streamAIAgentChat,
  updateAIAgent,
} from '../api/ai';
import { useAuthStore } from '../store/authStore';
import { PlushFade, PlushPop, PlushPresence, PlushSlide } from '../ui/PlushMotion';
import PlushSelect, { type PlushSelectOption } from '../ui/PlushSelect';
import { deriveAICommandTitle } from './aiCommandCenterHistory';
import './AICommandCenterWindow.css';

type CommandMode = 'chat' | 'summary' | 'translate' | 'rewrite' | 'prompt';

interface CommandPreset {
  id: CommandMode;
  label: string;
  helper: string;
  placeholder: string;
  compose: (input: string) => string;
}

interface AgentDraft {
  name: string;
  description: string;
  avatarColor: string;
  avatarIcon: string;
  systemPrompt: string;
  openingMessage: string;
  exampleQuestionsText: string;
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
    placeholder: '粘贴内容，我帮你总结重点',
    compose: (input) => `请总结以下内容，提炼关键结论和待办：\n\n${input}`,
  },
  {
    id: 'translate',
    label: '翻译',
    helper: '转成中文',
    placeholder: '粘贴需要翻译的内容',
    compose: (input) => `请把以下内容翻译成自然、准确的中文：\n\n${input}`,
  },
  {
    id: 'rewrite',
    label: '改写',
    helper: '更清晰',
    placeholder: '输入需要润色或改写的文字',
    compose: (input) => `请改写以下内容，让表达更清晰、有条理，并保留原意：\n\n${input}`,
  },
  {
    id: 'prompt',
    label: 'Prompt Lab',
    helper: '整理提示词',
    placeholder: '描述你想让 AI 完成的任务',
    compose: (input) => `请把下面的需求整理成可直接使用的高质量提示词：\n\n${input}`,
  },
];

const ICON_EMOJI: Record<string, string> = {
  assistant: '🤖',
  bot: '🤖',
  calendar: '📅',
  code: '💻',
  default: '✨',
  idea: '💡',
  lightbulb: '💡',
  prompt: '🪄',
  research: '🔎',
  rewrite: '✍️',
  search: '🔎',
  sparkles: '✨',
  summary: '📊',
  translate: '🌐',
  writing: '✏️',
};

const DEFAULT_TASKS = ['拆解复杂问题', '整理关键结论', '生成行动清单', '优化表达结构'];
const DEFAULT_TAGS = ['信息检索', '数据分析', '报告撰写', '资料整理'];

function emptyAgentDraft(): AgentDraft {
  return {
    name: '',
    description: '',
    avatarColor: '#8fb45e',
    avatarIcon: 'sparkles',
    systemPrompt: '',
    openingMessage: '',
    exampleQuestionsText: '',
  };
}

function draftFromAgent(agent: AIAgent): AgentDraft {
  return {
    name: agent.name,
    description: agent.description,
    avatarColor: agent.avatarColor || '#8fb45e',
    avatarIcon: agent.avatarIcon || 'sparkles',
    systemPrompt: agent.systemPrompt,
    openingMessage: agent.openingMessage,
    exampleQuestionsText: agent.exampleQuestions.join('\n'),
  };
}

function formatConversationTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function createLocalMessage(
  role: AIMessage['role'],
  agentId: string,
  conversationId: string,
  content: string,
): AIMessage {
  return {
    id: `local-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    agentId,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function getAgentAccent(agent?: AIAgent) {
  return agent?.avatarColor || '#8fb45e';
}

function getAgentIcon(agent?: AIAgent) {
  if (!agent) return ICON_EMOJI.default;
  const rawIcon = agent.avatarIcon?.trim().toLowerCase();
  if (rawIcon && ICON_EMOJI[rawIcon]) return ICON_EMOJI[rawIcon];
  if (rawIcon && rawIcon.length <= 3) return agent.avatarIcon;

  const profile = `${agent.name} ${agent.description}`.toLowerCase();
  if (/code|代码|编程|调试/.test(profile)) return ICON_EMOJI.code;
  if (/日程|计划|calendar|schedule/.test(profile)) return ICON_EMOJI.calendar;
  if (/研究|分析|检索|search|research/.test(profile)) return ICON_EMOJI.research;
  if (/写作|文案|writing|copy/.test(profile)) return ICON_EMOJI.writing;
  if (/翻译|translate/.test(profile)) return ICON_EMOJI.translate;
  return ICON_EMOJI.default;
}

function getAgentSubtitle(agent?: AIAgent) {
  return agent?.description || '个人私有智能体';
}

function getAbilityTags(agent?: AIAgent) {
  const examples = agent?.exampleQuestions?.map((item) => item.trim()).filter(Boolean) ?? [];
  return (examples.length ? examples : DEFAULT_TAGS).slice(0, 6);
}

function getTaskList(agent?: AIAgent) {
  const examples = agent?.exampleQuestions?.map((item) => item.trim()).filter(Boolean) ?? [];
  return (examples.length ? examples : DEFAULT_TASKS).slice(0, 4);
}

function toAgentPayload(draft: AgentDraft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    avatarColor: draft.avatarColor.trim() || '#8fb45e',
    avatarIcon: draft.avatarIcon.trim() || 'sparkles',
    systemPrompt: draft.systemPrompt.trim(),
    openingMessage: draft.openingMessage.trim(),
    exampleQuestions: draft.exampleQuestionsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export default function AICommandCenterWindow() {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mode, setMode] = useState<CommandMode>('chat');
  const [draft, setDraft] = useState('');
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [activeMessages, setActiveMessages] = useState<AIMessage[]>([]);
  const [textModels, setTextModels] = useState<AvailableAIModel[]>([]);
  const [textModelId, setTextModelId] = useState('');
  const [agentDraft, setAgentDraft] = useState<AgentDraft>(() => emptyAgentDraft());
  const [createDraft, setCreateDraft] = useState<AgentDraft>(() => ({
    ...emptyAgentDraft(),
    name: '研究分析师',
    description: '信息检索与深度分析专家',
    avatarIcon: 'research',
    systemPrompt: '你是一名严谨、清晰、擅长拆解复杂问题的研究分析师。',
    openingMessage: '你好，我可以帮你分析资料、提炼结论和整理行动建议。',
    exampleQuestionsText: '帮我分析一份资料\n生成可视化图表建议\n给出落地行动清单',
  }));
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isThreadSwitching, setIsThreadSwitching] = useState(false);
  const [threadViewKey, setThreadViewKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const activeConversationRef = useRef('');
  const threadScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void listAvailableAIModels(token)
      .then((result) => {
        if (active) setTextModels(result.list);
      })
      .catch(() => {
        if (active) setError('模型列表加载失败');
      });
    return () => {
      active = false;
    };
  }, [token]);

  const activePreset = COMMAND_PRESETS.find((preset) => preset.id === mode) ?? COMMAND_PRESETS[0];
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const scrollVersion = `${activeConversationId}:${activeMessages.length}:${
    activeMessages.at(-1)?.content.length ?? 0
  }:${isSending ? 'sending' : 'idle'}`;
  const suggestions = useMemo(() => {
    const examples =
      activeAgent?.exampleQuestions?.map((item) => item.trim()).filter(Boolean) ?? [];
    return examples.length
      ? examples.slice(0, 3)
      : ['生成可视化图表', '给出落地行动清单', '对比方案优劣'];
  }, [activeAgent]);
  const abilityTags = useMemo(() => getAbilityTags(activeAgent), [activeAgent]);
  const taskList = useMemo(() => getTaskList(activeAgent), [activeAgent]);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    void scrollVersion;
    void threadViewKey;
    const node = threadScrollRef.current;
    if (!node) return;
    const prefersReducedAutoScroll = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: prefersReducedAutoScroll || isSending ? 'auto' : 'smooth',
    });
  }, [scrollVersion, threadViewKey, isSending]);

  useEffect(() => {
    if (activeAgent) {
      setAgentDraft(draftFromAgent(activeAgent));
    } else {
      setAgentDraft(emptyAgentDraft());
    }
  }, [activeAgent]);

  const loadConversations = useCallback(
    async (agentId: string, preferredConversationId?: string) => {
      if (!token) return;
      setIsThreadSwitching(true);
      setError('');
      try {
        const response = await listAIConversations(agentId, token);
        let nextConversations = response.conversations;
        let nextConversation =
          nextConversations.find((conversation) => conversation.id === preferredConversationId) ??
          nextConversations[0];

        if (!nextConversation) {
          const created = await createAIConversation(agentId, { title: '新对话' }, token);
          nextConversation = created.conversation;
          nextConversations = [created.conversation, ...nextConversations];
        }

        setConversations(nextConversations);
        setActiveConversationId(nextConversation.id);
        activeConversationRef.current = nextConversation.id;
        const detail = await getAIConversation(agentId, nextConversation.id, token);
        if (activeConversationRef.current === nextConversation.id) {
          setActiveMessages(detail.messages ?? []);
          setThreadViewKey(`${agentId}:${nextConversation.id}:${Date.now()}`);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '会话加载失败');
      } finally {
        setIsThreadSwitching(false);
      }
    },
    [token],
  );

  const loadAgents = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await listAIAgents(token);
      setAgents(response.agents);
      const nextAgentId = response.activeAgentId || response.agents[0]?.id || '';
      setActiveAgentId(nextAgentId);
      if (nextAgentId) await loadConversations(nextAgentId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI 智能体加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [loadConversations, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setAgents([]);
      setConversations([]);
      setActiveMessages([]);
      setActiveAgentId('');
      setActiveConversationId('');
      setError('');
      return;
    }

    void loadAgents();
  }, [isAuthenticated, loadAgents, token]);

  const handleSelectAgent = (agentId: string) => {
    if (agentId === activeAgentId || isSending) return;
    setActiveAgentId(agentId);
    setActiveMessages([]);
    void loadConversations(agentId);
  };

  const handleCreateAgent = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !createDraft.name.trim()) return;
    setError('');
    try {
      const response = await createAIAgent(toAgentPayload(createDraft), token);
      setAgents((current) => [response.agent, ...current]);
      setActiveAgentId(response.agent.id);
      setCreateDraft(emptyAgentDraft());
      setIsCreateDialogOpen(false);
      setIsInspectorOpen(true);
      await loadConversations(response.agent.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '智能体创建失败');
    }
  };

  const handleSaveAgent = async () => {
    if (!token || !activeAgent || !agentDraft.name.trim()) return;
    setError('');
    try {
      const response = await updateAIAgent(activeAgent.id, toAgentPayload(agentDraft), token);
      setAgents((current) =>
        current.map((agent) => (agent.id === response.agent.id ? response.agent : agent)),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '智能体保存失败');
    }
  };

  const handleDeleteAgent = async () => {
    if (!token || !activeAgent) return;
    setError('');
    try {
      const response = await deleteAIAgent(activeAgent.id, token);
      setAgents((current) => current.filter((agent) => agent.id !== activeAgent.id));
      const nextAgentId = response.nextAgentId;
      setActiveAgentId(nextAgentId);
      setActiveMessages([]);
      if (nextAgentId) {
        await loadConversations(nextAgentId);
      } else {
        await loadAgents();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '智能体删除失败');
    }
  };

  const handleNewConversation = async () => {
    if (!token || !activeAgent) return;
    setError('');
    try {
      const created = await createAIConversation(activeAgent.id, { title: '新对话' }, token);
      setConversations((current) => [created.conversation, ...current]);
      setActiveConversationId(created.conversation.id);
      activeConversationRef.current = created.conversation.id;
      setActiveMessages(created.messages ?? []);
      setThreadViewKey(`${activeAgent.id}:${created.conversation.id}:${Date.now()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '新建会话失败');
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    if (!token || !activeAgent || conversationId === activeConversationId || isSending) return;
    setIsThreadSwitching(true);
    setError('');
    try {
      setActiveConversationId(conversationId);
      activeConversationRef.current = conversationId;
      const detail = await getAIConversation(activeAgent.id, conversationId, token);
      if (activeConversationRef.current === conversationId) {
        setActiveMessages(detail.messages ?? []);
        setThreadViewKey(`${activeAgent.id}:${conversationId}:${Date.now()}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '会话加载失败');
    } finally {
      setIsThreadSwitching(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!token || !activeAgent) return;
    setError('');
    try {
      await deleteAIConversation(activeAgent.id, conversationId, token);
      const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
      setConversations(remaining);
      if (conversationId === activeConversationId) {
        if (remaining[0]) {
          await handleSelectConversation(remaining[0].id);
        } else {
          await handleNewConversation();
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '会话删除失败');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = draft.trim();
    if (!input || !token || !activeAgent || !activeConversation || !textModelId || isSending)
      return;
    const composedMessage = activePreset.compose(input);
    const userMessage = createLocalMessage('user', activeAgent.id, activeConversation.id, input);
    const assistantMessage = createLocalMessage(
      'assistant',
      activeAgent.id,
      activeConversation.id,
      '',
    );
    const conversationId = activeConversation.id;
    setDraft('');
    setError('');
    setIsSending(true);
    setActiveMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      await streamAIAgentChat(
        activeAgent.id,
        conversationId,
        { message: composedMessage, modelId: textModelId },
        token,
        {
          onMeta: (event) => {
            setActiveMessages((current) =>
              current.map((message) =>
                message.id === userMessage.id ? event.userMessage : message,
              ),
            );
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === event.conversation.id ? event.conversation : conversation,
              ),
            );
          },
          onDelta: (event) => {
            setActiveMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: `${message.content}${event.chunk}` }
                  : message,
              ),
            );
          },
          onDone: (event) => {
            setActiveMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id ? event.assistantMessage : message,
              ),
            );
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === event.conversation.id ? event.conversation : conversation,
              ),
            );
          },
        },
      );
    } catch (caught) {
      setActiveMessages((current) =>
        current.filter((message) => message.id !== assistantMessage.id || message.content),
      );
      setError(caught instanceof Error ? caught.message : 'AI 回复失败');
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  if (!isAuthenticated || !token) {
    return (
      <div className="ai-command-center ai-command-center--locked">
        <section className="ai-command-center__locked-card">
          <Sparkles size={30} />
          <h2>登录后使用</h2>
          <p>AI Command Center 会把智能体和对话记录保存到你的云端账号。</p>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`ai-command-center ${isInspectorOpen ? 'ai-command-center--with-inspector' : ''}`}
    >
      <aside className="ai-command-center__rail" aria-label="智能体与会话">
        <section className="ai-command-center__rail-section ai-command-center__rail-section--agents">
          <header className="ai-command-center__rail-head">
            <div>
              <strong>智能体</strong>
              <span>{agents.length} 个私有角色</span>
            </div>
            <button type="button" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus size={15} />
            </button>
          </header>

          <div className="ai-command-center__agent-list">
            {agents.map((agent) => (
              <button
                className={`ai-command-center__agent-card ${
                  agent.id === activeAgentId ? 'is-active' : ''
                }`}
                key={agent.id}
                type="button"
                onClick={() => handleSelectAgent(agent.id)}
              >
                <span
                  className="ai-command-center__agent-avatar"
                  style={{ '--agent-color': getAgentAccent(agent) } as React.CSSProperties}
                >
                  {getAgentIcon(agent)}
                </span>
                <span>
                  <strong>{agent.name}</strong>
                  <small>{getAgentSubtitle(agent)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="ai-command-center__rail-section ai-command-center__rail-section--threads">
          <header className="ai-command-center__rail-head">
            <div>
              <strong>会话</strong>
              <span>{conversations.length} 条记录</span>
            </div>
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={!activeAgent || isSending}
            >
              <MessageSquarePlus size={14} />
            </button>
          </header>

          <div className="ai-command-center__conversation-list">
            {conversations.map((conversation) => (
              <div
                className={`ai-command-center__conversation ${
                  conversation.id === activeConversationId ? 'is-active' : ''
                }`}
                key={conversation.id}
              >
                <button
                  type="button"
                  onClick={() => handleSelectConversation(conversation.id)}
                  disabled={isSending}
                >
                  <span>{conversation.title || deriveAICommandTitle('')}</span>
                  <small>{formatConversationTime(conversation.updatedAt)}</small>
                </button>
                <button
                  type="button"
                  aria-label="删除会话"
                  onClick={() => handleDeleteConversation(conversation.id)}
                  disabled={isSending}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <button
          className="ai-command-center__discover"
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Sparkles size={17} />
          <span>发现更多智能体</span>
        </button>
      </aside>

      <main className="ai-command-center__stage">
        <header className="ai-command-center__stage-head">
          <div className="ai-command-center__stage-profile">
            <span
              className="ai-command-center__agent-avatar ai-command-center__agent-avatar--large"
              style={{ '--agent-color': getAgentAccent(activeAgent) } as React.CSSProperties}
            >
              {getAgentIcon(activeAgent)}
            </span>
            <div>
              <h2>{activeAgent?.name || 'AI Command Center'}</h2>
              <span>
                <i /> 在线
              </span>
            </div>
          </div>
          <div className="ai-command-center__stage-actions">
            <button type="button" aria-label="固定智能体">
              <Pin size={16} />
            </button>
            <button type="button" aria-label="更多操作">
              <MoreHorizontal size={17} />
            </button>
            <button
              type="button"
              onClick={() => setIsInspectorOpen((current) => !current)}
              aria-label={isInspectorOpen ? '收起智能体资料' : '展开智能体资料'}
            >
              {isInspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
              <span>智能体资料</span>
            </button>
          </div>
        </header>

        <section
          className={`ai-command-center__thread ${isThreadSwitching ? 'is-switching' : ''}`}
          ref={threadScrollRef}
        >
          <div className="ai-command-center__thread-content" key={threadViewKey}>
            {isLoading ? (
              <div className="ai-command-center__empty">
                <strong>正在整理你的智能体</strong>
                <span>稍等一下</span>
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="ai-command-center__empty">
                <strong>{activeAgent?.openingMessage || '有什么想让我处理的？'}</strong>
                <span>选择下方建议，或者直接输入你的问题。</span>
              </div>
            ) : (
              <PlushPresence>
                {activeMessages.map((message) => (
                  <PlushFade key={message.id} open>
                    <article
                      className={`ai-command-center__message ai-command-center__message--${message.role}`}
                    >
                      <span
                        className="ai-command-center__agent-avatar ai-command-center__message-avatar"
                        style={
                          {
                            '--agent-color':
                              message.role === 'assistant'
                                ? getAgentAccent(activeAgent)
                                : '#a8d4ea',
                          } as React.CSSProperties
                        }
                      >
                        {message.role === 'assistant' ? getAgentIcon(activeAgent) : '你'}
                      </span>
                      <div className="ai-command-center__bubble">
                        <div>
                          {message.role === 'assistant' ? activeAgent?.name || 'AI' : 'You'}
                        </div>
                        <p>{message.content || '...'}</p>
                      </div>
                    </article>
                  </PlushFade>
                ))}
              </PlushPresence>
            )}
          </div>
        </section>

        <form className="ai-command-center__composer" onSubmit={submit}>
          <div className="ai-command-center__suggestion-row">
            {suggestions.map((suggestion) => (
              <button
                className="ai-command-center__suggestion-pill"
                key={suggestion}
                type="button"
                onClick={() => setDraft(suggestion)}
              >
                <Sparkles size={13} />
                {suggestion}
              </button>
            ))}
            <PlushSelect
              value={textModelId}
              options={
                [
                  { value: '', label: '选择文本模型', disabled: true },
                  ...textModels.map((item) => ({
                    value: item.id,
                    label: `${item.displayName} · ${item.provider}`,
                  })),
                ] as PlushSelectOption[]
              }
              onChange={setTextModelId}
              ariaLabel="选择文本模型"
              disabled={isSending}
            />
          </div>

          <div className="ai-command-center__composer-shell">
            <textarea
              value={draft}
              placeholder={activePreset.placeholder}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isSending || !activeAgent || !activeConversation}
            />
            <div className="ai-command-center__actions">
              <div className="ai-command-center__mode-row">
                {COMMAND_PRESETS.map((preset) => (
                  <button
                    className={preset.id === mode ? 'is-active' : ''}
                    key={preset.id}
                    type="button"
                    onClick={() => setMode(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.helper}</span>
                  </button>
                ))}
              </div>
              {error ? <span className="ai-command-center__error">{error}</span> : null}
              <button
                className="ai-command-center__send"
                type="submit"
                disabled={
                  !draft.trim() || !textModelId || isSending || !activeAgent || !activeConversation
                }
              >
                <Send size={16} />
                <span>{isSending ? '发送中' : '发送'}</span>
              </button>
            </div>
          </div>
        </form>
      </main>

      {isInspectorOpen ? (
        <PlushPresence>
          <PlushSlide key="ai-inspector" open from="right">
            <aside className="ai-command-center__inspector" aria-label="智能体详情">
              <header className="ai-command-center__detail-head">
                <span>智能体详情</span>
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  aria-label="收起详情"
                >
                  <X size={16} />
                </button>
              </header>

              {activeAgent ? (
                <div>
                  <section className="ai-command-center__detail-card">
                    <span
                      className="ai-command-center__agent-avatar ai-command-center__agent-avatar--hero"
                      style={
                        { '--agent-color': getAgentAccent(activeAgent) } as React.CSSProperties
                      }
                    >
                      {getAgentIcon(activeAgent)}
                    </span>
                    <h3>{activeAgent.name}</h3>
                    <p>{getAgentSubtitle(activeAgent)}</p>
                  </section>

                  <section className="ai-command-center__detail-section">
                    <strong>简介</strong>
                    <p>
                      {activeAgent.description ||
                        activeAgent.openingMessage ||
                        '这个智能体还没有简介。'}
                    </p>
                  </section>

                  <section className="ai-command-center__detail-section">
                    <strong>能力</strong>
                    <div className="ai-command-center__ability-tags">
                      {abilityTags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </section>

                  <section className="ai-command-center__detail-section">
                    <strong>擅长任务</strong>
                    <div className="ai-command-center__task-list">
                      {taskList.map((task) => (
                        <span key={task}>
                          <Check size={13} />
                          {task}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="ai-command-center__detail-rows">
                    <div>
                      <span>模型</span>
                      <strong>
                        {textModels.find((item) => item.id === textModelId)?.displayName ||
                          '未选择'}
                      </strong>
                      <ChevronRight size={15} />
                    </div>
                    <div>
                      <span>工具</span>
                      <strong>已启用基础对话</strong>
                      <ChevronRight size={15} />
                    </div>
                    <div>
                      <span>提示词示例</span>
                      <strong>{activeAgent.exampleQuestions.length || 0} 条</strong>
                      <ChevronRight size={15} />
                    </div>
                  </section>

                  <section className="ai-command-center__switch-rows">
                    <div>
                      <span>记忆</span>
                      <i className="is-on" />
                    </div>
                    <div>
                      <span>联网搜索</span>
                      <i />
                    </div>
                  </section>

                  <section className="ai-command-center__edit-card">
                    <header>
                      <PencilLine size={15} />
                      <strong>资料编辑</strong>
                    </header>
                    <label>
                      名称
                      <input
                        value={agentDraft.name}
                        onChange={(event) =>
                          setAgentDraft((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      简介
                      <textarea
                        value={agentDraft.description}
                        onChange={(event) =>
                          setAgentDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="ai-command-center__edit-grid">
                      <label>
                        头像色
                        <input
                          value={agentDraft.avatarColor}
                          onChange={(event) =>
                            setAgentDraft((current) => ({
                              ...current,
                              avatarColor: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        图标
                        <input
                          value={agentDraft.avatarIcon}
                          onChange={(event) =>
                            setAgentDraft((current) => ({
                              ...current,
                              avatarIcon: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      系统提示词
                      <textarea
                        value={agentDraft.systemPrompt}
                        onChange={(event) =>
                          setAgentDraft((current) => ({
                            ...current,
                            systemPrompt: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      开场白
                      <textarea
                        value={agentDraft.openingMessage}
                        onChange={(event) =>
                          setAgentDraft((current) => ({
                            ...current,
                            openingMessage: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      示例问题
                      <textarea
                        value={agentDraft.exampleQuestionsText}
                        onChange={(event) =>
                          setAgentDraft((current) => ({
                            ...current,
                            exampleQuestionsText: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="ai-command-center__edit-actions">
                      <button type="button" onClick={handleSaveAgent}>
                        保存
                      </button>
                      <button type="button" onClick={handleDeleteAgent}>
                        删除
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </aside>
          </PlushSlide>
        </PlushPresence>
      ) : null}

      {isCreateDialogOpen ? (
        <PlushPresence>
          <PlushFade key="ai-dialog-backdrop" open>
            <div className="ai-command-center__dialog-backdrop">
              <PlushPop key="ai-dialog" open>
                <form className="ai-command-center__dialog" onSubmit={handleCreateAgent}>
                  <header>
                    <strong>创建智能体</strong>
                    <button type="button" onClick={() => setIsCreateDialogOpen(false)}>
                      <X size={15} />
                    </button>
                  </header>
                  <label>
                    名称
                    <input
                      value={createDraft.name}
                      onChange={(event) =>
                        setCreateDraft((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="例如：研究分析师"
                    />
                  </label>
                  <label>
                    简介
                    <input
                      value={createDraft.description}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="这个智能体擅长什么"
                    />
                  </label>
                  <div className="ai-command-center__edit-grid">
                    <label>
                      头像色
                      <input
                        value={createDraft.avatarColor}
                        onChange={(event) =>
                          setCreateDraft((current) => ({
                            ...current,
                            avatarColor: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      图标
                      <input
                        value={createDraft.avatarIcon}
                        onChange={(event) =>
                          setCreateDraft((current) => ({
                            ...current,
                            avatarIcon: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    系统提示词
                    <textarea
                      value={createDraft.systemPrompt}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          systemPrompt: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    开场白
                    <textarea
                      value={createDraft.openingMessage}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          openingMessage: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    示例问题
                    <textarea
                      value={createDraft.exampleQuestionsText}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          exampleQuestionsText: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" disabled={!createDraft.name.trim()}>
                    创建智能体
                  </button>
                </form>
              </PlushPop>
            </div>
          </PlushFade>
        </PlushPresence>
      ) : null}
    </div>
  );
}
