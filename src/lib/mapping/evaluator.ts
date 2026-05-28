import type { RuleCondition, EvaluationResult } from "@/types/mapping";

interface TicketFields {
  jiraKey: string;
  epicKey: string | null;
  epicName: string | null;
  labels: string[];
  components: string[];
  issueType: string;
  sprintName: string | null;
  priority: string | null;
  assignee: string | null;
  rawData: Record<string, unknown>;
}

function getFieldValue(ticket: TicketFields, condition: RuleCondition): string[] {
  switch (condition.field) {
    case "projectKey":
      return [ticket.jiraKey.split("-")[0]];
    case "epicKey":
      return ticket.epicKey ? [ticket.epicKey] : [];
    case "epicName":
      return ticket.epicName ? [ticket.epicName] : [];
    case "label":
      return ticket.labels;
    case "component":
      return ticket.components;
    case "issueType":
      return [ticket.issueType];
    case "sprintName":
      return ticket.sprintName ? [ticket.sprintName] : [];
    case "priority":
      return ticket.priority ? [ticket.priority] : [];
    case "assignee":
      return ticket.assignee ? [ticket.assignee] : [];
    case "customField": {
      const key = condition.customFieldKey;
      if (!key) return [];
      const fields = (ticket.rawData as { fields?: Record<string, unknown> })?.fields ?? {};
      const val = fields[key];
      if (val == null) return [];
      return [String(val)];
    }
    default:
      return [];
  }
}

function applyOperator(
  values: string[],
  operator: RuleCondition["operator"],
  target: string
): number {
  if (values.length === 0) return 0;

  const lowerTarget = target.toLowerCase();

  for (const v of values) {
    const lower = v.toLowerCase();
    switch (operator) {
      case "equals":
        if (lower === lowerTarget) return 1.0;
        break;
      case "notEquals":
        if (lower !== lowerTarget) return 1.0;
        break;
      case "contains":
        if (lower.includes(lowerTarget)) return 0.8;
        break;
      case "startsWith":
        if (lower.startsWith(lowerTarget)) return 0.9;
        break;
      case "endsWith":
        if (lower.endsWith(lowerTarget)) return 0.9;
        break;
      case "matches":
        try {
          if (new RegExp(target, "i").test(v)) return 0.7;
        } catch {
          // invalid regex — skip
        }
        break;
    }
  }
  return 0;
}

export function evaluateCondition(
  ticket: TicketFields,
  condition: RuleCondition
): number {
  const values = getFieldValue(ticket, condition);
  return applyOperator(values, condition.operator, condition.value);
}

export function evaluateRule(
  ticket: TicketFields,
  conditions: RuleCondition[],
  logic: "AND" | "OR"
): EvaluationResult {
  if (conditions.length === 0) return { matched: false, confidence: 0 };

  const scores = conditions.map((c) => evaluateCondition(ticket, c));

  if (logic === "AND") {
    if (scores.some((s) => s === 0)) return { matched: false, confidence: 0 };
    return { matched: true, confidence: Math.min(...scores) };
  } else {
    const max = Math.max(...scores);
    return { matched: max > 0, confidence: max };
  }
}
