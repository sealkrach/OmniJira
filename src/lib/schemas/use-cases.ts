import { z } from "zod";

export const useCaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  entityId: z.string().cuid(),
  parentId: z.string().cuid().optional().nullable(),
  level: z.enum(["DOMAIN", "CAPABILITY", "INITIATIVE"]),
  targetQuarter: z.number().int().min(1).max(4).optional().nullable(),
  targetYear: z.number().int().min(2020).max(2040).optional().nullable(),
  priority: z.number().int().min(0).max(100).default(0),
  statusOverride: z.enum(["GREEN", "AMBER", "RED"]).optional().nullable(),
  ownerId: z.string().cuid().optional().nullable(),
});

export const importEpicsSchema = z.object({
  jiraInstanceId: z.string().cuid(),
  projectKey: z.string().min(1),
  entityId: z.string().cuid(),
  parentId: z.string().cuid().optional().nullable(),
});
