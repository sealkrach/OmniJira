import { RagBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { UseCaseProgress } from "@/types/rag";

interface InitiativeProgressBarProps {
  useCase: UseCaseProgress;
  depth?: number;
}

export function InitiativeProgressBar({ useCase, depth = 0 }: InitiativeProgressBarProps) {
  const levelColors: Record<string, string> = {
    DOMAIN: "text-slate-200 text-sm font-semibold",
    CAPABILITY: "text-slate-300 text-sm font-medium",
    INITIATIVE: "text-slate-400 text-xs",
  };

  return (
    <div className={depth > 0 ? "ml-4 border-l border-slate-800 pl-4" : ""}>
      <div className="py-2">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className={levelColors[useCase.level] ?? levelColors.INITIATIVE}>
            {useCase.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {useCase.targetQuarter && useCase.targetYear && (
              <span className="text-xs text-slate-500">
                Q{useCase.targetQuarter} {useCase.targetYear}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {useCase.doneCount}/{useCase.totalCount}
            </span>
            <RagBadge status={useCase.rag} />
          </div>
        </div>
        <ProgressBar value={useCase.progress} rag={useCase.rag} height="h-1.5" />
      </div>

      {useCase.children?.map((child) => (
        <InitiativeProgressBar key={child.useCaseId} useCase={child} depth={depth + 1} />
      ))}
    </div>
  );
}
