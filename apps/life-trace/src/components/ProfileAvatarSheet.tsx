import { Check, History, ImagePlus, PencilLine } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AvatarHistoryItem,
  getUserAvatarHistory,
  useAvatarHistory as requestUseAvatarHistory,
  updateUserProfile,
  uploadUserAvatar,
} from '@/api/auth';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, SheetHeader } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ProfileAvatarSheetProps = {
  open: boolean;
  token: string | null;
  userName: string;
  avatarUrl?: string;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated: (profile: { nickname?: string; avatar?: string }) => void;
  onMessage?: (message: string) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function buildAvatarFallback(name: string) {
  return (name.trim().slice(0, 1) || 'L').toUpperCase();
}

export function ProfileAvatarSheet({
  open,
  token,
  userName,
  avatarUrl,
  onOpenChange,
  onProfileUpdated,
  onMessage,
}: ProfileAvatarSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<AvatarHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [nickname, setNickname] = useState(userName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setError('');

    getUserAvatarHistory(token, 12)
      .then((list) => {
        if (!cancelled) {
          setHistory(list);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '读取历史头像失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open) {
      setError('');
      setNickname(userName);
      setSavingProfile(false);
      setSwitchingId(null);
      setUploading(false);
    }
  }, [open, userName]);

  const busy = savingProfile || uploading || Boolean(switchingId);
  const fallback = useMemo(() => buildAvatarFallback(userName), [userName]);
  const trimmedNickname = nickname.trim();
  const nicknameChanged = trimmedNickname.length > 0 && trimmedNickname !== userName.trim();

  const closeSheet = () => {
    if (busy) {
      return;
    }
    onOpenChange(false);
  };

  const handlePickFile = () => {
    if (busy) {
      return;
    }
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !token) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('头像文件不能超过 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const { avatarUrl: nextAvatarUrl } = await uploadUserAvatar(token, formData);
      onProfileUpdated({ avatar: nextAvatarUrl });
      onOpenChange(false);
      onMessage?.('头像已更新');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '头像上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleUseHistory = async (item: AvatarHistoryItem) => {
    if (!token || busy) {
      return;
    }

    setSwitchingId(item.id);
    setError('');

    try {
      const { avatarUrl: nextAvatarUrl } = await requestUseAvatarHistory(token, item.id);
      onProfileUpdated({ avatar: nextAvatarUrl });
      onOpenChange(false);
      onMessage?.('已切换历史头像');
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : '切换历史头像失败');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) {
      return;
    }

    if (!trimmedNickname) {
      setError('昵称不能为空');
      return;
    }

    if (!nicknameChanged) {
      onOpenChange(false);
      return;
    }

    setSavingProfile(true);
    setError('');

    try {
      const updated = await updateUserProfile(token, { nickname: trimmedNickname });
      onProfileUpdated({
        nickname: updated.nickname,
        avatar: updated.avatar,
      });
      onOpenChange(false);
      onMessage?.('昵称已更新');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '昵称保存失败');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeSheet();
          return;
        }
        onOpenChange(true);
      }}
      overlayLabel="关闭资料编辑"
      closeDisabled={busy}
      portal
      className="will-change-transform"
    >
      <SheetHeader
        title="头像与昵称"
        description="支持上传新头像、切换历史头像，也可以顺手改一下昵称。"
        meta="编辑资料"
        icon={PencilLine}
        iconClassName="bg-life-plan/10 text-life-plan"
        closeDisabled={busy}
        onClose={closeSheet}
      />

      <Card className="overflow-hidden border-life-ai/20 bg-[linear-gradient(180deg,rgba(6,182,212,0.08),rgba(16,185,129,0.06))] p-4">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                className="size-28 rounded-[2rem] border border-foreground/10 object-cover shadow-[0_16px_44px_rgba(0,0,0,0.22)]"
              />
            ) : (
              <div className="grid size-28 place-items-center rounded-[2rem] border border-life-ai/20 bg-life-ai text-4xl font-bold text-background shadow-[0_16px_44px_rgba(6,182,212,0.2)]">
                {fallback}
              </div>
            )}
            <div className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-2xl border border-background bg-life-trace text-background shadow-lg">
              {uploading ? <ActionLoadingIcon tone="trace" /> : <ImagePlus className="size-4" />}
            </div>
          </div>
          <p className="mt-4 text-base font-semibold">{userName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            建议选择清晰的方形头像，显示会更稳定。
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleFileChange(event)}
          />
          <Button
            type="button"
            variant="ai"
            className="mt-4 w-full"
            disabled={!token || busy}
            onClick={handlePickFile}
          >
            {uploading ? <ActionLoadingIcon tone="trace" /> : <ImagePlus className="size-4" />}
            {uploading ? '上传中...' : '上传新头像'}
          </Button>
        </div>
      </Card>

      <Card className="mt-4 border-border/80 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-plan/10 text-life-plan">
            <PencilLine className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <FormItem label="昵称">
              <Input
                id="profile-nickname"
                type="text"
                maxLength={24}
                value={nickname}
                disabled={busy}
                onChange={(event) => setNickname(event.target.value)}
                className="h-12 bg-secondary/70 text-base font-medium focus:bg-card"
                placeholder="输入你的昵称"
              />
            </FormItem>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>头像和昵称会同步到你的账户资料。</span>
              <span>{nickname.length}/24</span>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ai"
          className="mt-4 w-full"
          disabled={!token || busy || !trimmedNickname}
          onClick={() => void handleSaveProfile()}
        >
          {savingProfile ? <ActionLoadingIcon tone="trace" /> : <PencilLine className="size-4" />}
          {savingProfile ? '保存中...' : nicknameChanged ? '保存昵称' : '完成'}
        </Button>
      </Card>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-life-plan" />
            最近头像
          </div>
          {historyLoading ? (
            <span className="text-xs text-muted-foreground">读取中...</span>
          ) : history.length > 0 ? (
            <span className="text-xs text-muted-foreground">{history.length} 张</span>
          ) : null}
        </div>

        {error ? (
          <div className="mb-3 rounded-2xl border border-life-alert/25 bg-life-alert/10 px-4 py-3 text-sm text-life-alert">
            {error}
          </div>
        ) : null}

        {historyLoading ? (
          <div className="grid grid-cols-4 gap-3 max-[360px]:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-[1.25rem] border border-border bg-secondary/80"
              />
            ))}
          </div>
        ) : history.length > 0 ? (
          <div className="grid grid-cols-4 gap-3 max-[360px]:grid-cols-3">
            {history.map((item) => {
              const active = item.avatarUrl === avatarUrl;
              const switching = switchingId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-[1.25rem] border transition',
                    active
                      ? 'border-life-ai/50 shadow-[0_16px_36px_rgba(6,182,212,0.18)]'
                      : 'border-border bg-secondary hover:border-foreground/20',
                  )}
                  onClick={() => void handleUseHistory(item)}
                >
                  <img
                    src={item.avatarUrl}
                    alt="历史头像"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-2 text-left text-[10px] text-white/88">
                    {new Date(item.createdAt).toLocaleDateString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                  {active ? (
                    <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-life-ai text-background shadow-lg">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                  {switching ? (
                    <span className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                      <ActionLoadingIcon tone="ai" className="size-5" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed p-4 text-center text-sm text-muted-foreground">
            暂无历史头像，上传一次后会自动出现在这里。
          </Card>
        )}
      </div>
    </BottomSheet>
  );
}
