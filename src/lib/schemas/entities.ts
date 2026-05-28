import { z } from "zod";

export const entitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  parentId: z.string().cuid().optional().nullable(),
});
