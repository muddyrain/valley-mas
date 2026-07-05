import { MessageCircle, PanelRightClose, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type AIChatMessage, reqAIChatStream } from '@/api/ai';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

let msgCounter = 0;
function createMsgId(role: string) {
  return `${role}-${Date.now()}-${++msgCounter}`;
}

const WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      '你好！我是 Valley AI 助手。你可以问我任何问题，或者让我帮你完成创作任务。\n\n试试输入 "帮我写一篇关于 AI 的博客" 开始吧。',
  },
];

export function AIPanel() {
  const open = useLayoutStore((s) => s.aiPanelOpen);
  const setOpen = useLayoutStore((s) => s.setAIPanelOpen);
  const width = useLayoutStore((s) => s.aiPanelWidth);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(WELCOME_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  async function handleSubmit(rawPrompt?: string) {
    const prompt = (rawPrompt ?? input).trim();
    if (!prompt || loading) return;

    if (!isAuthenticated) {
      toast.info('登录后即可与 AI 对话');
      navigate('/login');
      return;
    }

    const history: AIChatMessage[] = messages
      .filter((m) => !m.pending)
      .map(({ role, content }) => ({ role, content }));

    const userMsg: ChatMessage = { id: createMsgId('user'), role: 'user', content: prompt };
    const assistantMsg: ChatMessage = {
      id: createMsgId('assistant'),
      role: 'assistant',
      content: '',
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setLoading(true);

    let streamed = '';
    try {
      await reqAIChatStream(
        { message: prompt, history },
        {
          onChunk: (payload) => {
            if (payload.chunk) {
              streamed += payload.chunk;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: streamed } : m)),
              );
            }
            if (payload.done) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m)),
              );
              setLoading(false);
            }
          },
          onError: (err) => {
            streamed += `\n\n[错误] ${err}`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: streamed, pending: false } : m,
              ),
            );
            setLoading(false);
          },
        },
      );
      // If stream ended without done flag, mark as complete
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m)),
      );
      setLoading(false);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: streamed || '请求失败，请重试', pending: false }
            : m,
        ),
      );
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  if (!open) return null;

  return (
    <aside className="flex h-screen flex-col border-l border-border bg-card" style={{ width }}>
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI 助手</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div ref={scrollRef} className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                {msg.pending && (
                  <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-primary" />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="icon"
            onClick={() => void handleSubmit()}
            disabled={loading || !input.trim()}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
