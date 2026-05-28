import { NextRequest } from "next/server";
import { remapAllTickets } from "@/lib/mapping/engine";
import { requireSession, ok } from "@/lib/api-utils";

export async function POST(_req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  // Run in background — don't await
  remapAllTickets().catch(console.error);

  return ok({ started: true });
}
