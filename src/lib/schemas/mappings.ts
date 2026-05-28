import { z } from "zod";

const conditionSchema = z.object({
  field: z.enum([
    "projectKey",
    "epicKey",
    "epicName",
    "label",
    "component",
    "issueType",
    "sprintName",
    "priority",
    "assignee",
    "customField",
  ]),
  operator: z.enum(["equals", "notEquals", "contains", "startsWith", "endsWith", "matches"]),
  value: z.string().min(1),
  customFieldKey: z.string().optional(),
});

export const mappingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  useCaseId: z.string().cuid(),
  jiraInstanceId: z.string().cuid().optional().nullable(),
  logic: z.enum(["AND", "OR"]).default("AND"),
  conditions: z.array(conditionSchema).min(1),
  priority: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
});
