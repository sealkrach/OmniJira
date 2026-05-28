import { z } from "zod";

export const createInstanceSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  email: z.string().email(),
  token: z.string().min(1),
  instanceType: z.enum(["CLOUD", "SERVER"]).default("CLOUD"),
  syncEnabled: z.boolean().default(true),
  syncIntervalMinutes: z.number().int().min(5).max(1440).default(60),
  projectFilter: z.array(z.string()).default([]),
  storyPointsField: z.string().default("customfield_10016"),
});

export const updateInstanceSchema = createInstanceSchema.partial().omit({ token: true }).extend({
  token: z.string().min(1).optional(),
});
