import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-indigo-600 hover:bg-indigo-500 text-white",
        variant === "secondary" && "bg-slate-700 hover:bg-slate-600 text-slate-200",
        variant === "ghost" && "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
        variant === "danger" && "bg-red-600/20 hover:bg-red-600/30 text-red-400",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
