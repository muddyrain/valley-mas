import { apiRequest } from '@/api/request';
import type { HouseholdInvitePayload, HouseholdMember, HouseholdSummary } from '@/types';

export function listHouseholds(token: string) {
  return apiRequest<{ list: HouseholdSummary[]; currentHouseholdId?: string }>(
    '/life-trace/households',
    token,
  );
}

export function getHousehold(token: string, householdId: string) {
  return apiRequest<HouseholdSummary>(`/life-trace/households/${householdId}`, token);
}

export function createHousehold(token: string, name: string) {
  return apiRequest<HouseholdSummary>('/life-trace/households', token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function listHouseholdMembers(token: string, householdId: string) {
  return apiRequest<{ householdId: string; list: HouseholdMember[] }>(
    `/life-trace/households/${householdId}/members`,
    token,
  );
}

export function createHouseholdInvite(token: string, householdId: string) {
  return apiRequest<HouseholdInvitePayload>(
    `/life-trace/households/${householdId}/invites`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function revokeHouseholdInvite(token: string, householdId: string) {
  return apiRequest<HouseholdInvitePayload>(`/life-trace/households/${householdId}/invite`, token, {
    method: 'DELETE',
  });
}

export function joinHousehold(token: string, inviteCode: string) {
  return apiRequest<HouseholdSummary>('/life-trace/households/join', token, {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}

export function leaveHousehold(token: string, householdId: string) {
  return apiRequest<{ householdId: string; left: boolean }>(
    `/life-trace/households/${householdId}/leave`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function transferHouseholdOwner(token: string, householdId: string, targetUserId: string) {
  return apiRequest<HouseholdSummary>(
    `/life-trace/households/${householdId}/transfer-owner`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    },
  );
}

export function dissolveHousehold(token: string, householdId: string) {
  return apiRequest<{ householdId: string; status: string }>(
    `/life-trace/households/${householdId}/dissolve`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}
