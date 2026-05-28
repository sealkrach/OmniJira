import { Worker, Queue, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { processSyncJob } from "../lib/sync/processor";
import type { SyncJobData } from "../lib/queue";

const SYNC_QUEUE = "jira-sync";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

function getConnectionOptions() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return parseRedisUrl(url);
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

  console.log("[worker] OmniJira sync worker starting...");

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

      console.log(`[worker] Syncing instance ${instanceId} (job ${resolvedJobId})`);
      await processSyncJob(resolvedJobId, instanceId);
      console.log(`[worker] Finished sync for instance ${instanceId}`);
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

  process.on("SIGTERM", async () => {
    console.log("[worker] Shutting down...");
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  console.log("[worker] Ready");
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
