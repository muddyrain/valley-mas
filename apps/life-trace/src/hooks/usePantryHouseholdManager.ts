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
import { getLifeTraceErrorMessage } from '@/lib/error';
import { findHouseholdById, resolveHouseholdSelection } from '@/lib/householdSelection';
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
  const [activeHouseholdId, setActiveHouseholdId] = useState('');
  const invitePayloadRef = useRef(invitePayload);
  const pendingActiveHouseholdIdRef = useRef('');

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
    setActiveHouseholdId('');
    pendingActiveHouseholdIdRef.current = '';
  }, [token]);

  const currentHousehold = useMemo(
    () => findHouseholdById(households, activeHouseholdId),
    [activeHouseholdId, households],
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
        throw new Error(getLifeTraceErrorMessage(error, '读取家庭成员失败'));
      } finally {
        setHouseholdMembersLoading(false);
      }
    },
    [token],
  );

  const persistActiveHousehold = useCallback(
    (householdId: string, householdName?: string) => {
      pendingActiveHouseholdIdRef.current = householdId;
      return setActivePantryHousehold(householdId, householdName).finally(() => {
        if (pendingActiveHouseholdIdRef.current === householdId) {
          pendingActiveHouseholdIdRef.current = '';
        }
      });
    },
    [setActivePantryHousehold],
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

        const nextSelectedHouseholdId = resolveHouseholdSelection({
          households: response.list,
          explicitHouseholdId: preferredHouseholdId,
          optimisticHouseholdId: pendingActiveHouseholdIdRef.current,
          serverCurrentHouseholdId: response.currentHouseholdId,
          preferredHouseholdId: preferredPantryHouseholdId,
        });
        const nextSelectedHousehold = findHouseholdById(response.list, nextSelectedHouseholdId);

        setActiveHouseholdId(nextSelectedHouseholdId);
        if (nextSelectedHousehold?.kind === 'shared') {
          setPreferredPantryHouseholdId(nextSelectedHousehold.id, nextSelectedHousehold.name);
        } else {
          setPreferredPantryHouseholdId('', nextSelectedHousehold?.name);
        }

        if (!response.list.some((item) => item.id === invitePayloadRef.current?.householdId)) {
          setInvitePayload(null);
        }

        return nextSelectedHouseholdId;
      } catch (error) {
        setHouseholdError(getLifeTraceErrorMessage(error, '读取家庭空间失败'));
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
      setActiveHouseholdId(householdId);
      setPreferredPantryHouseholdId(
        household?.kind === 'shared' ? householdId : '',
        household?.name,
      );
      void persistActiveHousehold(householdId, household?.name);
      setInvitePayload((current) => (current?.householdId === householdId ? current : null));
    },
    [households, persistActiveHousehold, setPreferredPantryHouseholdId],
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
        void persistActiveHousehold(nextSelectedHouseholdId, created.name);
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
      return created;
    },
    [loadHouseholdMembersFor, loadHouseholds, persistActiveHousehold, token],
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
        void persistActiveHousehold(nextSelectedHouseholdId, joined.name);
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
      return joined;
    },
    [loadHouseholdMembersFor, loadHouseholds, persistActiveHousehold, token],
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
      void persistActiveHousehold(nextSelectedHouseholdId);
      if (nextSelectedHouseholdId) {
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
    },
    [loadHouseholdMembersFor, loadHouseholds, persistActiveHousehold, token],
  );

  const handleTransferOwner = useCallback(
    async (householdId: string, targetUserId: string) => {
      if (!token) {
        throw new Error('请先登录后再转移家庭所有者');
      }

      await transferHouseholdOwner(token, householdId, targetUserId);
      const nextSelectedHouseholdId = await loadHouseholds(householdId);
      void persistActiveHousehold(nextSelectedHouseholdId || householdId);
      await loadHouseholdMembersFor(nextSelectedHouseholdId || householdId);
    },
    [loadHouseholdMembersFor, loadHouseholds, persistActiveHousehold, token],
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
      void persistActiveHousehold(nextSelectedHouseholdId);
      if (nextSelectedHouseholdId) {
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      }
    },
    [loadHouseholdMembersFor, loadHouseholds, persistActiveHousehold, token],
  );

  return {
    households,
    householdsLoaded,
    householdsLoading,
    householdError,
    householdMembers,
    householdMembersLoading,
    invitePayload,
    activeHouseholdId,
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
