import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Achievement, AchievementCategory, AchievementRarity } from '@/types';

type AchievementBadgeIconSize = 'sm' | 'md' | 'lg';

type AchievementBadgeIconProps = {
  achievement: Pick<Achievement, 'category' | 'code' | 'rarity' | 'title' | 'unlocked'>;
  className?: string;
  size?: AchievementBadgeIconSize;
};

type AchievementGlyphProps = {
  className?: string;
};

type AchievementGlyph = (props: AchievementGlyphProps) => ReactNode;

const sizeClassMap: Record<
  AchievementBadgeIconSize,
  { shell: string; glyph: string; notch: string }
> = {
  sm: { shell: 'size-10 rounded-2xl', glyph: 'size-7', notch: 'inset-1.5 rounded-[0.9rem]' },
  md: { shell: 'size-12 rounded-2xl', glyph: 'size-8', notch: 'inset-2 rounded-[1rem]' },
  lg: { shell: 'size-16 rounded-[1.25rem]', glyph: 'size-11', notch: 'inset-2.5 rounded-[1.1rem]' },
};

const categoryClassMap: Record<AchievementCategory, string> = {
  ai: 'border-life-ai/35 bg-life-ai/12 text-life-ai shadow-[0_0_26px_rgba(6,182,212,0.14)]',
  family:
    'border-life-plan/35 bg-life-plan/12 text-life-plan shadow-[0_0_26px_rgba(139,92,246,0.14)]',
  pantry:
    'border-life-health/35 bg-life-health/12 text-life-health shadow-[0_0_26px_rgba(245,158,11,0.14)]',
  plan: 'border-life-plan/35 bg-life-plan/12 text-life-plan shadow-[0_0_26px_rgba(139,92,246,0.14)]',
  trace:
    'border-life-trace/35 bg-life-trace/12 text-life-trace shadow-[0_0_26px_rgba(16,185,129,0.14)]',
};

const rarityClassMap: Record<AchievementRarity, string> = {
  common: 'after:border-white/10',
  rare: 'after:border-life-health/35 after:shadow-[inset_0_0_18px_rgba(245,158,11,0.18)]',
  epic: 'after:border-life-plan/40 after:shadow-[inset_0_0_22px_rgba(139,92,246,0.22)]',
};

const achievementGlyphMap: Record<string, AchievementGlyph> = {
  ai_plan_done: AiPlanDoneGlyph,
  ai_action_three: AiActionThreeGlyph,
  ai_action_ten: AiActionTenGlyph,
  ai_conversation_ten: AiConversationTenGlyph,
  ai_image_plan_three: AiImagePlanThreeGlyph,
  ai_conversation_three: AiConversationThreeGlyph,
  barcode_memory: BarcodeMemoryGlyph,
  expiry_rescue: ExpiryRescueGlyph,
  fresh_start: FreshStartGlyph,
  autumn_pantry: AutumnPantryGlyph,
  family_three_members: FamilyThreeMembersGlyph,
  first_ai_chat: FirstAiChatGlyph,
  first_household: FirstHouseholdGlyph,
  first_pantry: FirstPantryGlyph,
  first_plan: FirstPlanGlyph,
  first_plan_done: FirstPlanDoneGlyph,
  first_trace: FirstTraceGlyph,
  image_to_plan: ImageToPlanGlyph,
  image_trace: ImageTraceGlyph,
  late_night_trace: LateNightTraceGlyph,
  light_day: LightDayGlyph,
  long_trace: LongTraceGlyph,
  lookback_trace: LookbackTraceGlyph,
  manual_trace_three: ManualTraceThreeGlyph,
  mood_keeper: MoodKeeperGlyph,
  morning_plan: MorningPlanGlyph,
  pantry_category_three: PantryCategoryThreeGlyph,
  pantry_five_items: PantryFiveItemsGlyph,
  pantry_location_three: PantryLocationThreeGlyph,
  pantry_photo_memory: PantryPhotoMemoryGlyph,
  pantry_reminder_keeper: PantryReminderKeeperGlyph,
  pantry_twenty_items: PantryTwentyItemsGlyph,
  pantry_ten_normal: PantryTenNormalGlyph,
  photo_memory_three: PhotoMemoryThreeGlyph,
  place_keeper: PlaceKeeperGlyph,
  plan_thirty_done: PlanThirtyDoneGlyph,
  plan_ten_done: PlanTenDoneGlyph,
  plan_triple: PlanTripleGlyph,
  plan_type_collector: PlanTypeCollectorGlyph,
  reading_plan_done: ReadingPlanDoneGlyph,
  recipe_plan: RecipePlanGlyph,
  recipe_plan_three: RecipePlanThreeGlyph,
  review_to_plan: ReviewToPlanGlyph,
  review_to_plan_three: ReviewToPlanThreeGlyph,
  weekly_review_to_plan_five: WeeklyReviewToPlanFiveGlyph,
  daily_planner_week: DailyPlannerWeekGlyph,
  shared_pantry_category_three: SharedPantryCategoryThreeGlyph,
  shared_pantry_expiry_rescue: SharedPantryExpiryRescueGlyph,
  shared_pantry_first: SharedPantryFirstGlyph,
  shared_pantry_location_three: SharedPantryLocationThreeGlyph,
  shared_pantry_photo_memory: SharedPantryPhotoMemoryGlyph,
  shared_pantry_ten: SharedPantryTenGlyph,
  shared_pantry_used_food: SharedPantryUsedFoodGlyph,
  social_plan_done: SocialPlanDoneGlyph,
  sport_plan_done: SportPlanDoneGlyph,
  spring_trace: SpringTraceGlyph,
  summer_night_trace: SummerNightTraceGlyph,
  three_day_trace: ThreeDayTraceGlyph,
  trace_fourteen_day_streak: TraceFourteenDayStreakGlyph,
  tag_collector: TagCollectorGlyph,
  trace_fourteen_total: TraceFourteenTotalGlyph,
  trace_thirty_day_streak: TraceThirtyDayStreakGlyph,
  trace_seven_total: TraceSevenTotalGlyph,
  used_food: UsedFoodGlyph,
  waste_saver_three: WasteSaverThreeGlyph,
  weekend_life: WeekendLifeGlyph,
  winter_meal_plan: WinterMealPlanGlyph,
  weekly_review_four: WeeklyReviewFourGlyph,
  weekly_review: WeeklyReviewGlyph,
  expiry_rescue_three: ExpiryRescueThreeGlyph,
};

export function AchievementBadgeIcon({
  achievement,
  className,
  size = 'md',
}: AchievementBadgeIconProps) {
  const Glyph = achievementGlyphMap[achievement.code] ?? FallbackAchievementGlyph;
  const sizeClasses = sizeClassMap[size];

  return (
    <div
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden border',
        "after:pointer-events-none after:absolute after:border after:content-['']",
        sizeClasses.shell,
        rarityClassMap[achievement.rarity],
        achievement.unlocked
          ? categoryClassMap[achievement.category]
          : 'border-border bg-card/70 text-muted-foreground shadow-none grayscale',
        className,
      )}
      aria-hidden="true"
      data-achievement-badge-icon={achievement.code}
      title={achievement.title}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_34%,rgba(255,255,255,0.05)_72%)] opacity-80',
          sizeClasses.notch,
        )}
      />
      {achievement.unlocked ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 size-4 rounded-full bg-current opacity-20 blur-md"
        />
      ) : null}
      <Glyph
        className={cn('relative drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)]', sizeClasses.glyph)}
      />
    </div>
  );
}

function GlyphSvg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
      viewBox="0 0 64 64"
    >
      {children}
    </svg>
  );
}

function SparkMark() {
  return (
    <>
      <path d="M48 8l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" fill="currentColor" stroke="none" />
      <path
        d="M14 42l1.5 4.5L20 48l-4.5 1.5L14 54l-1.5-4.5L8 48l4.5-1.5L14 42z"
        fill="currentColor"
        stroke="none"
      />
    </>
  );
}

function FirstPlanGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="34" rx="8" width="38" x="13" y="17" />
      <path d="M22 12v10M42 12v10M13 28h38M32 36v10M27 41h10" />
      <SparkMark />
    </GlyphSvg>
  );
}

function FirstPlanDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M19 16h26l4 8-17 28L15 24l4-8z" />
      <path d="M23 34l6 6 13-14" />
      <path d="M22 24h20" />
    </GlyphSvg>
  );
}

function PlanTripleGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="13" rx="4" width="34" x="15" y="13" />
      <rect height="13" rx="4" width="34" x="15" y="30" />
      <rect height="13" rx="4" width="34" x="15" y="47" />
      <path d="M23 20h18M23 37h18M23 54h18" />
    </GlyphSvg>
  );
}

function PlanTenDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M19 16h26l4 8-17 28L15 24l4-8z" />
      <path d="M22 34l5 5 9-11" />
      <path d="M42 34h.1M48 34h.1" strokeWidth="7" />
      <path d="M40 44h10" />
    </GlyphSvg>
  );
}

function PlanThirtyDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M19 16h26l4 8-17 28L15 24l4-8z" />
      <path d="M23 34l5 5 12-14" />
      <path d="M42 34h.1M48 34h.1M45 43h.1" strokeWidth="6" />
      <SparkMark />
    </GlyphSvg>
  );
}

function PlanTypeCollectorGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="17" rx="5" width="17" x="12" y="14" />
      <circle cx="43" cy="22" r="9" />
      <path d="M22 42l10 14H12l10-14z" />
      <path d="M40 42h12v12H40z" />
    </GlyphSvg>
  );
}

function DailyPlannerWeekGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="36" rx="8" width="40" x="12" y="17" />
      <path d="M21 12v10M43 12v10M12 29h40" />
      <path d="M21 39h.1M28 39h.1M35 39h.1M42 39h.1M25 47h.1M32 47h.1M39 47h.1" strokeWidth="5" />
    </GlyphSvg>
  );
}

function MorningPlanGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M16 44h32" />
      <path d="M21 44a11 11 0 0 1 22 0" />
      <path d="M32 16v8M15 31l6 3M49 31l-6 3M20 20l5 6M44 20l-5 6" />
      <rect height="28" rx="7" width="36" x="14" y="24" />
    </GlyphSvg>
  );
}

function ReadingPlanDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M14 17h18a8 8 0 0 1 8 8v29H22a8 8 0 0 0-8 8V17z" />
      <path d="M40 17h10v37H40M23 29h9M23 39h8" />
      <path d="M38 45l4 4 9-12" />
    </GlyphSvg>
  );
}

function SportPlanDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M17 43c6-12 12-18 22-20" />
      <path d="M39 23l6-8M39 23l9 5M27 51l8-13M35 38l11 13" />
      <circle cx="47" cy="12" r="5" />
      <path d="M16 52h18M42 48l4 4 9-12" />
    </GlyphSvg>
  );
}

function SocialPlanDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <circle cx="24" cy="24" r="7" />
      <circle cx="43" cy="25" r="6" />
      <path d="M13 49c2-10 20-10 23 0M34 49c2-8 15-8 17 0" />
      <path d="M44 11l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" fill="currentColor" stroke="none" />
    </GlyphSvg>
  );
}

function WeekendLifeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <circle cx="32" cy="30" r="11" />
      <path d="M32 8v8M32 44v8M10 30h8M46 30h8M16 14l6 6M42 40l6 6M48 14l-6 6M22 40l-6 6" />
      <path d="M18 50c8-6 20-6 28 0" />
    </GlyphSvg>
  );
}

function LightDayGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M16 43c19 1 31-10 31-27-17 0-29 9-31 27z" />
      <path d="M18 45c9-9 17-16 28-22M25 42l-2-10M34 34l-1-8" />
      <path d="M13 51h24" />
    </GlyphSvg>
  );
}

function AiPlanDoneGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="30" rx="8" width="34" x="15" y="20" />
      <path d="M24 20v-5M40 20v-5M25 34l5 5 11-12" />
      <SparkMark />
    </GlyphSvg>
  );
}

function FirstTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M18 48c4-10 10-16 19-18 6-1 10-5 11-12" />
      <path d="M17 24c-4 0-7 3-7 7 0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z" />
      <circle cx="17" cy="31" r="2" fill="currentColor" stroke="none" />
      <path d="M46 10c-4 0-7 3-7 7 0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z" />
      <circle cx="46" cy="17" r="2" fill="currentColor" stroke="none" />
    </GlyphSvg>
  );
}

function ImageTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="34" rx="7" width="40" x="12" y="18" />
      <circle cx="24" cy="29" r="4" />
      <path d="M17 47l12-12 8 8 5-5 10 9" />
      <SparkMark />
    </GlyphSvg>
  );
}

function TraceSevenTotalGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M16 14h32v40H16z" />
      <path d="M24 25h16M24 34h16M24 43h9" />
      <path d="M46 47l4 4 8-11" />
    </GlyphSvg>
  );
}

function TraceFourteenTotalGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M16 14h32v40H16z" />
      <path d="M24 24h16M24 32h16M24 40h16M24 48h9" />
      <path d="M45 46h8M49 42v8" />
    </GlyphSvg>
  );
}

function TraceThirtyDayStreakGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="36" rx="8" width="40" x="12" y="17" />
      <path d="M21 12v10M43 12v10M12 29h40" />
      <path d="M23 41l5 5 13-14" />
      <SparkMark />
    </GlyphSvg>
  );
}

function TagCollectorGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M14 20h22l14 14-22 22-14-14V20z" />
      <circle cx="25" cy="31" r="3" />
      <path d="M37 16h8l7 7M42 27l7 7" />
    </GlyphSvg>
  );
}

function LateNightTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M44 13a20 20 0 1 0 7 30 16 16 0 0 1-7-30z" />
      <path d="M19 48c5-8 11-12 20-13" />
      <path d="M48 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" fill="currentColor" stroke="none" />
    </GlyphSvg>
  );
}

function PlaceKeeperGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M32 9c-8 0-14 6-14 14 0 10 14 26 14 26s14-16 14-26c0-8-6-14-14-14z" />
      <circle cx="32" cy="23" r="5" />
      <path d="M15 52c8 5 26 5 34 0" />
    </GlyphSvg>
  );
}

function ManualTraceThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M15 49l5-15 22-22 10 10-22 22-15 5z" />
      <path d="M37 17l10 10M20 34l10 10" />
      <path d="M41 48h.1M48 48h.1M45 55h.1" strokeWidth="6" />
    </GlyphSvg>
  );
}

function PhotoMemoryThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="28" rx="6" width="34" x="15" y="20" />
      <path d="M20 43l9-9 6 6 4-4 10 7" />
      <circle cx="26" cy="29" r="3" />
      <path d="M18 13h28M22 54h20" />
    </GlyphSvg>
  );
}

function MoodKeeperGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <circle cx="32" cy="32" r="20" />
      <path d="M24 28h.1M40 28h.1" strokeWidth="7" />
      <path d="M23 39c5 6 13 6 18 0" />
      <SparkMark />
    </GlyphSvg>
  );
}

function LongTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M16 15h23a9 9 0 0 1 9 9v29H24a8 8 0 0 0-8 8V15z" />
      <path d="M24 26h15M24 35h18M24 44h12" />
    </GlyphSvg>
  );
}

function ThreeDayTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="34" rx="8" width="40" x="12" y="18" />
      <path d="M21 12v10M43 12v10M12 29h40" />
      <path d="M22 40h.1M32 40h.1M42 40h.1" strokeWidth="7" />
    </GlyphSvg>
  );
}

function LookbackTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M20 23h-9v-9" />
      <path d="M12 23a23 23 0 1 1 7 21" />
      <path d="M32 20v14l10 6" />
    </GlyphSvg>
  );
}

function FirstPantryGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M14 24l18-10 18 10v25L32 59 14 49V24z" />
      <path d="M14 24l18 10 18-10M32 34v25M24 19l18 10" />
      <path d="M47 42h10M52 37v10" />
    </GlyphSvg>
  );
}

function PantryFiveItemsGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 28h40v25H12z" />
      <path d="M18 28v-8h28v8M20 37h.1M28 37h.1M36 37h.1M44 37h.1M24 46h.1" strokeWidth="7" />
    </GlyphSvg>
  );
}

function PantryTwentyItemsGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M11 27h42v27H11z" />
      <path
        d="M17 27v-9h30v9M20 36h.1M28 36h.1M36 36h.1M44 36h.1M20 45h.1M28 45h.1M36 45h.1M44 45h.1"
        strokeWidth="6"
      />
      <SparkMark />
    </GlyphSvg>
  );
}

function PantryCategoryThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="14" rx="4" width="18" x="12" y="15" />
      <rect height="14" rx="4" width="18" x="34" y="15" />
      <rect height="14" rx="4" width="18" x="23" y="39" />
      <path d="M21 29v10M43 29v10M21 39h22" />
    </GlyphSvg>
  );
}

function PantryLocationThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M18 12h28v40H18z" />
      <path d="M18 25h28M18 38h28" />
      <path d="M27 19h.1M37 32h.1M31 45h.1" strokeWidth="7" />
      <SparkMark />
    </GlyphSvg>
  );
}

function PantryReminderKeeperGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M20 28a12 12 0 0 1 24 0v12l6 8H14l6-8V28z" />
      <path d="M27 52a6 6 0 0 0 10 0M32 12v5" />
      <path d="M43 18l5-5" />
    </GlyphSvg>
  );
}

function ExpiryRescueGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <circle cx="32" cy="34" r="18" />
      <path d="M18 12l-7 7M46 12l7 7M32 23v12l8 5M22 54l-4 6M42 54l4 6" />
      <path d="M22 34h20M32 24v20" />
    </GlyphSvg>
  );
}

function ExpiryRescueThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <circle cx="32" cy="34" r="18" />
      <path d="M18 12l-7 7M46 12l7 7M32 23v12l8 5" />
      <path d="M22 34h20M32 24v20" />
      <path d="M21 54h22" />
    </GlyphSvg>
  );
}

function UsedFoodGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M20 13v18M28 13v18M20 31c0 7 8 7 8 0M24 38v14" />
      <path d="M42 13c-7 7-8 15-2 21l4 4v14" />
      <path d="M17 52h30" />
    </GlyphSvg>
  );
}

function WasteSaverThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M22 20h20l6 10-16 24-16-24 6-10z" />
      <path d="M24 36c4-7 12-7 16 0M40 36h-8v-8" />
      <path d="M22 45h20" />
    </GlyphSvg>
  );
}

function FreshStartGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M15 25l17-9 17 9v24l-17 9-17-9V25z" />
      <path d="M15 25l17 9 17-9M32 34v24" />
      <path d="M43 15l5 5 7-10" />
    </GlyphSvg>
  );
}

function PantryPhotoMemoryGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M14 24l18-10 18 10v25L32 59 14 49V24z" />
      <path d="M14 24l18 10 18-10M32 34v25" />
      <rect height="16" rx="4" width="20" x="22" y="35" />
      <circle cx="29" cy="42" r="2" />
    </GlyphSvg>
  );
}

function PantryTenNormalGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="13" rx="3" width="34" x="15" y="13" />
      <rect height="13" rx="3" width="34" x="15" y="30" />
      <rect height="13" rx="3" width="34" x="15" y="47" />
      <path d="M24 20h.1M24 37h.1M24 54h.1" strokeWidth="7" />
    </GlyphSvg>
  );
}

function BarcodeMemoryGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="34" rx="7" width="40" x="12" y="18" />
      <path d="M21 26v18M27 26v18M34 26v18M43 26v18" />
      <path d="M20 12h-7v7M44 12h7v7M20 52h-7v-7M44 52h7v-7" />
      <SparkMark />
    </GlyphSvg>
  );
}

function FirstAiChatGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M15 20a10 10 0 0 1 10-10h14a10 10 0 0 1 10 10v10a10 10 0 0 1-10 10h-9l-11 9v-10a10 10 0 0 1-4-8V20z" />
      <path d="M25 25h.1M32 25h.1M39 25h.1" strokeWidth="7" />
      <SparkMark />
    </GlyphSvg>
  );
}

function AiConversationThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M13 18h30a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H30l-11 8v-8h-6V18z" />
      <path d="M24 30h.1M32 30h.1M40 30h.1" strokeWidth="7" />
      <SparkMark />
    </GlyphSvg>
  );
}

function AiConversationTenGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M13 18h31a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H31l-12 9v-9h-6V18z" />
      <path d="M23 29h18M23 37h12" />
      <SparkMark />
    </GlyphSvg>
  );
}

function AiActionThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M17 16h30v36H17z" />
      <path d="M25 27l4 4 9-10M25 41h16" />
      <SparkMark />
    </GlyphSvg>
  );
}

function AiActionTenGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M17 16h30v36H17z" />
      <path d="M25 26l4 4 9-10M25 39h16M25 47h12" />
      <SparkMark />
    </GlyphSvg>
  );
}

function ImageToPlanGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="26" rx="6" width="28" x="10" y="18" />
      <path d="M15 39l8-8 5 5 3-3 7 6M44 18h9v34H23v-4M48 26v14M41 33h14" />
      <SparkMark />
    </GlyphSvg>
  );
}

function AiImagePlanThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="20" rx="5" width="24" x="10" y="16" />
      <rect height="20" rx="5" width="24" x="22" y="28" />
      <path d="M34 22h18v30H22v-4M40 35v10M35 40h10" />
      <SparkMark />
    </GlyphSvg>
  );
}

function RecipePlanGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M21 27a11 11 0 0 1 22 0h3a7 7 0 0 1 0 14H18a7 7 0 0 1 0-14h3z" />
      <path d="M22 41v12h20V41M27 48h10" />
      <path d="M47 48l6 6M53 48l-6 6" />
    </GlyphSvg>
  );
}

function RecipePlanThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M21 27a11 11 0 0 1 22 0h3a7 7 0 0 1 0 14H18a7 7 0 0 1 0-14h3z" />
      <path d="M22 41v12h20V41M26 48h12" />
      <path d="M48 48h.1M54 48h.1M51 54h.1" strokeWidth="6" />
    </GlyphSvg>
  );
}

function WeeklyReviewGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="40" rx="7" width="34" x="15" y="13" />
      <path d="M24 13v-4h16v4M24 28h16M24 38h11M24 47h8" />
      <path d="M40 44l4 4 8-10" />
    </GlyphSvg>
  );
}

function WeeklyReviewFourGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="40" rx="7" width="34" x="15" y="13" />
      <path d="M24 13v-4h16v4M24 27h16M24 36h16M24 45h10" />
      <path d="M42 42l4 4 8-10" />
    </GlyphSvg>
  );
}

function ReviewToPlanGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="36" rx="7" width="30" x="12" y="14" />
      <path d="M21 25h13M21 35h9" />
      <path d="M39 33h13v18H30v-9M43 39v6M40 42h6" />
      <SparkMark />
    </GlyphSvg>
  );
}

function ReviewToPlanThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="38" rx="7" width="30" x="11" y="13" />
      <path d="M20 24h13M20 34h11M20 43h8" />
      <path d="M39 34h13v18H30v-9M39 43h.1M45 43h.1M42 49h.1" strokeWidth="6" />
      <SparkMark />
    </GlyphSvg>
  );
}

function FirstHouseholdGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M13 30l19-16 19 16v22H13V30z" />
      <path d="M25 52V37h14v15" />
      <circle cx="25" cy="30" r="4" />
      <circle cx="39" cy="30" r="4" />
      <path d="M18 43c2-5 12-5 14 0M32 43c2-5 12-5 14 0" />
    </GlyphSvg>
  );
}

function FamilyThreeMembersGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 31l20-16 20 16v21H12V31z" />
      <circle cx="22" cy="34" r="4" />
      <circle cx="32" cy="31" r="4" />
      <circle cx="42" cy="34" r="4" />
      <path d="M17 45c2-6 11-6 13 0M27 45c2-7 12-7 14 0M37 45c2-6 9-6 11 0" />
    </GlyphSvg>
  );
}

function SharedPantryFirstGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M13 30l19-15 19 15v22H13V30z" />
      <path d="M22 39l10-6 10 6v13L32 58 22 52V39z" />
      <path d="M22 39l10 6 10-6M32 45v13" />
    </GlyphSvg>
  );
}

function SharedPantryTenGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 31l20-16 20 16v22H12V31z" />
      <path d="M20 36h24v15H20z" />
      <path d="M25 41h.1M32 41h.1M39 41h.1M26 48h.1M34 48h.1" strokeWidth="6" />
      <SparkMark />
    </GlyphSvg>
  );
}

function SharedPantryCategoryThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 30l20-15 20 15v22H12V30z" />
      <rect height="9" rx="3" width="12" x="18" y="34" />
      <rect height="9" rx="3" width="12" x="34" y="34" />
      <rect height="9" rx="3" width="12" x="26" y="46" />
    </GlyphSvg>
  );
}

function SharedPantryUsedFoodGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 31l20-16 20 16v21H12V31z" />
      <path d="M24 34v11M31 34v11M24 45c0 5 7 5 7 0M28 50v7" />
      <path d="M43 34c-5 5-6 11-1 16l3 3v4" />
    </GlyphSvg>
  );
}

function SharedPantryExpiryRescueGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 30l20-15 20 15v22H12V30z" />
      <circle cx="32" cy="40" r="11" />
      <path d="M32 34v7l5 3M24 24l-5 5M40 24l5 5" />
      <path d="M25 40h14M32 33v14" />
    </GlyphSvg>
  );
}

function SharedPantryPhotoMemoryGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 30l20-15 20 15v22H12V30z" />
      <rect height="16" rx="4" width="24" x="20" y="34" />
      <circle cx="28" cy="41" r="2" />
      <path d="M22 48l7-7 5 5 3-3 7 5" />
    </GlyphSvg>
  );
}

function SharedPantryLocationThreeGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 31l20-16 20 16v21H12V31z" />
      <path d="M20 36h24M20 45h24M27 31v21M37 31v21" />
      <path d="M24 40h.1M32 49h.1M40 40h.1" strokeWidth="6" />
    </GlyphSvg>
  );
}

function SpringTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M18 49c5-11 12-17 24-20" />
      <path d="M27 40c-9-1-13-7-12-17 10 0 15 6 12 17z" />
      <path d="M34 32c-1-10 5-16 16-17 0 11-6 17-16 17z" />
      <SparkMark />
    </GlyphSvg>
  );
}

function SummerNightTraceGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M42 12a19 19 0 1 0 8 30 15 15 0 0 1-8-30z" />
      <path d="M16 50c6-9 14-14 25-15" />
      <path
        d="M16 18l4 5 6-7M48 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"
        fill="currentColor"
        stroke="none"
      />
    </GlyphSvg>
  );
}

function AutumnPantryGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M16 25l16-9 16 9v24l-16 9-16-9V25z" />
      <path d="M16 25l16 9 16-9M32 34v24" />
      <path d="M42 16c-13 1-20 8-20 21 13 0 20-8 20-21z" />
      <path d="M24 36c5-6 10-10 17-15" />
    </GlyphSvg>
  );
}

function WinterMealPlanGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M20 30a12 12 0 0 1 24 0h3a7 7 0 0 1 0 14H17a7 7 0 0 1 0-14h3z" />
      <path d="M22 44v10h20V44M27 50h10" />
      <path d="M20 14v7M32 11v8M44 14v7" />
      <SparkMark />
    </GlyphSvg>
  );
}

function TraceFourteenDayStreakGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="36" rx="8" width="40" x="12" y="17" />
      <path d="M21 12v10M43 12v10M12 29h40" />
      <path d="M22 40h.1M30 40h.1M38 40h.1M46 40h.1M26 48h.1M34 48h.1M42 48h.1" strokeWidth="5" />
      <SparkMark />
    </GlyphSvg>
  );
}

function WeeklyReviewToPlanFiveGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <rect height="38" rx="7" width="30" x="11" y="13" />
      <path d="M20 24h13M20 34h11M20 43h8" />
      <path d="M39 34h13v18H30v-9" />
      <path d="M36 42h.1M42 42h.1M48 42h.1M39 49h.1M45 49h.1" strokeWidth="5" />
    </GlyphSvg>
  );
}

function FallbackAchievementGlyph({ className }: AchievementGlyphProps) {
  return (
    <GlyphSvg className={className}>
      <path d="M19 16h26l4 8-17 28L15 24l4-8z" />
      <SparkMark />
    </GlyphSvg>
  );
}
