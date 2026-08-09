import { describe, expect, it } from 'vitest';
import type { AIAppArtifact } from '@/api/aiWorkbench';
import { toArtifactToolCard } from './toolCards';

const baseArtifact: AIAppArtifact = {
  id: 'artifact-1',
  conversationId: 'conversation-1',
  runId: 'run-1',
  resourceId: 'resource-1',
  fileName: 'report.docx',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  sizeBytes: 4096,
  kind: 'conversion',
  sourceFormat: 'pdf',
  targetFormat: 'docx',
  expiresAt: '2026-08-11T00:00:00Z',
  createdAt: '2026-08-08T00:00:00Z',
};

describe('AI app artifact tool cards', () => {
  it('restores conversion metadata after refreshing the conversation', () => {
    expect(toArtifactToolCard(baseArtifact)).toEqual({
      type: 'conversion_result',
      sourceFormat: 'pdf',
      targetFormat: 'docx',
      summary: '转换完成',
      artifact: {
        type: 'file_artifact',
        artifactId: 'artifact-1',
        fileName: 'report.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 4096,
        expiresAt: '2026-08-11T00:00:00Z',
        persistedAt: undefined,
      },
    });
  });

  it('keeps ordinary generated files as file cards', () => {
    expect(
      toArtifactToolCard({
        ...baseArtifact,
        kind: 'file',
        sourceFormat: undefined,
        targetFormat: undefined,
        fileName: 'notes.md',
        contentType: 'text/markdown',
      }).type,
    ).toBe('file_artifact');
  });
});
