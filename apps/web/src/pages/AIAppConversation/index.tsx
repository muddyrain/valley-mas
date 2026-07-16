import { Bot, MessageCirclePlus, Send, Square, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AIAppConversation,
  type AIAppConversationMessage,
  type AIAppConversationToolTrace,
  type AIKnowledgeReference,
  createAIAppConversation,
  deleteAIAppConversation,
  getAIAppConversation,
  getAPIErrorMessage,
  listAIAppConversations,
  streamAIAppConversation,
} from '@/api/aiWorkbench';
import { AIResponseContext } from '@/components/ai-workbench/AIResponseContext';
import { EditorPageHeader } from '@/components/ai-workbench/EditorPageHeader';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const quickPrompts = [
  '介绍一下你的能力',
  '根据资料库回答一个问题',
  '帮我梳理当前任务',
  '给我一个开始建议',
];

export default function AIAppConversationPage() {
  const { appId, conversationId } = useParams<{ appId: string; conversationId: string }>();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AIAppConversation[]>([]);
  const [conversation, setConversation] = useState<AIAppConversation | null>(null);
  const [messages, setMessages] = useState<AIAppConversationMessage[]>([]);
  const [toolTraces, setToolTraces] = useState<AIAppConversationToolTrace[]>([]);
  const [references, setReferences] = useState<AIKnowledgeReference[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingReply, setStreamingReply] = useState('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!appId) return;
    let active = true;
    listAIAppConversations(appId)
      .then((result) => {
        if (active) setConversations(result.list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载会话列表失败'));
      });
    return () => {
      active = false;
    };
  }, [appId]);

  useEffect(() => {
    if (!appId || !conversationId) return;
    let active = true;
    setLoading(true);
    setStreamingReply('');
    setReferences([]);
    getAIAppConversation(appId, conversationId)
      .then((result) => {
        if (!active) return;
        setConversation(result.conversation);
        setMessages(result.messages);
        setToolTraces(result.toolTraces);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(getAPIErrorMessage(error, '加载会话失败'));
        navigate(`/workbench/apps/${appId}`, { replace: true });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appId, conversationId, navigate]);

  const createConversation = async () => {
    if (!appId) return;
    try {
      const result = await createAIAppConversation(appId);
      setConversations((items) => [result.conversation, ...items]);
      navigate(`/workbench/apps/${appId}/conversations/${result.conversation.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建会话失败'));
    }
  };

  const removeConversation = async (target: AIAppConversation) => {
    if (!appId) return;
    try {
      await deleteAIAppConversation(appId, target.id);
      const next = conversations.filter((item) => item.id !== target.id);
      setConversations(next);
      if (target.id === conversationId) {
        if (next[0])
          navigate(`/workbench/apps/${appId}/conversations/${next[0].id}`, { replace: true });
        else navigate(`/workbench/apps/${appId}`, { replace: true });
      }
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除会话失败'));
    }
  };

  const stop = () => controllerRef.current?.abort();

  const send = async () => {
    if (!appId || !conversationId || !input.trim() || sending) return;
    const content = input.trim();
    const localUserMessage: AIAppConversationMessage = {
      id: `local-user-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setInput('');
    setMessages((items) => [...items, localUserMessage]);
    setStreamingReply('');
    setToolStatus(null);
    setReferences([]);
    setSending(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await streamAIAppConversation(
        appId,
        conversationId,
        content,
        {
          onDelta: (chunk) => setStreamingReply((reply) => reply + chunk),
          onToolCall: (name) =>
            setToolStatus(name === 'content.search' ? '正在搜索内容' : '正在调用工具'),
          onToolResult: (name, ok) => {
            setToolStatus(
              name === 'content.search' ? (ok ? '内容搜索完成' : '内容搜索失败') : null,
            );
          },
          onDone: (result) => {
            setConversation(result.conversation);
            setConversations((items) => [
              result.conversation,
              ...items.filter((item) => item.id !== result.conversation.id),
            ]);
            setMessages((items) => [
              ...items.filter((item) => item.id !== localUserMessage.id),
              result.userMessage,
              result.assistantMessage,
            ]);
            setReferences(result.references);
            // 在移除流式气泡前结束发送态，避免空文本短暂回退为“正在思考…”。
            setSending(false);
            setStreamingReply('');
          },
          onError: (message) => toast.error(message),
        },
        controller.signal,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error(getAPIErrorMessage(error, '会话发送失败'));
      }
    } finally {
      controllerRef.current = null;
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="relative h-screen">
        <BoxLoadingOverlay show compact minimal title="加载会话" />
      </div>
    );
  }
  if (!conversation || !appId) return null;

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <EditorPageHeader
        title={conversation.title}
        description="智能体私有会话 · 固定版本"
        onBack={() => navigate(`/workbench/apps/${appId}`)}
      />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col bg-muted/30 p-4 lg:border-r lg:border-border">
          <Button className="w-full justify-start" onClick={() => void createConversation()}>
            <MessageCirclePlus data-icon="inline-start" />
            新建会话
          </Button>
          <div className="mt-6 flex items-center justify-between px-1">
            <p className="text-xs font-medium text-muted-foreground">最近会话</p>
            <Badge variant="secondary">{conversations.length}</Badge>
          </div>
          <ScrollArea className="mt-3 min-h-36 flex-1">
            <div className="flex flex-col gap-1 pr-3">
              {conversations.map((item) => (
                <div key={item.id} className="group flex items-center gap-1">
                  <Button
                    variant={item.id === conversation.id ? 'secondary' : 'ghost'}
                    className="min-w-0 flex-1 justify-start"
                    onClick={() => navigate(`/workbench/apps/${appId}/conversations/${item.id}`)}
                  >
                    <span className="truncate">{item.title}</span>
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="删除会话"
                    title="删除会话"
                    onClick={() => void removeConversation(item)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <Badge variant="outline" className="self-start">
            仅自己可见
          </Badge>
        </aside>
        <section className="flex min-h-0 flex-col bg-background">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-8">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                  <Avatar size="lg">
                    <AvatarFallback>
                      <Bot />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">开始一段新对话</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      发送问题，智能体会基于固定版本回应。
                    </p>
                  </div>
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {quickPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        size="sm"
                        variant="outline"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-start gap-3',
                    message.role === 'user' && 'flex-row-reverse',
                  )}
                >
                  <Avatar>
                    <AvatarFallback>
                      {message.role === 'user' ? <UserRound /> : <Bot />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'max-w-[min(85%,42rem)] rounded-xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {sending ? (
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      <Bot />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[min(85%,42rem)] rounded-xl bg-muted px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                    {streamingReply || '正在思考…'}
                  </div>
                </div>
              ) : null}
              <AIResponseContext
                className="ml-11 max-w-[min(85%,42rem)]"
                toolStatus={toolStatus}
                toolTraces={toolTraces.map((trace) => ({
                  id: trace.id,
                  name: trace.toolName,
                  status: trace.status === 'succeeded' ? 'succeeded' : 'failed',
                  durationMs: trace.durationMs,
                }))}
                references={references}
              />
            </div>
          </div>
          <div className="border-t border-border bg-background px-4 py-5 sm:px-7">
            <Card className="mx-auto max-w-3xl gap-0 border-border py-0 shadow-none" size="sm">
              <CardContent className="px-4 py-3">
                <Textarea
                  value={input}
                  placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                  disabled={sending}
                  className="min-h-24 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Badge variant="secondary">固定版本</Badge>
                  {sending ? (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={stop}
                      aria-label="停止生成"
                      title="停止生成"
                    >
                      <Square />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={() => void send()}
                      disabled={!input.trim()}
                      aria-label="发送消息"
                      title="发送消息"
                    >
                      <Send />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
