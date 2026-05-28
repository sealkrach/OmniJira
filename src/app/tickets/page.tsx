"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Ticket as TicketIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JiraTicket {
  id: string;
  jiraKey: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType: string;
  labels: string[];
  epicName: string | null;
  sprintName: string | null;
  storyPoints: number | null;
  assignee: string | null;
  priority: string | null;
  jiraUpdatedAt: string | null;
  jiraInstance: { id: string; name: string };
  useCaseMappings: Array<{ useCase: { id: string; name: string } }>;
}

interface TicketsResponse {
  tickets: JiraTicket[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function StatusCategoryBadge({ cat }: { cat: string }) {
  if (cat === "Done") return <Badge variant="green">Done</Badge>;
  if (cat === "In Progress") return <Badge variant="amber">In Progress</Badge>;
  return <Badge variant="outline">To Do</Badge>;
}

export default function TicketsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [instanceFilter, setInstanceFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: instances = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["jira-instances"],
    queryFn: () => fetch("/api/jira-instances").then((r) => r.json()),
  });

  const { data, isLoading } = useQuery<TicketsResponse>({
    queryKey: ["tickets", { search: debouncedSearch, statusFilter, instanceFilter, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (instanceFilter) params.set("instanceId", instanceFilter);
      params.set("page", String(page));
      params.set("limit", "50");
      return fetch(`/api/tickets?${params}`).then((r) => r.json());
    },
  });

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Tickets" />
        <main className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={handleSearchChange}
                placeholder="Search tickets..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>

            <select
              value={instanceFilter}
              onChange={(e) => { setInstanceFilter(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Instances</option>
              {instances.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>

            <span className="text-xs text-slate-500 ml-auto">
              {data?.total ?? 0} tickets
            </span>
          </div>

          {/* Table */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardContent className="p-0 flex-1 overflow-auto">
              {isLoading ? (
                <div className="text-center text-slate-500 py-16 text-sm">Loading tickets...</div>
              ) : !data?.tickets.length ? (
                <div className="text-center text-slate-500 py-16 text-sm">
                  <TicketIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No tickets found. Connect a Jira instance and run a sync.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-32">Key</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Summary</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-28">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-24">Points</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-32">Instance</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-36">Use Cases</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-32">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-indigo-400 text-xs">{ticket.jiraKey}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="truncate max-w-xs text-slate-200">{ticket.summary}</div>
                          {ticket.epicName && (
                            <div className="text-xs text-slate-500 truncate mt-0.5">{ticket.epicName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusCategoryBadge cat={ticket.statusCategory} />
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {ticket.storyPoints ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{ticket.jiraInstance.name}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {ticket.useCaseMappings.slice(0, 2).map((m) => (
                              <Badge key={m.useCase.id} variant="default" className="text-xs">{m.useCase.name}</Badge>
                            ))}
                            {ticket.useCaseMappings.length > 2 && (
                              <Badge variant="default">+{ticket.useCaseMappings.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {ticket.jiraUpdatedAt
                            ? formatDistanceToNow(new Date(ticket.jiraUpdatedAt), { addSuffix: true })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Page {data.page} of {data.pages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

let searchTimeout: ReturnType<typeof setTimeout>;
