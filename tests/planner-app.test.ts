// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import type { Point, RoutedPath } from "../src/types/models";

const mocks = vi.hoisted(() => ({
  addPoint: undefined as ((point: Point) => void) | undefined,
  setRoute: vi.fn(),
  calculate: vi.fn(),
}));
vi.mock("../src/services/map", () => ({
  RouteMap: class {
    constructor(addPoint: (point: Point) => void) {
      mocks.addPoint = addPoint;
    }
    setRoute = mocks.setRoute;
    setTrace() {}
    locate() {}
    centerPoint() {
      return { lat: 50, lng: 14 };
    }
  },
}));
vi.mock("../src/services/routing", () => ({
  MAX_WAYPOINTS: 100,
  routeOnFoot: mocks.calculate,
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));

const a = { lat: 50, lng: 14 },
  b = { lat: 50, lng: 14.002 };
const routed: RoutedPath = {
  points: [a, { lat: 50.002, lng: 14 }, { lat: 50.002, lng: 14.002 }, b],
  routing: {
    profile: "foot",
    provider: "osrm",
    waypoints: [a, b],
    distanceMeters: 588,
  },
};
const $ = (id: string) => document.getElementById(id)!;
const disabled = (id: string) => ($(id) as HTMLButtonElement).disabled;
const flush = () => vi.advanceTimersByTimeAsync(0);
async function click(id: string) {
  $(id).click();
  await flush();
}
async function clear() {
  await click("clear-route");
  const dialog = $("confirm-dialog") as HTMLDialogElement;
  dialog.returnValue = "confirm";
  dialog.dispatchEvent(new Event("close"));
  await flush();
}
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("plans, saves and reloads a road route; blocks partial/error routes and retries without stale distances", async () => {
  vi.useFakeTimers();
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = vi.fn();
  mocks.calculate.mockResolvedValue(routed);
  await import("../src/main");
  await flush();
  mocks.addPoint!(a);
  mocks.addPoint!(b);
  expect($("route-distance").textContent).toBe("—");
  for (const id of ["start-run", "save-route", "use-route-distance"])
    expect(disabled(id)).toBe(true);
  await vi.advanceTimersByTimeAsync(350);
  expect($("route-distance").textContent).toBe("0,59");
  expect(mocks.setRoute).toHaveBeenLastCalledWith(
    routed.points,
    false,
    routed.routing.waypoints,
  );
  expect(disabled("start-run")).toBe(false);
  await click("use-route-distance");
  expect(($("goal-distance") as HTMLInputElement).value).toBe("0.6");
  await click("save-route");
  const stored: {
    plans: { id: string; points: Point[]; routing: RoutedPath["routing"] }[];
  } = JSON.parse(localStorage.getItem("runguide-v2:device")!);
  expect(stored.plans[0].points).toEqual(routed.points);
  expect(stored.plans[0].routing).toEqual(routed.routing);
  await clear();
  const select = $("saved-routes") as HTMLSelectElement;
  select.value = stored.plans[0].id;
  select.dispatchEvent(new Event("change"));
  expect($("route-distance").textContent).toBe("0,59");
  expect(mocks.calculate).toHaveBeenCalledTimes(1);
  await click("undo-route");
  expect($("route-summary").textContent).toContain("1 bodů");
  expect(mocks.setRoute).toHaveBeenLastCalledWith([], false, [a]);
  mocks.addPoint!(b);
  mocks.calculate.mockRejectedValueOnce(new TypeError("offline"));
  await click("close-loop");
  await vi.advanceTimersByTimeAsync(1100);
  expect(mocks.calculate.mock.calls.at(-1)?.[0]).toEqual([a, b, a]);
  expect($("routing-status").textContent).toContain("internet");
  expect($("retry-route").hidden).toBe(false);
  expect(disabled("start-run")).toBe(true);
  expect(disabled("save-route")).toBe(true);
  await click("retry-route");
  await vi.advanceTimersByTimeAsync(1100);
  expect(disabled("start-run")).toBe(false);
  expect($("retry-route").hidden).toBe(true);
  await clear();
  expect(disabled("start-run")).toBe(false);
});
