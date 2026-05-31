import axios, { AxiosInstance, AxiosError } from "axios";
import type { JiraSearchResponse, JiraProjectRaw } from "@/types/jira";
import type { SyncLogger } from "@/lib/sync/logger";

const BASE_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "labels",
  "components",
  "priority",
  "assignee",
  "created",
  "updated",
  "parent",
  "customfield_10014",
  "customfield_10011",
  "customfield_10016",
  "customfield_10020",
];

export class JiraClient {
  private http: AxiosInstance;
  readonly instanceType: "CLOUD" | "SERVER";
  rateLimitDelay: number;
  storyPointsField: string;

  constructor(options: {
    url: string;
    email: string;
    token: string;
    instanceType: "CLOUD" | "SERVER";
    storyPointsField?: string;
    rateLimitDelay?: number;
    logger?: SyncLogger;
  }) {
    const { url, email, token, instanceType, storyPointsField, rateLimitDelay, logger } = options;
    this.instanceType = instanceType;
    const apiVersion = instanceType === "CLOUD" ? "3" : "2";
    this.rateLimitDelay = rateLimitDelay ?? (instanceType === "CLOUD" ? 300 : 200);
    this.storyPointsField = storyPointsField ?? "customfield_10016";

    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    this.http = axios.create({
      baseURL: `${url.replace(/\/$/, "")}/rest/api/${apiVersion}`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30_000,
    });

    const startTimes = new Map<string, number>();

    this.http.interceptors.request.use((config) => {
      const key = `${config.method?.toUpperCase()} ${config.url}`;
      startTimes.set(key, Date.now());
      if (logger) {
        logger.debug(`→ ${key} ${JSON.stringify(config.params ?? "")}`);
      }
      return config;
    });

    this.http.interceptors.response.use(
      (res) => {
        const key = `${res.config.method?.toUpperCase()} ${res.config.url}`;
        const durationMs = Date.now() - (startTimes.get(key) ?? Date.now());
        startTimes.delete(key);
        if (logger) {
          const data = res.data as Record<string, unknown> | null;
          const pagination = data
            ? ` total=${data.total ?? "?"} isLast=${data.isLast ?? "?"} issues=${Array.isArray(data.issues) ? data.issues.length : "n/a"} values=${Array.isArray(data.values) ? data.values.length : "n/a"}`
            : "";
          logger.debug(`← ${res.status} ${res.config.url} (${durationMs}ms)${pagination}`);
        }
        return res;
      },
      (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const msg = `${err.response?.status} ${err.config?.url} — ${JSON.stringify(err.response?.data ?? err.message)}`;
          if (logger) logger.error(msg);
          else console.error(`[jira] ERROR ${msg}`);
        }
        return Promise.reject(err);
      }
    );
  }

  async search(
    jql: string,
    startAt: number,
    maxResults: number
  ): Promise<JiraSearchResponse> {
    const allFields = this.storyPointsField
      ? [...BASE_FIELDS, this.storyPointsField]
      : BASE_FIELDS;
    const fields = Array.from(new Set(allFields)).join(",");
    // Cloud v3 deprecated /search in favour of /search/jql; Server v2 still uses /search
    const endpoint = this.instanceType === "CLOUD" ? "/search/jql" : "/search";
    const response = await this.withRetry(() =>
      this.http.get<JiraSearchResponse>(endpoint, {
        params: { jql, startAt, maxResults, fields },
      })
    );
    return response.data;
  }

  async getProjects(): Promise<JiraProjectRaw[]> {
    // Try paginated /project/search first (Cloud v3), fall back to /project (Server/old Cloud)
    try {
      const all: JiraProjectRaw[] = [];
      let startAt = 0;
      const maxResults = 50;
      while (true) {
        const res = await this.withRetry(() =>
          this.http.get<{ values: JiraProjectRaw[]; isLast: boolean }>("/project/search", {
            params: { startAt, maxResults },
          })
        );
        all.push(...res.data.values);
        if (res.data.isLast || res.data.values.length < maxResults) break;
        startAt += maxResults;
      }
      return all;
    } catch {
      // Fallback to simple /project (array response, works on Server)
      const res = await this.withRetry(() =>
        this.http.get<JiraProjectRaw[]>("/project")
      );
      return Array.isArray(res.data) ? res.data : [];
    }
  }

  async testConnection(): Promise<{ ok: boolean; serverInfo?: Record<string, unknown>; error?: string }> {
    try {
      const res = await this.http.get("/serverInfo");
      return { ok: true, serverInfo: res.data };
    } catch (err: unknown) {
      const detail = extractAxiosError(err);
      return { ok: false, error: detail };
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        if (axios.isAxiosError(err)) {
          const status = err.response?.status ?? 0;
          if (status === 429) {
            const retryAfter = parseInt(err.response?.headers?.["retry-after"] ?? "10", 10);
            await delay((retryAfter + attempt * 2) * 1000);
          } else if (status >= 400 && status < 500) {
            // 4xx — not retryable, but enrich error with response body
            throw new Error(
              `Jira API ${status}: ${extractAxiosError(err)}`
            );
          } else {
            await delay(Math.pow(2, attempt) * 1000);
          }
        } else {
          await delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    throw lastError;
  }
}

function extractAxiosError(err: unknown): string {
  if (!axios.isAxiosError(err)) return err instanceof Error ? err.message : String(err);
  const ax = err as AxiosError<{ errorMessages?: string[]; message?: string }>;
  const status = ax.response?.status;
  const body = ax.response?.data;
  const bodyMsg =
    body?.errorMessages?.join(", ") ??
    body?.message ??
    (typeof body === "string" ? body : JSON.stringify(body));
  return `HTTP ${status} — ${bodyMsg ?? ax.message}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
