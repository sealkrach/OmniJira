"use client";

import { cn } from "@/lib/utils";

interface QuarterSelectorProps {
  quarter: number | null;
  year: number;
  onChange: (quarter: number | null, year: number) => void;
}

const YEARS = [2024, 2025, 2026, 2027];
const QUARTERS = [1, 2, 3, 4];

export function QuarterSelector({ quarter, year, onChange }: QuarterSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={year}
        onChange={(e) => onChange(quarter, parseInt(e.target.value))}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <div className="flex gap-1">
        <button
          onClick={() => onChange(null, year)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
            quarter === null
              ? "bg-indigo-600 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          )}
        >
          All
        </button>
        {QUARTERS.map((q) => (
          <button
            key={q}
            onClick={() => onChange(q, year)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              quarter === q
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            Q{q}
          </button>
        ))}
      </div>
    </div>
  );
}
