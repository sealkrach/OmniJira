import { NextRequest } from "next/server";
import { requireSession, ok, err } from "@/lib/api-utils";
import { generateUseCasesFromTickets } from "@/lib/ai/use-case-generator";
import { z } from "zod";

export const maxDuration = 120;

const schema = z.object({
  instanceId: z.string().min(1),
  entityId: z.string().cuid(),
  targetQuarter: z.number().int().min(1).max(4).optional().nullable(),
  targetYear: z.number().int().min(2020).max(2040).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  try {
    const result = await generateUseCasesFromTickets(
      parsed.data.instanceId,
      parsed.data.entityId,
      { targetQuarter: parsed.data.targetQuarter, targetYear: parsed.data.targetYear }
    );
    return ok(result);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "AI generation failed", 500);
  }
}
