import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const todayPageSource = readFileSync(resolve(__dirname, '../src/pages/TodayPage.tsx'), 'utf8');

describe('today weather skeleton surface', () => {
  it('keeps the loading skeleton close to the loaded weather card height', () => {
    expect(todayPageSource).toContain('showWeatherSkeleton');
    expect(todayPageSource).toContain('settings.weatherAlerts &&');
    expect(todayPageSource).toContain('min-[720px]:grid-cols-[1.4fr_1fr]');
    expect(todayPageSource).toContain('key={`weather-hour-skeleton-${index}`}');
    expect(todayPageSource).toContain('flex min-w-20 shrink-0 flex-col');
    expect(todayPageSource).not.toContain('className="flex min-w-14 flex-col');
  });
});
