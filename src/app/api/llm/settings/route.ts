import { NextRequest } from "next/server";
import { requireSession, ok, err } from "@/lib/api-utils";
import { saveLlmSettings, getLlmConfig } from "@/lib/ai/openai";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const [keySetting, modelSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "llm.apiKey" } }),
    prisma.appSetting.findUnique({ where: { key: "llm.model" } }),
  ]);

  const hasDbKey = !!keySetting?.value;
  const hasEnvKey = !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("sk-your-");

  return ok({
    configured: hasDbKey || hasEnvKey,
    keySource: hasDbKey ? "database" : hasEnvKey ? "env" : "none",
    model: modelSetting?.value ?? "gpt-4o-mini",
  });
}

const schema = z.object({
  apiKey: z.string().min(10),
  model: z.enum(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]),
});

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  await saveLlmSettings(parsed.data.apiKey, parsed.data.model);
  return ok({ saved: true });
}
