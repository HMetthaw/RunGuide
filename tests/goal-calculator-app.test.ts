// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { LocalRepository } from "../src/services/storage";

vi.mock("../src/services/map", () => ({
  RouteMap: class {
    setRoute() {}
    setTrace() {}
    resize() {}
    locate() {}
  },
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
function edit(id: string, value: string) {
  field(id).value = value;
  field(id).dispatchEvent(new Event("input"));
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("blocks invalid pace, starts with the precise goal and locks pace editing for the run", async () => {
  vi.useFakeTimers();
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  const watch = vi.fn<(success: PositionCallback) => number>(() => 1);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: watch, clearWatch: vi.fn() },
  });
  await import("../src/main");
  await vi.advanceTimersByTimeAsync(0);

  edit("goal-distance", "2");
  edit("goal-pace-minutes", "5");
  edit("goal-pace-seconds", "50");
  expect(field("target-pace").textContent).toBe("5:50");
  expect(field("start-run").disabled).toBe(false);
  edit("goal-pace-seconds", "60");
  expect(field("start-run").disabled).toBe(true);
  expect(field("target-pace").textContent).toBe("—");
  expect(field("run-preparation-summary").textContent).toContain("tempo");
  field("start-run").click();
  await vi.advanceTimersByTimeAsync(0);
  expect(watch).not.toHaveBeenCalled();

  edit("goal-pace-seconds", "50");
  field("start-run").click();
  await vi.advanceTimersByTimeAsync(0);
  expect(watch).toHaveBeenCalledOnce();
  expect(field("goal-pace-minutes").matches(":disabled")).toBe(true);
  expect(field("goal-pace-seconds").matches(":disabled")).toBe(true);
  watch.mock.calls[0][0]({
    coords: {
      latitude: 50,
      longitude: 14,
      accuracy: 5,
      speed: null,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  });
  field("pause-run").click();
  await vi.advanceTimersByTimeAsync(0);
  expect(new LocalRepository(localStorage).draft()!.goal).toEqual({
    distanceKm: 2,
    durationMinutes: 700 / 60,
  });
});
