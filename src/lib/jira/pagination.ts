import type { JiraClient } from "./client";
import type { JiraIssueRaw } from "@/types/jira";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* paginatedSearch(
  client: JiraClient,
  jql: string,
  maxResults = 100
): AsyncGenerator<JiraIssueRaw[]> {
  let startAt = 0;

  while (true) {
    const response = await client.search(jql, startAt, maxResults);

    if (!response.issues || response.issues.length === 0) break;
    yield response.issues;
    startAt += response.issues.length;

    // New Cloud endpoint uses isLast; old endpoint uses total
    const done = response.isLast === true
      || (response.total !== undefined && startAt >= response.total)
      || response.issues.length < maxResults;
    if (done) break;

    await sleep(client.rateLimitDelay);
  }
}
