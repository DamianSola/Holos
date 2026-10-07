const TIME_ZONE = "America/Argentina/Buenos_Aires";

const WEEKDAY_FROM_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type MovementPeriod = "month" | "week" | "day";

export type PeriodWindow = { start: Date; end: Date };

type CalendarDate = { year: number; month: number; day: number };

export function movementWindows(now: Date): Record<MovementPeriod, PeriodWindow> {
  const today = calendarDate(now);
  const weekStart = addDays(today, -weekdayFromMonday(now));
  const nextMonth = today.month === 12
    ? { year: today.year + 1, month: 1, day: 1 }
    : { year: today.year, month: today.month + 1, day: 1 };

  return {
    day: { start: zonedMidnight(today), end: zonedMidnight(addDays(today, 1)) },
    week: { start: zonedMidnight(weekStart), end: zonedMidnight(addDays(weekStart, 7)) },
    month: { start: zonedMidnight({ year: today.year, month: today.month, day: 1 }), end: zonedMidnight(nextMonth) },
  };
}

export function coversPeriod(at: Date, window: PeriodWindow) {
  return at >= window.start && at < window.end;
}

export function inclusiveCivilRange(from: string, to: string): PeriodWindow | null {
  const startDate = civilDate(from);
  const endDate = civilDate(to);
  if (!startDate || !endDate) return null;
  const [first, last] = compareCivil(startDate, endDate) <= 0 ? [startDate, endDate] : [endDate, startDate];
  return { start: zonedMidnight(first), end: zonedMidnight(addDays(last, 1)) };
}

function civilDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  const seen = calendarDate(probe);
  if (seen.year !== year || seen.month !== month || seen.day !== day) return null;
  return { year, month, day };
}

function compareCivil(left: CalendarDate, right: CalendarDate) {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

function calendarDate(instant: Date): CalendarDate {
  const parts = zonedParts(instant);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function weekdayFromMonday(instant: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(instant);
  const index = WEEKDAY_FROM_MONDAY[weekday];
  if (index === undefined) throw new Error(`Día de semana desconocido: ${weekday}`);
  return index;
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function zonedMidnight(date: CalendarDate) {
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0));
  const offset = zoneOffsetMs(utcGuess);
  const instant = new Date(utcGuess.getTime() - offset);
  const corrected = zoneOffsetMs(instant);
  return corrected === offset ? instant : new Date(utcGuess.getTime() - corrected);
}

function zoneOffsetMs(instant: Date) {
  const parts = zonedParts(instant);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

function zonedParts(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let hour = value("hour");
  if (hour === 24) hour = 0;
  return { year: value("year"), month: value("month"), day: value("day"), hour, minute: value("minute"), second: value("second") };
}
