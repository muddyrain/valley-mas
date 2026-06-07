import { Copy, Crown, LogOut, RefreshCw, Shield, Sparkles, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLifeTraceErrorMessage } from '@/lib/error';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { HouseholdInvitePayload, HouseholdMember, HouseholdSummary } from '@/types';

type PantryHouseholdDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: HouseholdSummary | null;
  members: HouseholdMember[];
  membersLoading: boolean;
  invitePayload?: HouseholdInvitePayload | null;
  inviteLoading: boolean;
  onLoadInvite: (householdId: string) => Promise<HouseholdInvitePayload | null>;
  onCreateInvite: (householdId: string) => Promise<void>;
  onRevokeInvite: (householdId: string) => Promise<void>;
  onRefreshMembers: (householdId: string) => Promise<void>;
  onTransferOwner: (householdId: string, targetUserId: string) => Promise<void>;
  onLeaveHousehold: (householdId: string) => Promise<void>;
  onDissolveHousehold: (householdId: string) => Promise<void>;
};

type ConfirmAction =
  | { type: 'transfer'; householdId: string; targetUserId: string; memberLabel: string }
  | { type: 'leave'; householdId: string; householdName: string }
  | { type: 'dissolve'; householdId: string; householdName: string }
  | { type: 'revoke'; householdId: string; householdName: string };

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

export function PantryHouseholdDetailSheet({
  open,
  onOpenChange,
  household,
  members,
  membersLoading,
  invitePayload,
  inviteLoading,
  onLoadInvite,
  onCreateInvite,
  onRevokeInvite,
  onRefreshMembers,
  onTransferOwner,
  onLeaveHousehold,
  onDissolveHousehold,
}: PantryHouseholdDetailSheetProps) {
  const [sheetError, setSheetError] = useState('');
  const [submittingAction, setSubmittingAction] = useState<
    'invite' | 'revoke' | 'leave' | 'dissolve' | 'refresh' | 'transfer' | null
  >(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const inviteExpired = Boolean(
    invitePayload?.expiresAt && new Date(invitePayload.expiresAt).getTime() <= Date.now(),
  );
  const inviteActive = invitePayload?.status === 'pending' && !inviteExpired;
  const ownerLeavingBlocked = household?.role === 'owner' && (household.memberCount ?? 0) > 1;

  useEffect(() => {
    if (!open || !household) {
      return;
    }

    setSheetError('');
    void onRefreshMembers(household.id).catch((error) => {
      setSheetError(getLifeTraceErrorMessage(error, '刷新成员失败'));
    });
    void onLoadInvite(household.id).catch((error) => {
      setSheetError(getLifeTraceErrorMessage(error, '读取邀请码失败'));
    });
  }, [household, onLoadInvite, onRefreshMembers, open]);

  useEffect(() => {
    if (!open) {
      setSheetError('');
      setSubmittingAction(null);
      setConfirmAction(null);
    }
  }, [open]);

  const handleCopyInviteCode = async () => {
    if (!invitePayload?.inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(invitePayload.inviteCode);
      showToast('邀请码已复制，可以直接发给家人。');
      setSheetError('');
    } catch {
      setSheetError('当前环境暂时无法复制邀请码，请手动复制。');
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    const action = confirmAction;
    setSheetError('');

    if (action.type === 'transfer') {
      setSubmittingAction('transfer');
      try {
        await onTransferOwner(action.householdId, action.targetUserId);
        showToast(`已将家庭所有者转交给${action.memberLabel}`);
        setConfirmAction(null);
      } catch (error) {
        setSheetError(getLifeTraceErrorMessage(error, '转移所有者失败'));
      } finally {
        setSubmittingAction(null);
      }
      return;
    }

    if (action.type === 'leave') {
      setSubmittingAction('leave');
      try {
        await onLeaveHousehold(action.householdId);
        showToast(`已退出「${action.householdName}」`);
        setConfirmAction(null);
        onOpenChange(false);
      } catch (error) {
        setSheetError(getLifeTraceErrorMessage(error, '退出家庭失败'));
      } finally {
        setSubmittingAction(null);
      }
      return;
    }

    if (action.type === 'dissolve') {
      setSubmittingAction('dissolve');
      try {
        await onDissolveHousehold(action.householdId);
        showToast(`已归档「${action.householdName}」`);
        setConfirmAction(null);
        onOpenChange(false);
      } catch (error) {
        setSheetError(getLifeTraceErrorMessage(error, '解散家庭失败'));
      } finally {
        setSubmittingAction(null);
      }
      return;
    }

    setSubmittingAction('revoke');
    try {
      await onRevokeInvite(action.householdId);
      showToast(`已作废「${action.householdName}」的邀请码`);
      setConfirmAction(null);
    } catch (error) {
      setSheetError(getLifeTraceErrorMessage(error, '作废邀请码失败'));
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        overlayLabel="关闭当前家庭详情"
        zIndexClassName="z-[80]"
        portal
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">当前空间详情</h2>
            <p className="mt-1 text-sm text-muted-foreground">看成员、邀请码和当前家庭状态。</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭当前家庭详情"
            data-sheet-drag-ignore="true"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenChange(false);
            }}
          >
            <X className="size-5" />
          </Button>
        </div>

        {sheetError ? (
          <Card className="mb-4 border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
            {sheetError}
          </Card>
        ) : null}

        {!household ? (
          <EmptyState
            title="当前不是共享家庭"
            description="共享家庭会显示成员和邀请码。"
            eyebrow="暂无详情"
            tone="ai"
            icon={Users}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-life-ai/35 bg-life-ai/10 p-4 shadow-[0_16px_40px_rgba(6,182,212,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="ai">共享家庭</Badge>
                    <Badge tone={household.status === 'active' ? 'ai' : 'default'}>
                      {household.status === 'active'
                        ? householdRoleLabel[household.role]
                        : '已归档'}
                    </Badge>
                  </div>
                  <p className="mt-2 truncate text-base font-semibold">{household.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {household.status === 'active'
                      ? `${household.memberCount} 位成员共同维护`
                      : '归档共享家庭，仅保留只读信息'}
                  </p>
                </div>
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-ai text-background">
                  <Users className="size-4.5" />
                </div>
              </div>
            </div>

            {household.status === 'active' ? (
              <>
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">邀请码</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        生成后可复制，失效时可直接作废。
                      </p>
                    </div>
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
                            await Promise.all([
                              onRefreshMembers(household.id),
                              onLoadInvite(household.id),
                            ]);
                          } catch (error) {
                            setSheetError(getLifeTraceErrorMessage(error, '刷新详情失败'));
                          } finally {
                            setSubmittingAction(null);
                          }
                        }}
                      >
                        {submittingAction === 'refresh' ? (
                          <ActionLoadingIcon className="size-4" tone="ai" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        {submittingAction === 'refresh' ? '刷新中...' : '刷新'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={submittingAction === 'invite'}
                        onClick={async () => {
                          setSubmittingAction('invite');
                          setSheetError('');
                          try {
                            await onCreateInvite(household.id);
                            showToast('已生成新的邀请码');
                          } catch (error) {
                            setSheetError(getLifeTraceErrorMessage(error, '创建邀请码失败'));
                          } finally {
                            setSubmittingAction(null);
                          }
                        }}
                      >
                        {submittingAction === 'invite' ? (
                          <ActionLoadingIcon className="size-4" tone="ai" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {submittingAction === 'invite'
                          ? '生成中...'
                          : invitePayload
                            ? '重新生成'
                            : '生成邀请码'}
                      </Button>
                    </div>
                  </div>

                  {inviteLoading ? (
                    <Card className="p-4 text-sm text-muted-foreground">正在同步邀请码...</Card>
                  ) : invitePayload ? (
                    <Card className="space-y-3 border-life-ai/20 bg-life-ai/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">当前邀请码</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {inviteActive
                              ? '这条邀请码现在可用。'
                              : invitePayload.status === 'revoked'
                                ? '这条邀请码已经作废。'
                                : inviteExpired || invitePayload.status === 'expired'
                                  ? '这条邀请码已经过期。'
                                  : invitePayload.status === 'accepted'
                                    ? '这条邀请码已经被使用。'
                                    : '这条邀请码当前不可用。'}
                          </p>
                        </div>
                        <Badge tone={inviteActive ? 'ai' : 'default'}>
                          {inviteActive
                            ? '可用'
                            : invitePayload.status === 'revoked'
                              ? '已作废'
                              : invitePayload.status === 'accepted'
                                ? '已使用'
                                : '已失效'}
                        </Badge>
                      </div>
                      <div className="rounded-2xl border border-life-ai/20 bg-card px-4 py-3 text-base font-semibold tracking-[0.18em] text-life-ai">
                        {invitePayload.inviteCode}
                      </div>
                      {invitePayload.expiresAt ? (
                        <p className="text-xs text-muted-foreground">
                          有效期至 {new Date(invitePayload.expiresAt).toLocaleString('zh-CN')}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyInviteCode()}
                        >
                          <Copy className="size-4" />
                          复制
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={submittingAction === 'invite'}
                          onClick={async () => {
                            setSubmittingAction('invite');
                            setSheetError('');
                            try {
                              await onCreateInvite(household.id);
                              showToast('已重新生成邀请码');
                            } catch (error) {
                              setSheetError(getLifeTraceErrorMessage(error, '创建邀请码失败'));
                            } finally {
                              setSubmittingAction(null);
                            }
                          }}
                        >
                          {submittingAction === 'invite' ? (
                            <ActionLoadingIcon className="size-4" tone="ai" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          {submittingAction === 'invite' ? '生成中' : '重新生成'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="border border-life-alert/20 text-life-alert hover:bg-life-alert/10 hover:text-life-alert"
                          disabled={submittingAction === 'revoke' || !inviteActive}
                          onClick={() =>
                            setConfirmAction({
                              type: 'revoke',
                              householdId: household.id,
                              householdName: household.name,
                            })
                          }
                        >
                          {submittingAction === 'revoke' ? (
                            <ActionLoadingIcon className="size-4" tone="alert" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          {submittingAction === 'revoke' ? '作废中' : '作废'}
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <Card className="space-y-3 p-4">
                      <p className="text-sm text-muted-foreground">当前还没有可展示的邀请码。</p>
                      <Button
                        type="button"
                        variant="ai"
                        size="sm"
                        disabled={submittingAction === 'invite'}
                        onClick={async () => {
                          setSubmittingAction('invite');
                          setSheetError('');
                          try {
                            await onCreateInvite(household.id);
                            showToast('已生成新的邀请码');
                          } catch (error) {
                            setSheetError(getLifeTraceErrorMessage(error, '创建邀请码失败'));
                          } finally {
                            setSubmittingAction(null);
                          }
                        }}
                      >
                        {submittingAction === 'invite' ? (
                          <ActionLoadingIcon className="size-4" tone="ai" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {submittingAction === 'invite' ? '生成中...' : '生成邀请码'}
                      </Button>
                    </Card>
                  )}
                </section>

                <Card className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">成员列表</p>
                      <p className="mt-1 text-xs text-muted-foreground">谁在一起维护这份家庭库存</p>
                    </div>
                    <Badge tone="ai" className="shrink-0 whitespace-nowrap">
                      {household.memberCount} 人
                    </Badge>
                  </div>
                  {membersLoading ? (
                    <p className="text-sm text-muted-foreground">正在同步家庭成员...</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-secondary/50 px-4 py-3"
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
                          <div className="flex shrink-0 items-center gap-2 self-start pl-2">
                            <Badge
                              tone={member.role === 'owner' ? 'ai' : 'default'}
                              className="shrink-0 whitespace-nowrap"
                            >
                              {member.role === 'owner' ? (
                                <Crown className="mr-1 size-3.5" />
                              ) : member.role === 'admin' ? (
                                <Shield className="mr-1 size-3.5" />
                              ) : null}
                              {memberRoleLabel[member.role]}
                            </Badge>
                            {household.role === 'owner' && member.role !== 'owner' ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={submittingAction === 'transfer'}
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'transfer',
                                    householdId: household.id,
                                    targetUserId: member.userId,
                                    memberLabel: `成员 #${member.userId}`,
                                  })
                                }
                              >
                                {submittingAction === 'transfer' ? (
                                  <ActionLoadingIcon className="size-4" tone="ai" />
                                ) : (
                                  <Crown className="size-4" />
                                )}
                                转交
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submittingAction === 'leave' || ownerLeavingBlocked}
                    onClick={() =>
                      setConfirmAction({
                        type: 'leave',
                        householdId: household.id,
                        householdName: household.name,
                      })
                    }
                  >
                    {submittingAction === 'leave' ? (
                      <ActionLoadingIcon className="size-4" tone="ai" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    {submittingAction === 'leave' ? '退出中...' : '退出家庭'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-life-alert/20 text-life-alert hover:bg-life-alert/10 hover:text-life-alert"
                    disabled={submittingAction === 'dissolve' || household.role !== 'owner'}
                    onClick={() =>
                      setConfirmAction({
                        type: 'dissolve',
                        householdId: household.id,
                        householdName: household.name,
                      })
                    }
                  >
                    {submittingAction === 'dissolve' ? (
                      <ActionLoadingIcon className="size-4" tone="alert" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {submittingAction === 'dissolve' ? '解散中...' : '解散家庭'}
                  </Button>
                </div>

                {ownerLeavingBlocked ? (
                  <p className="text-xs text-muted-foreground">
                    你是当前家庭的所有者，且还有其他成员。先把 owner
                    转交给其中一位成员，再退出会更稳。
                  </p>
                ) : null}
              </>
            ) : (
              <Card className="p-4 text-sm text-muted-foreground">
                这个家庭已经归档，当前仅保留只读信息。
              </Card>
            )}
          </div>
        )}
      </BottomSheet>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction?.type === 'transfer'
            ? '转交家庭所有者？'
            : confirmAction?.type === 'leave'
              ? '退出这个家庭？'
              : confirmAction?.type === 'dissolve'
                ? '归档这个家庭？'
                : '作废这条邀请码？'
        }
        description={
          confirmAction?.type === 'transfer'
            ? `转交后，你会从 owner 变成 admin，${confirmAction.memberLabel} 会接手当前家庭。`
            : confirmAction?.type === 'leave'
              ? `退出后，你将不再看到「${confirmAction.householdName}」的共享库存。`
              : confirmAction?.type === 'dissolve'
                ? `「${confirmAction.householdName}」会进入归档状态，库存记录只读保留。`
                : confirmAction
                  ? `作废后，这条邀请码将不能继续加入「${confirmAction.householdName}」。`
                  : ''
        }
        confirmLabel={
          confirmAction?.type === 'transfer'
            ? '确认转交'
            : confirmAction?.type === 'leave'
              ? '确认退出'
              : confirmAction?.type === 'dissolve'
                ? '确认归档'
                : '确认作废'
        }
        loadingLabel={
          confirmAction?.type === 'transfer'
            ? '转交中'
            : confirmAction?.type === 'leave'
              ? '退出中'
              : confirmAction?.type === 'dissolve'
                ? '归档中'
                : '作废中'
        }
        loading={Boolean(confirmAction) && submittingAction === confirmAction?.type}
        onCancel={() => {
          if (!submittingAction) {
            setConfirmAction(null);
          }
        }}
        onConfirm={() => void handleConfirmAction()}
      />
    </>
  );
}
