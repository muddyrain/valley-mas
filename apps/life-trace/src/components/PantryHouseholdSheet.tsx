import {
  Copy,
  Crown,
  Home,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HouseholdInvitePayload, HouseholdMember, HouseholdSummary } from '@/types';

type PantryHouseholdSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: HouseholdSummary[];
  selectedHouseholdId?: string;
  members: HouseholdMember[];
  membersLoading: boolean;
  householdsLoading: boolean;
  invitePayload?: HouseholdInvitePayload | null;
  onSelectHousehold: (householdId: string) => void;
  onCreateHousehold: (name: string) => Promise<void>;
  onJoinHousehold: (inviteCode: string) => Promise<void>;
  onCreateInvite: (householdId: string) => Promise<void>;
  onRefreshMembers: (householdId: string) => Promise<void>;
  onTransferOwner: (householdId: string, targetUserId: string) => Promise<void>;
  onLeaveHousehold: (householdId: string) => Promise<void>;
  onDissolveHousehold: (householdId: string) => Promise<void>;
};

const householdRoleLabel = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
} satisfies Record<HouseholdSummary['role'], string>;

const memberRoleLabel = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
} satisfies Record<HouseholdMember['role'], string>;

export function PantryHouseholdSheet({
  open,
  onOpenChange,
  households,
  selectedHouseholdId,
  members,
  membersLoading,
  householdsLoading,
  invitePayload,
  onSelectHousehold,
  onCreateHousehold,
  onJoinHousehold,
  onCreateInvite,
  onRefreshMembers,
  onTransferOwner,
  onLeaveHousehold,
  onDissolveHousehold,
}: PantryHouseholdSheetProps) {
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submittingAction, setSubmittingAction] = useState<
    'create' | 'join' | 'invite' | 'leave' | 'dissolve' | 'refresh' | 'transfer' | null
  >(null);
  const [sheetError, setSheetError] = useState('');
  const [sheetNotice, setSheetNotice] = useState('');
  const currentHousehold = useMemo(
    () => households.find((item) => item.id === selectedHouseholdId) ?? households[0] ?? null,
    [households, selectedHouseholdId],
  );

  useEffect(() => {
    if (!open) {
      setSheetError('');
      setSheetNotice('');
      setSubmittingAction(null);
      setCreateName('');
      setJoinCode('');
    }
  }, [open]);

  const handleCopyInviteCode = async () => {
    if (!invitePayload?.inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(invitePayload.inviteCode);
      setSheetNotice('邀请码已复制，可以直接发给家人。');
      setSheetError('');
    } catch {
      setSheetError('当前环境暂时无法复制邀请码，请手动复制。');
    }
  };

  const sharedHousehold = currentHousehold?.kind === 'shared';
  const ownerLeavingBlocked =
    currentHousehold?.role === 'owner' && (currentHousehold.memberCount ?? 0) > 1;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭家庭空间管理"
      zIndexClassName="z-[75]"
      portal
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">家庭空间</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            切换库存空间，也可以在这里创建、邀请或加入共享家庭。
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </Button>
      </div>

      {sheetError ? (
        <Card className="mb-4 border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
          {sheetError}
        </Card>
      ) : null}
      {sheetNotice ? (
        <Card className="mb-4 border-life-trace/20 bg-life-trace/10 p-4 text-sm text-life-trace">
          {sheetNotice}
        </Card>
      ) : null}

      <div className="space-y-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">我的空间</p>
              <p className="mt-1 text-xs text-muted-foreground">当前账号可访问的全部库存空间</p>
            </div>
            {householdsLoading ? <Badge tone="ai">同步中</Badge> : null}
          </div>
          {households.length === 0 && householdsLoading ? (
            <Card className="p-4 text-sm text-muted-foreground">正在同步家庭空间...</Card>
          ) : households.length === 0 ? (
            <EmptyState
              title="还没有可用空间"
              description="登录后会自动为你准备个人空间。"
              eyebrow="空间为空"
              tone="plan"
              icon={Home}
            />
          ) : (
            <div className="space-y-2">
              {households.map((household) => {
                const selected = household.id === currentHousehold?.id;
                return (
                  <button
                    key={household.id}
                    type="button"
                    className={cn(
                      'w-full rounded-[1.25rem] border p-4 text-left transition',
                      selected
                        ? 'border-life-ai/35 bg-life-ai/10 shadow-[0_16px_40px_rgba(6,182,212,0.08)]'
                        : 'border-border bg-card hover:border-foreground/15',
                    )}
                    onClick={() => onSelectHousehold(household.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={household.kind === 'personal' ? 'trace' : 'ai'}>
                            {household.kind === 'personal' ? '个人空间' : '共享家庭'}
                          </Badge>
                          <Badge tone="default">{householdRoleLabel[household.role]}</Badge>
                        </div>
                        <p className="mt-2 truncate text-base font-semibold">{household.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {household.kind === 'personal'
                            ? '始终保留的个人库存空间'
                            : `${household.memberCount} 位成员共同维护`}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'grid size-10 shrink-0 place-items-center rounded-2xl',
                          selected
                            ? 'bg-life-ai text-background'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {household.kind === 'personal' ? (
                          <Home className="size-4.5" />
                        ) : (
                          <Users className="size-4.5" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-3">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
                <Plus className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">创建共享家庭</p>
                <p className="text-xs text-muted-foreground">例如：一家三口、周末囤货组</p>
              </div>
            </div>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="输入家庭名称"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
            <Button
              type="button"
              variant="ai"
              className="w-full"
              disabled={submittingAction === 'create'}
              onClick={async () => {
                const name = createName.trim();
                if (!name) {
                  setSheetError('请先输入家庭名称。');
                  return;
                }
                setSubmittingAction('create');
                setSheetError('');
                try {
                  await onCreateHousehold(name);
                  setCreateName('');
                  setSheetNotice(`已创建共享家庭「${name}」。`);
                } catch (error) {
                  setSheetError(error instanceof Error ? error.message : '创建家庭失败');
                } finally {
                  setSubmittingAction(null);
                }
              }}
            >
              <Plus className="size-4" />
              {submittingAction === 'create' ? '创建中...' : '创建家庭'}
            </Button>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-2xl bg-life-plan/10 text-life-plan">
                <UserPlus className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">加入家庭</p>
                <p className="text-xs text-muted-foreground">输入邀请码，切进共享库存一起维护</p>
              </div>
            </div>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="例如：HHABC123"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm uppercase outline-none transition focus:border-ring"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={submittingAction === 'join'}
              onClick={async () => {
                const code = joinCode.trim();
                if (!code) {
                  setSheetError('请先输入邀请码。');
                  return;
                }
                setSubmittingAction('join');
                setSheetError('');
                try {
                  await onJoinHousehold(code);
                  setJoinCode('');
                  setSheetNotice('已加入新的共享家庭。');
                } catch (error) {
                  setSheetError(error instanceof Error ? error.message : '加入家庭失败');
                } finally {
                  setSubmittingAction(null);
                }
              }}
            >
              <UserPlus className="size-4" />
              {submittingAction === 'join' ? '加入中...' : '通过邀请码加入'}
            </Button>
          </Card>
        </section>

        {currentHousehold ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">当前空间详情</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentHousehold.kind === 'personal'
                    ? '个人空间不可解散，也不需要邀请成员。'
                    : '邀请家人后，大家会共享同一份库存列表。'}
                </p>
              </div>
              {sharedHousehold ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submittingAction === 'refresh' || membersLoading}
                    onClick={async () => {
                      setSubmittingAction('refresh');
                      setSheetError('');
                      try {
                        await onRefreshMembers(currentHousehold.id);
                      } catch (error) {
                        setSheetError(error instanceof Error ? error.message : '刷新成员失败');
                      } finally {
                        setSubmittingAction(null);
                      }
                    }}
                  >
                    <RefreshCw className="size-4" />
                    刷新
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      submittingAction === 'invite' ||
                      (currentHousehold.role !== 'owner' && currentHousehold.role !== 'admin')
                    }
                    onClick={async () => {
                      setSubmittingAction('invite');
                      setSheetError('');
                      try {
                        await onCreateInvite(currentHousehold.id);
                        setSheetNotice('已生成新的邀请码。');
                      } catch (error) {
                        setSheetError(error instanceof Error ? error.message : '创建邀请码失败');
                      } finally {
                        setSubmittingAction(null);
                      }
                    }}
                  >
                    <Sparkles className="size-4" />
                    {submittingAction === 'invite' ? '生成中...' : '生成邀请码'}
                  </Button>
                </div>
              ) : null}
            </div>

            {invitePayload?.householdId === currentHousehold.id ? (
              <Card className="space-y-3 border-life-ai/20 bg-life-ai/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">当前邀请码</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      分享给家人后，对方可以直接加入这个家庭库存。
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopyInviteCode()}
                  >
                    <Copy className="size-4" />
                    复制
                  </Button>
                </div>
                <div className="rounded-2xl border border-life-ai/20 bg-card px-4 py-3 text-base font-semibold tracking-[0.18em] text-life-ai">
                  {invitePayload.inviteCode}
                </div>
                {invitePayload.expiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    有效期至 {new Date(invitePayload.expiresAt).toLocaleString('zh-CN')}
                  </p>
                ) : null}
              </Card>
            ) : null}

            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">成员列表</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sharedHousehold ? '谁在一起维护这份家庭库存' : '个人空间只有你自己'}
                  </p>
                </div>
                <Badge tone={sharedHousehold ? 'ai' : 'trace'}>
                  {currentHousehold.memberCount} 人
                </Badge>
              </div>
              {membersLoading ? (
                <p className="text-sm text-muted-foreground">正在同步家庭成员...</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          成员 #{member.userId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {member.joinedAt
                            ? `${new Date(member.joinedAt).toLocaleDateString('zh-CN')} 加入`
                            : '已加入'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={member.role === 'owner' ? 'ai' : 'default'}>
                          {member.role === 'owner' ? (
                            <Crown className="mr-1 size-3.5" />
                          ) : member.role === 'admin' ? (
                            <Shield className="mr-1 size-3.5" />
                          ) : null}
                          {memberRoleLabel[member.role]}
                        </Badge>
                        {sharedHousehold &&
                        currentHousehold.role === 'owner' &&
                        member.role !== 'owner' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={submittingAction === 'transfer'}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `确认将「${currentHousehold.name}」的所有者转交给成员 #${member.userId} 吗？`,
                                )
                              ) {
                                return;
                              }
                              setSubmittingAction('transfer');
                              setSheetError('');
                              try {
                                await onTransferOwner(currentHousehold.id, member.userId);
                                setSheetNotice(`已将家庭所有者转交给成员 #${member.userId}。`);
                              } catch (error) {
                                setSheetError(
                                  error instanceof Error ? error.message : '转移所有者失败',
                                );
                              } finally {
                                setSubmittingAction(null);
                              }
                            }}
                          >
                            <Crown className="size-4" />
                            转交
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {sharedHousehold ? (
              <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submittingAction === 'leave' || ownerLeavingBlocked}
                  onClick={async () => {
                    if (!window.confirm(`确认退出「${currentHousehold.name}」吗？`)) {
                      return;
                    }
                    setSubmittingAction('leave');
                    setSheetError('');
                    try {
                      await onLeaveHousehold(currentHousehold.id);
                      setSheetNotice(`已退出「${currentHousehold.name}」。`);
                    } catch (error) {
                      setSheetError(error instanceof Error ? error.message : '退出家庭失败');
                    } finally {
                      setSubmittingAction(null);
                    }
                  }}
                >
                  <LogOut className="size-4" />
                  {submittingAction === 'leave' ? '退出中...' : '退出家庭'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-life-alert/20 text-life-alert hover:bg-life-alert/10 hover:text-life-alert"
                  disabled={submittingAction === 'dissolve' || currentHousehold.role !== 'owner'}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `确认解散「${currentHousehold.name}」吗？解散后该共享空间会进入归档状态。`,
                      )
                    ) {
                      return;
                    }
                    setSubmittingAction('dissolve');
                    setSheetError('');
                    try {
                      await onDissolveHousehold(currentHousehold.id);
                      setSheetNotice(`已解散「${currentHousehold.name}」。`);
                    } catch (error) {
                      setSheetError(error instanceof Error ? error.message : '解散家庭失败');
                    } finally {
                      setSubmittingAction(null);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  {submittingAction === 'dissolve' ? '解散中...' : '解散家庭'}
                </Button>
              </div>
            ) : null}

            {ownerLeavingBlocked ? (
              <p className="text-xs text-muted-foreground">
                你是当前家庭的所有者，且还有其他成员。先把 owner 转交给其中一位成员，再退出会更稳。
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </BottomSheet>
  );
}
