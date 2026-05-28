import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get("instanceId");
  const status = searchParams.get("status");
  const issueType = searchParams.get("issueType");
  const useCaseId = searchParams.get("useCaseId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const where = {
    ...(instanceId ? { jiraInstanceId: instanceId } : {}),
    ...(status ? { statusCategory: status } : {}),
    ...(issueType ? { issueType } : {}),
    ...(useCaseId ? { useCaseMappings: { some: { useCaseId } } } : {}),
    ...(search ? {
      OR: [
        { jiraKey: { contains: search, mode: "insensitive" as const } },
        { summary: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [tickets, total] = await Promise.all([
    prisma.jiraTicket.findMany({
      where,
      include: {
        jiraInstance: { select: { id: true, name: true } },
        useCaseMappings: {
          include: { useCase: { select: { id: true, name: true } } },
          take: 5,
        },
      },
      orderBy: { jiraUpdatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.jiraTicket.count({ where }),
  ]);

  return ok({ tickets, total, page, limit, pages: Math.ceil(total / limit) });
}
