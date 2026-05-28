import { NextRequest } from "next/server";
import { requireSession, ok } from "@/lib/api-utils";
import { computeEntityProgress } from "@/lib/rag/aggregator";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const quarter = searchParams.get("quarter") ? parseInt(searchParams.get("quarter")!) : undefined;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;

  const data = await computeEntityProgress(undefined, quarter, year);
  return ok(data);
}
