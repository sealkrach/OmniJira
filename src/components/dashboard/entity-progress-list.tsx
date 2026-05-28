import { ProgressBar } from "@/components/ui/progress-bar";
import { RagBadge } from "@/components/ui/badge";
import type { EntityProgress } from "@/types/rag";
import Link from "next/link";

export function EntityProgressList({ entities }: { entities: EntityProgress[] }) {
  if (entities.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-8">
        No entities configured.{" "}
        <Link href="/entities" className="text-indigo-400 hover:underline">
          Create one
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entities.map((entity) => (
        <div
          key={entity.entityId}
          className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors"
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: entity.entityColor }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-200 truncate">
                {entity.entityName}
              </span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-xs text-slate-500">
                  {entity.doneCount}/{entity.totalCount}
                </span>
                <RagBadge status={entity.rag} />
              </div>
            </div>
            <ProgressBar value={entity.progress} rag={entity.rag} height="h-1.5" />
          </div>
        </div>
      ))}
    </div>
  );
}
