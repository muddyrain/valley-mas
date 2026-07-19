import { Link2Icon, Loader2Icon, UnplugIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  disconnectNotion,
  getAPIErrorMessage,
  getNotionConnection,
  type NotionConnectionStatus,
  startNotionAuthorization,
} from '@/api/aiWorkbench';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const authorizationTimeoutMs = 2 * 60 * 1000;
const authorizationPollMs = 1200;

export default function NotionConnectorCard() {
  const [status, setStatus] = useState<NotionConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadStatus = useCallback(async () => {
    const next = await getNotionConnection();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void loadStatus()
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '读取 Notion 连接失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      stopPolling();
    };
  }, [loadStatus, stopPolling]);

  const pollForConnection = (popup: Window) => {
    const startedAt = Date.now();
    stopPolling();
    pollRef.current = window.setInterval(() => {
      void loadStatus()
        .then((next) => {
          if (next.connected) {
            stopPolling();
            setConnecting(false);
            popup.close();
            toast.success('Notion 已连接');
            return;
          }
          if (popup.closed || Date.now() - startedAt >= authorizationTimeoutMs) {
            stopPolling();
            setConnecting(false);
          }
        })
        .catch(() => {
          if (popup.closed || Date.now() - startedAt >= authorizationTimeoutMs) {
            stopPolling();
            setConnecting(false);
          }
        });
    }, authorizationPollMs);
  };

  const handleConnect = async () => {
    const popup = window.open('', 'valley-notion-oauth', 'popup,width=540,height=720');
    if (!popup) {
      toast.error('请允许浏览器打开 Notion 授权窗口');
      return;
    }
    setConnecting(true);
    try {
      const { authUrl } = await startNotionAuthorization();
      popup.location.assign(authUrl);
      pollForConnection(popup);
    } catch (error) {
      popup.close();
      setConnecting(false);
      toast.error(getAPIErrorMessage(error, '发起 Notion 授权失败'));
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectNotion();
      await loadStatus();
      toast.success('Notion 已断开');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '断开 Notion 连接失败'));
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading || !status) {
    return <Skeleton className="h-44 w-full rounded-xl" />;
  }

  const workspace = status.workspaceName || 'Notion 工作区';
  const stateLabel = status.connected ? '已连接' : status.configured ? '未连接' : '待配置';

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
            <Link2Icon className="size-4" />
          </span>
          Notion
        </CardTitle>
        <CardDescription>{status.connected ? workspace : '连接 Notion 工作区'}</CardDescription>
        <CardAction>
          <Badge variant={status.connected ? 'secondary' : 'outline'}>{stateLabel}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {status.connected
            ? '已授权内容可用于后续工作流工具。'
            : '连接后可在工作流中使用已授权内容。'}
        </p>
        {status.connected ? (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
              <UnplugIcon />
              断开
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>断开 Notion 连接？</AlertDialogTitle>
                <AlertDialogDescription>
                  将撤销 Valley 对此 Notion 工作区的访问权限。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={disconnecting}
                  onClick={handleDisconnect}
                >
                  {disconnecting ? <Loader2Icon className="animate-spin" /> : <UnplugIcon />}
                  确认断开
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button size="sm" disabled={!status.configured || connecting} onClick={handleConnect}>
            {connecting ? <Loader2Icon className="animate-spin" /> : <Link2Icon />}
            {connecting ? '正在连接' : '连接 Notion'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
