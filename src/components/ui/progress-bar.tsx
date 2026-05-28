import { cn } from "@/lib/utils";
import { ragToColor } from "@/lib/rag/calculator";
import type { RagStatus } from "@/types/rag";

interface ProgressBarProps {
  value: number; // 0-1
  rag?: RagStatus;
  showPercent?: boolean;
  className?: string;
  height?: string;
}

export function ProgressBar({
  value,
  rag,
  showPercent = true,
  className,
  height = "h-2",
}: ProgressBarProps) {
  const pct = Math.round(value * 100);
  const color = rag ? ragToColor(rag) : "#6366f1";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-1 bg-slate-700/50 rounded-full overflow-hidden", height)}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showPercent && (
        <span className="text-xs text-slate-400 w-9 text-right shrink-0">{pct}%</span>
      )}
    </div>
  );
}
