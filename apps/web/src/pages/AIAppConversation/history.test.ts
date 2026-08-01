import { describe, expect, it } from 'vitest';
import type { AIImageGeneration } from '@/api/aiImages';
import { loadAvailableConversationImages } from './history';

const generation = (id: string): AIImageGeneration => ({
  id,
  source: 'agent',
  modelCatalogId: 'model-1',
  provider: 'test',
  model: 'test-model',
  presetId: '',
  presetName: '',
  presetPrompt: '',
  skillName: '',
  styleProfileId: '',
  styleProfileSource: '',
  prompt: '测试',
  aspectRatio: '1:1',
  quality: '1K',
  requestedSize: '1024x1024',
  referenceCount: 0,
  editMode: '',
  isFavorited: false,
  status: 'succeeded',
  stage: 'completed',
  resultUrl: 'https://example.com/image.png',
  resultWidth: 1024,
  resultHeight: 1024,
  resultSize: 1,
  canvasSnapshotUrl: '',
  canvasSnapshotWidth: 0,
  canvasSnapshotHeight: 0,
  errorCode: '',
  errorMessage: '',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
});

describe('conversation image history', () => {
  it('keeps available images when another historical generation is unavailable', async () => {
    const images = await loadAvailableConversationImages(['missing', 'available'], async (id) => {
      if (id === 'missing') throw new Error('not found');
      return generation(id);
    });

    expect(images).toEqual([generation('available')]);
  });
});
