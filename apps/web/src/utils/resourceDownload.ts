import { downloadResource } from '@/api/resource';

interface TriggerResourceDownloadOptions {
  resourceId?: string;
  isAuthenticated: boolean;
  onRequireAuth?: () => void;
  onStart?: () => void;
  onSuccess?: () => void;
  onFinally?: () => void;
}

export async function triggerResourceDownload({
  resourceId,
  isAuthenticated,
  onRequireAuth,
  onStart,
  onSuccess,
  onFinally,
}: TriggerResourceDownloadOptions): Promise<boolean> {
  if (!resourceId) return false;

  if (!isAuthenticated) {
    onRequireAuth?.();
    return false;
  }

  try {
    onStart?.();
    const { downloadUrl } = await downloadResource(resourceId);
    window.open(downloadUrl, '_blank', 'noopener');
    onSuccess?.();
    return true;
  } finally {
    onFinally?.();
  }
}
