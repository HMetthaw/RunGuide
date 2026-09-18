import { afterEach, describe, expect, it, vi } from "vitest";
import { routeOnFoot } from "../src/services/routing";
import { RoutePlanner } from "../src/services/route-planner";
import { routeDistance } from "../src/domain/geo";
import type { Point, RoutedPath } from "../src/types/models";

const a = { lat: 50, lng: 14 };
const b = { lat: 50, lng: 14.002 };
const detour = [a, { lat: 50.002, lng: 14 }, { lat: 50.002, lng: 14.002 }, b];
const result: RoutedPath = {
  points: detour,
  routing: {
    profile: "foot",
    provider: "osrm",
    waypoints: [a, b],
    distanceMeters: 588,
  },
};
const body = () => ({
  code: "Ok",
  routes: [
    {
      distance: 588,
      geometry: {
        type: "LineString",
        coordinates: detour.map((p) => [p.lng, p.lat]),
      },
    },
  ],
  waypoints: [a, b].map((p) => ({ location: [p.lng, p.lat] })),
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("foot routing service", () => {
  it("uses the actual foot server and full road geometry, including a detour over a bridge", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body())));
    vi.stubGlobal("fetch", fetcher);
    const routed = await routeOnFoot([a, b], new AbortController().signal);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toContain(
      "/routed-foot/route/v1/foot/14.000000,50.000000;14.002000,50.000000",
    );
    expect(url.searchParams.get("overview")).toBe("full");
    expect(url.searchParams.get("radiuses")).toBe("100;100");
    expect(url.searchParams.get("continue_straight")).toBe("false");
    expect(routed.points).toEqual(detour);
    expect(routed.routing.distanceMeters).toBe(588);
    expect(routed.routing.distanceMeters).toBeGreaterThan(
      routeDistance([a, b]) * 3,
    );
  });
  it.each(["NoRoute", "NoSegment"])(
    "rejects %s without a straight-line fallback",
    async (code) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ code }), { status: 400 }),
          ),
      );
      await expect(
        routeOnFoot([a, b], new AbortController().signal),
      ).rejects.toThrow("pěší cestu");
    },
  );
  it("rejects a point snapped too far away", async () => {
    const invalid = body();
    invalid.waypoints[1].location = [15, 51];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid))),
    );
    await expect(
      routeOnFoot([a, b], new AbortController().signal),
    ).rejects.toThrow("přiřadit");
  });
  it("shows a readable error when an unavailable server returns HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Unavailable</html>", { status: 503 }),
        ),
    );
    await expect(
      routeOnFoot([a, b], new AbortController().signal),
    ).rejects.toThrow("použitelnou trasu");
  });
  it("rejects invalid geometry and rate limits", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...body(), routes: [] })),
      )
      .mockResolvedValueOnce(new Response("Busy", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      routeOnFoot([a, b], new AbortController().signal),
    ).rejects.toThrow("neplatnou");
    await expect(
      routeOnFoot([a, b], new AbortController().signal),
    ).rejects.toThrow("vytížená");
  });
});

describe("route planner lifecycle", () => {
  it("coalesces clicks, preserves waypoint order and separates geometry from editable points", async () => {
    vi.useFakeTimers();
    const calculate = vi.fn().mockResolvedValue(result);
    const planner = new RoutePlanner(vi.fn(), calculate);
    planner.setWaypoints([a]);
    expect(planner.blocked).toBe(false);
    planner.setWaypoints([a, b]);
    planner.setWaypoints([a, b, a]);
    expect(planner.points).toEqual([]);
    expect(planner.blocked).toBe(true);
    await vi.advanceTimersByTimeAsync(350);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(calculate.mock.calls[0][0]).toEqual([a, b, a]);
    expect(planner.points).toEqual(detour);
    expect(planner.waypoints).toEqual([a, b, a]);
    expect(planner.distanceMeters).toBe(588);
  });
  it("aborts stale edits, spaces network requests and ignores a late response after clearing", async () => {
    vi.useFakeTimers();
    const pending: {
      resolve: (value: RoutedPath) => void;
      signal: AbortSignal;
    }[] = [];
    const calculate = vi.fn(
      (_points: Point[], signal: AbortSignal) =>
        new Promise<RoutedPath>((resolve) => pending.push({ resolve, signal })),
    );
    const planner = new RoutePlanner(vi.fn(), calculate);
    planner.setWaypoints([a, b]);
    await vi.advanceTimersByTimeAsync(350);
    planner.setWaypoints([a, b, a]);
    expect(pending[0].signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1099);
    expect(calculate).toHaveBeenCalledTimes(1);
    pending[0].resolve(result);
    await vi.advanceTimersByTimeAsync(1);
    expect(calculate).toHaveBeenCalledTimes(2);
    expect(planner.status).toBe("pending");
    planner.setWaypoints([]);
    pending[1].resolve(result);
    await vi.advanceTimersByTimeAsync(0);
    expect(planner.status).toBe("empty");
    expect(planner.points).toEqual([]);
  });
  it("keeps failed plans unusable until retry succeeds and reuses cached results for undo", async () => {
    vi.useFakeTimers();
    const calculate = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue(result);
    const planner = new RoutePlanner(vi.fn(), calculate);
    planner.setWaypoints([a, b]);
    await vi.advanceTimersByTimeAsync(350);
    expect(planner.blocked).toBe(true);
    expect(planner.message).toContain("internet");
    expect(planner.points).toEqual([]);
    planner.setWaypoints(planner.waypoints);
    await vi.advanceTimersByTimeAsync(1100);
    expect(planner.blocked).toBe(false);
    planner.setWaypoints([a]);
    planner.setWaypoints([a, b]);
    expect(planner.status).toBe("ready");
    expect(calculate).toHaveBeenCalledTimes(2);
  });
  it("times out hanging requests and can load a saved routed plan offline", async () => {
    vi.useFakeTimers();
    const calculate = vi.fn(
      (_points: Point[], signal: AbortSignal) =>
        new Promise<RoutedPath>((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
    const planner = new RoutePlanner(vi.fn(), calculate);
    planner.setWaypoints([a, b]);
    await vi.advanceTimersByTimeAsync(15350);
    expect(planner.status).toBe("error");
    expect(planner.message).toContain("příliš dlouho");
    planner.load(result.points, result.routing);
    expect(planner.blocked).toBe(false);
    expect(planner.waypoints).toEqual([a, b]);
    expect(planner.distanceMeters).toBe(588);
  });
  it("recalculates legacy plans but preserves legacy runs in progress", async () => {
    vi.useFakeTimers();
    const calculate = vi.fn().mockResolvedValue(result);
    const planner = new RoutePlanner(vi.fn(), calculate);
    planner.load([a, b]);
    expect(planner.blocked).toBe(true);
    await vi.advanceTimersByTimeAsync(350);
    expect(planner.points).toEqual(detour);
    planner.restoreRun([a, b]);
    expect(planner.points).toEqual([a, b]);
    expect(planner.blocked).toBe(true);
  });
});
