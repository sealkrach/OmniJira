import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { requireSession, ok, err } from "@/lib/api-utils";
import { updateInstanceSchema } from "@/lib/schemas/instances";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const instance = await prisma.jiraInstance.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      url: true,
      email: true,
      instanceType: true,
      syncEnabled: true,
      syncIntervalMinutes: true,
      projectFilter: true,
      storyPointsField: true,
      lastSyncAt: true,
      createdAt: true,
      syncJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          ticketsSynced: true,
          error: true,
          createdAt: true,
        },
      },
      _count: { select: { tickets: true } },
    },
  });

  if (!instance) return err("Instance not found", 404);
  return ok(instance);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = updateInstanceSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { token, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (token) updateData.encryptedToken = encrypt(token);

  const instance = await prisma.jiraInstance.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, name: true, url: true, email: true, instanceType: true, syncEnabled: true },
  });

  return ok(instance);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  await prisma.jiraInstance.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
