export interface JiraSearchResponse {
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
  issues: JiraIssueRaw[];
}

export interface JiraIssueRaw {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: { key: string; name: string };
    };
    issuetype: { name: string };
    labels: string[];
    components: Array<{ name: string }>;
    priority: { name: string } | null;
    assignee: { displayName: string; emailAddress?: string } | null;
    created: string;
    updated: string;
    // Epic link (Server/Cloud v2)
    customfield_10014?: string; // epic key on Cloud
    // Epic name
    customfield_10011?: string; // epic name (Server)
    // Story points (Cloud default)
    customfield_10016?: number | null;
    // Sprint (Cloud)
    customfield_10020?: Array<{ name: string; state: string }> | null;
    // Parent (for sub-tasks and also for Cloud epics)
    parent?: {
      key: string;
      fields: { summary: string; issuetype: { name: string } };
    };
    [key: string]: unknown;
  };
}

export interface JiraProjectRaw {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraEpicRaw {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string; name: string } };
    [key: string]: unknown;
  };
}

export interface NormalizedTicket {
  jiraKey: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType: string;
  labels: string[];
  components: string[];
  epicKey: string | null;
  epicName: string | null;
  sprintName: string | null;
  storyPoints: number | null;
  assignee: string | null;
  priority: string | null;
  jiraCreatedAt: Date | null;
  jiraUpdatedAt: Date | null;
  rawData: Record<string, unknown>;
}
