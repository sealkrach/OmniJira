import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { JiraClient } from "@/lib/jira/client";
import { requireSession, ok, err } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const instance = await prisma.jiraInstance.findUnique({ where: { id: params.id } });
  if (!instance) return err("Instance not found", 404);

  const token = decrypt(instance.encryptedToken);
  const client = new JiraClient({
    url: instance.url,
    email: instance.email,
    token,
    instanceType: instance.instanceType,
  });

  const result = await client.testConnection();
  return ok(result);
}
