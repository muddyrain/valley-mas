import type { AIAppArtifact } from '@/api/aiWorkbench';
import type {
  ConversationToolCardData,
  FileArtifactToolCard,
} from '@/components/ai/ConversationToolCard';

function toFileArtifactCard(artifact: AIAppArtifact): FileArtifactToolCard {
  return {
    type: 'file_artifact',
    artifactId: artifact.id,
    fileName: artifact.fileName,
    contentType: artifact.contentType,
    sizeBytes: artifact.sizeBytes,
    expiresAt: artifact.expiresAt,
    persistedAt: artifact.persistedAt,
  };
}

export function toArtifactToolCard(artifact: AIAppArtifact): ConversationToolCardData {
  const fileCard = toFileArtifactCard(artifact);
  if (
    artifact.kind === 'conversion' &&
    artifact.sourceFormat?.trim() &&
    artifact.targetFormat?.trim()
  ) {
    return {
      type: 'conversion_result',
      sourceFormat: artifact.sourceFormat,
      targetFormat: artifact.targetFormat,
      summary: '转换完成',
      artifact: fileCard,
    };
  }
  return fileCard;
}
