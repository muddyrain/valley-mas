import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pantryPageSource = readFileSync(resolve(__dirname, '../src/pages/PantryPage.tsx'), 'utf8');
const lifeTraceStoreSource = readFileSync(
  resolve(__dirname, '../src/store/useLifeTraceStore.ts'),
  'utf8',
);

describe('pantry status action guards', () => {
  it('keeps pantry status actions free of extra client trace writes', () => {
    expect(pantryPageSource).not.toContain('buildPantryTraceInput(updated');
    expect(pantryPageSource).not.toContain('addTrace(buildPantryTraceInput');
    expect(lifeTraceStoreSource).not.toContain('recordPantryTrace(');
    expect(lifeTraceStoreSource).not.toContain("'/api/v1/life-trace/traces'");
  });

  it('blocks duplicate status submissions before React disables the tapped button', () => {
    expect(pantryPageSource).toContain('statusActionInFlightRef');
    expect(pantryPageSource).toContain('statusActionInFlightRef.current.has(item.id)');
    expect(lifeTraceStoreSource).toContain('pantryStatusUpdateInFlightKeys');
  });

  it('keeps mobile status action labels stable while the action is pending', () => {
    expect(pantryPageSource).toContain('const StatusActionIcon = BadgeAlert');
    expect(pantryPageSource).toContain('const DiscardActionIcon = Trash2');
    expect(pantryPageSource).toContain('<ActionLoadingIcon className="size-4" tone="trace" />');
    expect(pantryPageSource).toContain('<ActionLoadingIcon className="size-4" tone="alert" />');
    expect(pantryPageSource).toContain('min-w-10 whitespace-nowrap text-center');
    expect(pantryPageSource).not.toContain("usedUpPending ? '处理中...'");
    expect(pantryPageSource).not.toContain("discardedPending ? '处理中...'");
  });
});
