import type { AIImageGeneration } from '@/api/aiImages';

export async function loadAvailableConversationImages(
  generationIds: string[],
  loadGeneration: (id: string) => Promise<AIImageGeneration>,
) {
  const results = await Promise.allSettled(generationIds.map((id) => loadGeneration(id)));
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}
