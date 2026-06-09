import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mediaDiaryPageSource = readFileSync(
  resolve(__dirname, '../src/pages/MediaDiaryPage.tsx'),
  'utf8',
);

describe('media diary page surface', () => {
  it('refreshes traces after media diary mutations', () => {
    expect(mediaDiaryPageSource).toContain(
      "import { useLifeTraceStore } from '@/store/useLifeTraceStore'",
    );
    expect(mediaDiaryPageSource).toContain(
      'const loadTraces = useLifeTraceStore((state) => state.loadTraces);',
    );

    const saveSuccessIndex = mediaDiaryPageSource.indexOf(
      "showToast(editingEntry ? '书影音日记已更新' : '书影音日记已保存', 'success');",
    );
    const deleteSuccessIndex = mediaDiaryPageSource.indexOf(
      "showToast('书影音日记已删除', 'success');",
    );
    expect(saveSuccessIndex).toBeGreaterThan(-1);
    expect(deleteSuccessIndex).toBeGreaterThan(-1);

    expect(mediaDiaryPageSource.indexOf('void loadTraces();', saveSuccessIndex)).toBeGreaterThan(
      saveSuccessIndex,
    );
    expect(mediaDiaryPageSource.indexOf('void loadTraces();', deleteSuccessIndex)).toBeGreaterThan(
      deleteSuccessIndex,
    );
  });
});
