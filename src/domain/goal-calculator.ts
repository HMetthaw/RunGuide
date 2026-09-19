/** Pace is stored in seconds/km. Only the editor splits it into minutes/seconds. */
export function parsePaceInput(
  minutes: string,
  seconds: string,
): number | null {
  if (!/^\d+$/.test(minutes) || !/^\d{1,2}$/.test(seconds)) return null;
  const wholeMinutes = Number(minutes);
  const wholeSeconds = Number(seconds);
  const pace = wholeMinutes * 60 + wholeSeconds;
  return Number.isSafeInteger(pace) && wholeSeconds < 60 && pace > 0
    ? pace
    : null;
}

/** Inverse of targetPace: never round values that feed back into the goal. */
export function durationMinutesAtPace(
  distanceKm: number,
  paceSecondsPerKm: number,
): number | null {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(paceSecondsPerKm) ||
    distanceKm <= 0 ||
    paceSecondsPerKm <= 0
  )
    return null;
  const duration = (distanceKm * paceSecondsPerKm) / 60;
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}
