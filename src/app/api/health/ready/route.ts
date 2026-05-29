import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedisConnectionOptions } from "@/lib/queue";
import Redis from "ioredis";

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;

  await Promise.all([
    prisma.$queryRaw`SELECT 1`
      .then(() => { checks.db = "ok"; })
      .catch(() => { checks.db = "error"; allOk = false; }),

    (async () => {
      let redis: Redis | null = null;
      try {
        redis = new Redis({ ...getRedisConnectionOptions(), lazyConnect: true, connectTimeout: 3_000 });
        await redis.ping();
        checks.redis = "ok";
      } catch {
        checks.redis = "error";
        allOk = false;
      } finally {
        redis?.disconnect();
      }
    })(),
  ]);

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
