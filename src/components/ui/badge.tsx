import { cn } from "@/lib/utils";
import type { RagStatus } from "@/types/rag";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "green" | "amber" | "red" | "outline";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-slate-700 text-slate-300",
        variant === "green" && "bg-green-500/15 text-green-400",
        variant === "amber" && "bg-amber-500/15 text-amber-400",
        variant === "red" && "bg-red-500/15 text-red-400",
        variant === "outline" && "border border-slate-700 text-slate-400",
        className
      )}
    >
      {children}
    </span>
  );
}

export function RagBadge({ status }: { status: RagStatus }) {
  const labels: Record<RagStatus, string> = {
    GREEN: "On Track",
    AMBER: "At Risk",
    RED: "Off Track",
  };
  const variants: Record<RagStatus, "green" | "amber" | "red"> = {
    GREEN: "green",
    AMBER: "amber",
    RED: "red",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
