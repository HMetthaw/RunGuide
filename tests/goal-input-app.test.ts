// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { LocalRepository } from "../src/services/storage";
import type { Plan } from "../src/types/models";

vi.mock("../src/services/map", () => ({
  RouteMap: class {
    setRoute() {}
    setTrace() {}
    resize() {}
    locate() {}
  },
}));
vi.mock("../src/services/pwa", () => ({ registerApp: vi.fn() }));

const $ = (id: string) => document.getElementById(id)!;
const field = (id: string) => $(id) as HTMLInputElement;
const flush = () => vi.advanceTimersByTimeAsync(0);
function edit(id: string, value: string) {
  field(id).value = value;
  field(id).dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("edits decimal goals, validates them, reloads a precise plan and starts with all 30 extra seconds", async () => {
  vi.useFakeTimers();
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  localStorage.clear();
  const points = [
    { lat: 50, lng: 14 },
    { lat: 50.01, lng: 14.01 },
  ];
  const plan: Plan = {
    id: crypto.randomUUID(),
    name: "Přesná trasa",
    points,
    goal: { distanceKm: 5.55, durationMinutes: 27.5 },
    routing: {
      profile: "foot",
      provider: "osrm",
      waypoints: points,
      distanceMeters: 5550,
    },
    createdAt: new Date().toISOString(),
  };
  new LocalRepository(localStorage).savePlan(plan);
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  let gpsSuccess: PositionCallback | undefined;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn((callback: PositionCallback) => {
        gpsSuccess = callback;
        return 1;
      }),
      clearWatch: vi.fn(),
    },
  });
  await import("../src/main");
  await flush();
  document
    .querySelector<HTMLAnchorElement>('a[href="#goal"][data-route]')!
    .click();
  expect(document.body.dataset.step).toBe("goal");
  for (const id of ["goal-distance", "goal-time"]) {
    expect(field(id).type).toBe("text");
    expect(field(id).inputMode).toBe("decimal");
    expect(field(id).getAttribute("aria-describedby")).toContain("goal-error");
  }

  for (const separator of [",", "."]) {
    edit("goal-distance", `5${separator}5`);
    edit("goal-time", `27${separator}5`);
    expect($("target-pace").textContent).toBe("5:00");
    expect($("remaining-time").textContent).toContain("27:30");
    expect(field("start-run").disabled).toBe(false);
    expect($("goal-error").textContent).toBe("");
    expect(field("goal-time").value).toBe(`27${separator}5`);
  }

  for (const [id, invalid, valid] of [
    ["goal-distance", "5,5km", "5,55"],
    ["goal-distance", "0,09", "5,55"],
    ["goal-time", "27,", "27,5"],
    ["goal-time", "1440,01", "27,5"],
    ["goal-time", "", "27,5"],
  ]) {
    edit(id, invalid);
    expect(field("start-run").disabled).toBe(true);
    expect($("target-pace").textContent).toBe("—");
    expect(field(id).getAttribute("aria-invalid")).toBe("true");
    expect($("goal-error").textContent).toContain("Zadej");
    edit(id, valid);
    expect(field(id).getAttribute("aria-invalid")).toBe("false");
    expect(field("start-run").disabled).toBe(false);
  }

  const select = $("saved-routes") as HTMLSelectElement;
  select.value = plan.id;
  select.dispatchEvent(new Event("change"));
  expect(field("goal-distance").value).toBe("5.55");
  expect(field("goal-time").value).toBe("27.5");
  expect($("target-pace").textContent).toBe("4:57");
  expect($("goal-error").textContent).toBe("");

  edit("goal-distance", "5,55");
  edit("goal-time", "27,5");
  $("save-route").click();
  await flush();
  expect(new LocalRepository(localStorage).plans()[0].goal).toEqual(plan.goal);
  document
    .querySelector<HTMLAnchorElement>('a[href="#run"][data-route]')!
    .click();
  expect(document.body.dataset.step).toBe("run");
  expect($("run-preparation-summary").textContent).toContain(
    "5,55 km · 27,5 min · tempo 4:57 / km",
  );
  $("start-run").click();
  await flush();
  expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce();
  expect(document.body.dataset.runPhase).toBe("acquiring");
  expect($("remaining-distance").textContent).toBe("5,55 km");
  expect($("remaining-time").textContent).toContain("27:30");
  if (!gpsSuccess) throw new Error("GPS callback was not registered");
  gpsSuccess({
    coords: {
      latitude: 50,
      longitude: 14,
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
  expect(document.body.dataset.runPhase).toBe("running");
  $("pause-run").click();
  await flush();
  expect(new LocalRepository(localStorage).draft()?.goal).toEqual(plan.goal);
});
