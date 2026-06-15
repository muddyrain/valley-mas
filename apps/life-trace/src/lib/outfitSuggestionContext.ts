import type { WeatherApiResponse } from '@/api/weather';
import { isTodayPlan } from '@/lib/planGroups';
import type { Plan, PlanType, UserSettings } from '@/types';

export type OutfitSuggestionContext = {
  weatherText: string;
  temperature?: number;
  lowTemp?: number;
  highTemp?: number;
  precip?: string;
  planType?: PlanType;
  planTitle?: string;
  planId?: string;
  scene: string;
};

type BuildOutfitSuggestionContextInput = {
  settings: UserSettings;
  plans: Plan[];
  weather: WeatherApiResponse | null;
  todayKey?: string;
};

export function buildOutfitSuggestionContext({
  plans,
  weather,
  todayKey,
}: BuildOutfitSuggestionContextInput): OutfitSuggestionContext {
  const primaryPlan = pickPrimaryTodayPlan(plans, todayKey);
  const temperature = parseWeatherNumber(weather?.now?.temp);
  const lowTemp = parseWeatherNumber(weather?.now?.low);
  const highTemp = parseWeatherNumber(weather?.now?.high);
  const precip = weather?.now?.precip?.trim() || undefined;

  return {
    weatherText: weather?.now?.text?.trim() || '今日天气',
    ...(temperature === undefined ? {} : { temperature }),
    ...(lowTemp === undefined ? {} : { lowTemp }),
    ...(highTemp === undefined ? {} : { highTemp }),
    ...(precip === undefined ? {} : { precip }),
    ...(primaryPlan
      ? { planType: primaryPlan.type, planTitle: primaryPlan.title, planId: primaryPlan.id }
      : {}),
    scene: primaryPlan?.type || '日常',
  };
}

export function pickPrimaryTodayPlan(plans: Plan[], todayKey?: string) {
  const todayPlans = plans
    .filter(
      (plan) => !plan.completed && (todayKey ? plan.scheduledDate === todayKey : isTodayPlan(plan)),
    )
    .sort((a, b) => {
      const aTime = a.scheduledTime || '99:99';
      const bTime = b.scheduledTime || '99:99';
      return aTime.localeCompare(bTime);
    });
  return todayPlans[0] ?? null;
}

function parseWeatherNumber(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(String(value).replace('°', '').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
