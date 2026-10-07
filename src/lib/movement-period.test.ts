import { describe, expect, it } from "vitest";
import { coversPeriod, inclusiveCivilRange, movementWindows } from "@/lib/movement-period";

describe("movement windows in Argentina", () => {
  it("uses the current month, Monday-Sunday week, and today from midnight", () => {
    const now = new Date("2026-10-06T15:00:00.000Z");
    const windows = movementWindows(now);

    expect(windows.day).toEqual({ start: new Date("2026-10-06T03:00:00.000Z"), end: new Date("2026-10-07T03:00:00.000Z") });
    expect(windows.week).toEqual({ start: new Date("2026-10-05T03:00:00.000Z"), end: new Date("2026-10-12T03:00:00.000Z") });
    expect(windows.month).toEqual({ start: new Date("2026-10-01T03:00:00.000Z"), end: new Date("2026-11-01T03:00:00.000Z") });
    expect(coversPeriod(new Date("2026-10-06T02:59:59.000Z"), windows.day)).toBe(false);
    expect(coversPeriod(new Date("2026-10-06T02:59:59.000Z"), windows.week)).toBe(true);
  });

  it("starts a Sunday week on the previous Monday, even in the prior month", () => {
    const windows = movementWindows(new Date("2026-10-04T15:00:00.000Z"));
    expect(windows.week).toEqual({ start: new Date("2026-09-28T03:00:00.000Z"), end: new Date("2026-10-05T03:00:00.000Z") });
  });

  it("includes both ends of a civil range in Argentina", () => {
    expect(inclusiveCivilRange("2026-10-04", "2026-10-04")).toEqual({
      start: new Date("2026-10-04T03:00:00.000Z"),
      end: new Date("2026-10-05T03:00:00.000Z"),
    });
    expect(inclusiveCivilRange("2026-10-06", "2026-10-04")).toEqual({
      start: new Date("2026-10-04T03:00:00.000Z"),
      end: new Date("2026-10-07T03:00:00.000Z"),
    });
    expect(inclusiveCivilRange("2026-02-31", "2026-02-31")).toBeNull();
  });

  it("keeps a sale on the next month inside the week and outside the month", () => {
    const windows = movementWindows(new Date("2026-10-31T15:00:00.000Z"));
    const nextMonth = new Date("2026-11-01T13:00:00.000Z");
    expect(coversPeriod(nextMonth, windows.week)).toBe(true);
    expect(coversPeriod(nextMonth, windows.month)).toBe(false);
  });
});
