import { getVisiblePlanNote } from '@/lib/advicePlan';
import { parsePlanReminderDate } from '@/lib/planReminder';
import type { Plan } from '@/types';

const DEFAULT_EVENT_DURATION_MINUTES = 60;
const DEFAULT_REMINDER_LEAD_MINUTES = 10;

type PlanCalendarOptions = {
  now?: Date;
  durationMinutes?: number;
  reminderLeadMinutes?: number;
  eventUrl?: string;
};

export type PlanCalendarEvent = {
  content: string;
  filename: string;
  startsAt: Date;
  endsAt: Date;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatUtcDateTime(date: Date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('');
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function sanitizeFilename(value: string) {
  const filename = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, 72);

  return filename || 'Life Trace 计划';
}

function sanitizeUid(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '-');
}

function buildEventUrl(plan: Plan, explicitUrl?: string) {
  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  return `${window.location.origin}/plans/${encodeURIComponent(plan.id)}`;
}

export function createPlanCalendarEvent(
  plan: Plan,
  options: PlanCalendarOptions = {},
): PlanCalendarEvent | null {
  const startsAt = parsePlanReminderDate(plan, options.now);
  if (!startsAt) {
    return null;
  }

  const durationMinutes = options.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES;
  const endsAt = new Date(startsAt.getTime() + Math.max(durationMinutes, 1) * 60_000);
  const visibleNote = getVisiblePlanNote(plan.note);
  const eventUrl = buildEventUrl(plan, options.eventUrl);
  const description = [visibleNote, eventUrl ? `Life Trace：${eventUrl}` : 'Life Trace']
    .filter(Boolean)
    .join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Valley MAS//Life Trace//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:life-trace-plan-${sanitizeUid(plan.id)}@valley-mas`,
    `DTSTAMP:${formatUtcDateTime(options.now ?? new Date())}`,
    `DTSTART:${formatUtcDateTime(startsAt)}`,
    `DTEND:${formatUtcDateTime(endsAt)}`,
    `SUMMARY:${escapeIcsText(plan.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
  ];

  if (plan.location) {
    lines.push(`LOCATION:${escapeIcsText(plan.location)}`);
  }

  if (eventUrl) {
    lines.push(`URL:${escapeIcsText(eventUrl)}`);
  }

  if (plan.reminder) {
    const leadMinutes = Math.max(options.reminderLeadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES, 0);
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER:${leadMinutes > 0 ? `-PT${leadMinutes}M` : 'PT0M'}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(plan.title)}`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return {
    content: `${lines.join('\r\n')}\r\n`,
    filename: `${sanitizeFilename(plan.title)}.ics`,
    startsAt,
    endsAt,
  };
}

export function openPlanInNativeCalendar(plan: Plan, options: PlanCalendarOptions = {}) {
  const event = createPlanCalendarEvent(plan, options);
  if (!event || typeof document === 'undefined') {
    return false;
  }

  const blob = new Blob([event.content], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = event.filename;
  link.target = '_blank';
  link.rel = 'noopener';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
  return true;
}
