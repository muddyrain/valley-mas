import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pantryPageSource = readFileSync(resolve(__dirname, '../src/pages/PantryPage.tsx'), 'utf8');
const lifeTraceStoreSource = readFileSync(
  resolve(__dirname, '../src/store/useLifeTraceStore.ts'),
  'utf8',
);

describe('pantry status action guards', () => {
  it('keeps trace creation centralized in the store after status actions', () => {
    expect(pantryPageSource).not.toContain('buildPantryTraceInput(updated');
    expect(pantryPageSource).not.toContain('addTrace(buildPantryTraceInput');
    expect(lifeTraceStoreSource).toContain('recordPantryTrace(');
  });

  it('blocks duplicate status submissions before React disables the tapped button', () => {
    expect(pantryPageSource).toContain('statusActionInFlightRef');
    expect(pantryPageSource).toContain('statusActionInFlightRef.current.has(item.id)');
    expect(lifeTraceStoreSource).toContain('pantryStatusUpdateInFlightKeys');
  });
});
