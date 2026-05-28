import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { useCaseSchema } from "@/lib/schemas/use-cases";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");

  const useCases = await prisma.useCase.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      parentId: null,
    },
    include: {
      children: {
        include: {
          children: {
            include: {
              _count: { select: { ticketMappings: true } },
            },
            orderBy: { priority: "desc" },
          },
          _count: { select: { ticketMappings: true } },
        },
        orderBy: { priority: "desc" },
      },
      _count: { select: { ticketMappings: true } },
    },
    orderBy: { priority: "desc" },
  });

  return ok(useCases);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = useCaseSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const useCase = await prisma.useCase.create({ data: parsed.data });
  return ok(useCase, 201);
}
