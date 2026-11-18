import assert from "node:assert/strict";
import test from "node:test";

import { AGING_DAYS, calendarDaysBetween, formatPhoenixISODate, isAging, startOfPhoenixMonth, startOfPhoenixWeek } from "./time";

test("Phoenix calendar dates ignore UTC evening rollover", () => {
  assert.equal(formatPhoenixISODate(new Date("2026-11-18T18:00:00.000Z")), "2026-11-18");
  assert.equal(formatPhoenixISODate(new Date("2026-11-18T06:30:00.000Z")), "2026-11-17");
});

test("weeks start Monday and months start on the first, Arizona time", () => {
  const wednesday = new Date("2026-11-18T18:00:00.000Z");
  assert.equal(startOfPhoenixWeek(wednesday), "2026-11-16");
  assert.equal(startOfPhoenixMonth(wednesday), "2026-11-01");

  const sundayEveningPhoenix = new Date("2026-11-16T06:30:00.000Z");
  assert.equal(formatPhoenixISODate(sundayEveningPhoenix), "2026-11-15");
  assert.equal(startOfPhoenixWeek(sundayEveningPhoenix), "2026-11-09");
});

test("aging starts at 14 full days open", () => {
  assert.equal(calendarDaysBetween("2026-11-04", "2026-11-18"), AGING_DAYS);
  assert.equal(isAging("2026-11-04", "2026-11-18", null), true);
  assert.equal(isAging("2026-11-05", "2026-11-18", null), false);
  assert.equal(isAging("2026-11-01", "2026-11-18", "2026-11-18T18:00:00.000Z"), false);
});
