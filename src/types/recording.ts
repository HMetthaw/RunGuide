import { z } from "zod";
import {
  goalSchema,
  pointSchema,
  routingSchema,
  tracePointSchema,
} from "./models";

export const interruptionSchema = z.object({
  since: z.number().finite().nonnegative(),
  reason: z.enum(["hidden", "pagehide", "gps-timeout", "gps-error"]),
});
export type TrackingInterruption = z.infer<typeof interruptionSchema>;

export const draftSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.number().finite().nonnegative(),
  elapsedMs: z.number().finite().nonnegative(),
  goal: goalSchema,
  route: z.array(pointSchema).max(5000),
  routing: routingSchema.optional(),
  trace: z.array(tracePointSchema).max(30000),
  meters: z.number().finite().nonnegative(),
  rejectedFixes: z.number().int().nonnegative(),
  gaps: z.number().int().nonnegative(),
  navigationNext: z.number().int().nonnegative().default(0),
  // Optional for existing v2 checkpoints. A legacy phase is unknown, not paused.
  phase: z.enum(["acquiring", "running", "paused", "finished"]).optional(),
  savedAt: z.number().finite().nonnegative().optional(),
  untrackedMs: z.number().finite().nonnegative().optional(),
  recoveryUncertain: z.boolean().optional(),
  interruption: interruptionSchema.nullable().optional(),
});
export type Draft = z.infer<typeof draftSchema>;
