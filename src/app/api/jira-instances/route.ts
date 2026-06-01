import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { requireSession, ok, err } from "@/lib/api-utils";
import { createInstanceSchema } from "@/lib/schemas/instances";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const instances = await prisma.jiraInstance.findMany({
    orderBy: { createdAt: "desc" },
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
      _count: { select: { tickets: true, syncJobs: true } },
      syncJobs: {
        where: {
          status: { in: ["PENDING", "RUNNING"] },
          createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, ticketsSynced: true, startedAt: true },
      },
    },
  });

  const shaped = instances.map(({ syncJobs, ...rest }) => ({
    ...rest,
    activeSyncJob: syncJobs[0] ?? null,
  }));

  return ok(shaped);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createInstanceSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { token, ...rest } = parsed.data;
  const encryptedToken = encrypt(token);

  const instance = await prisma.jiraInstance.create({
    data: { ...rest, encryptedToken },
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
    },
  });

  return ok(instance, 201);
}
