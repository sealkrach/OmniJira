import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { JiraClient } from "@/lib/jira/client";
import { requireSession, ok, err } from "@/lib/api-utils";
import { importEpicsSchema } from "@/lib/schemas/use-cases";

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = importEpicsSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { jiraInstanceId, projectKey, entityId, parentId } = parsed.data;

  const instance = await prisma.jiraInstance.findUnique({ where: { id: jiraInstanceId } });
  if (!instance) return err("Instance not found", 404);

  const token = decrypt(instance.encryptedToken);
  const client = new JiraClient({
    url: instance.url,
    email: instance.email,
    token,
    instanceType: instance.instanceType,
  });

  // Fetch all epics from the project
  const jql = `issuetype = Epic AND project = "${projectKey}" ORDER BY created ASC`;
  const response = await client.search(jql, 0, 100);

  const created: string[] = [];

  for (const issue of response.issues) {
    const useCase = await prisma.useCase.upsert({
      where: {
        id: `imported-${jiraInstanceId}-${issue.key}`,
      },
      create: {
        id: `imported-${jiraInstanceId}-${issue.key}`,
        name: issue.fields.summary,
        entityId,
        parentId: parentId ?? null,
        level: "INITIATIVE",
        priority: 0,
      },
      update: {
        name: issue.fields.summary,
      },
    });

    // Create automatic mapping rule for this epic
    await prisma.mappingRule.upsert({
      where: {
        id: `rule-${jiraInstanceId}-${issue.key}`,
      },
      create: {
        id: `rule-${jiraInstanceId}-${issue.key}`,
        name: `Auto: Epic ${issue.key}`,
        useCaseId: useCase.id,
        jiraInstanceId,
        logic: "OR",
        conditions: [
          { field: "epicKey", operator: "equals", value: issue.key },
        ],
        priority: 10,
        enabled: true,
      },
      update: {},
    });

    created.push(useCase.id);
  }

  return ok({ created: created.length, useCaseIds: created }, 201);
}
