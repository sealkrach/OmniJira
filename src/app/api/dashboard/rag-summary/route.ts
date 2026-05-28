import { requireSession, ok } from "@/lib/api-utils";
import { computeEntityProgress } from "@/lib/rag/aggregator";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const entities = await computeEntityProgress();

  const ragCounts = { GREEN: 0, AMBER: 0, RED: 0 };
  for (const entity of entities) {
    for (const uc of entity.useCases) {
      ragCounts[uc.rag]++;
      for (const child of uc.children ?? []) {
        ragCounts[child.rag]++;
      }
    }
  }

  return ok({ ragCounts, entities: entities.map(e => ({ id: e.entityId, name: e.entityName, rag: e.rag })) });
}
