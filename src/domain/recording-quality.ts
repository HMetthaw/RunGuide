import type { Run } from "../types/models";

export function isIncomplete(run: Run): boolean {
  return run.quality.gaps > 0 || !!run.quality.recoveryUncertain;
}
export function averageRunPace(run: Run): number | null {
  return !isIncomplete(run) && run.distanceMeters > 0
    ? (run.durationSeconds * 1000) / run.distanceMeters
    : null;
}
