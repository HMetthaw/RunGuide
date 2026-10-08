import { z } from "zod";

export const paceIntervalSchema = z.number().int().min(15).max(3600);
const channelSchema = z.object({
  enabled: z.boolean(),
  intervalSeconds: paceIntervalSchema,
});
export const paceSettingsSchema = z.object({
  current: channelSchema,
  average: channelSchema,
});
export type PaceSettings = z.infer<typeof paceSettingsSchema>;
export type PaceChannel = keyof PaceSettings;
export interface DuePaces {
  current: boolean;
  average: boolean;
}

export const DEFAULT_PACE_SETTINGS: PaceSettings = {
  current: { enabled: true, intervalSeconds: 120 },
  average: { enabled: false, intervalSeconds: 120 },
};
