export type ReservationMode = "DATE" | "TURN";

export type ReservationSchedule = {
  mode: ReservationMode;
  crewSize: number | null;
  visitsEach: number | null;
  turnMinutes: 30 | 60 | null;
  seatsPerTurn: number | null;
  openTime: string | null;
  closeTime: string | null;
  weekdays: number[];
  fixedPlace: string | null;
};

export const defaultSchedule: ReservationSchedule = {
  mode: "DATE",
  crewSize: null,
  visitsEach: null,
  turnMinutes: null,
  seatsPerTurn: null,
  openTime: null,
  closeTime: null,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  fixedPlace: null,
};

export function dailyPlaces(crewSize: number | null, visitsEach: number | null) {
  if (crewSize === null || visitsEach === null) return null;
  return crewSize * visitsEach;
}

export function minutesOf(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function clock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function slotTimes(open: string, close: string, step: number) {
  const start = minutesOf(open);
  const end = minutesOf(close);
  if (start === null || end === null || (step !== 30 && step !== 60) || start >= end) return [];
  if (start % step !== 0 || end % step !== 0) return [];
  const slots: string[] = [];
  for (let cursor = start; cursor + step <= end; cursor += step) slots.push(clock(cursor));
  return slots;
}

export function slotsOf(schedule: Pick<ReservationSchedule, "openTime" | "closeTime" | "turnMinutes">) {
  if (!schedule.openTime || !schedule.closeTime || !schedule.turnMinutes) return [];
  return slotTimes(schedule.openTime, schedule.closeTime, schedule.turnMinutes);
}

export function isoWeekday(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function dayBounds(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextKey = next.toISOString().slice(0, 10);
  return { start: new Date(`${key}T00:00:00-03:00`), end: new Date(`${nextKey}T00:00:00-03:00`) };
}

export function buenosAiresDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function buenosAiresTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function parseWeekdays(value: string) {
  const days = value.split(",").map((item) => Number(item)).filter((item) => item >= 1 && item <= 7);
  return [...new Set(days)].sort((left, right) => left - right);
}

export function weekdayList(days: number[]) {
  return [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((left, right) => left - right).join(",");
}
