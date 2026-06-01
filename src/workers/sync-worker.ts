import { Worker, Queue, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { processSyncJob } from "../lib/sync/processor";
import { generatePendingEmbeddings } from "../lib/ai/embeddings";
import { SyncLogger } from "../lib/sync/logger";
import type { SyncJobData } from "../lib/queue";

const SYNC_QUEUE = "jira-sync";
const VERBOSE = process.env.SYNC_VERBOSE === "true";

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

function getConnectionOptions() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return parseRedisUrl(url);
}

async function cleanupOrphanedJobs(prisma: PrismaClient) {
  const { count } = await prisma.syncJob.updateMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    data: { status: "FAILED", completedAt: new Date(), error: "Job interrompu — worker redémarré" },
  });
  if (count > 0) {
    console.log(`[worker] ${count} job(s) orphelin(s) marqué(s) FAILED`);
  }
}

async function registerRepeatableJobs(prisma: PrismaClient, connection: ReturnType<typeof getConnectionOptions>) {
  const syncQueue = new Queue(SYNC_QUEUE, { connection });

  const instances = await prisma.jiraInstance.findMany({
    where: { syncEnabled: true },
  });

  for (const instance of instances) {
    const jobKey = `sync:${instance.id}`;
    await syncQueue.add(
      jobKey,
      { instanceId: instance.id, syncJobId: "scheduled" },
      {
        repeat: { every: instance.syncIntervalMinutes * 60_000 },
        jobId: jobKey,
      }
    );
  }

  await syncQueue.close();
}

async function main() {
  const prisma = new PrismaClient();
  const connection = getConnectionOptions();

  console.log(`[worker] OmniJira sync worker starting... (verbose=${VERBOSE})`);

  await cleanupOrphanedJobs(prisma);
  await registerRepeatableJobs(prisma, connection);

  const worker = new Worker<SyncJobData>(
    SYNC_QUEUE,
    async (job: Job<SyncJobData>) => {
      const { instanceId, syncJobId } = job.data;

      let resolvedJobId = syncJobId;

      if (syncJobId === "scheduled") {
        const created = await prisma.syncJob.create({
          data: { jiraInstanceId: instanceId, status: "PENDING" },
        });
        resolvedJobId = created.id;
      }

      const logger = new SyncLogger(VERBOSE);

      console.log(`[worker] Syncing instance ${instanceId} (job ${resolvedJobId})`);

      try {
        await processSyncJob(resolvedJobId, instanceId, logger);
        console.log(`[worker] Finished sync for instance ${instanceId}`);
      } finally {
        // Always persist logs, even on failure (processSyncJob already updated status)
        const logs = logger.getLogs();
        if (logs.length > 0) {
          await prisma.syncJob.update({
            where: { id: resolvedJobId },
            data: { logs },
          });
        }
      }

      // Generate embeddings for tickets that don't have one yet
      const embedded = await generatePendingEmbeddings(20);
      if (embedded > 0) console.log(`[worker] Generated embeddings for ${embedded} ticket(s)`);
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 10, duration: 60_000 },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`[worker] Job ${job.id} completed`);
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`[worker] ${signal} received — draining active jobs and shutting down...`);

    const forceExit = setTimeout(() => {
      console.error("[worker] Graceful shutdown timeout (30s) exceeded — forcing exit");
      process.exit(1);
    }, 30_000);
    forceExit.unref();

    try {
      await worker.close();
      await prisma.$disconnect();
      clearTimeout(forceExit);
      console.log("[worker] Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      console.error("[worker] Error during shutdown:", err);
      clearTimeout(forceExit);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log("[worker] Ready");
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
