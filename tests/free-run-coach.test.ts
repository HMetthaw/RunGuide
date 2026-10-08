import { describe, expect, it } from "vitest";
import { FreeRunCoach, freeRunMessage } from "../src/domain/free-run-coach";
import type { FreeRunSnapshot } from "../src/types/free-run";

const snapshot = (
  seconds: number,
  meters: number,
  override: Partial<FreeRunSnapshot> = {},
): FreeRunSnapshot => ({
  phase: "running",
  activeSeconds: seconds,
  meters,
  currentPace: 330,
  gpsReliable: true,
  traceIncomplete: false,
  ...override,
});

describe("free run announcements", () => {
  it("reports only whole-run average when current pace is disabled", () => {
    const coach = new FreeRunCoach({
      current: { enabled: false, intervalSeconds: 30 },
      average: { enabled: true, intervalSeconds: 90 },
    });
    expect(coach.advise(snapshot(30, 100))).toBeNull();
    const advice = coach.advise(snapshot(90, 300, { currentPace: null }));
    expect(advice).toMatchObject({ pace: null, averagePace: 300 });
    expect(freeRunMessage(advice!, String)).toBe(
      "Dosavadní průměrné tempo 300.",
    );
    coach.spoken(advice!, 90);
    expect(coach.advise(snapshot(179, 500))).toBeNull();
    const gap = coach.advise(snapshot(180, 500, { traceIncomplete: true }));
    expect(gap).toMatchObject({
      pace: null,
      averagePace: null,
      averageUncertain: true,
    });
    expect(freeRunMessage(gap!, String)).not.toContain("300");
  });

  it("combines independently due current and average paces in one message", () => {
    const coach = new FreeRunCoach({
      current: { enabled: true, intervalSeconds: 30 },
      average: { enabled: true, intervalSeconds: 60 },
    });
    const first = coach.advise(snapshot(30, 100));
    coach.spoken(first!, 30);
    const both = coach.advise(snapshot(60, 200, { currentPace: 500 }));
    expect(freeRunMessage(both!, String)).toBe(
      "Aktuální tempo 500. Dosavadní průměrné tempo 300.",
    );
  });

  it("waits for smoothed pace and two active minutes", () => {
    const coach = new FreeRunCoach();
    expect(coach.advise(snapshot(120, 360, { currentPace: null }))).toBeNull();
    expect(coach.advise(snapshot(120, 360, { gpsReliable: false }))).toBeNull();
    const advice = coach.advise(snapshot(120, 360));
    expect(advice).toMatchObject({
      kind: "pace",
      pace: 330,
      averagePace: null,
    });
    coach.spoken(advice!, 120);
    expect(coach.advise(snapshot(180, 540))).toBeNull();
    expect(coach.advise(snapshot(240, 720))?.kind).toBe("pace");
  });

  it("reports each kilometer once with its own interpolated split pace", () => {
    const coach = new FreeRunCoach();
    coach.advise(snapshot(330, 990));
    const first = coach.advise(snapshot(340, 1020));
    expect(first).toMatchObject({ kind: "kilometer", kilometer: 1 });
    expect(first?.kind === "kilometer" && first.pace).toBeCloseTo(333.33, 1);
    expect(coach.advise(snapshot(341, 1023))).toEqual(first);
    coach.spoken(first!, 341);
    expect(coach.advise(snapshot(342, 1026))).toBeNull();
    coach.advise(snapshot(670, 1990));
    const second = coach.advise(snapshot(680, 2020));
    expect(second).toMatchObject({ kind: "kilometer", kilometer: 2 });
    expect(second?.kind === "kilometer" && second.pace).toBeCloseTo(340, 1);
  });

  it("does not claim a split pace after a GPS gap or replay one after recovery", () => {
    const coach = new FreeRunCoach();
    coach.reset(300, 900);
    expect(coach.advise(snapshot(320, 960, { phase: "paused" }))).toBeNull();
    coach.resume(300);
    const advice = coach.advise(snapshot(340, 1010, { traceIncomplete: true }));
    expect(advice).toEqual({ kind: "kilometer", kilometer: 1, pace: null });
    expect(freeRunMessage(advice!, String)).toContain("výpadku GPS");
    coach.spoken(advice!, 340);
    coach.reset(340, 1010);
    expect(
      coach.advise(snapshot(341, 1013, { traceIncomplete: true })),
    ).toBeNull();
  });
});
