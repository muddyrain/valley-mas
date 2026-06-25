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
    expect(pantryPageSource).toContain('const consumePending = pendingActionId ===');
    expect(pantryPageSource).toContain(':consume-used`;');
    expect(pantryPageSource).toContain(':consume-discarded` || consumePending');
    expect(pantryPageSource).toContain('<ActionLoadingIcon className="size-4" tone="trace" />');
    expect(pantryPageSource).toContain('<ActionLoadingIcon className="size-4" tone="alert" />');
    expect(pantryPageSource).toContain('<span className="whitespace-nowrap">');
    expect(pantryPageSource).toContain("'用 1'");
    expect(pantryPageSource).toContain("'处理'");
    expect(pantryPageSource).not.toContain("usedUpPending ? '处理中...'");
    expect(pantryPageSource).not.toContain("discardedPending ? '处理中...'");
  });

  it('keeps partial consume actions available from the process sheet', () => {
    expect(pantryPageSource).toContain('openConsumeSheet(item)');
    expect(pantryPageSource).toContain('处理数量');
    expect(pantryPageSource).toContain('使用数量');
    expect(pantryPageSource).toContain('全部用完');
    expect(pantryPageSource).toContain('丢弃数量');
    expect(pantryPageSource).toContain('全部丢弃');
  });

  it('uses shaped pantry skeletons instead of a plain syncing text card', () => {
    expect(pantryPageSource).toContain('function PantryListSkeleton');
    expect(pantryPageSource).toContain('<PantryListSkeleton');
    expect(pantryPageSource).toContain('aria-label="库存加载中"');
    expect(pantryPageSource).not.toContain('正在同步{currentHouseholdName}库存...');
  });

  it('keeps pantry card thumbnails in a fixed mobile slot', () => {
    expect(pantryPageSource).toContain('flex w-full items-stretch gap-3 p-3 text-left');
    expect(pantryPageSource).toContain('grid h-32 w-[6.75rem] shrink-0');
    expect(pantryPageSource).toContain('max-[360px]:h-[7.5rem] max-[360px]:w-24');
    expect(pantryPageSource).not.toContain('h-full min-h-28 w-full');
  });
});
