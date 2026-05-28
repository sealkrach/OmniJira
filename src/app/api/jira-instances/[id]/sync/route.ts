import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSyncQueue } from "@/lib/queue";
import { requireSession, ok, err } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const instance = await prisma.jiraInstance.findUnique({ where: { id: params.id } });
  if (!instance) return err("Instance not found", 404);

  const syncJob = await prisma.syncJob.create({
    data: { jiraInstanceId: params.id, status: "PENDING" },
  });

  const queue = getSyncQueue();
  await queue.add(
    `manual-sync:${params.id}`,
    { instanceId: params.id, syncJobId: syncJob.id },
    { priority: 1 }
  );

  return ok({ syncJobId: syncJob.id, status: "PENDING" }, 202);
}
