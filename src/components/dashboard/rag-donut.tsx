"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RagDonutProps {
  data: { GREEN: number; AMBER: number; RED: number };
}

export function RagDonut({ data }: RagDonutProps) {
  const chartData = [
    { name: "On Track", value: data.GREEN, color: "#22c55e" },
    { name: "At Risk", value: data.AMBER, color: "#f59e0b" },
    { name: "Off Track", value: data.RED, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const total = data.GREEN + data.AMBER + data.RED;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
        No use cases yet
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f1f5f9",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: "#94a3b8", fontSize: "12px" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center mt-[-16px]">
          <p className="text-2xl font-bold text-white">{total}</p>
          <p className="text-xs text-slate-500">use cases</p>
        </div>
      </div>
    </div>
  );
}
