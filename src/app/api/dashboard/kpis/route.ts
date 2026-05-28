import { prisma } from "@/lib/db";
import { requireSession, ok } from "@/lib/api-utils";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const [totalTickets, doneTickets, totalEntities, totalUseCases, totalInstances, pendingSyncs] =
    await Promise.all([
      prisma.jiraTicket.count(),
      prisma.jiraTicket.count({ where: { statusCategory: "Done" } }),
      prisma.entity.count(),
      prisma.useCase.count(),
      prisma.jiraInstance.count(),
      prisma.syncJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    ]);

  return ok({
    totalTickets,
    doneTickets,
    progressPercent: totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0,
    totalEntities,
    totalUseCases,
    totalInstances,
    pendingSyncs,
  });
}
