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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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
      const result = await disconnectNotion();
      await loadStatus();
      if (result.remoteRevoked) {
        toast.success('Notion 已断开');
      } else {
        toast.message('已清理本地授权记录，请在 Notion 中手动撤销旧授权');
      }
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
  const stateLabel = status.connected
    ? '已连接'
    : status.reconnectRequired
      ? '需重新连接'
      : status.configured
        ? '未连接'
        : '待配置';

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
            <Link2Icon className="size-4" />
          </span>
          Notion
        </CardTitle>
        <CardDescription>
          {status.connected || status.reconnectRequired ? workspace : '连接 Notion 工作区'}
        </CardDescription>
        <CardAction>
          <Badge
            variant={
              status.connected ? 'secondary' : status.reconnectRequired ? 'destructive' : 'outline'
            }
          >
            {stateLabel}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {status.connected
              ? '已授权内容可用于后续工作流工具。'
              : status.reconnectRequired
                ? '原授权已不可用，重新连接后会覆盖本地授权。'
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
              {connecting
                ? '正在连接'
                : status.reconnectRequired
                  ? '重新连接 Notion'
                  : '连接 Notion'}
            </Button>
          )}
        </div>

        {status.connected ? (
          <>
            <Separator />
            <section className="space-y-2" aria-labelledby="notion-access-scope">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 id="notion-access-scope" className="text-sm font-medium">
                    访问范围
                  </h3>
                  <p className="text-sm text-muted-foreground">将项目根目录加入授权范围。</p>
                </div>
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" size="sm" />}>
                    <Link2Icon />
                    添加授权页面
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>为页面添加 Valley</DialogTitle>
                      <DialogDescription>
                        在 Notion 中打开需要检索的项目根目录，再将 Valley 添加为连接。
                      </DialogDescription>
                    </DialogHeader>
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                      <li>点击页面右上角的“•••”。</li>
                      <li>选择“Connections”，再选择“Add connections”。</li>
                      <li>搜索并选择 Valley，确认页面及其子页面的访问权限。</li>
                    </ol>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>知道了</DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-sm text-muted-foreground">
                根目录下的新页面可直接检索。独立页面需要在 Notion 中单独添加 Valley。
              </p>
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
