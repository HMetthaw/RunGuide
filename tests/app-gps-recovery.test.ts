// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { Runner } from "../src/domain/runner";
import { LocalRepository } from "../src/services/storage";

vi.mock("../src/services/map", () => ({
  RouteMap: class {
    setRoute() {}
    setTrace() {}
    locate() {}
    resize() {}
    centerPoint() {
      return { lat: 49.78, lng: 18.43 };
    }
  },
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));
const epoch = 1789500000000;
const $ = (id: string) => document.getElementById(id)!;
const flush = () => vi.advanceTimersByTimeAsync(0);
const click = async (id: string) => {
  $(id).click();
  await flush();
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("restores privately in pause, restarts on return, persists every accepted point and shows incomplete history after GPS stops", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(epoch + 40000);
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const watches: {
    success: PositionCallback;
    failure: PositionErrorCallback;
  }[] = [];
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn(
        (success: PositionCallback, failure: PositionErrorCallback) => {
          watches.push({ success, failure });
          return watches.length;
        },
      ),
      clearWatch: vi.fn(),
    },
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = vi.fn();
  const interrupted = new Runner();
  interrupted.start({ distanceKm: 5, durationMinutes: 30 }, []);
  for (let i = 0; i <= 30; i++)
    interrupted.ingest(
      {
        lat: 49.78 + (i * 3) / 111195,
        lng: 18.43,
        accuracy: 5,
        timestamp: epoch + i * 1000,
        speed: null,
      },
      epoch + i * 1000,
    );
  new LocalRepository(localStorage).saveDraft(
    interrupted.checkpoint(epoch + 30000),
  );
  await import("../src/main");
  await flush();
  expect($("recovery").hidden).toBe(false);
  await click("restore-run");
  expect(document.body.dataset.runPhase).toBe("paused");
  expect($("recording-status").textContent).toContain(
    "dobu mimo aplikaci neznáme",
  );
  expect(watches).toHaveLength(0);
  vi.setSystemTime(epoch + 50000);
  await click("resume-run");
  const send = async (
    seconds: number,
    meters: number,
    watcher = watches.at(-1)!,
  ) => {
    watcher.success({
      timestamp: epoch + seconds * 1000,
      toJSON: () => ({}),
      coords: {
        latitude: 49.78 + meters / 111195,
        longitude: 18.43,
        accuracy: 5,
        speed: null,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        toJSON: () => ({}),
      },
    });
    await flush();
  };
  await send(50, 500);
  vi.setSystemTime(epoch + 60000);
  await send(60, 530);
  expect(new LocalRepository(localStorage).draft()?.meters).toBeCloseTo(120, 0);
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(new LocalRepository(localStorage).draft()?.interruption?.reason).toBe(
    "hidden",
  );
  const old = watches[0];
  vi.setSystemTime(epoch + 100000);
  await send(100, 700, old);
  expect(new LocalRepository(localStorage).draft()?.meters).toBeCloseTo(120, 0);
  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("pageshow"));
  expect(watches).toHaveLength(2);
  old.failure({
    code: 1,
    message: "old denied",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  });
  expect(document.body.dataset.runPhase).toBe("running");
  await send(99, 697);
  expect($("gps-status").textContent).toContain("vynechán");
  await send(100, 700);
  vi.setSystemTime(epoch + 110000);
  await send(110, 730);
  expect($("live-distance").textContent).toBe("0,15");
  expect($("average-pace").textContent).toBe("—");
  await vi.advanceTimersByTimeAsync(30000);
  expect($("recording-status").hidden).toBe(false);
  expect($("recording-status").textContent).toContain("GPS neměří");
  expect(watches).toHaveLength(3);
  await click("stop-run");
  const dialog = $("confirm-dialog") as HTMLDialogElement;
  dialog.returnValue = "confirm";
  dialog.dispatchEvent(new Event("close"));
  await flush();
  const run = new LocalRepository(localStorage).runs()[0];
  expect(run.distanceMeters).toBeCloseTo(150, 0);
  expect(run.durationSeconds).toBe(120);
  expect(run.quality).toMatchObject({
    gaps: 3,
    recoveryUncertain: true,
    untrackedSeconds: 70,
  });
  expect(document.querySelector(".history-summary")?.textContent).toContain(
    "průměrné tempo nelze určit",
  );
  expect($("summary-pace").textContent).toBe("—");
  expect(
    new LocalRepository(localStorage, "different-owner").runs(),
  ).toHaveLength(0);
});
