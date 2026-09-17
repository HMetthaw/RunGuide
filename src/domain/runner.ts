import { z } from "zod";
import {
  fixSchema,
  goalSchema,
  pointSchema,
  tracePointSchema,
  type Fix,
  type Goal,
  type Point,
  type Run,
  type RunPhase,
  type TracePoint,
} from "../types/models";
import { distance, simplifyTrace } from "./geo";

export const draftSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.number().finite().nonnegative(),
  elapsedMs: z.number().finite().nonnegative(),
  goal: goalSchema,
  route: z.array(pointSchema).max(5000),
  trace: z.array(tracePointSchema).max(30000),
  meters: z.number().finite().nonnegative(),
  rejectedFixes: z.number().int().nonnegative(),
  gaps: z.number().int().nonnegative(),
  navigationNext: z.number().int().nonnegative().default(0),
});
export type Draft = z.infer<typeof draftSchema>;
export class Runner {
  phase: RunPhase = "idle";
  goal: Goal = { distanceKm: 5, durationMinutes: 30 };
  route: Point[] = [];
  trace: TracePoint[] = [];
  meters = 0;
  rejectedFixes = 0;
  gaps = 0;
  navigationNext = 0;
  lastFix: Fix | null = null;
  private anchor: Fix | null = null;
  private lastSeen = 0;
  private segment = 0;
  private samples: { at: number; meters: number; moving: boolean }[] = [];
  private elapsedMs = 0;
  private activeSince: number | null = null;
  private startedAt = 0;
  private id = "";

  start(goal: Goal, route: Point[]) {
    if (!["idle", "finished"].includes(this.phase)) return;
    this.goal = goalSchema.parse(goal);
    this.route = route.map((p) => ({ ...p }));
    this.trace = [];
    this.meters = 0;
    this.rejectedFixes = 0;
    this.gaps = 0;
    this.navigationNext = 0;
    this.lastFix = null;
    this.anchor = null;
    this.lastSeen = 0;
    this.segment = 0;
    this.samples = [];
    this.elapsedMs = 0;
    this.activeSince = null;
    this.startedAt = 0;
    this.id = crypto.randomUUID();
    this.phase = "acquiring";
  }
  elapsed(now: number): number {
    return (
      (this.elapsedMs +
        (this.activeSince === null ? 0 : Math.max(0, now - this.activeSince))) /
      1000
    );
  }
  ingest(
    input: Fix,
    now: number,
  ): "accepted" | "weak" | "stale" | "jump" | "jitter" | "ignored" {
    if (this.phase !== "acquiring" && this.phase !== "running")
      return "ignored";
    const parsed = fixSchema.safeParse(input);
    if (!parsed.success || parsed.data.accuracy > 35) {
      this.rejectedFixes++;
      return "weak";
    }
    const fix = parsed.data;
    if (
      fix.timestamp <= this.lastSeen ||
      now - fix.timestamp > 15000 ||
      fix.timestamp > now + 2000
    ) {
      this.rejectedFixes++;
      return "stale";
    }
    this.lastSeen = fix.timestamp;
    if (this.anchor && fix.timestamp - this.anchor.timestamp > 15000) {
      this.anchor = null;
      this.samples = [];
      this.segment++;
      this.gaps++;
    }
    if (!this.anchor) {
      this.anchor = fix;
      this.lastFix = fix;
      this.trace.push({ ...fix, segment: this.segment });
      this.samples = [{ at: fix.timestamp, meters: this.meters, moving: true }];
      if (this.phase === "acquiring") {
        if (!this.startedAt) this.startedAt = now;
        this.activeSince = now;
        this.phase = "running";
      }
      return "accepted";
    }
    const delta = distance(this.anchor, fix),
      seconds = (fix.timestamp - this.anchor.timestamp) / 1000;
    if (delta / seconds > 9 || (fix.speed !== null && fix.speed > 9)) {
      this.rejectedFixes++;
      return "jump";
    }
    this.lastFix = fix;
    // Keep the anchor until meaningful movement exceeds measurement noise.
    const moved =
      delta >=
      Math.max(3, Math.min(12, (this.anchor.accuracy + fix.accuracy) * 0.35));
    if (moved) {
      this.meters += delta;
      this.anchor = fix;
      this.trace.push({ ...fix, segment: this.segment });
      if (this.trace.length > 29000) this.trace = simplifyTrace(this.trace, 6);
    } else if (seconds >= 10) {
      // Refresh timestamp, not coordinates: stationary noise must not accumulate.
      this.anchor = { ...this.anchor, timestamp: fix.timestamp };
    }
    this.samples.push({
      at: fix.timestamp,
      meters: this.meters,
      moving: moved,
    });
    this.samples = this.samples.filter(
      (sample) => sample.at >= fix.timestamp - 45000,
    );
    return moved ? "accepted" : "jitter";
  }
  currentPace(now: number): number | null {
    if (
      this.phase !== "running" ||
      !this.lastFix ||
      now - this.lastFix.timestamp > 10000 ||
      this.samples.length < 2
    )
      return null;
    const moving = this.samples.filter((sample) => sample.moving);
    if (moving.length < 2) return null;
    const first = moving[0],
      last = moving[moving.length - 1];
    if (now - last.at >= 10000) return null;
    const seconds = (last.at - first.at) / 1000,
      meters = last.meters - first.meters;
    return seconds >= 20 && meters >= 30 ? (seconds * 1000) / meters : null;
  }
  pause(now: number) {
    if (!["acquiring", "running"].includes(this.phase)) return;
    this.elapsedMs = this.elapsed(now) * 1000;
    this.activeSince = null;
    this.phase = "paused";
    this.anchor = null;
    this.lastFix = null;
    this.samples = [];
    this.segment++;
  }
  resume() {
    if (this.phase === "paused") this.phase = "acquiring";
  }
  checkpoint(now: number): Draft | null {
    if (!this.startedAt) return null;
    return {
      id: this.id,
      startedAt: this.startedAt,
      elapsedMs: this.elapsed(now) * 1000,
      goal: this.goal,
      route: this.route,
      trace: this.trace,
      meters: this.meters,
      rejectedFixes: this.rejectedFixes,
      gaps: this.gaps,
      navigationNext: this.navigationNext,
    };
  }
  restore(value: unknown) {
    const draft = draftSchema.parse(value);
    this.id = draft.id;
    this.startedAt = draft.startedAt;
    this.elapsedMs = draft.elapsedMs;
    this.goal = draft.goal;
    this.route = draft.route;
    this.trace = draft.trace;
    this.meters = draft.meters;
    this.rejectedFixes = draft.rejectedFixes;
    this.gaps = draft.gaps;
    this.navigationNext = draft.navigationNext;
    this.segment = Math.max(0, ...draft.trace.map((p) => p.segment)) + 1;
    this.activeSince = null;
    this.lastFix = null;
    this.anchor = null;
    this.samples = [];
    this.phase = "paused";
  }
  finish(now: number): Run | null {
    if (!["acquiring", "running", "paused"].includes(this.phase)) return null;
    this.pause(now);
    this.phase = "finished";
    if (!this.startedAt || this.trace.length < 2 || this.meters < 10)
      return null;
    return {
      id: this.id,
      startedAt: new Date(this.startedAt).toISOString(),
      finishedAt: new Date(now).toISOString(),
      durationSeconds: this.elapsedMs / 1000,
      distanceMeters: this.meters,
      goal: this.goal,
      trace: simplifyTrace(this.trace),
      plannedRoute: this.route,
      quality: { rejectedFixes: this.rejectedFixes, gaps: this.gaps },
      feedback: "",
    };
  }
}
