import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

export async function getLlmConfig(): Promise<{ apiKey: string; model: string }> {
  const [keySetting, modelSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "llm.apiKey" } }),
    prisma.appSetting.findUnique({ where: { key: "llm.model" } }),
  ]);

  let apiKey: string | undefined;
  if (keySetting?.value) {
    try { apiKey = decrypt(keySetting.value); } catch { /* fall through to env */ }
  }
  if (!apiKey) {
    const envKey = process.env.OPENAI_API_KEY ?? "";
    if (envKey && !envKey.startsWith("sk-your-")) apiKey = envKey;
  }
  if (!apiKey) throw new Error("OpenAI API key not configured. Set it in LLM Settings.");

  const model = modelSetting?.value ?? "gpt-4o-mini";
  return { apiKey, model };
}

export async function getOpenAI(): Promise<{ client: OpenAI; model: string }> {
  const { apiKey, model } = await getLlmConfig();
  return { client: new OpenAI({ apiKey }), model };
}

export async function saveLlmSettings(apiKey: string, model: string): Promise<void> {
  const encrypted = encrypt(apiKey);
  await Promise.all([
    prisma.appSetting.upsert({
      where: { key: "llm.apiKey" },
      create: { key: "llm.apiKey", value: encrypted },
      update: { value: encrypted },
    }),
    prisma.appSetting.upsert({
      where: { key: "llm.model" },
      create: { key: "llm.model", value: model },
      update: { value: model },
    }),
  ]);
}
