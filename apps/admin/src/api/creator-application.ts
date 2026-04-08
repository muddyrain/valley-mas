import request from '../utils/request';

// 创作者申请状态
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

// 创作者申请类型
export interface CreatorApplication {
  id: string;
  userId: string;
  name: string;
  description: string;
  avatar: string;
  reason: string;
  phone?: string;
  email?: string;
  status: ApplicationStatus;
  reviewerId?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    nickname: string;
    avatar: string;
    role: string;
  };
  reviewer?: {
    id: string;
    username: string;
    nickname: string;
  };
}

// 提交申请参数
export interface SubmitApplicationParams {
  name: string;
  description?: string;
  avatar?: string;
  reason: string;
  phone?: string;
  email?: string;
}

// 审核申请参数
export interface ReviewApplicationParams {
  status: 'approved' | 'rejected';
  reviewNote?: string;
}

// 查询申请列表参数
export interface GetApplicationListParams {
  page?: number;
  pageSize?: number;
  status?: ApplicationStatus;
  keyword?: string;
}

export interface CreatorApplicationAuditConfig {
  strictness: number;
  updatedAt?: string;
  updatedBy?: string;
}

// 提交创作者申请
export const reqSubmitApplication = (params: SubmitApplicationParams) => {
  return request.post<
    unknown,
    {
      id: string;
      status: ApplicationStatus;
      createdAt: string;
      reviewedAt?: string;
      reviewNote?: string;
    }
  >('/creator/application', params);
};

// 获取我的申请状态
export const reqGetMyApplication = () => {
  return request.get<unknown, CreatorApplication>('/creator/application/my');
};

// 获取申请列表（管理员）
export const reqGetApplicationList = (params: GetApplicationListParams) => {
  return request.get<
    unknown,
    {
      list: CreatorApplication[];
      total: number;
      page: number;
      pageSize: number;
    }
  >('/admin/creator-applications', { params });
};

// 获取申请详情（管理员）
export const reqGetApplicationDetail = (id: string) => {
  return request.get<unknown, CreatorApplication>(`/admin/creator-applications/${id}`);
};

// 审核申请（管理员）
export const reqReviewApplication = (id: string, params: ReviewApplicationParams) => {
  return request.post<
    unknown,
    {
      status: ApplicationStatus;
      reviewedAt?: string;
    }
  >(`/admin/creator-applications/${id}/review`, params);
};

// 获取 AI 自动审核配置（管理员）
export const reqGetCreatorApplicationAuditConfig = () => {
  return request.get<unknown, CreatorApplicationAuditConfig>(
    '/admin/creator-application-audit-config',
  );
};

// 更新 AI 自动审核配置（管理员）
export const reqUpdateCreatorApplicationAuditConfig = (params: { strictness: number }) => {
  return request.put<unknown, CreatorApplicationAuditConfig>(
    '/admin/creator-application-audit-config',
    params,
  );
};
