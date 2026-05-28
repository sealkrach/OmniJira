import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, ok, err } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  useCaseId: z.string().cuid(),
  unmap: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { useCaseId, unmap } = parsed.data;

  if (unmap) {
    await prisma.ticketUseCaseMapping.deleteMany({
      where: { ticketId: params.id, useCaseId },
    });
    return ok({ unmapped: true });
  }

  const mapping = await prisma.ticketUseCaseMapping.upsert({
    where: { ticketId_useCaseId: { ticketId: params.id, useCaseId } },
    create: { ticketId: params.id, useCaseId, source: "MANUAL", confidence: 1.0 },
    update: { source: "MANUAL", confidence: 1.0 },
  });

  return ok(mapping);
}
