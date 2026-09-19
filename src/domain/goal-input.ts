import { goalSchema } from "../types/models";

export function parseDecimalInput(raw: string): number | null {
  const value = raw.trim();
  // Accept either decimal separator, but never a partial number or unit suffix.
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseGoalInput(distance: string, minutes: string) {
  return goalSchema.safeParse({
    distanceKm: parseDecimalInput(distance),
    durationMinutes: parseDecimalInput(minutes),
  });
}
