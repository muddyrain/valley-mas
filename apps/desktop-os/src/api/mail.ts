import { apiRequest } from './client';

export type MailProvider = 'gmail' | 'qq_imap';
export type MailAccountStatus = 'pending' | 'connected' | 'error';

export interface MailAccount {
  id: string;
  provider: MailProvider;
  authType: 'oauth' | 'app_password';
  email: string;
  status: MailAccountStatus;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MailMessageSummary {
  id: string;
  accountId: string;
  provider: MailProvider;
  providerMessageId: string;
  threadId?: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MailMessageDetail extends MailMessageSummary {
  textBody?: string;
}

export interface MailPagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface MailAccountListResponse {
  list: MailAccount[];
}

export interface MailMessageListResponse {
  list: MailMessageSummary[];
  pagination: MailPagination;
}

export interface QQMailBindInput {
  email: string;
  authorizationCode: string;
}

export interface MailMessageQuery {
  accountId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function listMailAccounts(token: string) {
  return apiRequest<MailAccountListResponse>('/user/mail/accounts', { token });
}

export function startGmailBinding(token: string) {
  return apiRequest<{ authUrl: string }>('/user/mail/accounts/gmail/start', {
    method: 'POST',
    token,
  });
}

export function bindQQMailAccount(input: QQMailBindInput, token: string) {
  return apiRequest<MailAccount>('/user/mail/accounts/qq-imap', {
    method: 'POST',
    token,
    body: input,
  });
}

export function deleteMailAccount(id: string, token: string) {
  return apiRequest<{ id: string }>(`/user/mail/accounts/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function syncMailAccount(id: string, token: string) {
  return apiRequest<MailAccount>(`/user/mail/accounts/${id}/sync`, {
    method: 'POST',
    token,
  });
}

export function listMailMessages(query: MailMessageQuery, token: string) {
  const params = new URLSearchParams();
  if (query.accountId) params.set('accountId', query.accountId);
  if (query.q) params.set('q', query.q);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<MailMessageListResponse>(`/user/mail/messages${suffix}`, { token });
}

export function getMailMessage(id: string, token: string) {
  return apiRequest<MailMessageDetail>(`/user/mail/messages/${id}`, { token });
}
