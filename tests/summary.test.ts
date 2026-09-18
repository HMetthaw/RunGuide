import { expect, it } from "vitest";
import { runSummary } from "../src/domain/summary";
import type { Run } from "../src/types/models";

function run(date: Date, distanceMeters: number, durationSeconds: number): Run {
  return {
    id: crypto.randomUUID(),
    startedAt: date.toISOString(),
    finishedAt: date.toISOString(),
    distanceMeters,
    durationSeconds,
    goal: { distanceKm: 5, durationMinutes: 30 },
    trace: [],
    plannedRoute: [],
    quality: { gaps: 0, rejectedFixes: 0 },
    feedback: "",
  };
}
it("counts local Monday through now, excludes previous week and future runs, and weights pace by distance", () => {
  const now = new Date(2026, 8, 18, 12);
  const runs = [
    run(new Date(2026, 8, 13, 23, 59), 9000, 900),
    run(new Date(2026, 8, 14, 0), 1000, 300),
    run(new Date(2026, 8, 16), 3000, 1800),
    run(new Date(2026, 8, 19), 8000, 1000),
  ];
  const summary = runSummary(runs, "week", now);
  expect(summary.count).toBe(2);
  expect(summary.meters).toBe(4000);
  expect(summary.pace).toBe(525);
  expect(summary.buckets.map((b) => b.meters)).toEqual([
    1000, 0, 3000, 0, 0, 0, 0,
  ]);
});
it("groups the full calendar month, including its final days, without filling empty activity", () => {
  const now = new Date(2026, 9, 31, 23, 59);
  const runs = [
    run(new Date(2026, 8, 30), 5000, 1000),
    run(new Date(2026, 9, 1), 2000, 600),
    run(new Date(2026, 9, 31), 6000, 1800),
  ];
  expect(runSummary(runs, "month", now).buckets.map((b) => b.meters)).toEqual([
    2000, 0, 0, 0, 6000,
  ]);
  expect(runSummary([], "month", now).pace).toBeNull();
});
