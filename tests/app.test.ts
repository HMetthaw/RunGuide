// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/services/map", () => ({
  RouteMap: class {
    setRoute() {}
    setTrace() {}
    locate() {}
    centerPoint() {
      return { lat: 49.78, lng: 18.43 };
    }
  },
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));
let success: PositionCallback;
let failure: PositionErrorCallback;
const epoch = 1789500000000;
const $ = (id: string) => document.getElementById(id)!;
const flush = async () => {
  await vi.advanceTimersByTimeAsync(0);
};
const click = async (id: string) => {
  $(id).click();
  await flush();
};
async function finishDialog() {
  const dialog = $("confirm-dialog") as HTMLDialogElement;
  dialog.returnValue = "confirm";
  dialog.dispatchEvent(new Event("close"));
  await flush();
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("runs the complete interface: invalid goal, denied GPS, run, pause, quota failure, retry, history, feedback and delete", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(epoch);
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn(
        (onSuccess: PositionCallback, onError: PositionErrorCallback) => {
          success = onSuccess;
          failure = onError;
          return 1;
        },
      ),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    },
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = vi.fn();
  await import("../src/main");
  await flush();
  const target = $("goal-distance") as HTMLInputElement;
  target.value = "0";
  target.dispatchEvent(new Event("input"));
  expect(($("start-run") as HTMLButtonElement).disabled).toBe(true);
  expect($("goal-error").textContent).toContain("Zadej");
  target.value = "5";
  target.dispatchEvent(new Event("input"));
  await click("start-run");
  failure({
    code: 1,
    message: "Denied",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  });
  expect($("gps-status").textContent).toContain("zamítnutý");
  expect($("resume-run").hidden).toBe(false);
  await click("stop-run");
  await finishDialog();
  expect($("history-count").textContent).toBe("0");
  await click("start-run");
  async function gps(seconds: number, meters: number) {
    vi.setSystemTime(epoch + seconds * 1000);
    success({
      coords: {
        latitude: 49.78 + meters / 111195,
        longitude: 18.43,
        accuracy: 5,
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
  for (let i = 0; i <= 60; i++) await gps(i, i * 3);
  expect($("live-distance").textContent).toBe("0,18");
  expect($("live-pace").textContent).toBe("5:33");
  await click("pause-run");
  expect($("resume-run").hidden).toBe(false);
  vi.setSystemTime(epoch + 120000);
  await click("resume-run");
  await gps(120, 500);
  await gps(130, 530);
  expect($("live-time").textContent).toBe("1:10");
  expect($("live-distance").textContent).toBe("0,21");
  const quota = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Quota");
    });
  await click("stop-run");
  await finishDialog();
  expect($("history-count").textContent).toBe("0");
  expect($("app-status").textContent).toContain("nepodařilo uložit");
  expect($("retry-save").hidden).toBe(false);
  quota.mockRestore();
  await click("retry-save");
  expect($("history-count").textContent).toBe("1");
  expect($("history").hidden).toBe(false);
  expect(document.querySelectorAll(".history-item svg polyline").length).toBe(
    2,
  );
  const feedback = document.querySelector<HTMLTextAreaElement>(
    ".history-item textarea",
  )!;
  feedback.value = "<img src=x onerror=alert(1)>";
  document
    .querySelector<HTMLButtonElement>(".history-item details button")!
    .click();
  await flush();
  expect(document.querySelector(".history-item img")).toBeNull();
  expect(localStorage.getItem("runguide-v2:device")).toContain("onerror");
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    ".history-item details button",
  );
  buttons[2].click();
  await flush();
  await finishDialog();
  expect($("history-count").textContent).toBe("0");
});
