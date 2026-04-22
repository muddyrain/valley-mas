import { Loader2, LogIn, Orbit, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type AIChatMessage, reqAIChatStream } from '@/api/ai';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/useAuthStore';

interface HomeAICoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptSeed?: string;
  promptSeedVersion: number;
}

interface HomeAICoreMessage extends AIChatMessage {
  id: string;
  pending?: boolean;
}

export const HOME_AI_CORE_PROMPTS = [
  '帮我看看首页最近有什么值得先点开',
  '我想先找壁纸和头像资源，帮我规划入口',
  '按我现在的兴趣推荐几位值得关注的创作者',
  '我准备开始创作，先给我一条最短路径',
];

const INITIAL_MESSAGES: HomeAICoreMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content:
      '我是 Valley AI 中枢。你可以让我帮你串起内容、资源和创作者路线，也可以直接说你此刻想做什么。',
  },
];

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function HomeAICoreDialog({
  open,
  onOpenChange,
  promptSeed,
  promptSeedVersion,
}: HomeAICoreDialogProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<HomeAICoreMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('');
  const lastHandledSeedRef = useRef(0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  useEffect(() => {
    if (!open || !promptSeed || promptSeedVersion <= 0) return;
    if (lastHandledSeedRef.current === promptSeedVersion) return;

    lastHandledSeedRef.current = promptSeedVersion;
    setInput(promptSeed);

    if (isAuthenticated) {
      void submitPrompt(promptSeed);
    }
  }, [isAuthenticated, open, promptSeed, promptSeedVersion]);

  const resetConversation = () => {
    setMessages(INITIAL_MESSAGES);
    setInput('');
    setActiveModel('');
  };

  async function submitPrompt(rawPrompt?: string) {
    const prompt = (rawPrompt ?? input).trim();
    if (!prompt || loading) return;

    if (!isAuthenticated) {
      toast.info('登录后就能直接唤醒 Valley AI 中枢。');
      navigate('/login');
      return;
    }

    const history = messages
      .filter((item) => !item.pending)
      .map<AIChatMessage>(({ role, content }) => ({ role, content }));
    const userMessage: HomeAICoreMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: prompt,
    };
    const assistantMessage: HomeAICoreMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      content: '',
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setLoading(true);

    let streamedContent = '';
    let responseModel = '';
    let streamError = '';

    try {
      await reqAIChatStream(
        {
          message: prompt,
          history,
        },
        {
          onChunk: (payload) => {
            if (payload.model) responseModel = payload.model;
            if (payload.chunk) {
              streamedContent += payload.chunk;
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantMessage.id ? { ...item, content: streamedContent } : item,
                ),
              );
            }
          },
          onError: (message) => {
            streamError = message || 'AI 中枢暂时没有接通，请稍后再试。';
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantMessage.id
                  ? { ...item, content: streamError, pending: false }
                  : item,
              ),
            );
          },
        },
      );

      if (streamError) {
        toast.error(streamError);
        return;
      }

      const finalContent =
        streamedContent.trim() ||
        '我先收到你的问题了，不过这次还没有整理出完整回答，你可以换一种说法再试试。';

      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: finalContent, pending: false }
            : item,
        ),
      );
      setActiveModel(responseModel);
    } catch (error) {
      console.error('Failed to chat with home AI core:', error);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: 'AI 中枢暂时没有连上，请稍后再试。', pending: false }
            : item,
        ),
      );
      toast.error('AI 中枢暂时没有连上，请稍后再试。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),color-mix(in_srgb,var(--theme-primary-soft)_56%,white))] p-0 shadow-[0_32px_90px_rgba(var(--theme-primary-rgb),0.18)] sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-[1120px] xl:max-w-[1280px]"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-theme-shell-border/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),color-mix(in_srgb,var(--theme-primary-soft)_74%,white))] px-5 py-5 sm:px-6 lg:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-theme-shell-border bg-white/86 px-3 py-1 text-[11px] tracking-[0.18em] text-theme-primary uppercase">
                <Orbit className="h-3.5 w-3.5" />
                Valley AI Core
              </div>
              <DialogTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-2xl">
                让中枢帮你组织下一步路线
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-7 text-slate-600">
                {isAuthenticated
                  ? '你可以直接问它看什么、找什么、先去哪个入口，它会按 Valley 当前内容结构给你建议。'
                  : '当前对话需要登录后使用。你也可以先看看这些入口示例，登录后再继续提问。'}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              {activeModel ? (
                <span className="hidden rounded-full border border-theme-shell-border bg-white/90 px-3 py-1 text-[11px] text-slate-500 sm:inline-flex">
                  {activeModel}
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full px-3 text-slate-500 hover:bg-white/90 hover:text-slate-900"
                onClick={resetConversation}
                disabled={loading}
              >
                新对话
              </Button>
              {!isAuthenticated ? (
                <Button
                  type="button"
                  size="sm"
                  className="theme-btn-primary rounded-full px-4 text-white"
                  onClick={() => navigate('/login')}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  去登录
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {HOME_AI_CORE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setInput(prompt);
                  if (isAuthenticated) void submitPrompt(prompt);
                }}
                disabled={loading}
                className="rounded-full border border-theme-shell-border bg-white/90 px-3 py-1.5 text-xs text-slate-600 transition hover:-translate-y-0.5 hover:border-white hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="grid h-[min(78vh,760px)] min-h-0 gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-theme-shell-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),color-mix(in_srgb,var(--theme-primary-soft)_68%,white))] p-5 lg:p-6 xl:border-b-0 xl:border-r xl:p-7">
            <div className="rounded-[24px] border border-white/85 bg-white/72 p-4 shadow-[0_14px_30px_rgba(var(--theme-primary-rgb),0.08)]">
              <div className="inline-flex items-center gap-2 rounded-full bg-theme-soft px-3 py-1 text-[11px] tracking-[0.14em] text-theme-primary uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                Core Ready
              </div>
              <div className="mt-3 text-base font-medium leading-7 text-slate-900">
                它更适合做这些事
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                <li>帮你从首页内容里挑一个最值得先点开的入口。</li>
                <li>按你的兴趣，把资源、内容、创作者串成一条浏览路线。</li>
                <li>在你准备创作时，先告诉你最短的一步应该去哪里。</li>
              </ul>
            </div>

            <div className="mt-4 rounded-[24px] border border-theme-shell-border bg-[linear-gradient(180deg,rgba(255,255,255,0.82),color-mix(in_srgb,var(--theme-primary-soft)_62%,white))] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <WandSparkles className="h-4 w-4 text-theme-primary" />
                提问建议
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                越像真实需求越好，比如“我想先看偏前端的内容，再顺手找一套头像资源”。
              </p>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6 lg:px-7 lg:py-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-[0_10px_26px_rgba(var(--theme-primary-rgb),0.08)] xl:max-w-[84%] ${
                      message.role === 'user'
                        ? 'bg-theme-primary text-white'
                        : 'border border-theme-shell-border bg-white/88 text-slate-700'
                    }`}
                  >
                    <div className="mb-1 text-[11px] tracking-[0.12em] uppercase opacity-70">
                      {message.role === 'user' ? 'You' : 'Valley Core'}
                    </div>
                    <div>{message.content || (message.pending ? '正在整理回应...' : '')}</div>
                  </div>
                </div>
              ))}
              <div ref={scrollAnchorRef} />
            </div>

            <div className="border-t border-theme-shell-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),color-mix(in_srgb,var(--theme-primary-soft)_40%,white))] px-5 py-4 sm:px-6 lg:px-7">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void submitPrompt();
                    }
                  }}
                  placeholder="例如：帮我先挑一个值得看的内容入口，再给我一条浏览路线"
                  className="h-12 rounded-full border-white/90 bg-white/92 px-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                  disabled={loading}
                />
                <Button
                  type="button"
                  size="lg"
                  className="theme-btn-primary h-12 rounded-full px-6 text-white"
                  onClick={() => void submitPrompt()}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '发送给中枢'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
