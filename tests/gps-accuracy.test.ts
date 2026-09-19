import { describe, expect, it } from "vitest";
import { Runner } from "../src/domain/runner";
import { routeDistance } from "../src/domain/geo";
import type { Fix } from "../src/types/models";

const epoch = 1789580000000;
const fix = (
  seconds: number,
  north: number,
  speed: number | null = null,
): Fix => ({
  lat: 49.78 + north / 111195,
  lng: 18.43,
  timestamp: epoch + seconds * 1000,
  accuracy: 5,
  speed,
});
function start() {
  const runner = new Runner();
  runner.start({ distanceKm: 5, durationMinutes: 30 }, []);
  return runner;
}
function ingest(runner: Runner, point: Fix) {
  return runner.ingest(point, point.timestamp);
}

describe("GPS distance accuracy", () => {
  it("rejects a sudden jump after standing still using the latest trusted fix", () => {
    const runner = start();
    for (let i = 0; i < 9; i++) ingest(runner, fix(i, 0));
    expect(ingest(runner, fix(9, 50))).toBe("jump");
    expect(runner.meters).toBe(0);
    expect(ingest(runner, fix(10, 0))).toBe("jitter");
    expect(runner.meters).toBe(0);
  });

  it("does not count small GPS oscillations when the phone reports it is stationary", () => {
    const runner = start();
    for (let i = 0; i <= 120; i++) ingest(runner, fix(i, i % 2 ? 2 : -2, 0));
    expect(runner.meters).toBe(0);
    expect(runner.currentPace(epoch + 120000)).toBeNull();
    expect(runner.gaps).toBe(0);
  });

  it("does not report a GPS gap when frequent stationary fixes stay below the movement threshold", () => {
    const runner = start();
    for (let i = 0; i <= 60; i++) ingest(runner, fix(i * 8, 0));
    expect(runner.gaps).toBe(0);
    expect(runner.meters).toBe(0);
    expect(runner.trace).toHaveLength(1);
  });

  it("rejects impossible speeds and counts a silent outage once without waiting for recovery", () => {
    const runner = start();
    expect(ingest(runner, fix(0, 0, 30))).toBe("jump");
    expect(runner.phase).toBe("acquiring");
    expect(runner.elapsed(epoch + 1000)).toBe(0);
    ingest(runner, fix(1, 0, 3));
    ingest(runner, fix(2, 3, 3));
    for (let i = 20; i < 30; i++) ingest(runner, fix(i, 60, 30));
    expect(runner.gaps).toBe(1);
    expect(runner.interruption?.reason).toBe("gps-timeout");
    ingest(runner, fix(30, 90, 3));
    expect(runner.gaps).toBe(1);
    expect(runner.meters).toBe(0);
    expect(runner.trace.at(-1)?.segment).toBe(1);
  });

  it("does not permanently suppress movement when the speed sensor is stuck at zero", () => {
    const runner = start();
    for (let i = 0; i <= 60; i++) ingest(runner, fix(i, i * 3, 0));
    expect(runner.meters).toBeCloseTo(180, 0);
    expect(runner.currentPace(epoch + 60000)).toBeCloseTo(1000 / 3, 0);
  });

  it.each([5280, 42195])(
    "keeps clean %i m runs within one uncommitted GPS step, with or without speed",
    (meters) => {
      for (const speed of [null, 3]) {
        const runner = start();
        for (let i = 0; i <= meters / 3; i++)
          ingest(runner, fix(i, i * 3, speed));
        const expected = routeDistance([fix(0, 0), fix(meters / 3, meters)]);
        expect(Math.abs(runner.meters - expected)).toBeLessThan(3.5);
        const completed = runner.finish(epoch + (meters / 3) * 1000)!;
        expect(completed.distanceMeters).toBe(runner.meters);
        expect(completed.quality).toEqual({
          rejectedFixes: 0,
          gaps: 0,
          untrackedSeconds: 0,
          recoveryUncertain: false,
        });
      }
    },
  );

  it("preserves corners and a return along the same path with accurate fixes", () => {
    const runner = start();
    const points = Array.from({ length: 161 }, (_, i) => {
      const north = i <= 40 ? i * 3 : i <= 120 ? 120 : (160 - i) * 3;
      const east =
        i <= 40 || i >= 120 ? 0 : i <= 80 ? (i - 40) * 3 : (120 - i) * 3;
      return {
        ...fix(i, north, 3),
        lng: 18.43 + east / (111195 * Math.cos((49.78 * Math.PI) / 180)),
      };
    });
    points.forEach((point) => ingest(runner, point));
    expect(Math.abs(runner.meters - routeDistance(points))).toBeLessThan(0.1);
    expect(runner.rejectedFixes).toBe(0);
  });

  it("keeps stationary filtering separate across pauses and actual signal gaps", () => {
    const runner = start();
    for (let i = 0; i <= 20; i++) ingest(runner, fix(i, i * 3, 3));
    runner.pause(epoch + 20000);
    ingest(runner, fix(30, 600, 0));
    runner.resume();
    for (let i = 40; i <= 60; i++)
      ingest(runner, fix(i, 600 + (i % 2 ? 2 : -2), 0));
    expect(runner.meters).toBeCloseTo(60, 0);
    expect(runner.gaps).toBe(0);
    ingest(runner, fix(80, 1000, 3));
    expect(runner.gaps).toBe(1);
    expect(runner.meters).toBeCloseTo(60, 0);
    expect(runner.currentPace(epoch + 80000)).toBeNull();
  });
});
