import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createHousehold,
  createHouseholdInvite,
  dissolveHousehold,
  joinHousehold,
  leaveHousehold,
  listHouseholdMembers,
  listHouseholds,
  transferHouseholdOwner,
} from '@/api/household';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { HouseholdInvitePayload, HouseholdMember, HouseholdSummary } from '@/types';

export function usePantryHouseholdManager() {
  const token = useAuthStore((state) => state.token);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const setPreferredPantryHouseholdId = useLifeTraceStore(
    (state) => state.setPreferredPantryHouseholdId,
  );
  const setActivePantryHousehold = useLifeTraceStore((state) => state.setActivePantryHousehold);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [householdsLoaded, setHouseholdsLoaded] = useState(false);
  const [householdsLoading, setHouseholdsLoading] = useState(false);
  const [householdError, setHouseholdError] = useState('');
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [householdMembersLoading, setHouseholdMembersLoading] = useState(false);
  const [invitePayload, setInvitePayload] = useState<HouseholdInvitePayload | null>(null);
  const invitePayloadRef = useRef(invitePayload);

  useEffect(() => {
    invitePayloadRef.current = invitePayload;
  }, [invitePayload]);

  useEffect(() => {
    if (token) {
      return;
    }

    setHouseholds([]);
    setHouseholdsLoaded(false);
    setHouseholdsLoading(false);
    setHouseholdError('');
    setHouseholdMembers([]);
    setHouseholdMembersLoading(false);
    setInvitePayload(null);
  }, [token]);

  const currentHousehold = useMemo(
    () =>
      households.find((item) => item.id === preferredPantryHouseholdId) ?? households[0] ?? null,
    [households, preferredPantryHouseholdId],
  );

  const loadHouseholdMembersFor = useCallback(
    async (householdId: string) => {
      if (!token || !householdId) {
        setHouseholdMembers([]);
        return;
      }

      setHouseholdMembersLoading(true);
      try {
        const response = await listHouseholdMembers(token, householdId);
        setHouseholdMembers(response.list);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : '读取家庭成员失败');
      } finally {
        setHouseholdMembersLoading(false);
      }
    },
    [token],
  );

  const loadHouseholds = useCallback(
    async (preferredHouseholdId?: string) => {
      if (!token) {
        setHouseholds([]);
        setHouseholdsLoaded(false);
        setHouseholdMembers([]);
        setInvitePayload(null);
        setHouseholdError('');
        return '';
      }

      setHouseholdsLoading(true);
      setHouseholdError('');
      try {
        const response = await listHouseholds(token);
        setHouseholds(response.list);
        setHouseholdsLoaded(true);

        const requestedId = preferredHouseholdId || preferredPantryHouseholdId;
        const hasRequested = requestedId && response.list.some((item) => item.id === requestedId);
        const fallbackId =
          (response.currentHouseholdId &&
            response.list.some((item) => item.id === response.currentHouseholdId) &&
            response.currentHouseholdId) ||
          response.list[0]?.id ||
          '';
        const nextSelectedHouseholdId = hasRequested ? requestedId : fallbackId;
        const nextSelectedHousehold = response.list.find(
          (item) => item.id === nextSelectedHouseholdId,
        );

        setPreferredPantryHouseholdId(nextSelectedHouseholdId, nextSelectedHousehold?.name);

        if (!response.list.some((item) => item.id === invitePayloadRef.current?.householdId)) {
          setInvitePayload(null);
        }

        return nextSelectedHouseholdId;
      } catch (error) {
        setHouseholdError(error instanceof Error ? error.message : '读取家庭空间失败');
        setHouseholdsLoaded(true);
        return '';
      } finally {
        setHouseholdsLoading(false);
      }
    },
    [preferredPantryHouseholdId, setPreferredPantryHouseholdId, token],
  );

  const handleSelectHousehold = useCallback(
    (householdId: string) => {
      const household = households.find((item) => item.id === householdId);
      setPreferredPantryHouseholdId(householdId, household?.name);
      void setActivePantryHousehold(householdId, household?.name);
      setInvitePayload((current) => (current?.householdId === householdId ? current : null));
    },
    [households, setActivePantryHousehold, setPreferredPantryHouseholdId],
  );

  const handleCreateHousehold = useCallback(
    async (name: string) => {
      if (!token) {
        throw new Error('请先登录后再创建家庭');
      }

      const created = await createHousehold(token, name);
      setInvitePayload(null);
      const nextSelectedHouseholdId = await loadHouseholds(created.id);
      if (nextSelectedHouseholdId) {
        void setActivePantryHousehold(nextSelectedHouseholdId, created.name);
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
      return created;
    },
    [loadHouseholdMembersFor, loadHouseholds, setActivePantryHousehold, token],
  );

  const handleJoinHousehold = useCallback(
    async (inviteCode: string) => {
      if (!token) {
        throw new Error('请先登录后再加入家庭');
      }

      const joined = await joinHousehold(token, inviteCode);
      setInvitePayload(null);
      const nextSelectedHouseholdId = await loadHouseholds(joined.id);
      if (nextSelectedHouseholdId) {
        void setActivePantryHousehold(nextSelectedHouseholdId, joined.name);
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
      return joined;
    },
    [loadHouseholdMembersFor, loadHouseholds, setActivePantryHousehold, token],
  );

  const handleCreateInvite = useCallback(
    async (householdId: string) => {
      if (!token) {
        throw new Error('请先登录后再生成邀请码');
      }

      const payload = await createHouseholdInvite(token, householdId);
      setInvitePayload(payload);
      return payload;
    },
    [token],
  );

  const handleLeaveHousehold = useCallback(
    async (householdId: string) => {
      if (!token) {
        throw new Error('请先登录后再退出家庭');
      }

      await leaveHousehold(token, householdId);
      setInvitePayload(null);
      setHouseholdMembers([]);
      const nextSelectedHouseholdId = await loadHouseholds();
      void setActivePantryHousehold(nextSelectedHouseholdId);
      if (nextSelectedHouseholdId) {
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
    },
    [loadHouseholdMembersFor, loadHouseholds, setActivePantryHousehold, token],
  );

  const handleTransferOwner = useCallback(
    async (householdId: string, targetUserId: string) => {
      if (!token) {
        throw new Error('请先登录后再转移家庭所有者');
      }

      await transferHouseholdOwner(token, householdId, targetUserId);
      const nextSelectedHouseholdId = await loadHouseholds(householdId);
      void setActivePantryHousehold(nextSelectedHouseholdId || householdId);
      await loadHouseholdMembersFor(nextSelectedHouseholdId || householdId);
    },
    [loadHouseholdMembersFor, loadHouseholds, setActivePantryHousehold, token],
  );

  const handleDissolveHousehold = useCallback(
    async (householdId: string) => {
      if (!token) {
        throw new Error('请先登录后再解散家庭');
      }

      await dissolveHousehold(token, householdId);
      setInvitePayload(null);
      setHouseholdMembers([]);
      const nextSelectedHouseholdId = await loadHouseholds();
      void setActivePantryHousehold(nextSelectedHouseholdId);
      if (nextSelectedHouseholdId) {
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
    },
    [loadHouseholdMembersFor, loadHouseholds, setActivePantryHousehold, token],
  );

  return {
    households,
    householdsLoaded,
    householdsLoading,
    householdError,
    householdMembers,
    householdMembersLoading,
    invitePayload,
    currentHousehold,
    loadHouseholds,
    loadHouseholdMembersFor,
    handleSelectHousehold,
    handleCreateHousehold,
    handleJoinHousehold,
    handleCreateInvite,
    handleLeaveHousehold,
    handleTransferOwner,
    handleDissolveHousehold,
  };
}
