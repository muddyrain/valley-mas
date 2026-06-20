import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type CalendarEvent,
  type CalendarEventCategory,
  type CalendarEventInput,
  type CalendarHolidayInfo,
  type CalendarReminderMinutes,
  getHolidayInfoForDate,
  useCalendarStore,
} from '../store/calendarStore';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import './CalendarWindow.css';

type CalendarView = 'month' | 'week' | 'day';

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const VIEW_LABELS: Record<CalendarView, string> = {
  month: '月',
  week: '周',
  day: '日',
};
const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 22;
const WEEK_HOUR_HEIGHT = 54;
const WEEK_HOURS = Array.from(
  { length: WEEK_END_HOUR - WEEK_START_HOUR + 1 },
  (_, index) => WEEK_START_HOUR + index,
);
const CATEGORY_LABELS: Record<CalendarEventCategory, string> = {
  personal: '个人',
  work: '工作',
  life: '生活',
  focus: '专注',
};
const REMINDER_OPTIONS: Array<{ label: string; value: CalendarReminderMinutes }> = [
  { label: '不提醒', value: null },
  { label: '开始时', value: 0 },
  { label: '提前 5 分钟', value: 5 },
  { label: '提前 10 分钟', value: 10 },
  { label: '提前 30 分钟', value: 30 },
];

function emptyDraft(date = dayjs()): CalendarEventInput {
  return {
    title: '',
    date: date.format('YYYY-MM-DD'),
    endDate: date.format('YYYY-MM-DD'),
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    category: 'personal',
    reminderMinutes: null,
    notes: '',
  };
}

export default function CalendarWindow() {
  const events = useCalendarStore((s) => s.events);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const holidayCalendars = useCalendarStore((s) => s.holidayCalendars);
  const holidayLoadingYears = useCalendarStore((s) => s.holidayLoadingYears);
  const holidayErrorYears = useCalendarStore((s) => s.holidayErrorYears);
  const loadHolidayCalendar = useCalendarStore((s) => s.loadHolidayCalendar);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(() => dayjs());
  const [selectedDate, setSelectedDate] = useState(() => dayjs());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalendarEventInput>(() => emptyDraft());
  const remindedKeys = useRef(new Set<string>());

  const selectedEvents = useMemo(() => eventsForDate(events, selectedDate), [events, selectedDate]);
  const selectedHoliday = getHolidayInfoForDate(
    holidayCalendars,
    selectedDate.format('YYYY-MM-DD'),
  );
  const visibleDates = useMemo(
    () => visibleDatesForView(cursor, selectedDate, view),
    [cursor, selectedDate, view],
  );
  const visibleYears = useMemo(
    () => [...new Set(visibleDates.map((date) => date.year()))],
    [visibleDates],
  );
  const holidayStatus = holidayStatusText(visibleYears, holidayLoadingYears, holidayErrorYears);

  useEffect(() => {
    for (const year of visibleYears) {
      void loadHolidayCalendar(year);
    }
  }, [visibleYears, loadHolidayCalendar]);

  useEffect(() => {
    const timers = events
      .map((event) => {
        const reminderAt = reminderDateTime(event);
        if (!reminderAt) return null;
        const key = reminderKey(event);
        if (remindedKeys.current.has(key)) return null;
        const delay = reminderAt.diff(dayjs());
        if (delay <= 0 || delay > 2_147_483_647) return null;
        return window.setTimeout(() => {
          remindedKeys.current.add(key);
          pushNotification({
            app: '日历',
            title: event.title,
            body: eventReminderBody(event),
          });
        }, delay);
      })
      .filter((timer): timer is number => timer !== null);

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [events, pushNotification]);

  function moveCursor(direction: -1 | 1) {
    const unit = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
    const next = cursor.add(direction, unit);
    setCursor(next);
    setSelectedDate(next);
    setDraft((current) => ({ ...current, date: next.format('YYYY-MM-DD') }));
  }

  function goToday() {
    const today = dayjs();
    setCursor(today);
    setSelectedDate(today);
    setEditingId(null);
    setDraft(emptyDraft(today));
  }

  function selectDate(date: Dayjs) {
    setSelectedDate(date);
    setCursor(date);
    setEditingId(null);
    setDraft(emptyDraft(date));
  }

  function editEvent(event: CalendarEvent) {
    setEditingId(event.id);
    setSelectedDate(dayjs(event.date));
    setCursor(dayjs(event.date));
    setDraft({
      title: event.title,
      date: event.date,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      category: event.category,
      reminderMinutes: event.reminderMinutes,
      notes: event.notes,
    });
  }

  function resetDraft(date = selectedDate) {
    setEditingId(null);
    setDraft(emptyDraft(date));
  }

  function submitEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const input = normalizeDraft(draft);
    if (editingId) {
      updateEvent(editingId, input);
    } else {
      addEvent(input);
    }
    const nextDate = dayjs(input.date);
    setSelectedDate(nextDate);
    setCursor(nextDate);
    resetDraft(nextDate);
  }

  function removeEditingEvent() {
    if (!editingId) return;
    deleteEvent(editingId);
    resetDraft();
  }

  function moveEvent(event: CalendarEvent, nextDate: Dayjs) {
    const duration = Math.max(0, dayjs(event.endDate).diff(dayjs(event.date), 'day'));
    const nextStart = nextDate.format('YYYY-MM-DD');
    updateEvent(event.id, {
      ...event,
      date: nextStart,
      endDate: nextDate.add(duration, 'day').format('YYYY-MM-DD'),
    });
  }

  return (
    <div className="dock-app-window calendar-window">
      <header className="calendar-window__toolbar">
        <div>
          <div className="dock-app-window__eyebrow">日历</div>
          <h2>{formatTitle(cursor, view)}</h2>
          <p className="calendar-window__source">{holidayStatus}</p>
        </div>
        <div className="calendar-window__actions">
          <button type="button" className="calendar-window__nav" onClick={() => moveCursor(-1)}>
            ‹
          </button>
          <button type="button" className="calendar-window__today" onClick={goToday}>
            今天
          </button>
          <button type="button" className="calendar-window__nav" onClick={() => moveCursor(1)}>
            ›
          </button>
          <div className="calendar-window__segments">
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((item) => (
              <button
                key={item}
                type="button"
                className={view === item ? 'is-active' : ''}
                onClick={() => setView(item)}
              >
                {VIEW_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="calendar-window__layout">
        <main className="calendar-window__main">
          {view === 'month' ? (
            <MonthView
              cursor={cursor}
              selectedDate={selectedDate}
              events={events}
              holidayCalendars={holidayCalendars}
              onSelectDate={selectDate}
              onMoveEvent={moveEvent}
            />
          ) : null}
          {view === 'week' ? (
            <WeekView
              cursor={cursor}
              selectedDate={selectedDate}
              events={events}
              holidayCalendars={holidayCalendars}
              onSelectDate={selectDate}
              onEditEvent={editEvent}
            />
          ) : null}
          {view === 'day' ? (
            <DayView
              date={selectedDate}
              events={selectedEvents}
              holiday={selectedHoliday}
              onEditEvent={editEvent}
            />
          ) : null}
        </main>

        <aside className="calendar-window__sidebar">
          <section className="calendar-window__panel">
            <div className="calendar-window__panel-title">{selectedDate.format('M月D日')}</div>
            {selectedHoliday ? <HolidayPill holiday={selectedHoliday} /> : null}
            {selectedHoliday ? <HolidayDetail holiday={selectedHoliday} /> : null}
            {selectedEvents.length === 0 ? (
              <div className="calendar-window__empty">无日程安排</div>
            ) : (
              <div className="calendar-window__event-list">
                {selectedEvents.map((event) => (
                  <EventButton key={event.id} event={event} onClick={() => editEvent(event)} />
                ))}
              </div>
            )}
          </section>

          <form className="calendar-window__form" onSubmit={submitEvent}>
            <div className="calendar-window__panel-title">
              {editingId ? '编辑日程' : '新建日程'}
            </div>
            <label className="calendar-field">
              <span>标题</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
                required
              />
            </label>
            <label className="calendar-field">
              <span>日期</span>
              <input
                type="date"
                value={draft.date}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    date: e.target.value,
                    endDate: current.endDate < e.target.value ? e.target.value : current.endDate,
                  }))
                }
                required
              />
            </label>
            <label className="calendar-field">
              <span>结束日期</span>
              <input
                type="date"
                value={draft.endDate}
                min={draft.date}
                onChange={(e) => setDraft((current) => ({ ...current, endDate: e.target.value }))}
                required
              />
            </label>
            <label className="calendar-check">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    allDay: e.target.checked,
                  }))
                }
              />
              <span>全天</span>
            </label>
            <div className="calendar-window__time-row">
              <label className="calendar-field">
                <span>开始</span>
                <input
                  type="time"
                  value={draft.startTime}
                  disabled={draft.allDay}
                  onChange={(e) =>
                    setDraft((current) => ({ ...current, startTime: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="calendar-field">
                <span>结束</span>
                <input
                  type="time"
                  value={draft.endTime}
                  disabled={draft.allDay}
                  onChange={(e) => setDraft((current) => ({ ...current, endTime: e.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="calendar-window__time-row">
              <label className="calendar-field">
                <span>分类</span>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      category: e.target.value as CalendarEventCategory,
                    }))
                  }
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="calendar-field">
                <span>提醒</span>
                <select
                  value={draft.reminderMinutes ?? 'none'}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      reminderMinutes: parseReminderValue(e.target.value),
                    }))
                  }
                >
                  {REMINDER_OPTIONS.map((option) => (
                    <option key={option.value ?? 'none'} value={option.value ?? 'none'}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="calendar-field">
              <span>备注</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))}
              />
            </label>
            <div className="calendar-window__form-actions">
              {editingId ? (
                <button
                  type="button"
                  className="calendar-window__delete"
                  onClick={removeEditingEvent}
                >
                  删除
                </button>
              ) : null}
              <button type="button" className="calendar-window__ghost" onClick={() => resetDraft()}>
                取消
              </button>
              <button type="submit" className="dock-app-window__button">
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function MonthView({
  cursor,
  selectedDate,
  events,
  holidayCalendars,
  onSelectDate,
  onMoveEvent,
}: {
  cursor: Dayjs;
  selectedDate: Dayjs;
  events: CalendarEvent[];
  holidayCalendars: Parameters<typeof getHolidayInfoForDate>[0];
  onSelectDate: (date: Dayjs) => void;
  onMoveEvent: (event: CalendarEvent, date: Dayjs) => void;
}) {
  const days = monthGrid(cursor);

  return (
    <div className="calendar-month">
      <div className="calendar-month__weekdays">
        {WEEK_DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month__grid">
        {days.map((date) => {
          const dayEvents = eventsForDate(events, date);
          const holiday = getHolidayInfoForDate(holidayCalendars, date.format('YYYY-MM-DD'));
          return (
            <button
              key={date.format('YYYY-MM-DD')}
              type="button"
              className={[
                'calendar-day-cell',
                date.month() !== cursor.month() ? 'is-muted' : '',
                date.isSame(dayjs(), 'day') ? 'is-today' : '',
                date.isSame(selectedDate, 'day') ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(date)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const eventId = event.dataTransfer.getData('text/calendar-event-id');
                const draggedEvent = events.find((item) => item.id === eventId);
                if (draggedEvent) onMoveEvent(draggedEvent, date);
              }}
            >
              <span className="calendar-day-cell__head">
                <span className="calendar-day-cell__num">{date.date()}</span>
                {holiday ? <HolidayBadge holiday={holiday} /> : null}
              </span>
              {holiday ? (
                <span className="calendar-day-cell__holiday" title={holiday.name}>
                  {compactHolidayName(holiday)}
                </span>
              ) : null}
              <span className="calendar-day-cell__events">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    draggable
                    className={`calendar-day-cell__event calendar-day-cell__event--${event.category}`}
                    title={eventTitle(event)}
                    onDragStart={(dragEvent) => {
                      dragEvent.dataTransfer.setData('text/calendar-event-id', event.id);
                      dragEvent.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    {eventChipLabel(event)}
                  </span>
                ))}
                {dayEvents.length > 2 ? <span>+{dayEvents.length - 2}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  selectedDate,
  events,
  holidayCalendars,
  onSelectDate,
  onEditEvent,
}: {
  cursor: Dayjs;
  selectedDate: Dayjs;
  events: CalendarEvent[];
  holidayCalendars: Parameters<typeof getHolidayInfoForDate>[0];
  onSelectDate: (date: Dayjs) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  const start = weekStart(cursor);
  const days = Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));

  return (
    <div className="calendar-week">
      <div className="calendar-week__header">
        <div className="calendar-week__corner" />
        {days.map((date, index) => (
          <button
            key={date.format('YYYY-MM-DD')}
            type="button"
            className={`calendar-week__date ${date.isSame(selectedDate, 'day') ? 'is-selected' : ''}`}
            onClick={() => onSelectDate(date)}
          >
            <span>{WEEK_DAYS[index]}</span>
            <strong>{date.date()}</strong>
          </button>
        ))}
      </div>

      <div className="calendar-week__all-day">
        <span className="calendar-week__all-day-label">全天</span>
        {days.map((date) => {
          const dateKey = date.format('YYYY-MM-DD');
          const holiday = getHolidayInfoForDate(holidayCalendars, dateKey);
          const allDayEvents = eventsForDate(events, date).filter(
            (event) => event.allDay || event.date !== event.endDate,
          );
          return (
            <div key={dateKey} className="calendar-week__all-day-cell">
              {holiday ? <HolidayPill holiday={holiday} compact /> : null}
              {allDayEvents.slice(0, 2).map((event) => (
                <button
                  type="button"
                  key={event.id}
                  className={`calendar-week__all-day-event calendar-week__all-day-event--${event.category}`}
                  title={eventTitle(event)}
                  onClick={() => onEditEvent(event)}
                >
                  {event.title}
                </button>
              ))}
              {allDayEvents.length > 2 ? (
                <span className="calendar-week__more">+{allDayEvents.length - 2}</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="calendar-week__timeline">
        <div className="calendar-week__time-axis">
          {WEEK_HOURS.map((hour) => (
            <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
          ))}
        </div>
        {days.map((date) => (
          <div
            key={date.format('YYYY-MM-DD')}
            className={`calendar-week__column ${
              date.isSame(selectedDate, 'day') ? 'is-selected' : ''
            }`}
            onClick={() => onSelectDate(date)}
          >
            {WEEK_HOURS.map((hour) => (
              <div key={hour} className="calendar-week__hour" />
            ))}
            {eventsForDate(events, date)
              .filter((event) => !event.allDay && event.date === event.endDate)
              .map((event) => (
                <WeekTimedEvent key={event.id} event={event} onClick={() => onEditEvent(event)} />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekTimedEvent({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`calendar-week__event calendar-week__event--${event.category}`}
      style={weekEventStyle(event)}
      title={eventTitle(event)}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
    >
      <strong>{event.title}</strong>
      <span>{eventTimeLabel(event)}</span>
    </button>
  );
}

function DayView({
  date,
  events,
  holiday,
  onEditEvent,
}: {
  date: Dayjs;
  events: CalendarEvent[];
  holiday: CalendarHolidayInfo | null;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  return (
    <div className="calendar-day">
      <div className="calendar-day__date">
        <span>{WEEK_DAYS[(date.day() + 6) % 7]}</span>
        <strong>{date.format('M月D日')}</strong>
        {holiday ? <HolidayPill holiday={holiday} /> : null}
      </div>
      <div className="calendar-day__timeline">
        {Array.from({ length: 12 }, (_, index) => 8 + index).map((hour) => (
          <div key={hour} className="calendar-day__slot">
            <span>{String(hour).padStart(2, '0')}:00</span>
          </div>
        ))}
        <div className="calendar-day__stack">
          {events.map((event) => (
            <EventButton key={event.id} event={event} onClick={() => onEditEvent(event)} />
          ))}
          {events.length === 0 ? <div className="calendar-window__empty">无日程安排</div> : null}
        </div>
      </div>
    </div>
  );
}

function HolidayBadge({ holiday }: { holiday: CalendarHolidayInfo }) {
  return (
    <span className={`calendar-holiday-badge calendar-holiday-badge--${holiday.kind}`}>
      {holiday.kind === 'workday' ? '班' : '休'}
    </span>
  );
}

function compactHolidayName(holiday: CalendarHolidayInfo) {
  if (holiday.kind === 'workday') return '补班';
  if (holiday.kind === 'weekend') return '周末';
  return holiday.name.length > 4 ? `${holiday.name.slice(0, 4)}…` : holiday.name;
}

function HolidayPill({
  holiday,
  compact = false,
}: {
  holiday: CalendarHolidayInfo;
  compact?: boolean;
}) {
  return (
    <div
      className={`calendar-holiday-pill calendar-holiday-pill--${holiday.kind} ${
        compact ? 'is-compact' : ''
      }`}
    >
      <HolidayBadge holiday={holiday} />
      <span>{holiday.name}</span>
    </div>
  );
}

function HolidayDetail({ holiday }: { holiday: CalendarHolidayInfo }) {
  return (
    <div className="calendar-window__holiday-detail">
      <strong>{holidayKindLabel(holiday)}</strong>
      <span>{holiday.name}</span>
    </div>
  );
}

function holidayKindLabel(holiday: CalendarHolidayInfo) {
  if (holiday.kind === 'workday') return '上班日';
  return '休息日';
}

function EventButton({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`calendar-event calendar-event--${event.category}`}
      onClick={onClick}
      title={eventTitle(event)}
    >
      <span className="calendar-event__time">{eventTimeLabel(event)}</span>
      <strong>{event.title}</strong>
      <span className="calendar-event__meta">
        {CATEGORY_LABELS[event.category]}
        {event.reminderMinutes !== null ? ` · ${reminderLabel(event.reminderMinutes)}` : ''}
      </span>
      {event.notes ? <span className="calendar-event__notes">{event.notes}</span> : null}
    </button>
  );
}

function eventsForDate(events: CalendarEvent[], date: Dayjs) {
  const key = date.format('YYYY-MM-DD');
  return events
    .filter((event) => event.date <= key && event.endDate >= key)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startTime.localeCompare(b.startTime);
    });
}

function monthGrid(cursor: Dayjs) {
  const first = cursor.startOf('month');
  const offset = (first.day() + 6) % 7;
  const start = first.subtract(offset, 'day');
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'));
}

function weekStart(date: Dayjs) {
  return date.subtract((date.day() + 6) % 7, 'day');
}

function formatTitle(date: Dayjs, view: CalendarView) {
  if (view === 'day') return date.format('YYYY年M月D日');
  if (view === 'week') {
    const start = weekStart(date);
    const end = start.add(6, 'day');
    return `${start.format('M月D日')} - ${end.format('M月D日')}`;
  }
  return date.format('YYYY年M月');
}

function visibleDatesForView(cursor: Dayjs, selectedDate: Dayjs, view: CalendarView) {
  if (view === 'month') return monthGrid(cursor);
  if (view === 'week') {
    const start = weekStart(cursor);
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
  }
  return [selectedDate];
}

function holidayStatusText(
  years: number[],
  loadingYears: Record<number, boolean>,
  errorYears: Record<number, string>,
) {
  const loading = years.some((year) => loadingYears[year]);
  if (loading) return '节假日加载中';
  const failed = years.find((year) => errorYears[year]);
  if (failed) return `${failed} 年节假日不可用`;
  return '中国节假日与周末';
}

function normalizeDraft(input: CalendarEventInput): CalendarEventInput {
  const endDate = input.endDate < input.date ? input.date : input.endDate;
  const allDay = Boolean(input.allDay);
  return {
    ...input,
    title: input.title.trim(),
    notes: input.notes.trim(),
    endDate,
    allDay,
    startTime: allDay ? '00:00' : input.startTime,
    endTime: allDay || input.endTime < input.startTime ? input.startTime : input.endTime,
  };
}

function parseReminderValue(value: string): CalendarReminderMinutes {
  if (value === 'none') return null;
  const minutes = Number(value);
  return minutes === 0 || minutes === 5 || minutes === 10 || minutes === 30 ? minutes : null;
}

function reminderLabel(value: CalendarReminderMinutes) {
  if (value === null) return '不提醒';
  if (value === 0) return '开始时';
  return `提前 ${value} 分钟`;
}

function eventTimeLabel(event: CalendarEvent) {
  const dateRange =
    event.date === event.endDate
      ? ''
      : `${dayjs(event.date).format('M/D')} - ${dayjs(event.endDate).format('M/D')} `;
  if (event.allDay) return `${dateRange}全天`;
  return `${dateRange}${event.startTime} - ${event.endTime}`;
}

function eventChipLabel(event: CalendarEvent) {
  const prefix = event.allDay ? '全天' : event.startTime;
  return `${prefix} ${event.title}`;
}

function eventTitle(event: CalendarEvent) {
  return `${event.title} · ${eventTimeLabel(event)}`;
}

function reminderDateTime(event: CalendarEvent) {
  if (event.reminderMinutes === null) return null;
  const start = dayjs(`${event.date} ${event.allDay ? '09:00' : event.startTime}`);
  return start.subtract(event.reminderMinutes, 'minute');
}

function reminderKey(event: CalendarEvent) {
  return `${event.id}:${event.date}:${event.startTime}:${event.reminderMinutes}`;
}

function eventReminderBody(event: CalendarEvent) {
  if (event.allDay) return `${dayjs(event.date).format('M月D日')} 全天`;
  return `${dayjs(event.date).format('M月D日')} ${event.startTime}`;
}

function weekEventStyle(event: CalendarEvent) {
  const [startHour, startMinute] = event.startTime.split(':').map(Number);
  const [endHour, endMinute] = event.endTime.split(':').map(Number);
  const startMinutes = Math.max(
    0,
    (startHour - WEEK_START_HOUR) * 60 + (Number.isFinite(startMinute) ? startMinute : 0),
  );
  const endMinutes = Math.max(
    startMinutes + 30,
    (endHour - WEEK_START_HOUR) * 60 + (Number.isFinite(endMinute) ? endMinute : 0),
  );
  const maxMinutes = (WEEK_END_HOUR - WEEK_START_HOUR + 1) * 60;
  const top = (Math.min(startMinutes, maxMinutes) / 60) * WEEK_HOUR_HEIGHT;
  const height = (Math.min(endMinutes, maxMinutes) - Math.min(startMinutes, maxMinutes)) / 60;

  return {
    top: `${top}px`,
    minHeight: '28px',
    height: `${Math.max(28, height * WEEK_HOUR_HEIGHT - 4)}px`,
  };
}
