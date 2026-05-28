import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { useCaseSchema } from "@/lib/schemas/use-cases";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const uc = await prisma.useCase.findUnique({
    where: { id: params.id },
    include: {
      children: true,
      mappingRules: { where: { enabled: true } },
      ticketMappings: {
        include: { ticket: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!uc) return err("Use case not found", 404);
  return ok(uc);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = useCaseSchema.partial().safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const uc = await prisma.useCase.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return ok(uc);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  await prisma.useCase.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
