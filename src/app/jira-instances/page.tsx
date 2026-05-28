"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Server, Plus, RefreshCw, Trash2, Pencil, CheckCircle2,
  XCircle, Loader2, Clock,
} from "lucide-react";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
import { formatDistanceToNow } from "date-fns";

interface Instance {
  id: string;
  name: string;
  url: string;
  email: string;
  instanceType: string;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  projectFilter: string[];
  storyPointsField: string;
  lastSyncAt: string | null;
  _count: { tickets: number; syncJobs: number };
}

interface SyncJob {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  ticketsSynced: number;
  error: string | null;
  createdAt: string;
}

function InstanceForm({
  initial,
  onSave,
  onCancel,
  error,
}: {
  initial?: Partial<Instance>;
  onSave: (data: object) => void;
  onCancel: () => void;
  error?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [token, setToken] = useState("");
  const [instanceType, setInstanceType] = useState(initial?.instanceType ?? "CLOUD");
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(initial?.syncIntervalMinutes ?? 60);
  const [projectFilter, setProjectFilter] = useState(initial?.projectFilter?.join(", ") ?? "");
  const [storyPointsField, setStoryPointsField] = useState(initial?.storyPointsField ?? "customfield_10016");
  const [syncEnabled, setSyncEnabled] = useState(initial?.syncEnabled ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data: Record<string, unknown> = {
          name, url, email, instanceType,
          syncEnabled, syncIntervalMinutes,
          storyPointsField,
          projectFilter: projectFilter.split(",").map((s) => s.trim()).filter(Boolean),
        };
        if (token) data.token = token;
        onSave(data);
      }}
      className="space-y-3 max-h-[70vh] overflow-y-auto pr-1"
    >
      {error && <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
      <Input label="Instance Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="My Company Jira" />
      <Input label="Jira URL" value={url} onChange={(e) => setUrl(e.target.value)} required type="url" placeholder="https://mycompany.atlassian.net" />
      <Input label="Email / Username" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="user@company.com" />
      <Input
        label={initial?.id ? "API Token (leave blank to keep existing)" : "API Token"}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        required={!initial?.id}
        type="password"
        placeholder={initial?.id ? "••••••••" : "Your Jira API token"}
      />
      <Select label="Instance Type" value={instanceType} onChange={(e) => setInstanceType(e.target.value)}>
        <option value="CLOUD">Jira Cloud</option>
        <option value="SERVER">Jira Server / Data Center</option>
      </Select>
      <Input
        label="Story Points Field"
        value={storyPointsField}
        onChange={(e) => setStoryPointsField(e.target.value)}
        placeholder="customfield_10016"
      />
      <Input
        label="Project Filter (comma-separated keys, blank = all)"
        value={projectFilter}
        onChange={(e) => setProjectFilter(e.target.value)}
        placeholder="PROJ1, PROJ2"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Sync Interval (minutes)"
          type="number"
          value={syncIntervalMinutes}
          onChange={(e) => setSyncIntervalMinutes(parseInt(e.target.value))}
          min={5}
          max={1440}
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Auto-sync</label>
          <button
            type="button"
            onClick={() => setSyncEnabled(!syncEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              syncEnabled ? "bg-indigo-600" : "bg-slate-700"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${syncEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

function SyncStatus({ status }: { status: string }) {
  if (status === "COMPLETED") return <Badge variant="green">Completed</Badge>;
  if (status === "FAILED") return <Badge variant="red">Failed</Badge>;
  if (status === "RUNNING") return <Badge variant="amber">Running</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function JiraInstancesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ["jira-instances"],
    queryFn: () => apiFetch("/api/jira-instances"),
    refetchInterval: 10_000,
  });

  const { data: instanceDetail } = useQuery<{ syncJobs: SyncJob[] }>({
    queryKey: ["jira-instances", selectedInstance],
    queryFn: () => apiFetch(`/api/jira-instances/${selectedInstance}`),
    enabled: !!selectedInstance,
  });

  const create = useMutation({
    mutationFn: (data: object) =>
      apiFetch("/api/jira-instances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jira-instances"] }); setDialogOpen(false); setMutationError(""); },
    onError: (e: Error) => setMutationError(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & object) =>
      apiFetch(`/api/jira-instances/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jira-instances"] }); setDialogOpen(false); setEditing(null); setMutationError(""); },
    onError: (e: Error) => setMutationError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/jira-instances/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jira-instances"] }),
  });

  async function testConnection(id: string) {
    const res = await fetch(`/api/jira-instances/${id}/test`, { method: "POST" }).then((r) => r.json());
    setTestResults((prev) => ({ ...prev, [id]: res }));
  }

  async function triggerSync(id: string) {
    setSyncing((prev) => ({ ...prev, [id]: true }));
    await fetch(`/api/jira-instances/${id}/sync`, { method: "POST" });
    setSyncing((prev) => ({ ...prev, [id]: false }));
    queryClient.invalidateQueries({ queryKey: ["jira-instances"] });
    setSelectedInstance(id);
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Jira Instances" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Connected Instances</h2>
              <p className="text-sm text-slate-500">
                Configure Jira Cloud and Server connections
              </p>
            </div>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4" />
              Add Instance
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {instances.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-16 text-sm">
                <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
                No Jira instances connected. Add your first one.
              </div>
            )}

            {instances.map((instance) => {
              const test = testResults[instance.id];
              return (
                <Card key={instance.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{instance.name}</span>
                          <Badge variant={instance.instanceType === "CLOUD" ? "default" : "outline"}>
                            {instance.instanceType}
                          </Badge>
                          {instance.syncEnabled ? (
                            <Badge variant="green">Auto-sync</Badge>
                          ) : (
                            <Badge variant="outline">Manual</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{instance.url}</p>
                        <p className="text-xs text-slate-500">{instance.email}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(instance); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove.mutate(instance.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                      <span>{instance._count.tickets} tickets</span>
                      <span>·</span>
                      <span>
                        {instance.lastSyncAt
                          ? `Synced ${formatDistanceToNow(new Date(instance.lastSyncAt), { addSuffix: true })}`
                          : "Never synced"}
                      </span>
                    </div>

                    {test && (
                      <div className={`flex items-center gap-1.5 text-xs mb-2 ${test.ok ? "text-green-400" : "text-red-400"}`}>
                        {test.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {test.ok ? "Connected" : test.error}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => testConnection(instance.id)}>
                        Test Connection
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => triggerSync(instance.id)}
                        disabled={syncing[instance.id]}
                      >
                        {syncing[instance.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Sync Now
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedInstance(instance.id === selectedInstance ? null : instance.id)}>
                        <Clock className="w-3.5 h-3.5" />
                        History
                      </Button>
                    </div>

                    {/* Sync history */}
                    {selectedInstance === instance.id && instanceDetail && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                        <p className="text-xs font-medium text-slate-400 mb-2">Recent Syncs</p>
                        {instanceDetail.syncJobs.slice(0, 5).map((job) => (
                          <div key={job.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <SyncStatus status={job.status} />
                              <span className="text-slate-500">
                                {job.ticketsSynced} tickets
                              </span>
                            </div>
                            <span className="text-slate-600">
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Dialog
            open={dialogOpen}
            onClose={() => { setDialogOpen(false); setEditing(null); setMutationError(""); }}
            title={editing ? "Edit Instance" : "Add Jira Instance"}
            width="max-w-xl"
          >
            <InstanceForm
              initial={editing ?? undefined}
              error={mutationError}
              onSave={(data) => {
                if (editing) update.mutate({ id: editing.id, ...data });
                else create.mutate(data);
              }}
              onCancel={() => { setDialogOpen(false); setEditing(null); setMutationError(""); }}
            />
          </Dialog>
        </main>
      </div>
    </div>
  );
}
