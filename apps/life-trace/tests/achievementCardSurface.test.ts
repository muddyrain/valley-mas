import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const achievementCardSource = readFileSync(
  resolve(__dirname, '../src/components/AchievementCard.tsx'),
  'utf8',
);
const achievementUnlockDialogSource = readFileSync(
  resolve(__dirname, '../src/components/AchievementUnlockDialog.tsx'),
  'utf8',
);
const achievementBadgeIconSource = readFileSync(
  resolve(__dirname, '../src/components/AchievementBadgeIcon.tsx'),
  'utf8',
);
const achievementsPageSource = readFileSync(
  resolve(__dirname, '../src/pages/AchievementsPage.tsx'),
  'utf8',
);

describe('achievement card surface', () => {
  it('keeps distinct collected styles for rare and epic achievements', () => {
    expect(achievementCardSource).toContain('unlockedRarityStyles');
    expect(achievementCardSource).toContain('border-life-health/35');
    expect(achievementCardSource).toContain('border-life-plan/35');
  });

  it('exposes share actions on unlocked achievement surfaces', () => {
    expect(achievementCardSource).toContain('分享成就');
    expect(achievementUnlockDialogSource).toContain('分享成就');
    expect(achievementCardSource).toContain('shareAchievementCard');
    expect(achievementUnlockDialogSource).toContain('shareAchievementCard');
  });

  it('uses reusable dedicated badge icons across achievement surfaces', () => {
    expect(achievementCardSource).toContain('AchievementBadgeIcon');
    expect(achievementUnlockDialogSource).toContain('AchievementBadgeIcon');
    expect(achievementsPageSource).toContain('AchievementBadgeIcon');
  });

  it('keeps semantic glyphs for representative achievement codes', () => {
    expect(achievementBadgeIconSource).toContain('achievementGlyphMap');
    expect(achievementBadgeIconSource).toContain('first_plan: FirstPlanGlyph');
    expect(achievementBadgeIconSource).toContain('first_trace: FirstTraceGlyph');
    expect(achievementBadgeIconSource).toContain('expiry_rescue: ExpiryRescueGlyph');
    expect(achievementBadgeIconSource).toContain('barcode_memory: BarcodeMemoryGlyph');
    expect(achievementBadgeIconSource).toContain('recipe_plan: RecipePlanGlyph');
  });

  it('covers P7.2 expansion achievement codes with dedicated glyphs', () => {
    expect(achievementBadgeIconSource).toContain('plan_triple: PlanTripleGlyph');
    expect(achievementBadgeIconSource).toContain('trace_seven_total: TraceSevenTotalGlyph');
    expect(achievementBadgeIconSource).toContain('pantry_five_items: PantryFiveItemsGlyph');
    expect(achievementBadgeIconSource).toContain('ai_action_three: AiActionThreeGlyph');
    expect(achievementBadgeIconSource).toContain('plan_thirty_done: PlanThirtyDoneGlyph');
    expect(achievementBadgeIconSource).toContain(
      'trace_thirty_day_streak: TraceThirtyDayStreakGlyph',
    );
    expect(achievementBadgeIconSource).toContain('pantry_twenty_items: PantryTwentyItemsGlyph');
    expect(achievementBadgeIconSource).toContain('weekly_review_four: WeeklyReviewFourGlyph');
    expect(achievementBadgeIconSource).toContain('reading_plan_done: ReadingPlanDoneGlyph');
    expect(achievementBadgeIconSource).toContain('late_night_trace: LateNightTraceGlyph');
    expect(achievementBadgeIconSource).toContain('pantry_category_three: PantryCategoryThreeGlyph');
    expect(achievementBadgeIconSource).toContain('ai_image_plan_three: AiImagePlanThreeGlyph');
    expect(achievementBadgeIconSource).toContain('family_three_members: FamilyThreeMembersGlyph');
    expect(achievementBadgeIconSource).toContain('shared_pantry_first: SharedPantryFirstGlyph');
    expect(achievementBadgeIconSource).toContain('shared_pantry_ten: SharedPantryTenGlyph');
    expect(achievementBadgeIconSource).toContain(
      'shared_pantry_category_three: SharedPantryCategoryThreeGlyph',
    );
    expect(achievementBadgeIconSource).toContain(
      'shared_pantry_expiry_rescue: SharedPantryExpiryRescueGlyph',
    );
    expect(achievementBadgeIconSource).toContain(
      'shared_pantry_photo_memory: SharedPantryPhotoMemoryGlyph',
    );
    expect(achievementBadgeIconSource).toContain(
      'shared_pantry_location_three: SharedPantryLocationThreeGlyph',
    );
    expect(achievementBadgeIconSource).toContain(
      'shared_pantry_used_food: SharedPantryUsedFoodGlyph',
    );
    expect(achievementBadgeIconSource).toContain('spring_trace: SpringTraceGlyph');
    expect(achievementBadgeIconSource).toContain('summer_night_trace: SummerNightTraceGlyph');
    expect(achievementBadgeIconSource).toContain('autumn_pantry: AutumnPantryGlyph');
    expect(achievementBadgeIconSource).toContain('winter_meal_plan: WinterMealPlanGlyph');
    expect(achievementBadgeIconSource).toContain(
      'trace_fourteen_day_streak: TraceFourteenDayStreakGlyph',
    );
    expect(achievementBadgeIconSource).toContain(
      'checkin_seven_day_streak: CheckinSevenDayStreakGlyph',
    );
    expect(achievementBadgeIconSource).toContain(
      'weekly_review_to_plan_five: WeeklyReviewToPlanFiveGlyph',
    );
  });
});
