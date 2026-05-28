import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { mappingRuleSchema } from "@/lib/schemas/mappings";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const useCaseId = searchParams.get("useCaseId");

  const rules = await prisma.mappingRule.findMany({
    where: useCaseId ? { useCaseId } : undefined,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      useCase: { select: { id: true, name: true, entityId: true } },
      jiraInstance: { select: { id: true, name: true } },
      _count: { select: { ticketMappings: true } },
    },
  });

  return ok(rules);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = mappingRuleSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const rule = await prisma.mappingRule.create({ data: parsed.data });
  return ok(rule, 201);
}
