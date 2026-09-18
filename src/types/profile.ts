import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().max(40),
  weeklyKm: z.number().finite().min(1).max(500),
});
export type Profile = z.infer<typeof profileSchema>;
