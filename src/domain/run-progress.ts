import type { RunProgress } from "../types/coaching";
import type { Goal } from "../types/models";
import { remainingTime } from "./pace";

export function averagePace(
  meters: number,
  activeSeconds: number,
): number | null {
  if (
    !Number.isFinite(meters) ||
    !Number.isFinite(activeSeconds) ||
    meters <= 0 ||
    activeSeconds <= 0
  )
    return null;
  return (activeSeconds * 1000) / meters;
}

// A conditional projection at the whole-run average, never a GPS gap repair.
export function runProgress(
  goal: Goal,
  meters: number,
  activeSeconds: number,
): RunProgress {
  const average = averagePace(meters, activeSeconds);
  const remaining = remainingTime(goal, meters, activeSeconds);
  const projectedRemainingSeconds =
    average === null ? null : (remaining.remainingMeters * average) / 1000;
  return {
    ...remaining,
    averagePace: average,
    projectedRemainingSeconds,
    projectedTotalSeconds:
      projectedRemainingSeconds === null
        ? null
        : activeSeconds + projectedRemainingSeconds,
  };
}
