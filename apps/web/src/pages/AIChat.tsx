import { Bot, Plus, Send, Sparkles, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { reqAIChatStream } from '@/api/ai';
import { Button } from '@/components/ui/button';

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const SESSIONS_KEY = 'web_ai_chat_sessions_v1';
const ACTIVE_KEY = 'web_ai_chat_active_v1';

function createEmptySession(): ChatSession {
  const id = `s-${Date.now()}`;
  return {
    id,
    title: '新对话',
    messages: [],
    updatedAt: Date.now(),
  };
}

function readSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [createEmptySession()];
    const parsed = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [createEmptySession()];
    return parsed;
  } catch {
    return [createEmptySession()];
  }
}

function readActiveId(sessions: ChatSession[]): string {
  const fromStorage = localStorage.getItem(ACTIVE_KEY);
  if (fromStorage && sessions.some((s) => s.id === fromStorage)) return fromStorage;
  return sessions[0].id;
}

function persist(sessions: ChatSession[], activeId: string) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 30)));
  localStorage.setItem(ACTIVE_KEY, activeId);
}

function getTitleFromText(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= 24 ? line : `${line.slice(0, 24)}...`;
}

export default function AIChat() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => readSessions());
  const [activeId, setActiveId] = useState<string>(() => readActiveId(readSessions()));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [modelName, setModelName] = useState<string>('');
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? sessions[0],
    [sessions, activeId],
  );

  useEffect(() => {
    if (!activeSession) return;
    persist(sessions, activeSession.id);
  }, [sessions, activeSession]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [activeSession?.messages.length]);

  const updateCurrentSession = (updater: (session: ChatSession) => ChatSession) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
        return updater(s);
      }),
    );
  };

  const createSession = () => {
    const fresh = createEmptySession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput('');
  };

  const removeSession = (id: string) => {
    const next = sessions.filter((s) => s.id !== id);
    if (next.length === 0) {
      const fresh = createEmptySession();
      setSessions([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setSessions(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };

    const aiMsgId = `a-${Date.now()}`;
    const placeholderAI: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    updateCurrentSession((current) => ({
      ...current,
      title: current.messages.length === 0 ? getTitleFromText(text) : current.title,
      messages: [...current.messages, userMsg, placeholderAI],
      updatedAt: Date.now(),
    }));

    setInput('');
    setSending(true);

    try {
      const history = [...activeSession.messages, userMsg].slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await reqAIChatStream(
        { message: text, history, stream: true },
        {
          onChunk: (payload) => {
            if (payload.model) setModelName(payload.model);
            if (payload.chunk) {
              updateCurrentSession((current) => ({
                ...current,
                messages: current.messages.map((m) =>
                  m.id === aiMsgId ? { ...m, content: m.content + payload.chunk } : m,
                ),
                updatedAt: Date.now(),
              }));
            }
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
      );
    } catch (error) {
      console.error(error);
      updateCurrentSession((current) => ({
        ...current,
        messages: current.messages.map((m) =>
          m.id === aiMsgId ? { ...m, content: m.content || '请求失败，请稍后重试。' } : m,
        ),
      }));
      toast.error('AI 回复失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-[#f7f7fb]">
      <div className="pointer-events-none absolute -top-24 -left-12 h-64 w-64 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="pointer-events-none absolute top-16 right-10 h-72 w-72 rounded-full bg-purple-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-cyan-200/30 blur-3xl" />

      <div className="relative mx-auto flex h-full max-w-[1500px] gap-4 p-4 md:p-6">
        <aside className="hidden w-80 shrink-0 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur-xl md:flex md:flex-col">
          <div className="mb-4 flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Valley AI</div>
              <div className="text-xs text-slate-500">新式聊天工作台</div>
            </div>
          </div>

          <Button className="mb-4 w-full justify-start gap-2 rounded-xl" onClick={createSession}>
            <Plus className="h-4 w-4" />
            新建对话
          </Button>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {sessions
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((session) => (
                <button
                  type="button"
                  key={session.id}
                  onClick={() => setActiveId(session.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    session.id === activeId
                      ? 'border-indigo-300 bg-white text-slate-900 shadow-sm'
                      : 'border-white/70 bg-white/50 text-slate-700 hover:bg-white/80'
                  }`}
                >
                  <div className="line-clamp-1 text-sm font-medium">{session.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(session.updatedAt).toLocaleString('zh-CN')}
                  </div>
                </button>
              ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/75 shadow-xl backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900">AI Chat</h1>
              <p className="truncate text-xs text-slate-500">
                {modelName ? `模型：${modelName}` : '智能助手（中文流式）'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="md:hidden" onClick={createSession}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => removeSession(activeSession.id)}
                disabled={sending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto w-full max-w-4xl space-y-6">
              {activeSession.messages.length === 0 && (
                <div className="rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-purple-50 p-8 text-center">
                  <h2 className="text-lg font-semibold text-slate-800">开始一段新对话</h2>
                  <p className="mt-2 text-sm text-slate-600">输入你的问题，我会用中文实时回复。</p>
                </div>
              )}

              {activeSession.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-purple-600 text-white shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 md:max-w-[78%] ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'border border-slate-200/80 bg-white text-slate-800 shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content || (sending ? '...' : '')}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 shadow-sm">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <footer className="border-t border-slate-200/70 bg-white/80 px-3 py-3 md:px-6 md:py-4">
            <div className="mx-auto max-w-4xl rounded-2xl border border-slate-300/80 bg-white p-2 shadow-sm">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息..."
                className="h-24 w-full resize-none border-0 bg-transparent p-2 text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending && input.trim()) {
                      void handleSend();
                    }
                  }
                }}
              />

              <div className="flex items-center justify-between px-2 pb-1">
                <div className="text-xs text-slate-500">Enter 发送 · Shift+Enter 换行</div>
                <Button
                  className="gap-2 rounded-xl bg-slate-900 hover:bg-slate-800"
                  disabled={!input.trim() || sending}
                  onClick={() => void handleSend()}
                >
                  <Send className="h-4 w-4" />
                  {sending ? '生成中' : '发送'}
                </Button>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
