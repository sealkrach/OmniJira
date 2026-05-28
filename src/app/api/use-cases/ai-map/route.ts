import { NextRequest } from "next/server";
import { requireSession, ok, err } from "@/lib/api-utils";
import { mapTicketsToExistingUseCases } from "@/lib/ai/use-case-generator";
import { z } from "zod";

export const maxDuration = 120;

const schema = z.object({
  instanceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  try {
    const result = await mapTicketsToExistingUseCases(parsed.data.instanceId);
    // result now includes { mapped, skipped }
    return ok(result);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "AI mapping failed", 500);
  }
}
