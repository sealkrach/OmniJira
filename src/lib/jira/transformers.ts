import type { JiraIssueRaw, NormalizedTicket } from "@/types/jira";

export function transformIssue(
  issue: JiraIssueRaw,
  storyPointsField: string
): NormalizedTicket {
  const f = issue.fields;

  // Determine epic key: Cloud v3 uses `parent` for epics, v2 uses customfield_10014
  let epicKey: string | null = null;
  let epicName: string | null = null;

  if (f.parent?.fields?.issuetype?.name === "Epic") {
    epicKey = f.parent.key;
    epicName = f.parent.fields.summary;
  } else if (typeof f.customfield_10014 === "string") {
    epicKey = f.customfield_10014;
  }

  if (!epicName && typeof f.customfield_10011 === "string") {
    epicName = f.customfield_10011;
  }

  // Sprint: Cloud uses customfield_10020 (array of sprint objects)
  let sprintName: string | null = null;
  const sprints = f.customfield_10020;
  if (Array.isArray(sprints) && sprints.length > 0) {
    const active = sprints.find((s) => s.state === "active") ?? sprints[sprints.length - 1];
    sprintName = active.name;
  }

  // Story points from configured field
  const rawPoints = f[storyPointsField];
  const storyPoints =
    typeof rawPoints === "number" ? rawPoints : null;

  const statusCategory = f.status?.statusCategory?.key ?? f.status?.statusCategory?.name ?? "undefined";
  const normalizedCategory = normalizeStatusCategory(statusCategory);

  return {
    jiraKey: issue.key,
    summary: f.summary ?? "",
    status: f.status?.name ?? "Unknown",
    statusCategory: normalizedCategory,
    issueType: f.issuetype?.name ?? "Unknown",
    labels: f.labels ?? [],
    components: (f.components ?? []).map((c) => c.name),
    epicKey,
    epicName,
    sprintName,
    storyPoints,
    assignee: f.assignee?.displayName ?? null,
    priority: f.priority?.name ?? null,
    jiraCreatedAt: f.created ? new Date(f.created) : null,
    jiraUpdatedAt: f.updated ? new Date(f.updated) : null,
    rawData: issue as unknown as Record<string, unknown>,
  };
}

function normalizeStatusCategory(key: string): string {
  const lower = key.toLowerCase();
  if (lower === "done" || lower.includes("done")) return "Done";
  if (lower === "indeterminate" || lower.includes("progress")) return "In Progress";
  return "To Do";
}
