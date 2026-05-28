import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { mappingRuleSchema } from "@/lib/schemas/mappings";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = mappingRuleSchema.partial().safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const rule = await prisma.mappingRule.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return ok(rule);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  await prisma.mappingRule.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
