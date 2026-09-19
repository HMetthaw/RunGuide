// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import type { Plan, Point, RoutedPath } from "../src/types/models";
import { LocalRepository } from "../src/services/storage";

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
    resize() {}
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
    distanceMeters: 5550,
  },
};
const $ = (id: string) => document.getElementById(id)!;
const disabled = (id: string) => ($(id) as HTMLButtonElement).disabled;
const flush = () => vi.advanceTimersByTimeAsync(0);
const field = (id: string) => $(id) as HTMLInputElement;
function edit(id: string, value: string) {
  field(id).value = value;
  field(id).dispatchEvent(new Event("input"));
}
function selectPlan(id: string) {
  field("saved-routes").value = id;
  $("saved-routes").dispatchEvent(new Event("change"));
}
function visit(step: "start" | "goal" | "run") {
  document
    .querySelector<HTMLAnchorElement>(`a[data-route][href="#${step}"]`)!
    .click();
  expect(document.body.dataset.step).toBe(step === "start" ? "route" : step);
}
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

it("syncs fractional route lengths through planning, goals and saved plans while preserving manual overrides", async () => {
  vi.useFakeTimers();
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  const legacyPlan: Plan = {
    id: crypto.randomUUID(),
    name: "Starší plán s výchozím cílem",
    goal: { distanceKm: 5, durationMinutes: 30 },
    ...routed,
    createdAt: new Date().toISOString(),
  };
  const legacyUnrouted: Plan = {
    ...legacyPlan,
    id: crypto.randomUUID(),
    points: [a, { lat: 50.005, lng: 14.008 }],
    routing: undefined,
  };
  const initialRepository = new LocalRepository(localStorage);
  initialRepository.savePlan(legacyPlan);
  initialRepository.savePlan(legacyUnrouted);
  HTMLDialogElement.prototype.showModal = vi.fn();
  mocks.calculate.mockResolvedValue(routed);
  await import("../src/main");
  await flush();
  expect(field("goal-distance").value).toBe("5");
  mocks.addPoint!(a);
  mocks.addPoint!(b);
  expect($("route-distance").textContent).toBe("—");
  for (const id of ["start-run", "save-route", "use-route-distance"])
    expect(disabled(id)).toBe(true);
  await vi.advanceTimersByTimeAsync(350);
  expect($("route-distance").textContent).toBe("5,55");
  expect(field("goal-distance").value).toBe("5.55");
  expect($("target-pace").textContent).toBe("5:24");
  expect($("remaining-distance").textContent).toBe("5,55 km");
  for (const step of ["goal", "run", "start", "goal"] as const) {
    visit(step);
    expect(field("goal-distance").value).toBe("5.55");
    expect($("run-preparation-summary").textContent).toContain("5,55 km");
  }
  edit("goal-time", "33.3");
  expect($("target-pace").textContent).toBe("6:00");
  expect(field("goal-distance").value).toBe("5.55");
  expect(mocks.setRoute).toHaveBeenLastCalledWith(
    routed.points,
    false,
    routed.routing.waypoints,
  );
  expect(disabled("start-run")).toBe(false);
  await click("use-route-distance");
  expect(field("goal-distance").value).toBe("5.55");
  await click("save-route");
  const savedPlan = new LocalRepository(localStorage).plans()[0];
  expect(savedPlan.points).toEqual(routed.points);
  expect(savedPlan.routing).toEqual(routed.routing);
  expect(savedPlan.goal).toEqual({ distanceKm: 5.55, durationMinutes: 33.3 });
  expect(savedPlan.goalDistanceSource).toBe("route");
  await clear();
  selectPlan(savedPlan.id);
  expect($("route-distance").textContent).toBe("5,55");
  expect(field("goal-distance").value).toBe("5.55");
  expect(mocks.calculate).toHaveBeenCalledTimes(1);
  await click("undo-route");
  expect($("route-summary").textContent).toContain("1 bod");
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
  expect(field("goal-distance").value).toBe("5.55");
  await click("retry-route");
  await vi.advanceTimersByTimeAsync(1100);
  expect(disabled("start-run")).toBe(false);
  expect($("retry-route").hidden).toBe(true);
  await clear();
  expect(disabled("start-run")).toBe(false);
  expect(field("goal-distance").value).toBe("5.55");

  // An explicit plan selection uses its routed length, including older plans
  // whose saved goal still contains the original 5 km default.
  edit("goal-distance", "8");
  selectPlan(legacyPlan.id);
  expect(field("goal-distance").value).toBe("5.55");
  expect($("target-pace").textContent).toBe("5:24");

  // Deliberate manual goals survive navigation, saving and re-selecting a plan.
  edit("goal-distance", "6.25");
  edit("goal-time", "37.5");
  for (const step of ["run", "start", "goal"] as const) {
    visit(step);
    expect(field("goal-distance").value).toBe("6.25");
    expect($("target-pace").textContent).toBe("6:00");
  }
  await click("save-route");
  const manualPlan = new LocalRepository(localStorage).plans()[0];
  expect(manualPlan.goalDistanceSource).toBe("manual");
  expect(manualPlan.goal.distanceKm).toBe(6.25);
  selectPlan(savedPlan.id);
  expect(field("goal-distance").value).toBe("5.55");
  selectPlan(manualPlan.id);
  expect(field("goal-distance").value).toBe("6.25");
  expect(field("goal-time").value).toBe("37.5");

  // Returning to route length re-enables tracking; an edit made while a new
  // calculation is pending must still win over its eventual response.
  await click("goal-use-route");
  expect(field("goal-distance").value).toBe("5.55");
  const c = { lat: 50.003, lng: 14.005 };
  const longer: RoutedPath = {
    points: [...routed.points, c],
    routing: { ...routed.routing, waypoints: [a, b, c], distanceMeters: 6420 },
  };
  mocks.calculate.mockResolvedValueOnce(longer);
  mocks.addPoint!(c);
  expect($("route-distance").textContent).toBe("—");
  edit("goal-distance", "6.2");
  await vi.advanceTimersByTimeAsync(1100);
  expect($("route-distance").textContent).toBe("6,42");
  expect(field("goal-distance").value).toBe("6.2");
  await click("goal-use-route");
  expect(field("goal-distance").value).toBe("6.42");

  const d = { lat: 50.004, lng: 14.006 };
  mocks.calculate.mockResolvedValueOnce({
    points: [...longer.points, d],
    routing: {
      ...longer.routing,
      waypoints: [a, b, c, d],
      distanceMeters: 7025,
    },
  } satisfies RoutedPath);
  mocks.addPoint!(d);
  await vi.advanceTimersByTimeAsync(1100);
  expect(field("goal-distance").value).toBe("7.025");
  expect(field("goal-time").value).toBe("37.5");
  await click("undo-route");
  expect(field("goal-distance").value).toBe("6.42");
  selectPlan(savedPlan.id);
  expect(field("goal-distance").value).toBe("5.55");
  selectPlan(legacyUnrouted.id);
  expect(disabled("start-run")).toBe(true);
  await vi.advanceTimersByTimeAsync(1100);
  expect(field("goal-distance").value).toBe("5.55");
  expect(disabled("start-run")).toBe(false);

  // Route synchronization, decimal parsing and the pace editor must cooperate.
  edit("goal-distance", "5,55");
  edit("goal-time", "27,5");
  edit("goal-pace-minutes", "5");
  edit("goal-pace-seconds", "50");
  expect(field("goal-time").value).toBe("32.375");
  expect($("target-pace").textContent).toBe("5:50");
  await click("save-route");
  const pacedPlan = new LocalRepository(localStorage).plans()[0];
  expect(pacedPlan.goal).toEqual({ distanceKm: 5.55, durationMinutes: 32.375 });
  expect(pacedPlan.goalDistanceSource).toBe("manual");
  selectPlan(pacedPlan.id);
  expect($("target-pace").textContent).toBe("5:50");
  await click("use-route-distance");
  mocks.calculate.mockResolvedValueOnce({
    ...routed,
    routing: { ...routed.routing, distanceMeters: 588 },
  } satisfies RoutedPath);
  mocks.addPoint!({ lat: 50.006, lng: 14.009 });
  await vi.advanceTimersByTimeAsync(1100);
  expect(field("goal-distance").value).toBe("0.588");
  expect(field("goal-time").value).toBe("32.375");
  edit("goal-pace-minutes", "5");
  edit("goal-pace-seconds", "50");
  expect(field("goal-time").value).toBe("3.43");
  await click("save-route");
  const shortPlan = new LocalRepository(localStorage).plans()[0];
  expect(shortPlan.goal.distanceKm).toBe(0.588);
  expect(shortPlan.goal.durationMinutes).toBeCloseTo(3.43, 12);
  selectPlan(pacedPlan.id);
  selectPlan(shortPlan.id);
  expect(field("goal-distance").value).toBe("0.588");
  expect($("target-pace").textContent).toBe("5:50");
});
