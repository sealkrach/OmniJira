import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import { JiraClient } from "@/lib/jira/client";
import { paginatedSearch } from "@/lib/jira/pagination";
import { transformIssue } from "@/lib/jira/transformers";
import { runMappingEngine } from "@/lib/mapping/engine";

export async function processSyncJob(syncJobId: string, instanceId: string): Promise<void> {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const instance = await prisma.jiraInstance.findUniqueOrThrow({
      where: { id: instanceId },
    });

    const token = decrypt(instance.encryptedToken);
    const client = new JiraClient({
      url: instance.url,
      email: instance.email,
      token,
      instanceType: instance.instanceType,
      storyPointsField: instance.storyPointsField,
    });

    let ticketsSynced = 0;
    const upsertedIds: string[] = [];

    // Build project list
    const projects = instance.projectFilter.length > 0
      ? instance.projectFilter
      : await fetchAllProjectKeys(client);

    for (const projectKey of projects) {
      const updatedSince = instance.lastSyncAt
        ? instance.lastSyncAt.toISOString().split(".")[0].replace("T", " ")
        : null;

      const jql = updatedSince
        ? `project = "${projectKey}" AND updated >= "${updatedSince}" ORDER BY updated ASC`
        : `project = "${projectKey}" ORDER BY updated ASC`;

      for await (const batch of paginatedSearch(client, jql)) {
        const transformed = batch.map((issue) =>
          transformIssue(issue, instance.storyPointsField)
        );

        for (const ticket of transformed) {
          const { rawData, ...ticketFields } = ticket;
          const upserted = await prisma.jiraTicket.upsert({
            where: {
              jiraInstanceId_jiraKey: {
                jiraInstanceId: instanceId,
                jiraKey: ticket.jiraKey,
              },
            },
            create: {
              jiraInstanceId: instanceId,
              ...ticketFields,
              rawData: rawData as Prisma.InputJsonValue,
            },
            update: {
              ...ticketFields,
              rawData: rawData as Prisma.InputJsonValue,
              syncedAt: new Date(),
            },
          });
          upsertedIds.push(upserted.id);
          ticketsSynced++;
        }
      }
    }

    // Run mapping engine on all upserted tickets
    if (upsertedIds.length > 0) {
      await runMappingEngine(instanceId, upsertedIds);
    }

    await prisma.jiraInstance.update({
      where: { id: instanceId },
      data: { lastSyncAt: new Date() },
    });

    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        ticketsSynced,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: message,
      },
    });
    throw error;
  }
}

async function fetchAllProjectKeys(client: JiraClient): Promise<string[]> {
  const projects = await client.getProjects();
  console.log(`[sync] visible projects (${projects.length}):`, projects.map((p) => `${p.key} — ${p.name}`).join(", ") || "(none)");
  return projects.map((p) => p.key);
}
