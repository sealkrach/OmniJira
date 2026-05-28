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
import { Plus, Trash2, Pencil, GitMerge, RefreshCw, X, PlusCircle } from "lucide-react";
import type { RuleCondition } from "@/types/mapping";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

interface MappingRule {
  id: string;
  name: string;
  useCaseId: string;
  jiraInstanceId: string | null;
  logic: string;
  conditions: RuleCondition[];
  priority: number;
  enabled: boolean;
  useCase: { id: string; name: string; entityId: string };
  jiraInstance: { id: string; name: string } | null;
  _count: { ticketMappings: number };
}

const FIELDS = [
  { value: "projectKey", label: "Project Key" },
  { value: "epicKey", label: "Epic Key" },
  { value: "epicName", label: "Epic Name" },
  { value: "label", label: "Label" },
  { value: "component", label: "Component" },
  { value: "issueType", label: "Issue Type" },
  { value: "sprintName", label: "Sprint Name" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "customField", label: "Custom Field" },
];

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "matches", label: "matches (regex)" },
];

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value as RuleCondition["field"] })}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as RuleCondition["operator"] })}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="value"
        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {condition.field === "customField" && (
        <input
          value={condition.customFieldKey ?? ""}
          onChange={(e) => onChange({ ...condition, customFieldKey: e.target.value })}
          placeholder="field key"
          className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      )}
      <button onClick={onRemove} className="text-slate-500 hover:text-red-400 transition-colors mt-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function RuleForm({
  initial,
  useCases,
  instances,
  onSave,
  onCancel,
  error,
}: {
  initial?: Partial<MappingRule>;
  useCases: Array<{ id: string; name: string }>;
  instances: Array<{ id: string; name: string }>;
  onSave: (data: object) => void;
  onCancel: () => void;
  error?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [useCaseId, setUseCaseId] = useState(initial?.useCaseId ?? useCases[0]?.id ?? "");
  const [instanceId, setInstanceId] = useState(initial?.jiraInstanceId ?? "");
  const [logic, setLogic] = useState<"AND" | "OR">(initial?.logic as "AND" | "OR" ?? "AND");
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initial?.conditions ?? [{ field: "projectKey", operator: "equals", value: "" }]
  );

  const addCondition = () =>
    setConditions((prev) => [...prev, { field: "projectKey", operator: "equals", value: "" }]);

  const updateCondition = (i: number, c: RuleCondition) =>
    setConditions((prev) => prev.map((x, idx) => (idx === i ? c : x)));

  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name, useCaseId,
          jiraInstanceId: instanceId || null,
          logic, priority, enabled, conditions,
        });
      }}
      className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
    >
      {error && <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
      <Input label="Rule Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="My mapping rule" />

      <Select label="Use Case" value={useCaseId} onChange={(e) => setUseCaseId(e.target.value)} required>
        {useCases.map((uc) => <option key={uc.id} value={uc.id}>{uc.name}</option>)}
      </Select>

      <Select label="Jira Instance (optional)" value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
        <option value="">All instances</option>
        {instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>

      <div className="grid grid-cols-3 gap-3">
        <Select label="Logic" value={logic} onChange={(e) => setLogic(e.target.value as "AND" | "OR")}>
          <option value="AND">AND (all match)</option>
          <option value="OR">OR (any match)</option>
        </Select>
        <Input label="Priority" type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))} min={0} max={100} />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Enabled</label>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-indigo-600" : "bg-slate-700"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">Conditions</label>
          <button type="button" onClick={addCondition} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <PlusCircle className="w-3.5 h-3.5" /> Add condition
          </button>
        </div>
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <ConditionRow
              key={i}
              condition={c}
              onChange={(updated) => updateCondition(i, updated)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Rule</Button>
      </div>
    </form>
  );
}

export default function MappingsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MappingRule | null>(null);
  const [mutationError, setMutationError] = useState("");

  const { data: rules = [] } = useQuery<MappingRule[]>({
    queryKey: ["mappings"],
    queryFn: () => apiFetch("/api/mappings"),
  });

  const { data: useCases = [] } = useQuery({
    queryKey: ["use-cases-flat"],
    queryFn: async () => {
      const data = await apiFetch("/api/use-cases");
      const flat: Array<{ id: string; name: string }> = [];
      function traverse(arr: any[]) {
        for (const uc of arr) {
          flat.push({ id: uc.id, name: uc.name });
          if (uc.children) traverse(uc.children);
        }
      }
      traverse(data);
      return flat;
    },
  });

  const { data: instances = [] } = useQuery({
    queryKey: ["jira-instances"],
    queryFn: () => apiFetch("/api/jira-instances"),
  });

  const create = useMutation({
    mutationFn: (data: object) =>
      apiFetch("/api/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mappings"] }); setDialogOpen(false); setMutationError(""); },
    onError: (e: Error) => setMutationError(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & object) =>
      apiFetch(`/api/mappings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mappings"] }); setDialogOpen(false); setEditing(null); setMutationError(""); },
    onError: (e: Error) => setMutationError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/mappings/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mappings"] }),
  });

  const remap = useMutation({
    mutationFn: () => apiFetch("/api/mappings/remap", { method: "POST" }),
  });

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Mapping Rules" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Mapping Rules</h2>
              <p className="text-sm text-slate-500">
                Define conditions to automatically map Jira tickets to use cases
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => remap.mutate()} disabled={remap.isPending}>
                <RefreshCw className={`w-4 h-4 ${remap.isPending ? "animate-spin" : ""}`} />
                Re-map All
              </Button>
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                New Rule
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="py-2">
              {rules.length === 0 ? (
                <div className="text-center text-slate-500 py-12 text-sm">
                  <GitMerge className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No mapping rules yet. Create rules to automatically assign tickets to use cases.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {rules.map((rule) => (
                    <div key={rule.id} className="py-3 flex items-start gap-3 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200">{rule.name}</span>
                          {!rule.enabled && <Badge variant="outline">Disabled</Badge>}
                          <Badge variant="default">P{rule.priority}</Badge>
                          <Badge variant={rule.logic === "AND" ? "default" : "outline"}>{rule.logic}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 space-x-2">
                          <span>→ {rule.useCase?.name}</span>
                          {rule.jiraInstance && <span>· {rule.jiraInstance.name}</span>}
                          <span>· {rule._count.ticketMappings} tickets matched</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {rule.conditions.map((c, i) => (
                            <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                              {c.field} {c.operator} &quot;{c.value}&quot;
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(rule); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove.mutate(rule.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={dialogOpen}
            onClose={() => { setDialogOpen(false); setEditing(null); setMutationError(""); }}
            title={editing ? "Edit Rule" : "New Mapping Rule"}
            width="max-w-2xl"
          >
            <RuleForm
              initial={editing ?? undefined}
              useCases={useCases}
              instances={instances}
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
