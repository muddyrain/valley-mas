import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pantryDrawerSource = readFileSync(
  resolve(__dirname, '../src/components/PantryItemDrawer.tsx'),
  'utf8',
);
const bottomSheetSource = readFileSync(
  resolve(__dirname, '../src/components/BottomSheet.tsx'),
  'utf8',
);
const photoItemAnalysisSource = readFileSync(
  resolve(__dirname, '../src/pages/PhotoItemAnalysisPage.tsx'),
  'utf8',
);
const aiPageSource = readFileSync(resolve(__dirname, '../src/pages/AiPage.tsx'), 'utf8');
const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');
const expiryDateFieldSource = readFileSync(
  resolve(__dirname, '../src/components/PantryExpiryDateField.tsx'),
  'utf8',
);

describe('pantry drawer mobile layout guards', () => {
  it('clips sheet content horizontally instead of exposing a horizontal scrollbar', () => {
    expect(bottomSheetSource).toContain('overflow-x-hidden');
  });

  it('keeps sheet drag on the fixed handle instead of the scrollable form content', () => {
    expect(bottomSheetSource).toContain('data-sheet-drag-handle="true"');
    expect(bottomSheetSource).toContain(
      "'safe-bottom min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
    );
    expect(bottomSheetSource).toContain("style={{ touchAction: 'none' }}");
  });

  it('defaults bottom sheets to portal rendering so they open from the viewport bottom', () => {
    expect(bottomSheetSource).toContain('portal = true');
    expect(bottomSheetSource).toContain('createPortal(sheet, document.body)');
  });

  it('allows pantry form grids and date fields to shrink inside the bottom sheet', () => {
    expect(pantryDrawerSource).toContain('form className="min-w-0 space-y-4"');
    expect(pantryDrawerSource).toContain('className="grid min-w-0 grid-cols-2');
    expect(pantryDrawerSource).toContain('className="h-11 min-w-0 w-full');
    expect(pantryDrawerSource).toContain(
      'className="block min-w-0 max-w-full overflow-hidden rounded-2xl"',
    );
    expect(pantryDrawerSource).toContain('type="date"');
    expect(pantryDrawerSource).toContain('appearance-none');
  });

  it('keeps the photo review card in normal document flow while the sheet scrolls', () => {
    expect(photoItemAnalysisSource).toContain('当前编辑图片');
    expect(photoItemAnalysisSource).not.toContain('sticky top-0');
  });

  it('keeps photo analysis labels and expiry date clearing mobile friendly', () => {
    expect(photoItemAnalysisSource).toContain('className="shrink-0 whitespace-nowrap"');
    expect(photoItemAnalysisSource).toContain('<FormItem label="商品名称" required>');
    expect(expiryDateFieldSource).toContain('<FormItem label="生产/购买日期">');
    expect(expiryDateFieldSource).toContain('[&::-webkit-date-and-time-value]:min-h-11');
    expect(expiryDateFieldSource).toContain("value ? 'pr-[4.25rem]' : 'pr-10'");
    expect(expiryDateFieldSource).toContain('whitespace-nowrap');
    expect(expiryDateFieldSource).toContain('cursor-pointer border-life-health/35');
    expect(expiryDateFieldSource).toContain('cursor-not-allowed border-border');
    expect(expiryDateFieldSource).toContain('aria-label={clearLabel}');
    expect(expiryDateFieldSource).toContain('clearLabel="清空生产或购买日期"');
    expect(expiryDateFieldSource).toContain('clearLabel="清空过期日期"');
  });

  it('does not auto-open the inventory edit sheet when entering a requested photo draft', () => {
    expect(photoItemAnalysisSource).toContain(
      'restoreDraft(requestedDraft, { openSheet: false, silent: true })',
    );
    expect(photoItemAnalysisSource).toContain('handledRequestedDraftIdRef');
    expect(photoItemAnalysisSource).not.toContain('setSearchParams');
    expect(photoItemAnalysisSource).toContain('onClick={() => restoreDraft(latestDraft)}');
  });

  it('keeps the photo analysis back action in the shared subpage header', () => {
    expect(photoItemAnalysisSource).toContain("navigate('/ai', { replace: true })");
    expect(photoItemAnalysisSource).toContain('title="拍照分析商品"');
    expect(photoItemAnalysisSource).toContain('eyebrow="Life AI"');
    expect(photoItemAnalysisSource).toContain('onBack={handleBackToAi}');
  });

  it('cancels in-flight photo item analysis when leaving the page', () => {
    expect(photoItemAnalysisSource).toContain('analysisAbortRef');
    expect(photoItemAnalysisSource).toContain('analysisAbortRef.current?.abort()');
    expect(photoItemAnalysisSource).toContain('{ signal: analysisAbortController.signal }');
  });

  it('keeps photo analysis drafts removable from both AI and draft review entry points', () => {
    expect(aiPageSource).toContain('onRemovePhotoItemDraft');
    expect(aiPageSource).toContain('handleRemovePhotoItemDraft');
    expect(aiPageSource).toMatch(/aria-label=\{`移除\$\{itemName\}草稿`\}/);
    expect(photoItemAnalysisSource).toContain('const removeCurrentDraft = () =>');
    expect(photoItemAnalysisSource).toContain('canRemoveCurrentDraft');
    expect(photoItemAnalysisSource).toContain('移除草稿');
  });

  it('keeps each confirmed product as saved history before moving to the next detected draft', () => {
    expect(photoItemAnalysisSource).toContain(
      'markPhotoItemAnalysisSaved(currentHistoryId, item.id)',
    );
    expect(photoItemAnalysisSource).toContain(
      'const nextHistoryId = createPhotoItemAnalysisHistoryId();',
    );
    expect(photoItemAnalysisSource).toContain('setCurrentHistoryId(nextHistoryId)');
    expect(photoItemAnalysisSource).toContain('id: nextHistoryId');
  });

  it('closes the inventory confirmation sheet after the final photo item is saved', () => {
    expect(photoItemAnalysisSource).toContain("setState('done')");
    expect(photoItemAnalysisSource).toContain('setReviewSheetOpen(false)');
    expect(photoItemAnalysisSource).not.toContain(
      "setState('done');\r\n      setReviewSheetOpen(true)",
    );
  });

  it('refreshes recent product recognition after same-tab photo history changes', () => {
    expect(aiPageSource).toContain('PHOTO_ITEM_ANALYSIS_HISTORY_CHANGED_EVENT');
    expect(aiPageSource).toContain(
      'window.addEventListener(PHOTO_ITEM_ANALYSIS_HISTORY_CHANGED_EVENT',
    );
    expect(aiPageSource).toContain('onOpenSavedPantryItem');
    expect(aiPageSource).toContain("item.status === 'saved'");
  });

  it('keeps recent product recognition as a summary with a full history page', () => {
    expect(appSource).toContain('AiPhotoItemHistoryPage');
    expect(appSource).toContain('path="/ai/photo-item-history"');
    expect(aiPageSource).toContain('function PhotoItemHistoryArchive');
    expect(aiPageSource).toContain('getPhotoItemAnalysisSummaryItems(photoItemHistory)');
    expect(aiPageSource).not.toContain('photoItemHistory.slice(0, 3).map');
    expect(aiPageSource).toContain("navigate('/ai/photo-item-history')");
    expect(aiPageSource).toContain('全部');
  });

  it('lets the full product recognition history handle drafts and saved items differently', () => {
    expect(aiPageSource).toContain('title="最近商品识别"');
    expect(aiPageSource).toContain('onOpenPhotoItemDraft(item.id)');
    expect(aiPageSource).toContain("onOpenSavedPantryItem={() => navigate('/pantry')}");
    expect(aiPageSource).toContain('onRemovePhotoItemDraft(item.id)');
  });

  it('shows an immediate smart recipe loading state in the main chat area', () => {
    expect(aiPageSource).toContain("title: '正在生成智能菜谱'");
    expect(aiPageSource).toContain("quickActionLoading === '智能菜谱'");
    expect(aiPageSource).toContain('RecipeLoadingState');
  });

  it('does not stack large conversation sync skeletons under the recent recognition summary', () => {
    expect(aiPageSource).not.toContain('正在载入对话');
    expect(aiPageSource).not.toContain('正在把云端记录同步到当前设备。');
  });

  it('keeps transparent cover generation local and user triggered', () => {
    expect(pantryDrawerSource).toContain('createPantryCutoutCoverFile');
    expect(pantryDrawerSource).toContain('handleGenerateTransparentCover');
    expect(pantryDrawerSource).toContain('生成透明封面');
    expect(pantryDrawerSource).toContain('用实拍图做封面');
    expect(photoItemAnalysisSource).toContain('createPantryCutoutCoverFile');
    expect(photoItemAnalysisSource).toContain('transparentCoverUrl');
    expect(photoItemAnalysisSource).toContain('transparentCoverError');
    expect(photoItemAnalysisSource).toContain('生成透明封面');
    expect(photoItemAnalysisSource).toContain("coverMode === 'transparent'");
    expect(photoItemAnalysisSource).not.toContain(
      "setError(coverError instanceof Error ? coverError.message : '透明封面生成失败，请稍后再试。')",
    );
    expect(photoItemAnalysisSource).not.toContain(
      "{hasMeaningfulCropSuggestion && state !== 'done' ? (",
    );
    expect(photoItemAnalysisSource).toContain('bg-[length:12px_12px]');
    expect(photoItemAnalysisSource).not.toContain('shadow-[0_0_0_9999px');
    expect(photoItemAnalysisSource).not.toContain('shadow-[0_0_24px');
    expect(photoItemAnalysisSource).not.toContain('shadow-[0_0_28px');
  });
});
