// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/services/map", () => ({
  RouteMap: class {
    setRoute() {}
    setTrace() {}
    locate() {}
    resize() {}
  },
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("starts without a goal or route and speaks pace and the first kilometer", async () => {
  vi.useFakeTimers();
  const epoch = 1789500000000;
  vi.setSystemTime(epoch);
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  const synth = Object.assign(new EventTarget(), {
    getVoices: () => [],
    speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(),
    cancel: vi.fn(),
    speaking: false,
  });
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal("isSecureContext", true);
  let success: PositionCallback | undefined;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn((onSuccess: PositionCallback) => {
        success = onSuccess;
        return 1;
      }),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    },
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  await import("../src/main");
  await vi.advanceTimersByTimeAsync(0);
  const goal = document.getElementById("goal-distance") as HTMLInputElement;
  goal.value = "0";
  goal.dispatchEvent(new Event("input"));
  expect(
    (document.getElementById("start-run") as HTMLButtonElement).disabled,
  ).toBe(true);
  const free = document.getElementById("start-free-run") as HTMLButtonElement;
  expect(free.disabled).toBe(false);
  free.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(success).toBeDefined();
  expect(document.getElementById("goal-remaining-metric")!.hidden).toBe(true);
  expect(document.getElementById("goal-delta-metric")!.hidden).toBe(true);
  const draft = JSON.stringify(localStorage);
  expect(draft).toContain("free");

  for (let seconds = 0; seconds <= 340; seconds += 5) {
    vi.setSystemTime(epoch + seconds * 1000);
    success!({
      coords: {
        latitude: 49.78 + (seconds * 3) / 111195,
        longitude: 18.43,
        accuracy: 5,
        altitude: 100 + seconds / 10,
        altitudeAccuracy: 5,
        heading: null,
        speed: 3,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    });
    await vi.advanceTimersByTimeAsync(0);
  }
  const messages = synth.speak.mock.calls.map(([utterance]) => utterance.text);
  expect(messages.some((message) => message.startsWith("Aktuální tempo"))).toBe(
    true,
  );
  expect(
    messages.filter((message) => message.startsWith("První kilometr")),
  ).toHaveLength(1);
  expect(messages).not.toContain(expect.stringContaining("cílové tempo"));
  expect(document.getElementById("live-elevation")!.textContent).toBe(
    "134 m n. m.",
  );
  expect(document.getElementById("live-elevation-gain")!.textContent).toBe(
    "33 m",
  );
});
