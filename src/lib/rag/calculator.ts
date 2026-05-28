import { differenceInDays } from "date-fns";
import type { RagStatus } from "@/types/rag";

export interface RagInput {
  donePoints: number;
  totalPoints: number;
  doneCount: number;
  totalCount: number;
  targetQuarter: number | null;
  targetYear: number | null;
  createdAt: Date;
  statusOverride: RagStatus | null;
}

export function endOfQuarter(q: number, year: number): Date {
  const ends = [
    new Date(year, 2, 31),
    new Date(year, 5, 30),
    new Date(year, 8, 30),
    new Date(year, 11, 31),
  ];
  return ends[q - 1];
}

export function calculateRag(input: RagInput): RagStatus {
  if (input.statusOverride) return input.statusOverride;

  const progress =
    input.totalPoints > 0
      ? input.donePoints / input.totalPoints
      : input.totalCount > 0
      ? input.doneCount / input.totalCount
      : 0;

  if (!input.targetQuarter || !input.targetYear) {
    if (progress >= 0.8) return "GREEN";
    if (progress >= 0.5) return "AMBER";
    return "RED";
  }

  const targetDate = endOfQuarter(input.targetQuarter, input.targetYear);
  const today = new Date();
  const daysRemaining = differenceInDays(targetDate, today);

  if (daysRemaining < 0) return "RED";

  const daysTotal = differenceInDays(targetDate, input.createdAt);
  const timeElapsedRatio = daysTotal > 0 ? 1 - daysRemaining / daysTotal : 1;

  if (timeElapsedRatio >= 0.8) {
    if (progress >= 0.9) return "GREEN";
    if (progress >= 0.65) return "AMBER";
    return "RED";
  }

  if (progress >= 0.8) return "GREEN";
  if (progress >= 0.5) return "AMBER";
  return "RED";
}

export function worstRag(statuses: RagStatus[]): RagStatus {
  if (statuses.includes("RED")) return "RED";
  if (statuses.includes("AMBER")) return "AMBER";
  return "GREEN";
}

export function ragToColor(status: RagStatus): string {
  if (status === "GREEN") return "#22c55e";
  if (status === "AMBER") return "#f59e0b";
  return "#ef4444";
}

export function ragToBgClass(status: RagStatus): string {
  if (status === "GREEN") return "bg-green-500";
  if (status === "AMBER") return "bg-amber-500";
  return "bg-red-500";
}
