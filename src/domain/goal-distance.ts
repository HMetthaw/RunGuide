import { goalSchema } from "../types/models";

export function routeGoalDistance(distanceMeters: number): number | null {
  const parsed = goalSchema.shape.distanceKm.safeParse(distanceMeters / 1000);
  // Keep millimeter precision without exposing floating-point conversion noise.
  return parsed.success ? Number(parsed.data.toFixed(6)) : null;
}
