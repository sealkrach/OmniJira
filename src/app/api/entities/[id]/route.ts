import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { entitySchema } from "@/lib/schemas/entities";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const entity = await prisma.entity.findUnique({
    where: { id: params.id },
    include: {
      children: true,
      _count: { select: { useCases: true } },
    },
  });
  if (!entity) return err("Entity not found", 404);
  return ok(entity);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = entitySchema.partial().safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const entity = await prisma.entity.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return ok(entity);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  await prisma.entity.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
