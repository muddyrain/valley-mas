import type { AIImageGeneration } from '@/api/aiImages';
import type { ConversationComposerReferenceImage } from '@/components/ai/ConversationComposer';
import type { ConversationMessageAttachment } from '@/components/ai/ConversationMessage';

export type ImageConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  generationId?: string;
  referenceImages?: ConversationComposerReferenceImage[];
};

type ReferenceGeneration = Pick<AIImageGeneration, 'id' | 'referenceCount' | 'canvasSnapshotUrl'>;
type ConversationGeneration = Pick<AIImageGeneration, 'status' | 'stage'>;

export const INITIAL_IMAGE_CONVERSATION_MESSAGE = '我正在根据你的描述生成图片。';
export const REFERENCE_IMAGE_CONVERSATION_MESSAGE = '我会基于所选参考图生成新的版本。';
export const RETRY_IMAGE_CONVERSATION_MESSAGE = '正在重新生成图片。';

export function getImageConversationMessageContent(
  message: ImageConversationMessage,
  generation?: ConversationGeneration,
) {
  if (message.role !== 'assistant' || !generation) return message.content;

  const isInitial = message.content === INITIAL_IMAGE_CONVERSATION_MESSAGE;
  const isReference = message.content === REFERENCE_IMAGE_CONVERSATION_MESSAGE;
  const isRetry = message.content === RETRY_IMAGE_CONVERSATION_MESSAGE;
  if (!isInitial && !isReference && !isRetry) return message.content;

  if (generation.status === 'running' && generation.stage === 'storing') {
    return isRetry ? '图片已重新生成，正在保存结果。' : '图片已生成，正在保存结果。';
  }

  switch (generation.status) {
    case 'succeeded':
      if (isRetry) return '图片已重新生成。';
      if (isReference) return '已基于参考图生成新的版本。';
      return '图片已生成。';
    case 'failed':
      return isRetry ? '重新生成失败。' : '图片生成失败。';
    case 'paused':
      return isRetry ? '已暂停重新生成。' : '图片生成已暂停。';
    default:
      return message.content;
  }
}

export function getImageConversationReferenceAttachments(
  messages: ImageConversationMessage[],
  messageIndex: number,
  generations: ReferenceGeneration[],
): ConversationMessageAttachment[] {
  const message = messages[messageIndex];
  if (!message || message.role !== 'user') return [];
  if (message.referenceImages?.length) {
    return message.referenceImages.map((image) => ({
      id: image.id,
      name: image.name,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      previewUrl: image.dataUrl,
    }));
  }

  const nextMessage = messages[messageIndex + 1];
  if (nextMessage?.role !== 'assistant' || !nextMessage.generationId) return [];
  const generation = generations.find((item) => item.id === nextMessage.generationId);
  if (!generation?.canvasSnapshotUrl || generation.referenceCount === 0) return [];

  return [
    {
      id: `generation-reference-${generation.id}`,
      name: '参考图',
      mimeType: 'image/*',
      previewUrl: generation.canvasSnapshotUrl,
      secondary: generation.referenceCount > 1 ? `共 ${generation.referenceCount} 张` : '参考图',
    },
  ];
}
