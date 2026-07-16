import { MessageCircle, PanelRightClose, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type AIChatMessage, reqAIChatStream } from '@/api/ai';
import {
  type AIApp,
  createAIAppConversation,
  getAPIErrorMessage,
  listAIApps,
} from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
    content: '你好！我是 Valley 快速助手。需要一个灵感、提纲或即时答案时，可以直接问我。',
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
  const [apps, setApps] = useState<AIApp[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState('quick');
  const [openingAppId, setOpeningAppId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedApp = apps.find((app) => app.id === selectedAssistantId) ?? null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setApps([]);
      return;
    }
    void listAIApps()
      .then((result) => setApps(result.list.filter((app) => app.type === 'agent')))
      .catch((error) => toast.error(getAPIErrorMessage(error, '加载智能体列表失败')));
  }, [isAuthenticated]);

  const openAgentConversation = async (appId: string) => {
    try {
      setOpeningAppId(appId);
      const result = await createAIAppConversation(appId);
      setOpen(false);
      navigate(`/workbench/apps/${appId}/conversations/${result.conversation.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建智能体会话失败'));
    } finally {
      setOpeningAppId(null);
    }
  };

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
    <aside
      className="hidden h-screen flex-col border-l border-border bg-card md:flex"
      style={{ width }}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">快速助手</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="关闭快速助手"
          title="关闭快速助手"
        >
          <PanelRightClose />
        </Button>
      </div>

      <div className="border-b border-border p-3">
        <Select
          value={selectedAssistantId}
          disabled={openingAppId !== null}
          onValueChange={(value) => {
            if (!value) return;
            setSelectedAssistantId(value);
          }}
        >
          <SelectTrigger className="w-full" aria-label="选择智能体">
            <SelectValue>
              {selectedAssistantId === 'quick' ? '快速助手' : selectedApp?.name || '选择智能体'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>当前助手</SelectLabel>
              <SelectItem value="quick">快速助手</SelectItem>
            </SelectGroup>
            {apps.length > 0 ? (
              <SelectGroup>
                <SelectLabel>我的智能体</SelectLabel>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {openingAppId === app.id ? '正在打开…' : app.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
      </div>

      {selectedApp ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex w-full max-w-xs flex-col items-start gap-3 rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{selectedApp.name}</p>
              <Badge variant="outline">固定版本</Badge>
            </div>
            <Button
              className="w-full"
              disabled={openingAppId !== null}
              onClick={() => void openAgentConversation(selectedApp.id)}
            >
              {openingAppId === selectedApp.id ? '正在打开…' : '进入专属会话'}
            </Button>
          </div>
        </div>
      ) : (
        <>
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

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                className="min-h-10 flex-1 resize-none"
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
        </>
      )}
    </aside>
  );
}
