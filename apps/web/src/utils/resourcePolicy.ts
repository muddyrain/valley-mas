export type ResourceSourceKind = 'original' | 'ai_generated' | 'licensed';
export type ResourceLicense = 'download_allowed' | 'preview_only';

export interface ResourcePolicy {
  sourceKind: ResourceSourceKind | '';
  sourceUrl: string;
  license: ResourceLicense | '';
}

export const RESOURCE_SOURCE_LABELS: Record<ResourceSourceKind, string> = {
  original: '本人创作',
  ai_generated: 'AI 生成',
  licensed: '授权收藏',
};

export const RESOURCE_LICENSE_LABELS: Record<ResourceLicense, string> = {
  download_allowed: '允许站内下载',
  preview_only: '仅预览并链接出处',
};

export function validateResourcePolicy(policy: ResourcePolicy) {
  if (!policy.sourceKind) return '请选择图片来源';
  if (!policy.license) return '请选择使用许可';
  if (policy.sourceKind === 'licensed' && !policy.sourceUrl.trim()) return '请填写原始出处';
  return '';
}

export function appendResourcePolicyFormData(formData: FormData, policy: ResourcePolicy) {
  formData.append('sourceKind', policy.sourceKind);
  formData.append('sourceUrl', policy.sourceUrl.trim());
  formData.append('license', policy.license);
  formData.append('downloadAllowed', String(policy.license === 'download_allowed'));
}
