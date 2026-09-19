import { fixSchema, type Fix, type Point } from "../types/models";
import type { NavigationTurn, RouteMatch } from "../types/navigation";
import {
  bearing,
  distance,
  projectOnSegment,
  segmentDistance,
  turnAt,
} from "./geo";

const PREVIEW_METERS = 65;
const TURN_METERS = 15;
const INSTRUCTION_INTERVAL_MS = 4000;
const OFF_ROUTE_METERS = 35;
const RETURN_METERS = 15;
const CONFIRM_MS = 4000;
const OFF_ROUTE_REPEAT_MS = 60000;
const MAX_FIX_AGE_MS = 10000;

// Geometry has many vertices that merely describe a road. Remove small wiggles
// before deriving turns, retaining original indices for checkpoints and distance.
function routeTurns(route: Point[], cumulative: number[]): NavigationTurn[] {
  if (route.length < 3) return [];
  const keep = new Set([0, route.length - 1]);
  const pending: [number, number][] = [[0, route.length - 1]];
  while (pending.length) {
    const [start, end] = pending.pop()!;
    let furthest = -1;
    let deviation = 5;
    for (let i = start + 1; i < end; i++) {
      const meters = segmentDistance(route[i], route[start], route[end]);
      if (meters > deviation) {
        deviation = meters;
        furthest = i;
      }
    }
    if (furthest !== -1) {
      keep.add(furthest);
      pending.push([start, furthest], [furthest, end]);
    }
  }
  const indices = [...keep].sort((a, b) => a - b);
  const turns: NavigationTurn[] = [];
  let previousAngle = 0;
  for (let i = 1; i < indices.length - 1; i++) {
    const index = indices[i];
    if (
      distance(route[indices[i - 1]], route[index]) < 8 ||
      distance(route[index], route[indices[i + 1]]) < 8
    )
      continue;
    const direction = turnAt(
      route[indices[i - 1]],
      route[index],
      route[indices[i + 1]],
    );
    if (direction === "straight") continue;
    const angle = Math.abs(
      ((bearing(route[index], route[indices[i + 1]]) -
        bearing(route[indices[i - 1]], route[index]) +
        540) %
        360) -
        180,
    );
    const previous = turns.at(-1);
    // A rounded corner can have several same-direction geometry bends.
    if (
      previous?.direction === direction &&
      angle < 60 &&
      previousAngle < 60 &&
      cumulative[index] - cumulative[previous.index] < 30
    )
      continue;
    turns.push({ index, direction });
    previousAngle = angle;
  }
  return turns;
}

export class Navigator {
  next = 0;
  hasPriority = false;
  private announced = new Map<number, "preview" | "turn">();
  private lastOffRouteAt = -Infinity;
  private lastInstructionAt = -Infinity;
  private lastTimestamp = -Infinity;
  private matchedAt: number | null = null;
  private offRouteSince: number | null = null;
  private returningSince: number | null = null;
  private offRoute = false;
  private progress = 0;
  private cumulative: number[] = [0];
  private turns: NavigationTurn[];

  constructor(private route: Point[]) {
    for (let i = 1; i < route.length; i++)
      this.cumulative[i] =
        this.cumulative[i - 1] + distance(route[i - 1], route[i]);
    this.turns = routeTurns(route, this.cumulative);
  }

  // Rejected fixes, permission loss and pauses break consecutive GPS evidence.
  resetConfidence() {
    this.offRouteSince = null;
    this.returningSince = null;
  }

  private match(fix: Fix): RouteMatch | null {
    const candidates: RouteMatch[] = [];
    const start = Math.max(0, this.next - 1);
    const from = Math.max(this.progress, this.cumulative[start]);
    const lookAhead = Math.max(
      300,
      ((fix.timestamp - (this.matchedAt ?? fix.timestamp)) / 1000) * 9,
    );
    // Search upcoming segments. After signal loss or a detour, allow the same
    // maximum running speed as Runner so a distant return cannot strand progress.
    for (let i = start; i < this.route.length - 1; i++) {
      if (this.cumulative[i] > from + lookAhead) break;
      const projection = projectOnSegment(
        fix,
        this.route[i],
        this.route[i + 1],
      );
      const meters =
        this.cumulative[i] +
        projection.fraction * (this.cumulative[i + 1] - this.cumulative[i]);
      candidates.push({
        segment: i,
        meters,
        deviation: distance(fix, projection.point),
      });
    }
    if (!candidates.length) return null;
    const closest = Math.min(
      ...candidates.map((candidate) => candidate.deviation),
    );
    // Prefer the first plausible segment at crossings or overlapping out/back
    // legs. Small GPS noise must not select a much later traversal of that road.
    return candidates.find(
      (candidate) => candidate.deviation <= closest + Math.min(fix.accuracy, 8),
    )!;
  }

  private turnInstruction(meters: number, now: number): string | null {
    const turn = this.turns.find(
      (candidate) =>
        candidate.index >= this.next &&
        this.cumulative[candidate.index] >= meters - 3,
    );
    if (!turn) return null;
    const remaining = Math.max(0, this.cumulative[turn.index] - meters);
    if (remaining > PREVIEW_METERS) return null;
    this.hasPriority = true;
    const stage = remaining <= TURN_METERS ? "turn" : "preview";
    const previous = this.announced.get(turn.index);
    if (
      previous === "turn" ||
      previous === stage ||
      now - this.lastInstructionAt < INSTRUCTION_INTERVAL_MS ||
      (previous === "preview" && now - this.lastInstructionAt < 8000)
    )
      return null;
    this.announced.set(turn.index, stage);
    this.lastInstructionAt = now;
    const direction = { left: "doleva", right: "doprava", back: "zpět" };
    const instruction =
      turn.direction === "back"
        ? "Otočte se zpět"
        : `Odbočte ${direction[turn.direction]}`;
    return stage === "turn"
      ? `${instruction}.`
      : `${instruction} za přibližně ${Math.round(remaining / 10) * 10} metrů.`;
  }

  update(fix: Fix, now: number): string | null {
    if (
      !fixSchema.safeParse(fix).success ||
      fix.accuracy > 25 ||
      now - fix.timestamp > MAX_FIX_AGE_MS ||
      fix.timestamp > now + 2000 ||
      fix.timestamp <= this.lastTimestamp
    ) {
      this.resetConfidence();
      return null;
    }
    if (fix.timestamp - this.lastTimestamp > MAX_FIX_AGE_MS)
      this.resetConfidence();
    this.lastTimestamp = fix.timestamp;
    this.matchedAt ??= fix.timestamp;
    this.hasPriority = false;
    if (this.route.length < 2 || this.next >= this.route.length) return null;
    const match = this.match(fix);
    if (!match) return null;
    const onRoute = match.deviation <= Math.max(RETURN_METERS, fix.accuracy);
    const outside = match.deviation - fix.accuracy > OFF_ROUTE_METERS;
    if (outside) {
      this.hasPriority = true;
      this.returningSince = null;
      this.offRouteSince ??= fix.timestamp;
      if (
        fix.timestamp - this.offRouteSince >= CONFIRM_MS &&
        now - this.lastOffRouteAt >= OFF_ROUTE_REPEAT_MS
      ) {
        this.offRoute = true;
        this.lastOffRouteAt = now;
        return "Opustili jste trasu.";
      }
      return null;
    }
    this.offRouteSince = null;
    if (!onRoute) {
      this.hasPriority = true;
      this.returningSince = null;
      return null;
    }
    let returned = false;
    if (this.offRoute) {
      this.hasPriority = true;
      this.returningSince ??= fix.timestamp;
      if (fix.timestamp - this.returningSince < CONFIRM_MS) return null;
      this.offRoute = false;
      this.returningSince = null;
      this.lastOffRouteAt = -Infinity;
      returned = true;
    }
    // Evaluate the turn before consuming a nearby point; otherwise the first
    // accurate fix just before a junction can silently skip its instruction.
    const instruction = this.turnInstruction(match.meters, now);
    this.matchedAt = fix.timestamp;
    this.progress = Math.max(this.progress, match.meters);
    this.next = Math.max(this.next, match.segment + 1);
    const arrivalRadius = 8;
    while (
      this.next < this.route.length &&
      this.cumulative[this.next] <= this.progress + arrivalRadius &&
      distance(fix, this.route[this.next]) <= arrivalRadius
    )
      this.next++;
    if (this.next === this.route.length) {
      this.hasPriority = true;
      return "Dorazili jste k poslednímu bodu trasy.";
    }
    if (returned)
      return `Jste zpět na trase.${instruction ? ` ${instruction}` : ""}`;
    return instruction;
  }
}
