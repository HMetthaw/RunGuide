import {
  fixSchema,
  goalSchema,
  type Fix,
  type Goal,
  type Point,
  type Run,
  type Routing,
  type RunPhase,
  type TracePoint,
} from "../types/models";
import { distance, simplifyTrace } from "./geo";
import {
  draftSchema,
  type Draft,
  type TrackingInterruption,
} from "../types/recording";
export { draftSchema, type Draft } from "../types/recording";

export const GPS_GAP_MS = 15000;
export class Runner {
  phase: RunPhase = "idle";
  goal: Goal = { distanceKm: 5, durationMinutes: 30 };
  route: Point[] = [];
  routing: Routing | undefined;
  trace: TracePoint[] = [];
  meters = 0;
  rejectedFixes = 0;
  gaps = 0;
  recoveryUncertain = false;
  interruption: TrackingInterruption | null = null;
  private untrackedMs = 0;
  private acceptAfter = 0;
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

  start(goal: Goal, route: Point[], routing?: Routing) {
    if (!["idle", "finished"].includes(this.phase)) return;
    this.goal = goalSchema.parse(goal);
    this.route = route.map((p) => ({ ...p }));
    this.routing = routing ? structuredClone(routing) : undefined;
    this.trace = [];
    this.meters = 0;
    this.rejectedFixes = 0;
    this.gaps = 0;
    this.recoveryUncertain = false;
    this.interruption = null;
    this.untrackedMs = 0;
    this.acceptAfter = 0;
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
  get incomplete(): boolean {
    return this.gaps > 0 || this.recoveryUncertain;
  }
  averagePace(now: number): number | null {
    return !this.incomplete && this.meters > 10
      ? (this.elapsed(now) * 1000) / this.meters
      : null;
  }
  untrackedSeconds(now: number): number {
    return (
      (this.untrackedMs +
        (this.interruption ? Math.max(0, now - this.interruption.since) : 0)) /
      1000
    );
  }
  interrupt(now: number, reason: TrackingInterruption["reason"]): boolean {
    if (this.phase !== "running" || this.interruption) return false;
    this.interruption = { since: this.lastFix?.timestamp ?? now, reason };
    this.gaps++;
    this.segment++;
    this.anchor = null;
    this.samples = [];
    return true;
  }
  checkSignal(now: number): boolean {
    return this.phase === "running" &&
      this.lastFix !== null &&
      now - this.lastFix.timestamp > GPS_GAP_MS
      ? this.interrupt(now, "gps-timeout")
      : false;
  }
  // A new watcher must not anchor the route to a cached position from before return.
  reacquire(now: number) {
    this.acceptAfter = now;
  }
  private closeInterruption(now: number) {
    if (!this.interruption) return;
    this.untrackedMs += Math.max(0, now - this.interruption.since);
    this.interruption = null;
  }
  ingest(
    input: Fix,
    now: number,
  ): "accepted" | "weak" | "stale" | "jump" | "jitter" | "ignored" {
    if (this.phase !== "acquiring" && this.phase !== "running")
      return "ignored";
    this.checkSignal(now);
    const parsed = fixSchema.safeParse(input);
    if (!parsed.success || parsed.data.accuracy > 35) {
      this.rejectedFixes++;
      return "weak";
    }
    const fix = parsed.data;
    if (
      fix.timestamp <= this.lastSeen ||
      fix.timestamp < this.acceptAfter ||
      now - fix.timestamp > GPS_GAP_MS ||
      fix.timestamp > now + 2000
    ) {
      this.rejectedFixes++;
      return "stale";
    }
    this.lastSeen = fix.timestamp;
    if (fix.speed !== null && fix.speed > 9) {
      this.rejectedFixes++;
      return "jump";
    }
    if (!this.anchor) {
      this.closeInterruption(now);
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
    const previous = this.lastFix!;
    // Short-interval checks need the reported position uncertainty as well:
    // two noisy fixes can otherwise look like a sprint at high sample rates.
    const reachable =
      9 * ((fix.timestamp - previous.timestamp) / 1000) +
      previous.accuracy +
      fix.accuracy;
    if (delta / seconds > 9 || distance(previous, fix) > reachable) {
      this.rejectedFixes++;
      return "jump";
    }
    this.lastFix = fix;
    // Keep the anchor until meaningful movement exceeds measurement noise.
    const uncertainty = this.anchor.accuracy + fix.accuracy;
    const movementThreshold = Math.max(3, Math.min(12, uncertainty * 0.35));
    // A measured zero/near-zero speed corroborates stationary position noise.
    // Unknown speed must still allow running; displacement beyond the reported
    // uncertainty also wins over a stuck speed sensor.
    const stationary =
      fix.speed !== null && fix.speed < 0.5 && delta < uncertainty;
    const moved = delta >= movementThreshold && !stationary;
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
      this.interruption !== null ||
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
    this.checkSignal(now);
    this.closeInterruption(now);
    this.elapsedMs = this.elapsed(now) * 1000;
    this.activeSince = null;
    this.phase = "paused";
    this.anchor = null;
    this.lastFix = null;
    this.samples = [];
    this.segment++;
  }
  resume(now?: number) {
    if (this.phase === "paused") {
      this.phase = "acquiring";
      if (now !== undefined) this.reacquire(now);
    }
  }
  checkpoint(now: number): Draft | null {
    if (!this.id || this.phase === "idle") return null;
    this.checkSignal(now);
    return {
      id: this.id,
      startedAt: this.startedAt,
      elapsedMs: this.elapsed(now) * 1000,
      goal: this.goal,
      route: this.route,
      routing: this.routing,
      trace: this.trace,
      meters: this.meters,
      rejectedFixes: this.rejectedFixes,
      gaps: this.gaps,
      navigationNext: this.navigationNext,
      phase: this.phase,
      savedAt: now,
      untrackedMs: this.untrackedMs,
      recoveryUncertain: this.recoveryUncertain,
      interruption: this.interruption,
    };
  }
  restore(value: unknown) {
    const draft = draftSchema.parse(value);
    this.id = draft.id;
    this.startedAt = draft.startedAt;
    this.elapsedMs = draft.elapsedMs;
    this.goal = draft.goal;
    this.route = draft.route;
    this.routing = draft.routing;
    this.trace = draft.trace;
    this.meters = draft.meters;
    this.rejectedFixes = draft.rejectedFixes;
    this.gaps = draft.gaps;
    this.untrackedMs = draft.untrackedMs ?? 0;
    if (draft.interruption && draft.savedAt !== undefined)
      this.untrackedMs += Math.max(0, draft.savedAt - draft.interruption.since);
    const interrupted = draft.startedAt > 0 && draft.phase !== "paused";
    this.recoveryUncertain = !!draft.recoveryUncertain || interrupted;
    if (interrupted && !draft.interruption) this.gaps++;
    this.interruption = null;
    this.navigationNext = draft.navigationNext;
    this.segment = Math.max(0, ...draft.trace.map((p) => p.segment)) + 1;
    this.activeSince = null;
    this.lastFix = null;
    this.lastSeen = draft.trace.at(-1)?.timestamp ?? 0;
    this.acceptAfter = draft.savedAt ?? this.lastSeen;
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
      quality: {
        rejectedFixes: this.rejectedFixes,
        gaps: this.gaps,
        untrackedSeconds: this.untrackedMs / 1000,
        recoveryUncertain: this.recoveryUncertain,
      },
      feedback: "",
    };
  }
}
