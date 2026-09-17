import { describe, expect, it } from "vitest";
import { Runner } from "../src/domain/runner";
import { distance } from "../src/domain/geo";
import { formatPace, paceAdvice, remainingTime } from "../src/domain/pace";
import { Navigator } from "../src/domain/navigation";
import type { Fix } from "../src/types/models";

const epoch = 1789580000000;
const goal = { distanceKm: 5, durationMinutes: 30 };
const fix = (seconds: number, meters = seconds * 3, accuracy = 5): Fix => ({
  lat: 49.78 + meters / 111195,
  lng: 18.43,
  timestamp: epoch + seconds * 1000,
  accuracy,
  speed: null,
});
function feed(
  runner: Runner,
  seconds: number,
  meters = seconds * 3,
  accuracy = 5,
) {
  const p = fix(seconds, meters, accuracy);
  return runner.ingest(p, p.timestamp);
}
function running() {
  const runner = new Runner();
  runner.start(goal, []);
  return runner;
}

describe("GPS run lifecycle", () => {
  it("starts the clock only when a good fresh GPS fix is available", () => {
    const runner = running();
    feed(runner, 0, 0, 120);
    expect(runner.phase).toBe("acquiring");
    expect(runner.elapsed(epoch + 30000)).toBe(0);
    feed(runner, 30);
    expect(runner.elapsed(epoch + 40000)).toBe(10);
  });
  it("measures real GPS distance and saves actual trace separately from plan", () => {
    const runner = new Runner();
    runner.start(goal, [
      { lat: 50, lng: 14 },
      { lat: 50.1, lng: 14 },
    ]);
    for (let i = 0; i <= 60; i++) feed(runner, i);
    expect(runner.meters).toBeCloseTo(180, 0);
    expect(runner.currentPace(epoch + 60000)).toBeCloseTo(333.33, 0);
    const run = runner.finish(epoch + 60000)!;
    expect(run.trace[0].lat).toBe(49.78);
    expect(run.plannedRoute[0].lat).toBe(50);
    expect(run.durationSeconds).toBe(60);
  });
  it("does not accumulate stationary jitter", () => {
    const runner = running();
    for (let i = 0; i <= 120; i++) feed(runner, i, (i % 3) - 1, 10);
    expect(runner.meters).toBe(0);
    expect(runner.currentPace(epoch + 120000)).toBeNull();
  });
  it("rejects poor accuracy, teleportation, future and duplicate fixes", () => {
    const runner = running();
    feed(runner, 0);
    expect(feed(runner, 1, 2000)).toBe("jump");
    expect(feed(runner, 2, 6, 100)).toBe("weak");
    expect(feed(runner, 3, 9)).toBe("accepted");
    expect(feed(runner, 3, 9)).toBe("stale");
    expect(runner.ingest(fix(30), epoch + 4000)).toBe("stale");
    expect(runner.meters).toBeCloseTo(9, 0);
  });
  it("does not bridge a gap in GPS and suppresses stale pace", () => {
    const runner = running();
    for (let i = 0; i <= 40; i++) feed(runner, i);
    const before = runner.meters;
    expect(runner.currentPace(epoch + 60000)).toBeNull();
    feed(runner, 100, 900);
    expect(runner.meters).toBe(before);
    expect(runner.gaps).toBe(1);
    expect(runner.trace.at(-1)!.segment).toBe(1);
    expect(runner.currentPace(epoch + 100000)).toBeNull();
  });
  it("excludes pauses and reconnecting GPS from elapsed time and distance", () => {
    const runner = running();
    for (let i = 0; i <= 30; i++) feed(runner, i);
    runner.pause(epoch + 30000);
    expect(feed(runner, 50, 500)).toBe("ignored");
    runner.resume();
    feed(runner, 130, 1000);
    feed(runner, 140, 1030);
    expect(runner.elapsed(epoch + 140000)).toBe(40);
    expect(runner.meters).toBeCloseTo(120, 0);
  });
  it("restores a interrupted run paused without counting time away", () => {
    const runner = running();
    for (let i = 0; i <= 30; i++) feed(runner, i);
    runner.navigationNext = 4;
    const restored = new Runner();
    restored.restore(runner.checkpoint(epoch + 30000));
    expect(restored.phase).toBe("paused");
    expect(restored.elapsed(epoch + 86400000)).toBe(30);
    expect(restored.navigationNext).toBe(4);
    restored.resume();
    feed(restored, 100, 500);
    expect(restored.meters).toBeCloseTo(90, 0);
  });
  it("current pace responds to a speed change rather than using whole-run average", () => {
    const runner = running();
    for (let i = 0; i <= 120; i++) feed(runner, i, i * 4);
    for (let i = 121; i <= 180; i++) feed(runner, i, 480 + (i - 120) * 2);
    expect(runner.currentPace(epoch + 180000)).toBeCloseTo(500, -1);
    expect((runner.elapsed(epoch + 180000) * 1000) / runner.meters).toBeCloseTo(
      300,
      0,
    );
  });
  it("does not save an empty run and can start again cleanly", () => {
    const runner = running();
    expect(runner.finish(epoch)).toBeNull();
    runner.start(goal, []);
    expect(runner.phase).toBe("acquiring");
    expect(runner.meters).toBe(0);
  });
  it("does not tell a stationary runner to accelerate from a stale pace", () => {
    const runner = running();
    for (let i = 0; i <= 60; i++) feed(runner, i);
    for (let i = 61; i <= 80; i++) feed(runner, i, 180);
    expect(runner.currentPace(epoch + 80000)).toBeNull();
  });
});

describe("pace and route guidance", () => {
  it("recovers at a following waypoint after GPS misses one without skipping a loop at the start", () => {
    const a = fix(0, 0),
      b = fix(0, 100),
      c = { ...b, lng: b.lng + 0.002 };
    const nav = new Navigator([a, b, c, a]);
    nav.update(a, epoch);
    nav.update(a, epoch + 1000);
    expect(nav.next).toBe(1);
    nav.update(c, epoch + 30000);
    expect(nav.next).toBe(3);
    expect(nav.update(a, epoch + 60000)).toContain("poslednímu");
  });
  it("rounds pace without producing 5:60", () => {
    expect(formatPace(359.9)).toBe("6:00");
    expect(formatPace(NaN)).toBe("—");
  });
  it("respects settling time, pace thresholds, and advice cooldown", () => {
    expect(paceAdvice(300, 360, 20, epoch, 0)).toBeNull();
    expect(paceAdvice(300, 360, 70, epoch, epoch - 20000)).toBeNull();
    expect(paceAdvice(330, 360, 70, epoch, 0)).toBe("fast");
    expect(paceAdvice(390, 360, 70, epoch, 0)).toBe("slow");
    expect(paceAdvice(375, 360, 70, epoch, 0)).toBe("on-target");
  });
  it("handles a missed time target without negative remaining times", () => {
    expect(remainingTime(goal, 2000, 1900)).toEqual({
      remainingMeters: 3000,
      remainingSeconds: 0,
      requiredPace: null,
    });
  });
  it("preserves start/finish order on a loop and gives turn from route geometry", () => {
    const a = fix(0, 0),
      b = fix(0, 100),
      c = { ...b, lng: b.lng + 0.001 };
    const nav = new Navigator([a, b, c, a]);
    nav.update(a, epoch);
    expect(nav.next).toBe(1);
    expect(nav.update(fix(20, 45), epoch + 20000)).toContain("doprava");
    expect(nav.update(fix(21, 48), epoch + 21000)).toBeNull();
    expect(nav.next).toBe(1);
    expect(distance(a, b)).toBeCloseTo(100, 0);
  });
});
