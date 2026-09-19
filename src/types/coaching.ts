import type { Goal, RunPhase } from "./models";

export type GoalTrend = "ahead" | "on-track" | "behind";
export type GoalAssessment =
  GoalTrend | "time-expired" | "reached" | "reached-after-time" | "uncertain";

export interface RunProgress {
  averagePace: number | null;
  remainingMeters: number;
  remainingSeconds: number;
  requiredPace: number | null;
  projectedRemainingSeconds: number | null;
  projectedTotalSeconds: number | null;
}

export interface CoachingSnapshot {
  phase: RunPhase;
  goal: Goal;
  activeSeconds: number;
  meters: number;
  currentPace: number | null;
  gpsReliable: boolean;
  traceIncomplete: boolean;
}

export type CoachingAdvice =
  | { kind: "current"; pace: number; trend: GoalTrend; timeExpired: boolean }
  | {
      kind: "progress" | "completion";
      pace: number;
      assessment: GoalAssessment;
      traceIncomplete: boolean;
    };
