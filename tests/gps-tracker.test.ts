// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GpsTracker } from "../src/services/gps-tracker";

const epoch = 1789500000000;
const position: GeolocationPosition = {
  timestamp: epoch,
  coords: {
    latitude: 49,
    longitude: 18,
    accuracy: 5,
    speed: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    toJSON: () => ({}),
  },
  toJSON: () => ({}),
};
const error: GeolocationPositionError = {
  code: 3,
  message: "Timeout",
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};
class ScreenLock extends EventTarget implements WakeLockSentinel {
  released = false;
  readonly type = "screen";
  onrelease: WakeLockSentinel["onrelease"] = null;
  release = vi.fn(async () => {
    this.released = true;
    this.dispatchEvent(new Event("release"));
  });
}
let tracker: GpsTracker;
let hidden = false;
let watches: { success: PositionCallback; error: PositionErrorCallback }[];
const callbacks = {
  position: vi.fn(),
  error: vi.fn(),
  suspend: vi.fn(),
  resume: vi.fn(),
  tick: vi.fn(),
  wakeStatus: vi.fn(),
};
const clearWatch = vi.fn();
function visibility(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(epoch);
  vi.clearAllMocks();
  watches = [];
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.stubGlobal("navigator", {
    geolocation: {
      clearWatch,
      watchPosition: vi.fn(
        (success: PositionCallback, failure: PositionErrorCallback) => {
          watches.push({ success, error: failure });
          return watches.length;
        },
      ),
    },
  });
  tracker = new GpsTracker(callbacks);
});
afterEach(() => {
  tracker.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("web GPS lifecycle", () => {
  it("replaces the watcher once on return and ignores late fixes/errors from the hidden page", () => {
    tracker.start();
    const old = watches[0];
    old.success(position);
    visibility(true);
    window.dispatchEvent(new Event("pagehide"));
    expect(callbacks.suspend).toHaveBeenCalledExactlyOnceWith("hidden");
    expect(clearWatch).toHaveBeenCalledWith(1);
    old.success(position);
    old.error(error);
    expect(callbacks.position).toHaveBeenCalledTimes(1);
    expect(callbacks.error).not.toHaveBeenCalled();
    visibility(false);
    window.dispatchEvent(new Event("pageshow"));
    expect(callbacks.resume).toHaveBeenCalledTimes(1);
    expect(watches).toHaveLength(2);
    old.success(position);
    watches[1].success(position);
    expect(callbacks.position).toHaveBeenCalledTimes(2);
  });
  it("recovers pagehide/pageshow (bfcache) even without visibilitychange", () => {
    tracker.start();
    window.dispatchEvent(new Event("pagehide"));
    expect(callbacks.suspend).toHaveBeenCalledWith("pagehide");
    window.dispatchEvent(new Event("pageshow"));
    expect(watches).toHaveLength(2);
  });
  it("does not restart a manually paused or finished run on foregrounding", () => {
    tracker.start();
    tracker.stop();
    visibility(true);
    visibility(false);
    watches[0].success(position);
    watches[0].error(error);
    expect(watches).toHaveLength(1);
    expect(callbacks.position).not.toHaveBeenCalled();
    expect(callbacks.error).not.toHaveBeenCalled();
  });
  it("retries a silent watcher at 30 seconds, also before the first GPS fix", async () => {
    tracker.start();
    await vi.advanceTimersByTimeAsync(30000);
    expect(watches).toHaveLength(2);
    tracker.receivedUsableFix();
    await vi.advanceTimersByTimeAsync(20000);
    tracker.receivedUsableFix();
    await vi.advanceTimersByTimeAsync(20000);
    expect(watches).toHaveLength(2);
    visibility(true);
    await vi.advanceTimersByTimeAsync(120000);
    expect(watches).toHaveLength(2);
    visibility(false);
    expect(watches).toHaveLength(3);
  });
  it("reports unavailable screen protection explicitly", () => {
    tracker.start();
    expect(callbacks.wakeStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("nepodporuje"),
    );
  });
});

describe("screen wake lock", () => {
  it("requests protection while acquiring GPS, reports OS release, and retries without a tight loop", async () => {
    const first = new ScreenLock(),
      second = new ScreenLock();
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(second);
    Object.assign(navigator, { wakeLock: { request } });
    tracker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledExactlyOnceWith("screen");
    expect(callbacks.wakeStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("zůstává rozsvícený"),
    );
    await first.release();
    expect(callbacks.wakeStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("přerušilo"),
    );
    await vi.advanceTimersByTimeAsync(29000);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(2);
    tracker.stop();
    expect(second.release).toHaveBeenCalledTimes(1);
  });
  it("releases a late lock from the previous run without replacing the new run's lock", async () => {
    let resolve: (lock: WakeLockSentinel) => void = () => {};
    const late = new ScreenLock(),
      current = new ScreenLock();
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WakeLockSentinel>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(current);
    Object.assign(navigator, { wakeLock: { request } });
    tracker.start();
    tracker.stop();
    tracker.start();
    await vi.advanceTimersByTimeAsync(0);
    resolve(late);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.release).toHaveBeenCalledTimes(1);
    expect(current.release).not.toHaveBeenCalled();
    tracker.stop();
    expect(current.release).toHaveBeenCalledTimes(1);
  });
  it("reports rejection and reacquires after returning to the app", async () => {
    const current = new ScreenLock();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("Low battery"))
      .mockResolvedValueOnce(current);
    Object.assign(navigator, { wakeLock: { request } });
    tracker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(callbacks.wakeStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("nedovolil"),
    );
    visibility(true);
    visibility(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    visibility(true);
    expect(current.release).toHaveBeenCalledTimes(1);
  });
});
