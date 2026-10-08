import { describe, expect, it } from "vitest";
import { PaceSchedule } from "../src/domain/pace-schedule";

const settings = {
  current: { enabled: true, intervalSeconds: 60 },
  average: { enabled: true, intervalSeconds: 90 },
};

describe("independent pace schedules", () => {
  it("uses different intervals and merges only the channels due at the same instant", () => {
    const schedule = new PaceSchedule(settings);
    expect(schedule.due(59)).toEqual({ current: false, average: false });
    const expected = [
      [60, true, false],
      [90, false, true],
      [120, true, false],
      [180, true, true],
    ] as const;
    for (const [seconds, current, average] of expected) {
      const due = schedule.due(seconds);
      expect(due).toEqual({ current, average });
      schedule.spoken(due, seconds);
    }
  });

  it("does not consume intervals for rejected speech or during pauses", () => {
    const schedule = new PaceSchedule(settings);
    expect(schedule.due(60).current).toBe(true);
    expect(schedule.due(65).current).toBe(true);
    schedule.spoken({ current: true, average: false }, 65);
    schedule.resume(80);
    expect(schedule.due(80)).toEqual({ current: false, average: false });
    expect(schedule.due(90)).toEqual({ current: false, average: true });
    expect(schedule.due(125).current).toBe(true);
  });

  it("changes one live interval without resetting the other and can disable both", () => {
    const schedule = new PaceSchedule(settings);
    schedule.configure(
      { ...settings, current: { enabled: true, intervalSeconds: 30 } },
      70,
    );
    expect(schedule.due(90)).toEqual({ current: false, average: true });
    schedule.spoken({ current: false, average: true }, 90);
    expect(schedule.due(100)).toEqual({ current: true, average: false });
    schedule.configure(
      {
        current: { enabled: false, intervalSeconds: 30 },
        average: { enabled: false, intervalSeconds: 90 },
      },
      100,
    );
    expect(schedule.due(1000)).toEqual({ current: false, average: false });
  });
});
