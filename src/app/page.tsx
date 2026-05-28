"use client";

import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RagDonut } from "@/components/dashboard/rag-donut";
import { EntityProgressList } from "@/components/dashboard/entity-progress-list";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Ticket,
  Building2,
  Target,
  Server,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface Kpis {
  totalTickets: number;
  doneTickets: number;
  progressPercent: number;
  totalEntities: number;
  totalUseCases: number;
  totalInstances: number;
  pendingSyncs: number;
}

interface RagSummary {
  ragCounts: { GREEN: number; AMBER: number; RED: number };
  entities: Array<{ id: string; name: string; rag: string }>;
}

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useQuery<Kpis>({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => fetch("/api/dashboard/kpis").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: ragSummary } = useQuery<RagSummary>({
    queryKey: ["dashboard", "rag-summary"],
    queryFn: () => fetch("/api/dashboard/rag-summary").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: entityProgress } = useQuery({
    queryKey: ["dashboard", "entity-progress"],
    queryFn: () => fetch("/api/dashboard/entity-progress").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Executive Overview" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Total Tickets"
              value={kpisLoading ? "—" : kpis?.totalTickets ?? 0}
              icon={Ticket}
              sub={`${kpis?.progressPercent ?? 0}% complete`}
              color="indigo"
            />
            <KpiCard
              title="Done Tickets"
              value={kpisLoading ? "—" : kpis?.doneTickets ?? 0}
              icon={CheckCircle2}
              color="green"
            />
            <KpiCard
              title="Use Cases"
              value={kpisLoading ? "—" : kpis?.totalUseCases ?? 0}
              icon={Target}
              sub={`across ${kpis?.totalEntities ?? 0} entities`}
              color="blue"
            />
            <KpiCard
              title="Jira Instances"
              value={kpisLoading ? "—" : kpis?.totalInstances ?? 0}
              icon={Server}
              sub={kpis?.pendingSyncs ? `${kpis.pendingSyncs} syncing` : "All synced"}
              color={kpis?.pendingSyncs ? "amber" : "indigo"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* RAG Summary */}
            <Card>
              <CardHeader>
                <CardTitle>RAG Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {ragSummary ? (
                  <RagDonut data={ragSummary.ragCounts} />
                ) : (
                  <div className="h-44 flex items-center justify-center text-slate-500 text-sm">
                    Loading...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entity Progress */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Entity Progress</CardTitle>
                <Building2 className="w-4 h-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                {entityProgress ? (
                  <EntityProgressList entities={entityProgress} />
                ) : (
                  <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick stats per entity */}
          {entityProgress && entityProgress.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Entity Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {entityProgress.map((entity: any) => (
                  <Card key={entity.entityId}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: entity.entityColor }}
                        />
                        <span className="font-medium text-white text-sm">{entity.entityName}</span>
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {Math.round(entity.progress * 100)}%
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {entity.doneCount} / {entity.totalCount} tickets done
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
