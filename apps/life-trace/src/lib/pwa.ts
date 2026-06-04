import type { PwaShareResult } from '@/hooks/usePwaStatus';
import type { FeedbackToastTone } from '@/store/useFeedbackToastStore';

export function getPwaShareFeedback(result: PwaShareResult): {
  message: string;
  tone?: FeedbackToastTone;
} {
  if (result === 'shared') {
    return { message: '已打开系统分享面板' };
  }

  if (result === 'copied') {
    return { message: '应用链接已复制，可以发给朋友了' };
  }

  return {
    message: '当前浏览器不支持系统分享或剪贴板',
    tone: 'warning',
  };
}
