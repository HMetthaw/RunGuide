// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { LocalRepository } from "../src/services/storage";
import type { Plan, Point } from "../src/types/models";

vi.mock("../src/services/map", () => ({
  RouteMap: class {
    setRoute() {}
    setTrace() {}
    locate() {}
  },
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));

const epoch = 1789580000000;
const point = (east: number, north: number): Point => ({
  lat: 50 + north / 111195,
  lng: 14 + east / (111195 * Math.cos((50 * Math.PI) / 180)),
});
const $ = (id: string) => document.getElementById(id)!;
const flush = () => vi.advanceTimersByTimeAsync(0);

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("speaks a saved route's turns, deviation and return from actual app GPS callbacks with navigation before pace", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(epoch);
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  localStorage.setItem(
    "runguide.pace-settings",
    JSON.stringify({
      current: { enabled: true, intervalSeconds: 76 },
      average: { enabled: false, intervalSeconds: 120 },
    }),
  );
  const points = [point(0, 0), point(0, 240), point(150, 240), point(150, 440)];
  const plan: Plan = {
    id: crypto.randomUUID(),
    name: "Navigační okruh",
    goal: { distanceKm: 2, durationMinutes: 12 },
    points,
    routing: {
      provider: "osrm",
      profile: "foot",
      distanceMeters: 590,
      waypoints: [points[0], points.at(-1)!],
    },
    createdAt: new Date(epoch).toISOString(),
  };
  new LocalRepository(localStorage).savePlan(plan);
  const synth = {
    speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(),
    cancel: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    speaking: false,
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal("isSecureContext", true);
  let success: PositionCallback = () => {
    throw new Error("GPS not started");
  };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn((callback: PositionCallback) => {
        success = callback;
        return 1;
      }),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    },
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  await import("../src/main");
  await flush();
  const select = $("saved-routes") as HTMLSelectElement;
  select.value = plan.id;
  select.dispatchEvent(new Event("change"));
  $("start-run").click();
  await flush();

  async function gps(
    seconds: number,
    east: number,
    north: number,
    accuracy = 5,
  ) {
    vi.setSystemTime(epoch + seconds * 1000);
    const p = point(east, north);
    success({
      coords: {
        latitude: p.lat,
        longitude: p.lng,
        accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    });
    await flush();
  }
  const spoken = () =>
    synth.speak.mock.calls.map(([utterance]) => utterance.text);
  for (let t = 0; t <= 80; t++) {
    await gps(t, 0, t * 3);
    if (t === 76) {
      expect(spoken().at(-1)).toContain("Odbočte doprava");
      expect(spoken().some((text) => text.includes("Aktuální tempo"))).toBe(
        false,
      );
    }
  }
  for (let t = 81; t <= 130; t++) await gps(t, (t - 80) * 3, 240);
  expect(
    spoken().filter((text) => text.startsWith("Odbočte doprava")),
  ).toHaveLength(1);
  expect(
    spoken().filter((text) => text.startsWith("Odbočte doleva")),
  ).toHaveLength(1);
  expect(spoken().some((text) => text.includes("Aktuální tempo"))).toBe(true);
  expect(spoken().some((text) => /za přibližně|metrů/.test(text))).toBe(false);
  expect(
    synth.speak.mock.calls.every(([utterance]) => utterance.lang === "cs-CZ"),
  ).toBe(true);

  for (let t = 131; t <= 140; t++) await gps(t, 150, 240 + (t - 130) * 3);
  for (let t = 141; t <= 160; t++) await gps(t, 150 + (t - 140) * 3, 270);
  expect(
    spoken().filter((text) => text === "Opustili jste trasu."),
  ).toHaveLength(1);
  expect($("voice-copy").textContent).toBe("Opustili jste trasu.");
  // A weak apparent return must not resume turn guidance or announce recovery.
  await gps(161, 150, 270, 100);
  expect($("voice-copy").textContent).toBe("Opustili jste trasu.");
  for (let t = 162; t <= 180; t++) await gps(t, 210 - (t - 160) * 3, 270);
  expect(
    spoken().filter((text) => text === "Jste zpět na trase."),
  ).toHaveLength(1);

  $("pause-run").click();
  await flush();
  const count = synth.speak.mock.calls.length;
  await gps(181, 300, 270);
  expect(synth.speak).toHaveBeenCalledTimes(count);
});
