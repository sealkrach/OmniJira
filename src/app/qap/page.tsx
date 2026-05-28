"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { QuarterSelector } from "@/components/qap/quarter-selector";
import { InitiativeProgressBar } from "@/components/qap/initiative-progress-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RagBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { EntityProgress } from "@/types/rag";

export default function QapPage() {
  const currentYear = new Date().getFullYear();
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);
  const [quarter, setQuarter] = useState<number | null>(currentQ);
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery<EntityProgress[]>({
    queryKey: ["qap", { quarter, year }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (quarter) params.set("quarter", String(quarter));
      params.set("year", String(year));
      return fetch(`/api/qap?${params}`).then((r) => r.json());
    },
  });

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Quarterly Action Plan" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {quarter ? `Q${quarter} ${year}` : `Full Year ${year}`}
              </h2>
              <p className="text-sm text-slate-500">
                Progress across all entities and use cases
              </p>
            </div>
            <QuarterSelector
              quarter={quarter}
              year={year}
              onChange={(q, y) => { setQuarter(q); setYear(y); }}
            />
          </div>

          {isLoading && (
            <div className="text-center text-slate-500 py-16">Loading QAP data...</div>
          )}

          {data && data.length === 0 && (
            <div className="text-center text-slate-500 py-16">
              No data for the selected period. Create entities and use cases to get started.
            </div>
          )}

          <div className="space-y-6">
            {data?.map((entity) => (
              <Card key={entity.entityId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entity.entityColor }}
                      />
                      <CardTitle>{entity.entityName}</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {entity.doneCount}/{entity.totalCount} tickets
                      </span>
                      <RagBadge status={entity.rag} />
                    </div>
                  </div>
                  <ProgressBar
                    value={entity.progress}
                    rag={entity.rag}
                    height="h-1"
                    className="mt-2"
                  />
                </CardHeader>
                <CardContent className="py-2">
                  {entity.useCases.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">
                      No use cases for this period.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-800/50">
                      {entity.useCases.map((uc) => (
                        <InitiativeProgressBar key={uc.useCaseId} useCase={uc} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
