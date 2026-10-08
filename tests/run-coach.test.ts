import { describe, expect, it } from "vitest";
import { coachingMessage, goalTrend, RunCoach } from "../src/domain/run-coach";
import { averagePace, runProgress } from "../src/domain/run-progress";
import { Runner } from "../src/domain/runner";
import type { CoachingSnapshot, GoalTrend } from "../src/types/coaching";

const testSettings = {
  current: { enabled: true, intervalSeconds: 60 },
  average: { enabled: true, intervalSeconds: 120 },
};
const goal = { distanceKm: 2, durationMinutes: 12 };
const epoch = 1789580000000;
function snapshot(
  activeSeconds: number,
  overrides: Partial<CoachingSnapshot> = {},
): CoachingSnapshot {
  return {
    phase: "running",
    goal,
    activeSeconds,
    meters: (activeSeconds * 1000) / 360,
    currentPace: 360,
    gpsReliable: true,
    traceIncomplete: false,
    ...overrides,
  };
}

describe("whole-run progress", () => {
  it("uses active time over total distance, not an average of pace samples", () => {
    // One kilometre in 300 s, then half a kilometre in 300 s.
    expect(averagePace(1500, 600)).toBe(400);
    expect(averagePace(1500, 600)).not.toBe((300 + 600) / 2);
  });

  it.each([
    [0, 0],
    [0, 60],
    [100, 0],
    [-10, 60],
    [100, -1],
    [NaN, 60],
    [100, Infinity],
    [Infinity, 60],
  ])(
    "has no average before measurable progress (%s m, %s s)",
    (meters, seconds) => {
      expect(averagePace(meters, seconds)).toBeNull();
    },
  );

  it("projects arrival and the required remaining pace from the configured goal", () => {
    expect(runProgress(goal, 1000, 420)).toEqual({
      averagePace: 420,
      remainingMeters: 1000,
      remainingSeconds: 300,
      requiredPace: 300,
      projectedRemainingSeconds: 420,
      projectedTotalSeconds: 840,
    });
    expect(runProgress(goal, 0, 0).projectedTotalSeconds).toBeNull();
  });

  it("clamps remaining time and distance after the deadline or distance goal", () => {
    expect(runProgress(goal, 1000, 800)).toMatchObject({
      remainingSeconds: 0,
      requiredPace: null,
      projectedTotalSeconds: 1600,
    });
    expect(runProgress(goal, 2100, 750)).toMatchObject({
      remainingMeters: 0,
      remainingSeconds: 0,
      requiredPace: null,
      projectedRemainingSeconds: 0,
      projectedTotalSeconds: 750,
    });
  });

  it("honors Runner's pause, GPS reacquisition and restore rules for active time", () => {
    const runner = new Runner();
    runner.start(goal, []);
    function feed(seconds: number, meters: number) {
      runner.ingest(
        {
          lat: 49.78 + meters / 111195,
          lng: 18.43,
          accuracy: 5,
          speed: null,
          timestamp: epoch + seconds * 1000,
        },
        epoch + seconds * 1000,
      );
    }
    for (let seconds = 0; seconds <= 60; seconds += 5)
      feed(seconds, seconds * 3);
    runner.pause(epoch + 60000);
    runner.resume();
    feed(300, 1000);
    for (let seconds = 305; seconds <= 360; seconds += 5)
      feed(seconds, 1000 + (seconds - 300) * 3);
    expect(runner.elapsed(epoch + 360000)).toBe(120);
    expect(
      averagePace(runner.meters, runner.elapsed(epoch + 360000)),
    ).toBeCloseTo(333.33, 1);
    const restored = new Runner();
    restored.restore(runner.checkpoint(epoch + 360000));
    expect(
      averagePace(restored.meters, restored.elapsed(epoch + 999000)),
    ).toBeCloseTo(333.33, 1);
  });
});

describe("coaching decisions", () => {
  it("reports the configured whole-run average independently of current movement", () => {
    const coach = new RunCoach({
      current: { enabled: false, intervalSeconds: 30 },
      average: { enabled: true, intervalSeconds: 90 },
    });
    const advice = coach.advise(
      snapshot(90, { currentPace: null, meters: 300 }),
    );
    expect(advice).toMatchObject({ kind: "progress", pace: 300 });
    expect(coachingMessage(advice!, String)).not.toContain("Aktuální tempo");
  });

  it("waits for active time, distance, running phase and stable GPS", () => {
    const coach = new RunCoach(testSettings);
    expect(coach.advise(snapshot(59))).toBeNull();
    for (const override of [
      { meters: 0 },

      { gpsReliable: false },
      { activeSeconds: NaN },
      { phase: "paused" as const },
      { phase: "acquiring" as const },
      { phase: "finished" as const },
    ])
      expect(coach.advise(snapshot(120, override))).toBeNull();
    expect(coach.advise(snapshot(60, { currentPace: null }))).toBeNull();
    expect(coach.advise(snapshot(60, { currentPace: NaN }))).toBeNull();
    expect(coach.advise(snapshot(60))?.kind).toBe("current");
  });

  it("independently schedules current pace and merges it with average when both are due", () => {
    const coach = new RunCoach(testSettings);
    for (const seconds of [60, 120, 180, 240]) {
      const advice = coach.advise(snapshot(seconds, { currentPace: 400 }));
      expect(advice).toMatchObject({
        kind: seconds % 120 === 0 ? "progress" : "current",
        pace: seconds % 120 === 0 ? 360 : 400,
      });
      if (seconds % 120 === 0)
        expect(advice).toMatchObject({ currentPace: 400 });
      coach.spoken(advice!, seconds);
      expect(coach.advise(snapshot(seconds + 1))).toBeNull();
    }
  });

  it.each([
    [300, "ahead"],
    [360, "on-track"],
    [400, "behind"],
  ] as const)(
    "assesses average %s against the distance/time target",
    (pace, assessment) => {
      const advice = new RunCoach(testSettings).advise(
        snapshot(120, { meters: 120000 / pace }),
      );
      expect(advice).toMatchObject({ kind: "progress", pace, assessment });
    },
  );

  it("retries speech suppressed by navigation without consuming the interval", () => {
    const coach = new RunCoach(testSettings);
    const pending = coach.advise(snapshot(120));
    expect(pending?.kind).toBe("progress");
    expect(coach.advise(snapshot(125))?.kind).toBe("progress");
    coach.spoken(pending!, 125);
    expect(coach.advise(snapshot(180))).toBeNull();
    expect(coach.advise(snapshot(185))?.kind).toBe("current");
  });

  it("does not spend the interval during pauses or announce a burst after resume", () => {
    const coach = new RunCoach(testSettings);
    coach.spoken(coach.advise(snapshot(120))!, 120);
    expect(coach.advise(snapshot(120, { phase: "paused" }))).toBeNull();
    coach.resume(120);
    expect(coach.advise(snapshot(140))).toBeNull();
    expect(coach.advise(snapshot(180))?.kind).toBe("current");
  });

  it("keeps a gap or restored recording uncertain even after GPS recovers", () => {
    const coach = new RunCoach(testSettings);
    const advice = coach.advise(snapshot(120, { traceIncomplete: true }));
    expect(advice).toMatchObject({
      assessment: "uncertain",
      traceIncomplete: true,
    });
    coach.spoken(advice!, 120);
    expect(coach.advise(snapshot(240))).toMatchObject({
      assessment: "uncertain",
    });
    coach.reset(240, true);
    expect(coach.advise(snapshot(360))).toMatchObject({
      assessment: "uncertain",
    });
    coach.reset();
    expect(coach.advise(snapshot(120))).toMatchObject({
      assessment: "on-track",
    });
  });

  it.each([false, true])(
    "announces reaching the goal once, incomplete GPS: %s",
    (traceIncomplete) => {
      const coach = new RunCoach(testSettings);
      const completed = coach.advise(
        snapshot(700, { meters: 2000, traceIncomplete }),
      );
      expect(completed).toMatchObject({
        kind: "completion",
        assessment: traceIncomplete ? "uncertain" : "reached",
      });
      if (!traceIncomplete)
        expect(coachingMessage(completed!, String)).toContain(
          "Průměr při dosažení cílové vzdálenosti",
        );
      coach.spoken(completed!, 700);
      const continued = coach.advise(snapshot(900, { meters: 2200 }));
      expect(continued?.kind).toBe("progress");
      expect(coachingMessage(continued!, String)).not.toContain("přidej");
      coach.spoken(continued!, 900);
      coach.resume(900);
      expect(coach.advise(snapshot(1000, { meters: 2500 }))?.kind).toBe(
        "current",
      );
    },
  );

  it("retains a finish delayed by navigation even if the runner stops and the deadline passes", () => {
    const coach = new RunCoach(testSettings);
    coach.spoken(coach.advise(snapshot(690))!, 690);
    expect(coach.advise(snapshot(700, { meters: 2000 }))).toBeNull();
    expect(
      coach.advise(snapshot(730, { meters: 2000, currentPace: null })),
    ).toMatchObject({
      kind: "completion",
      assessment: "reached",
      pace: 350,
    });
  });

  it("does not promise success or encourage catching up after time expires", () => {
    const coach = new RunCoach(testSettings);
    const expired = coach.advise(snapshot(750, { meters: 1800 }));
    expect(expired).toMatchObject({
      kind: "progress",
      assessment: "time-expired",
    });
    coach.spoken(expired!, 750);
    const current = coach.advise(snapshot(810, { meters: 1900 }));
    expect(current).toMatchObject({ kind: "current", timeExpired: true });
    expect(coachingMessage(current!, String)).not.toContain("přidej");
    expect(coach.advise(snapshot(850, { meters: 2000 }))).toMatchObject({
      kind: "completion",
      assessment: "reached-after-time",
    });
  });

  it("uses hysteresis instead of flipping advice near a threshold", () => {
    let previous: GoalTrend | null = null;
    const result = [21, 19, 20, 11, 10, 19, -21, -19, -11, -10].map((delta) => {
      previous = goalTrend(delta, previous);
      return previous;
    });
    expect(result).toEqual([
      "behind",
      "behind",
      "behind",
      "behind",
      "on-track",
      "on-track",
      "ahead",
      "ahead",
      "ahead",
      "on-track",
    ]);
  });

  it("formats both pace messages through the same spoken-pace function and qualifies incomplete data", () => {
    const format = () => "6 minut 0 sekund na kilometr";
    const coach = new RunCoach(testSettings);
    expect(coachingMessage(coach.advise(snapshot(60))!, format)).toContain(
      "Aktuální tempo 6 minut 0 sekund na kilometr.",
    );
    expect(coachingMessage(coach.advise(snapshot(120))!, format)).toContain(
      "Dosavadní průměrné tempo 6 minut 0 sekund na kilometr.",
    );
    const uncertain = coachingMessage(
      coach.advise(snapshot(240, { traceIncomplete: true }))!,
      format,
    );
    expect(uncertain).toContain("Průměrné tempo a splnění cíle");
    expect(uncertain).not.toContain("Dosavadní průměrné tempo 6 minut");
    expect(uncertain).toContain("nelze spolehlivě posoudit");
    expect(uncertain).not.toContain("zvládl");
  });
});
