import { Queue } from "bullmq";

export const SYNC_QUEUE = "jira-sync";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    connectTimeout: 10_000,
    family: 4,
  };
}

export function getRedisConnectionOptions() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set");
  return parseRedisUrl(url);
}

let _syncQueue: Queue | null = null;

export function getSyncQueue(): Queue {
  if (!_syncQueue) {
    _syncQueue = new Queue(SYNC_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _syncQueue;
}

export interface SyncJobData {
  instanceId: string;
  syncJobId: string;
}
