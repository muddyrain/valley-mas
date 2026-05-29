import { apiRequest } from '@/api/request';

export type LifeTraceImageUpload = {
  url: string;
  storageKey: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  extension?: string;
  contentType?: string;
};

export function uploadLifeTraceImage(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<LifeTraceImageUpload>('/life-trace/uploads/image', token, {
    method: 'POST',
    body: formData,
  });
}
