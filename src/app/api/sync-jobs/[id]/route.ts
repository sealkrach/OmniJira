import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const job = await prisma.syncJob.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      ticketsSynced: true,
      error: true,
      logs: true,
      createdAt: true,
      jiraInstanceId: true,
    },
  });

  if (!job) return err("Sync job not found", 404);
  return ok(job);
}
