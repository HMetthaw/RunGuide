import type { Goal } from "../types/models";
export const targetPace = (goal: Goal): number =>
  (goal.durationMinutes * 60) / goal.distanceKm;
export function formatPace(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
export function formatSpokenPace(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0)
    return "není k dispozici";
  // Round before splitting so 8:59.5 becomes 9 minutes, never 60 seconds.
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  const minuteUnit =
    minutes === 1 ? "minuta" : minutes >= 2 && minutes <= 4 ? "minuty" : "minut";
  const secondUnit =
    remainder === 1
      ? "sekunda"
      : remainder >= 2 && remainder <= 4
        ? "sekundy"
        : "sekund";
  return `${minutes} ${minuteUnit} ${remainder} ${secondUnit} na kilometr`;
}
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export const formatDistance = (meters: number): string =>
  (meters / 1000).toLocaleString("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function remainingTime(goal: Goal, meters: number, elapsed: number) {
  const remainingMeters = Math.max(0, goal.distanceKm * 1000 - meters);
  const remainingSeconds = Math.max(0, goal.durationMinutes * 60 - elapsed);
  return {
    remainingMeters,
    remainingSeconds,
    requiredPace:
      remainingMeters > 0 && remainingSeconds > 0
        ? (remainingSeconds * 1000) / remainingMeters
        : null,
  };
}
export type PaceAdvice = "fast" | "slow" | "on-target";
export function paceAdvice(
  pace: number | null,
  target: number,
  elapsed: number,
  now: number,
  lastAdvice: number,
): PaceAdvice | null {
  if (
    pace === null ||
    !Number.isFinite(pace) ||
    elapsed < 60 ||
    now - lastAdvice < 60000
  )
    return null;
  const delta = pace - target;
  return delta < -20 ? "fast" : delta > 20 ? "slow" : "on-target";
}
