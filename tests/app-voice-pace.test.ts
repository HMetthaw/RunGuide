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

it("sends minutes and seconds to Czech speech for fast, on-target and slow pace advice", async () => {
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
  for (const [id, value] of [
    ["goal-distance", "2"],
    ["goal-time", "16"],
  ]) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }
  document.getElementById("start-run")!.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(success).toBeDefined();

  const paceUtterances = () =>
    synth.speak.mock.calls
      .map(([utterance]) => utterance)
      .filter((utterance) => utterance.text.includes("Aktuální tempo"));
  let meters = 0;
  for (let seconds = 0; seconds <= 180; seconds++) {
    const pace = seconds <= 60 ? 333.33 : seconds <= 120 ? 495 : 539.9;
    if (seconds > 0) meters += 1000 / pace;
    vi.setSystemTime(epoch + seconds * 1000);
    success!({
      coords: {
        latitude: 49.78 + meters / 111195,
        longitude: 18.43,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: 1000 / pace,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    });
    await vi.advanceTimersByTimeAsync(0);
    if (seconds < 60) expect(paceUtterances()).toHaveLength(0);
    if (seconds === 120)
      expect(document.getElementById("live-pace")!.textContent).toBe("8:15");
  }

  expect(paceUtterances().map((utterance) => utterance.text)).toEqual([
    "Běžíš rychleji než svůj cíl. Zkus trochu zpomalit. Aktuální tempo 5 minut 33 sekund na kilometr.",
    "Držíš cílové tempo. Pokračuj ve svém rytmu. Aktuální tempo 8 minut 15 sekund na kilometr.",
    "Běžíš pomaleji než svůj cíl. Jestli se cítíš dobře, lehce přidej. Aktuální tempo 9 minut 0 sekund na kilometr.",
  ]);
  for (const utterance of paceUtterances())
    expect(utterance.lang).toBe("cs-CZ");
  expect(document.getElementById("voice-copy")!.textContent).toBe(
    paceUtterances().at(-1)!.text,
  );
});
