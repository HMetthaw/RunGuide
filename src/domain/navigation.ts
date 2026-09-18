import type { Fix, Point } from "../types/models";
import { distance, segmentDistance, turnAt } from "./geo";
export class Navigator {
  next = 0;
  private announced = new Set<number>();
  private lastOffRouteAt = 0;
  private lastInstructionAt = -Infinity;
  private cumulative: number[] = [0];
  constructor(private route: Point[]) {
    for (let i = 1; i < route.length; i++)
      this.cumulative[i] =
        this.cumulative[i - 1] + distance(route[i - 1], route[i]);
  }
  update(fix: Fix, now: number): string | null {
    if (
      fix.accuracy > 25 ||
      !this.route.length ||
      this.next >= this.route.length
    )
      return null;
    const radius = Math.max(12, Math.min(25, fix.accuracy));
    // If GPS missed a waypoint, arriving at a nearby following waypoint must recover progress.
    // Never jump to a later point that overlaps the already-visited part of a loop.
    if (this.next > 0 && distance(fix, this.route[this.next]) >= radius) {
      const candidates = this.route
        .map((point, index) => ({ point, index, meters: distance(fix, point) }))
        .filter(
          (candidate) =>
            candidate.index > this.next &&
            this.cumulative[candidate.index] - this.cumulative[this.next] <=
              300 &&
            candidate.meters < radius,
        )
        .filter(
          (candidate) =>
            !this.route
              .slice(0, this.next)
              .some(
                (visited) => distance(visited, candidate.point) < radius * 2,
              ),
        )
        .sort((a, b) => a.meters - b.meters);
      if (candidates[0]) this.next = candidates[0].index;
    }
    // Progress only forward. Do not mistake an overlapping finish for the start.
    while (
      this.next < this.route.length &&
      distance(fix, this.route[this.next]) < radius
    )
      this.next++;
    if (this.next === this.route.length)
      return "Dorazil jsi k poslednímu bodu trasy.";
    const target = this.route[this.next],
      meters = distance(fix, target);
    if (this.next === 0) return null;
    const deviation = segmentDistance(fix, this.route[this.next - 1], target);
    if (deviation > 80 && now - this.lastOffRouteAt > 60000) {
      this.lastOffRouteAt = now;
      return "Jsi mimo plánovanou linii. Až bude bezpečné zastavit, zkontroluj trasu.";
    }
    if (deviation > 80 || meters > 70 || now - this.lastInstructionAt < 12000)
      return null;
    // Geometry vertices describe bends, not necessarily intersections. Look ahead
    // along the path and stay quiet on straight sections of a dense routed line.
    let instruction = this.next;
    while (
      instruction < this.route.length - 1 &&
      turnAt(
        this.route[instruction - 1],
        this.route[instruction],
        this.route[instruction + 1],
      ) === "straight"
    )
      instruction++;
    const remaining =
      meters + this.cumulative[instruction] - this.cumulative[this.next];
    if (remaining > 70 || this.announced.has(instruction)) return null;
    this.announced.add(instruction);
    this.lastInstructionAt = now;
    if (instruction === this.route.length - 1)
      return `Poslední bod trasy je asi ${Math.round(remaining / 10) * 10} metrů před tebou.`;
    const directions = {
      left: "doleva",
      right: "doprava",
      straight: "rovně",
      back: "zpátky",
    };
    return `Za přibližně ${Math.round(remaining / 10) * 10} metrů pokračuje plánovaná trasa ${directions[turnAt(this.route[instruction - 1], this.route[instruction], this.route[instruction + 1])]}.`;
  }
}
