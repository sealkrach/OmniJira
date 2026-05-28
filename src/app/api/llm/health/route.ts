import { requireSession, ok } from "@/lib/api-utils";
import { getLlmConfig } from "@/lib/ai/openai";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  // Check if key is configured at all (without decrypting unnecessarily)
  const [keySetting, modelSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "llm.apiKey" } }),
    prisma.appSetting.findUnique({ where: { key: "llm.model" } }),
  ]);

  const hasDbKey = !!keySetting?.value;
  const hasEnvKey = !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("sk-your-");
  const model = modelSetting?.value ?? "gpt-4o-mini";

  if (!hasDbKey && !hasEnvKey) {
    return ok({ ok: false, configured: false, error: "No API key configured", model });
  }

  const start = Date.now();
  try {
    const { client } = await getLlmConfig().then(({ apiKey, model: m }) => ({
      client: new OpenAI({ apiKey }),
      model: m,
    }));
    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    return ok({ ok: true, configured: true, model, latency: Date.now() - start });
  } catch (e: unknown) {
    return ok({
      ok: false,
      configured: true,
      model,
      error: e instanceof Error ? e.message : "Unknown error",
      latency: Date.now() - start,
    });
  }
}
