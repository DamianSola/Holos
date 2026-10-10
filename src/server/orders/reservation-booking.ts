import { prisma } from "@/lib/db";
import {
  buenosAiresTime,
  dailyPlaces,
  dayBounds,
  defaultSchedule,
  isoWeekday,
  parseWeekdays,
  slotsOf,
  weekdayList,
  type ReservationMode,
  type ReservationSchedule,
} from "@/lib/reservation-schedule";

type Writer = Pick<typeof prisma, "reservationSchedule" | "customerOrder">;

type Fit = { ok: true; scheduledFor: Date; bookedAs: ReservationMode; place: string | null } | { ok: false; code: string; message: string };

export async function readSchedule(db: Writer, businessId: string): Promise<ReservationSchedule> {
  const row = await db.reservationSchedule.findUnique({ where: { businessId } });
  if (!row) return defaultSchedule;
  return {
    mode: row.mode,
    crewSize: row.crewSize,
    visitsEach: row.visitsEach,
    turnMinutes: row.turnMinutes === 30 || row.turnMinutes === 60 ? row.turnMinutes : null,
    seatsPerTurn: row.seatsPerTurn,
    openTime: row.openTime,
    closeTime: row.closeTime,
    weekdays: parseWeekdays(row.weekdays),
    fixedPlace: row.fixedPlace,
  };
}

export function scheduleRecord(schedule: ReservationSchedule) {
  return {
    mode: schedule.mode,
    crewSize: schedule.crewSize,
    visitsEach: schedule.visitsEach,
    turnMinutes: schedule.turnMinutes,
    seatsPerTurn: schedule.seatsPerTurn,
    openTime: schedule.openTime,
    closeTime: schedule.closeTime,
    weekdays: weekdayList(schedule.weekdays) || "1,2,3,4,5,6,7",
    fixedPlace: schedule.fixedPlace ? schedule.fixedPlace : null,
  };
}

export async function checkReservationFit(db: Writer, input: {
  businessId: string;
  date: string;
  startsAt?: string | null;
  place?: string | null;
  bookedAs?: ReservationMode;
  excludeOrderId?: string;
  occupy: boolean;
}): Promise<Fit> {
  const schedule = await readSchedule(db, input.businessId);
  const bookedAs = input.bookedAs ?? schedule.mode;
  const startsAt = bookedAs === "TURN" ? input.startsAt ?? null : null;
  const typedPlace = input.place?.trim() || null;
  const place = bookedAs === "DATE" ? typedPlace : (schedule.mode === "TURN" && schedule.fixedPlace ? schedule.fixedPlace : typedPlace);
  const scheduledFor = bookedAs === "TURN" && startsAt ? new Date(`${input.date}T${startsAt}:00-03:00`) : new Date(`${input.date}T12:00:00`);

  if (bookedAs === "DATE" && !place) return { ok: false, code: "PLACE_REQUIRED", message: "El lugar es obligatorio." };
  if (!input.occupy) return { ok: true, scheduledFor, bookedAs, place };

  if (schedule.mode === "TURN" && bookedAs === "TURN") {
    const slots = slotsOf(schedule);
    if (!schedule.seatsPerTurn || slots.length === 0) return { ok: false, code: "SCHEDULE_INCOMPLETE", message: "Definí el horario antes de agendar." };
    if (!schedule.weekdays.includes(isoWeekday(input.date))) return { ok: false, code: "CLOSED_DAY", message: "Ese día no hay atención." };
    if (!startsAt || !slots.includes(startsAt)) return { ok: false, code: "INVALID_SLOT", message: "Elegí un horario disponible." };
    const taken = await takenTurns(db, input.businessId, input.date, startsAt, input.excludeOrderId);
    if (taken >= schedule.seatsPerTurn) return { ok: false, code: "TURN_FULL", message: "Ese turno ya está completo." };
    return { ok: true, scheduledFor, bookedAs, place };
  }

  const cap = schedule.mode === "DATE" ? dailyPlaces(schedule.crewSize, schedule.visitsEach) : null;
  if (cap === null) return { ok: true, scheduledFor, bookedAs, place };
  const taken = await takenOnDay(db, input.businessId, input.date, input.excludeOrderId);
  if (taken >= cap) return { ok: false, code: "DAY_FULL", message: "Ese día ya está completo." };
  return { ok: true, scheduledFor, bookedAs, place };
}

async function takenOnDay(db: Writer, businessId: string, date: string, excludeOrderId?: string) {
  const bounds = dayBounds(date);
  return db.customerOrder.count({
    where: {
      businessId,
      kind: "SERVICE",
      status: { not: "CANCELLED" },
      scheduledFor: { gte: bounds.start, lt: bounds.end },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
  });
}

async function takenTurns(db: Writer, businessId: string, date: string, startsAt: string, excludeOrderId?: string) {
  const bounds = dayBounds(date);
  const rows = await db.customerOrder.findMany({
    where: {
      businessId,
      kind: "SERVICE",
      bookedAs: "TURN",
      status: { not: "CANCELLED" },
      scheduledFor: { gte: bounds.start, lt: bounds.end },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { scheduledFor: true },
  });
  return rows.filter((row) => buenosAiresTime(row.scheduledFor) === startsAt).length;
}
