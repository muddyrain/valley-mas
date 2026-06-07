import { Home, Plus, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLifeTraceErrorMessage } from '@/lib/error';
import { sortHouseholdsForSheet } from '@/lib/householdSheet';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { HouseholdSummary } from '@/types';

type PantryHouseholdSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: HouseholdSummary[];
  selectedHouseholdId?: string;
  householdsLoading: boolean;
  onSelectHousehold: (householdId: string) => void;
  onCreateHousehold: (name: string) => Promise<void>;
  onJoinHousehold: (inviteCode: string) => Promise<void>;
};

const householdRoleLabel = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
} satisfies Record<HouseholdSummary['role'], string>;

export function PantryHouseholdSheet({
  open,
  onOpenChange,
  households,
  selectedHouseholdId,
  householdsLoading,
  onSelectHousehold,
  onCreateHousehold,
  onJoinHousehold,
}: PantryHouseholdSheetProps) {
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submittingAction, setSubmittingAction] = useState<'create' | 'join' | null>(null);
  const [sheetError, setSheetError] = useState('');
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const allSpaces = useMemo(() => sortHouseholdsForSheet(households), [households]);

  useEffect(() => {
    if (!open) {
      setSheetError('');
      setSubmittingAction(null);
      setCreateName('');
      setJoinCode('');
    }
  }, [open]);

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
          <p className="mt-1 text-sm text-muted-foreground">切换当前空间，或创建、加入共享家庭。</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="关闭家庭空间管理"
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

      <div className="space-y-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">所有空间</p>
              <p className="mt-1 text-xs text-muted-foreground">个人空间与共享家庭</p>
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
              {allSpaces.map((household) => {
                const selected = household.id === selectedHouseholdId;
                const archived = household.status !== 'active';
                return (
                  <button
                    key={household.id}
                    type="button"
                    disabled={archived}
                    className={cn(
                      'w-full rounded-[1.25rem] border p-4 text-left transition disabled:cursor-default disabled:opacity-70',
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
                          <Badge tone={archived ? 'default' : 'ai'}>
                            {archived ? '已归档' : householdRoleLabel[household.role]}
                          </Badge>
                          {selected ? <Badge tone="default">当前使用中</Badge> : null}
                        </div>
                        <p className="mt-2 truncate text-base font-semibold">{household.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {household.kind === 'personal'
                            ? '随时可以切回个人库存'
                            : archived
                              ? '已归档，仅保留展示'
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
                  showToast(`已创建共享家庭「${name}」`);
                } catch (error) {
                  setSheetError(getLifeTraceErrorMessage(error, '创建家庭失败'));
                } finally {
                  setSubmittingAction(null);
                }
              }}
            >
              {submittingAction === 'create' ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : (
                <Plus className="size-4" />
              )}
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
                  showToast('已加入新的共享家庭');
                } catch (error) {
                  setSheetError(getLifeTraceErrorMessage(error, '加入家庭失败'));
                } finally {
                  setSubmittingAction(null);
                }
              }}
            >
              {submittingAction === 'join' ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {submittingAction === 'join' ? '加入中...' : '通过邀请码加入'}
            </Button>
          </Card>
        </section>
      </div>
    </BottomSheet>
  );
}
