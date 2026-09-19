import { z } from "zod";

export const pointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
export const fixSchema = pointSchema.extend({
  timestamp: z.number().finite().nonnegative(),
  accuracy: z.number().finite().positive(),
  speed: z.number().finite().nonnegative().nullable().default(null),
});
export const tracePointSchema = fixSchema.extend({
  segment: z.number().int().nonnegative(),
});
export const goalSchema = z.object({
  distanceKm: z.number().min(0.1).max(100),
  durationMinutes: z.number().min(1).max(1440),
});
export const routingSchema = z.object({
  profile: z.literal("foot"),
  provider: z.literal("osrm"),
  waypoints: z.array(pointSchema).min(2).max(100),
  distanceMeters: z.number().finite().nonnegative(),
});
const goalDistanceSourceSchema = z.enum(["route", "manual"]);
export const planSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  goal: goalSchema,
  goalDistanceSource: goalDistanceSourceSchema.optional(),
  points: z.array(pointSchema).min(2).max(5000),
  routing: routingSchema.optional(),
  createdAt: z.string().datetime(),
});
export const runSchema = z
  .object({
    id: z.string().uuid(),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    durationSeconds: z.number().finite().nonnegative(),
    distanceMeters: z.number().finite().nonnegative(),
    goal: goalSchema,
    trace: z.array(tracePointSchema).max(30000),
    plannedRoute: z.array(pointSchema).max(5000),
    quality: z.object({
      rejectedFixes: z.number().int().nonnegative(),
      gaps: z.number().int().nonnegative(),
      untrackedSeconds: z.number().finite().nonnegative().optional(),
      recoveryUncertain: z.boolean().optional(),
    }),
    feedback: z.string().max(1000).default(""),
  })
  .refine(
    (run) => Date.parse(run.finishedAt) >= Date.parse(run.startedAt),
    "Invalid run dates",
  );
export type Point = z.infer<typeof pointSchema>;
export type Routing = z.infer<typeof routingSchema>;
export interface RoutedPath {
  points: Point[];
  routing: Routing;
}
export type Fix = z.infer<typeof fixSchema>;
export type TracePoint = z.infer<typeof tracePointSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type GoalDistanceSource = z.infer<typeof goalDistanceSourceSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Run = z.infer<typeof runSchema>;
export type RunPhase = "idle" | "acquiring" | "running" | "paused" | "finished";
