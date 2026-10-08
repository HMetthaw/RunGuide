import type { RunPhase } from "./models";

export interface FreeRunSnapshot {
  phase: RunPhase;
  activeSeconds: number;
  meters: number;
  currentPace: number | null;
  gpsReliable: boolean;
  traceIncomplete: boolean;
}

export type FreeRunAdvice =
  | {
      kind: "pace";
      pace: number | null;
      averagePace: number | null;
      averageUncertain: boolean;
    }
  | { kind: "kilometer"; kilometer: number; pace: number | null };
