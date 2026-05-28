import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { entitySchema } from "@/lib/schemas/entities";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const entities = await prisma.entity.findMany({
    orderBy: { name: "asc" },
    include: {
      children: { orderBy: { name: "asc" } },
      _count: { select: { useCases: true } },
    },
    where: { parentId: null },
  });

  return ok(entities);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = entitySchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const entity = await prisma.entity.create({ data: parsed.data });
  return ok(entity, 201);
}
