export type RuleConditionField =
  | "projectKey"
  | "epicKey"
  | "epicName"
  | "label"
  | "component"
  | "issueType"
  | "sprintName"
  | "priority"
  | "assignee"
  | "customField";

export type RuleConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches";

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
  customFieldKey?: string;
}

export interface EvaluationResult {
  matched: boolean;
  confidence: number;
}

export interface RuleMatchResult {
  useCaseId: string;
  confidence: number;
  ruleId: string;
}
