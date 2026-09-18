import { routeDistance } from "../domain/geo";
import type { Point, RoutedPath, Routing } from "../types/models";
import { MAX_WAYPOINTS, routeOnFoot } from "./routing";

// Coalesce rapid edits and serialize requests; never substitute straight lines on failure.
export class RoutePlanner {
  waypoints: Point[] = [];
  points: Point[] = [];
  routing: Routing | undefined;
  status: "empty" | "pending" | "ready" | "error" = "empty";
  message = "Přidej start a další bod. Spojíme je po pěších cestách.";
  private generation = 0;
  private controller: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRequestAt = -Infinity;
  private cache = new Map<string, RoutedPath>();
  constructor(
    private changed: () => void,
    private calculate = routeOnFoot,
  ) {}
  get blocked() {
    return (
      this.status === "pending" ||
      this.status === "error" ||
      (this.waypoints.length >= 2 && !this.routing)
    );
  }
  get distanceMeters() {
    return this.routing?.distanceMeters ?? routeDistance(this.points);
  }
  private cancel() {
    this.generation++;
    this.controller?.abort();
    clearTimeout(this.timer);
  }
  setWaypoints(points: Point[]) {
    this.cancel();
    this.waypoints = points.map((p) => ({ ...p }));
    this.points = [];
    this.routing = undefined;
    if (points.length < 2) {
      this.status = "empty";
      this.message = points.length
        ? "Přidej další bod, kudy chceš běžet."
        : "Přidej start a další bod. Spojíme je po pěších cestách.";
    } else if (points.length > MAX_WAYPOINTS) {
      this.status = "error";
      this.message = `Plánování podporuje nejvýš ${MAX_WAYPOINTS} zvolených bodů. Uber body nebo vytvoř nový plán.`;
    } else {
      const key = JSON.stringify(this.waypoints);
      const cached = this.cache.get(key);
      if (cached) {
        this.accept(cached);
      } else {
        this.status = "pending";
        this.message = "Hledám pěší cestu a počítám její délku…";
        const generation = this.generation;
        this.timer = setTimeout(
          () => {
            void this.request(generation, key);
          },
          Math.max(350, this.lastRequestAt + 1100 - Date.now()),
        );
      }
    }
    this.changed();
  }
  load(points: Point[], routing?: Routing) {
    if (!routing) {
      this.setWaypoints(points);
      return;
    }
    this.cancel();
    this.waypoints = routing.waypoints.map((p) => ({ ...p }));
    this.accept({ points, routing });
    this.changed();
  }
  restoreRun(points: Point[], routing?: Routing) {
    if (routing || !points.length) {
      this.load(points, routing);
      return;
    }
    // A legacy run in progress must keep its original navigation indices.
    this.cancel();
    this.waypoints = points.map((p) => ({ ...p }));
    this.points = points.map((p) => ({ ...p }));
    this.routing = undefined;
    this.status = "ready";
    this.message =
      "Obnovený běh má původní bodovou trasu. Pro další běh ji přepočítej po cestách.";
    this.changed();
  }
  private accept(result: RoutedPath) {
    this.points = result.points.map((p) => ({ ...p }));
    this.routing = structuredClone(result.routing);
    this.status = "ready";
    this.message =
      "Trasa vede po pěších cestách. Dalším bodem upřesníš, kudy chceš běžet.";
  }
  private async request(generation: number, key: string) {
    this.controller = new AbortController();
    const controller = this.controller;
    this.lastRequestAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await this.calculate(this.waypoints, controller.signal);
      if (generation !== this.generation) return;
      if (controller.signal.aborted)
        throw new Error("Výpočet trval příliš dlouho. Zkus ho znovu.");
      this.cache.set(key, structuredClone(result));
      if (this.cache.size > 20)
        this.cache.delete(this.cache.keys().next().value!);
      this.accept(result);
    } catch (error) {
      if (generation !== this.generation) return;
      this.status = "error";
      this.message = controller.signal.aborted
        ? "Výpočet trval příliš dlouho. Zkus ho znovu."
        : error instanceof TypeError
          ? "Cestu se nepodařilo načíst. Zkontroluj internet a zkus výpočet znovu."
          : error instanceof Error
            ? error.message
            : "Cestu se nepodařilo vypočítat. Zkus to znovu.";
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) this.changed();
    }
  }
}
