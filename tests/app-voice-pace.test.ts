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

it("speaks current pace and whole-run progress, excludes pauses and qualifies GPS gaps", async () => {
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
  const interval = document.getElementById(
    "pace-current-interval",
  ) as HTMLInputElement;
  interval.value = "60";
  interval.dispatchEvent(new Event("change"));
  document.getElementById("pace-average-enabled")!.click();
  document.getElementById("start-run")!.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(success).toBeDefined();

  const paceUtterances = () =>
    synth.speak.mock.calls
      .map(([utterance]) => utterance)
      .filter((utterance) => utterance.text.includes("Aktuální tempo"));
  const progressUtterances = () =>
    synth.speak.mock.calls
      .map(([utterance]) => utterance)
      .filter((utterance) =>
        /Dosavadní průměr|Průměrné tempo a splnění cíle/.test(utterance.text),
      );
  async function gps(seconds: number, meters: number, pace: number) {
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
  }
  let meters = 0;
  for (let seconds = 0; seconds <= 300; seconds++) {
    const pace = seconds <= 60 ? 333.33 : seconds <= 180 ? 495 : 539.9;
    if (seconds > 0) meters += 1000 / pace;
    await gps(seconds, meters, pace);
    if (seconds < 60) expect(paceUtterances()).toHaveLength(0);
    if (seconds === 120) {
      expect(document.getElementById("live-pace")!.textContent).toBe("8:15");
      expect(progressUtterances()).toHaveLength(1);
      expect(progressUtterances()[0].text).toContain(
        "Dosavadní průměrné tempo 6 minut 38 sekund na kilometr.",
      );
      expect(progressUtterances()[0].text).toContain(
        "Při zachování tohoto průměru",
      );
    }
  }

  expect(paceUtterances()).toHaveLength(5);
  expect(paceUtterances()[0].text).toBe(
    "Aktuální tempo 5 minut 33 sekund na kilometr. Běžíš rychleji než své cílové tempo. Zkus trochu zpomalit.",
  );
  expect(paceUtterances()[1].text).toContain(
    "Aktuální tempo 8 minut 15 sekund na kilometr. Dosavadní průměrné tempo",
  );
  expect(paceUtterances()[2].text).toBe(
    "Aktuální tempo 8 minut 15 sekund na kilometr. Držíš přibližně cílové tempo. Pokračuj ve svém rytmu.",
  );
  expect(paceUtterances()[4].text).toBe(
    "Aktuální tempo 9 minut 0 sekund na kilometr. Běžíš pomaleji než své cílové tempo. Jestli se cítíš dobře, lehce přidej.",
  );
  expect(progressUtterances()).toHaveLength(2);
  for (const utterance of paceUtterances())
    expect(utterance.lang).toBe("cs-CZ");
  expect(document.getElementById("voice-copy")!.textContent).toBe(
    paceUtterances().at(-1)!.text,
  );

  const averageBeforePause =
    document.getElementById("average-pace")!.textContent;
  document.getElementById("pause-run")!.click();
  await vi.advanceTimersByTimeAsync(0);
  vi.setSystemTime(epoch + 420000);
  document.getElementById("resume-run")!.click();
  await vi.advanceTimersByTimeAsync(0);
  await gps(420, meters, 539.9);
  expect(document.getElementById("average-pace")!.textContent).toBe(
    averageBeforePause,
  );
  for (let seconds = 421; seconds <= 480; seconds++) {
    meters += 1000 / 539.9;
    await gps(seconds, meters, 539.9);
    if (seconds < 480) expect(progressUtterances()).toHaveLength(2);
  }
  expect(progressUtterances()).toHaveLength(3);
  expect(document.getElementById("live-time")!.textContent).toBe("6:00");

  // A real recording gap loses distance; recovered current GPS must not turn
  // the whole-run projection back into a confident result.
  const messagesBeforeGap = synth.speak.mock.calls.length;
  meters += 200;
  await gps(550, meters, 539.9);
  expect(synth.speak).toHaveBeenCalledTimes(messagesBeforeGap + 1);
  expect(synth.speak.mock.calls.at(-1)![0].text).toContain(
    "Záznam GPS má výpadek",
  );
  expect(document.getElementById("average-pace")!.textContent).toBe("—");
  for (let seconds = 551; seconds <= 640; seconds++) {
    meters += 1000 / 539.9;
    await gps(seconds, meters, 539.9);
  }
  expect(progressUtterances().at(-1)!.text).toContain(
    "Průměrné tempo a splnění cíle",
  );
  expect(progressUtterances().at(-1)!.text).toContain(
    "nelze spolehlivě posoudit",
  );
  for (const utterance of progressUtterances()) {
    expect(utterance.lang).toBe("cs-CZ");
    expect(utterance.text).not.toMatch(/\d+:\d{2}|hodin/);
  }
});
