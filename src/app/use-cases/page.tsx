"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Plus, ChevronRight, Pencil, Trash2, Target, Sparkles, Network, RotateCcw, Download } from "lucide-react";
import { exportCsv, exportPdf } from "@/lib/export";

interface Entity { id: string; name: string }
interface JiraInstance { id: string; name: string }

interface UseCase {
  id: string;
  name: string;
  description: string | null;
  level: string;
  targetQuarter: number | null;
  targetYear: number | null;
  entityId: string;
  parentId: string | null;
  children: UseCase[];
  _count: { ticketMappings: number };
}

const LEVELS = ["DOMAIN", "CAPABILITY", "INITIATIVE"] as const;

const UC_EXPORT_COLS = ["Level", "Name", "Description", "Tickets", "Quarter", "Year"];

function flattenUcRows(ucs: UseCase[], depth = 0): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const uc of ucs) {
    rows.push([
      uc.level,
      "  ".repeat(depth) + uc.name,
      uc.description ?? "",
      totalTickets(uc),
      uc.targetQuarter ? `Q${uc.targetQuarter}` : "",
      uc.targetYear ?? "",
    ]);
    if (uc.children?.length) rows.push(...flattenUcRows(uc.children, depth + 1));
  }
  return rows;
}

function totalTickets(uc: UseCase): number {
  return uc._count.ticketMappings + (uc.children ?? []).reduce((sum, c) => sum + totalTickets(c), 0);
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function UseCaseForm({
  initial,
  entities,
  onSave,
  onCancel,
  error,
}: {
  initial?: Partial<UseCase>;
  entities: Entity[];
  onSave: (data: object) => void;
  onCancel: () => void;
  error?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [entityId, setEntityId] = useState(initial?.entityId ?? entities[0]?.id ?? "");
  const [level, setLevel] = useState<string>(initial?.level ?? "INITIATIVE");
  const [q, setQ] = useState<string>(initial?.targetQuarter ? String(initial.targetQuarter) : "");
  const [y, setY] = useState<string>(
    initial?.targetYear ? String(initial.targetYear) : String(new Date().getFullYear())
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, description: description || null, entityId, level, targetQuarter: q ? parseInt(q) : null, targetYear: y ? parseInt(y) : null });
      }}
      className="space-y-4"
    >
      {error && <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
      {entities.length === 0 && (
        <p className="text-sm text-amber-400 bg-amber-950/30 rounded-lg px-3 py-2">
          No entities found. Create an entity first in <a href="/entities" className="underline">Entities</a>.
        </p>
      )}
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Use case name" />
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <Select label="Entity" value={entityId} onChange={(e) => setEntityId(e.target.value)} required>
        {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
      </Select>
      <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
        {LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Target Quarter" value={q} onChange={(e) => setQ(e.target.value)}>
          <option value="">None</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Q{n}</option>)}
        </Select>
        <Input label="Target Year" type="number" value={y} onChange={(e) => setY(e.target.value)} min={2024} max={2035} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={entities.length === 0}>Save</Button>
      </div>
    </form>
  );
}

function AiGenerateForm({
  entities,
  instances,
  existingCount,
  onDone,
  onCancel,
}: {
  entities: Entity[];
  instances: JiraInstance[];
  existingCount: number;
  onDone: (result: { created: number; mapped: number }) => void;
  onCancel: () => void;
}) {
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [y, setY] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/api/use-cases/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          entityId,
          targetQuarter: q ? parseInt(q) : null,
          targetYear: y ? parseInt(y) : null,
        }),
      });
      onDone(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
      {existingCount > 0 && (
        <p className="text-sm text-amber-400 bg-amber-950/30 rounded-lg px-3 py-2">
          {existingCount} use cases already exist. Use <strong>Reset</strong> first to avoid duplicates.
        </p>
      )}
      <p className="text-sm text-slate-400">
        AI will analyze your synced tickets and automatically generate a Domain → Capability → Initiative taxonomy, then map each ticket.
      </p>
      <Select label="Jira Instance" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} required>
        {instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>
      <Select label="Entity" value={entityId} onChange={(e) => setEntityId(e.target.value)} required>
        {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Target Quarter" value={q} onChange={(e) => setQ(e.target.value)}>
          <option value="">None</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Q{n}</option>)}
        </Select>
        <Input label="Target Year" type="number" value={y} onChange={(e) => setY(e.target.value)} min={2024} max={2035} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !instanceId || !entityId}>
          {loading ? "Generating…" : "Generate with AI"}
        </Button>
      </div>
    </form>
  );
}

function AiMapForm({
  instances,
  onDone,
  onCancel,
}: {
  instances: JiraInstance[];
  onDone: (result: { mapped: number; skipped: number }) => void;
  onCancel: () => void;
}) {
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/api/use-cases/ai-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      onDone(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI mapping failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
      <p className="text-sm text-slate-400">
        AI will match tickets that have no use case assignment yet to the most relevant Initiative. Use this after syncing new tickets — not needed if you just ran AI Generate.
      </p>
      <Select label="Jira Instance" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} required>
        {instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !instanceId}>
          {loading ? "Mapping…" : "Map with AI"}
        </Button>
      </div>
    </form>
  );
}

function UseCaseNode({ uc, depth, onEdit, onDelete }: {
  uc: UseCase; depth: number;
  onEdit: (uc: UseCase) => void; onDelete: (id: string) => void;
}) {
  const children = uc.children ?? [];
  const [expanded, setExpanded] = useState(depth <= 1);
  const hasChildren = children.length > 0;

  const levelMeta = depth === 0
    ? { color: "text-indigo-400 font-semibold", badge: "Domain", badgeClass: "bg-indigo-950 text-indigo-400 border border-indigo-800/50" }
    : depth === 1
      ? { color: "text-slate-200 font-medium", badge: "Capability", badgeClass: "bg-slate-800 text-slate-400 border border-slate-700" }
      : { color: "text-slate-300", badge: "Initiative", badgeClass: "bg-emerald-950 text-emerald-400 border border-emerald-800/50" };

  const ticketCount = totalTickets(uc);

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-800/40 group">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 shrink-0">
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <div className="w-3.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${levelMeta.badgeClass}`}>{levelMeta.badge}</span>
            <span className={`text-sm ${levelMeta.color}`}>{uc.name}</span>
            {uc.targetQuarter && uc.targetYear && (
              <span className="text-xs text-slate-500">Q{uc.targetQuarter} {uc.targetYear}</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{ticketCount} ticket{ticketCount !== 1 ? "s" : ""} mappé{ticketCount !== 1 ? "s" : ""}</div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={() => onEdit(uc)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(uc.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="ml-6 border-l border-slate-800/70 pl-3">
          {children.map((child) => (
            <UseCaseNode key={child.id} uc={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

type ModalMode = "create" | "edit" | "ai-generate" | "ai-map" | "reset" | null;

export default function UseCasesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<UseCase | null>(null);
  const [filterEntity, setFilterEntity] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  const { data: entities = [] } = useQuery<Entity[]>({
    queryKey: ["entities"],
    queryFn: () => apiFetch("/api/entities"),
  });

  const { data: instances = [] } = useQuery<JiraInstance[]>({
    queryKey: ["jira-instances"],
    queryFn: () => apiFetch("/api/jira-instances"),
  });

  const { data: useCases = [] } = useQuery<UseCase[]>({
    queryKey: ["use-cases", filterEntity],
    queryFn: () => {
      const params = filterEntity ? `?entityId=${filterEntity}` : "";
      return apiFetch(`/api/use-cases${params}`);
    },
  });

  const create = useMutation({
    mutationFn: (data: object) =>
      apiFetch("/api/use-cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
      setModal(null);
      setMutationError("");
    },
    onError: (e: Error) => setMutationError(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & object) =>
      apiFetch(`/api/use-cases/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
      setModal(null);
      setEditing(null);
      setMutationError("");
    },
    onError: (e: Error) => setMutationError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/use-cases/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["use-cases"] }),
  });

  function closeModal() { setModal(null); setEditing(null); setMutationError(""); }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Use Cases" />
        <main className="flex-1 overflow-y-auto p-6">

          {toast && (
            <div className="mb-4 px-4 py-2 bg-green-900/50 border border-green-700/50 rounded-lg text-sm text-green-300">
              {toast}
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Use Case Taxonomy</h2>
              <p className="text-sm text-slate-500">Domain → Capability → Initiative hierarchy</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Entities</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {useCases.length > 0 && (
                <>
                  <Button variant="ghost" onClick={() => exportCsv("use-cases", UC_EXPORT_COLS, flattenUcRows(useCases))} title="Export CSV">
                    <Download className="w-4 h-4" />
                    CSV
                  </Button>
                  <Button variant="ghost" onClick={() => exportPdf("use-cases", "Use Case Taxonomy", UC_EXPORT_COLS, flattenUcRows(useCases))} title="Export PDF">
                    <Download className="w-4 h-4" />
                    PDF
                  </Button>
                  <Button variant="danger" onClick={() => setModal("reset")} title="Reset all AI-generated use cases">
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setModal("ai-map")} title="AI: map new tickets to existing use cases">
                <Network className="w-4 h-4" />
                AI Map
              </Button>
              <Button variant="ghost" onClick={() => setModal("ai-generate")} title="AI: generate taxonomy from ticket patterns">
                <Sparkles className="w-4 h-4" />
                AI Generate
              </Button>
              <Button onClick={() => { setEditing(null); setModal("create"); }}>
                <Plus className="w-4 h-4" />
                New
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="py-2">
              {useCases.length === 0 ? (
                <div className="text-center text-slate-500 py-12 text-sm">
                  <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No use cases yet.</p>
                  <p className="mt-1">Use <span className="text-indigo-400">AI Generate</span> to auto-create from tickets, or add manually.</p>
                </div>
              ) : (
                <div>
                  {useCases.map((uc) => (
                    <UseCaseNode
                      key={uc.id}
                      uc={uc}
                      depth={0}
                      onEdit={(u) => { setEditing(u); setModal("edit"); }}
                      onDelete={(id) => remove.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create / Edit */}
          <Dialog
            open={modal === "create" || modal === "edit"}
            onClose={closeModal}
            title={modal === "edit" ? "Edit Use Case" : "New Use Case"}
          >
            <UseCaseForm
              initial={editing ?? undefined}
              entities={entities}
              error={mutationError}
              onSave={(data) => {
                if (editing) update.mutate({ id: editing.id, ...data });
                else create.mutate(data);
              }}
              onCancel={closeModal}
            />
          </Dialog>

          {/* AI Generate */}
          <Dialog open={modal === "ai-generate"} onClose={closeModal} title="AI — Generate Use Cases from Tickets">
            <AiGenerateForm
              entities={entities}
              instances={instances}
              existingCount={useCases.length}
              onDone={(result) => {
                queryClient.invalidateQueries({ queryKey: ["use-cases"] });
                closeModal();
                showToast(`AI created ${result.created} use cases and mapped ${result.mapped} tickets.`);
              }}
              onCancel={closeModal}
            />
          </Dialog>

          {/* AI Map */}
          <Dialog open={modal === "ai-map"} onClose={closeModal} title="AI — Map Tickets to Use Cases">
            <AiMapForm
              instances={instances}
              onDone={(result: { mapped: number; skipped: number }) => {
                queryClient.invalidateQueries({ queryKey: ["use-cases"] });
                closeModal();
                const msg = result.mapped > 0
                  ? `AI mapped ${result.mapped} new tickets (${result.skipped} already mapped).`
                  : `No new tickets to map — ${result.skipped} tickets already have mappings.`;
                showToast(msg);
              }}
              onCancel={closeModal}
            />
          </Dialog>

          {/* Reset confirmation */}
          <Dialog open={modal === "reset"} onClose={closeModal} title="Reset Taxonomy">
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                This will delete <strong className="text-white">all use cases</strong> and their automatic ticket mappings.
                Manual mappings will also be removed. This cannot be undone.
              </p>
              <p className="text-sm text-amber-400 bg-amber-950/30 rounded-lg px-3 py-2">
                Run <strong>AI Generate</strong> again after resetting to rebuild the taxonomy from your current tickets.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    try {
                      await apiFetch("/api/use-cases/reset", { method: "DELETE" });
                      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
                      closeModal();
                      showToast("Taxonomy reset. Run AI Generate to rebuild.");
                    } catch (e: unknown) {
                      showToast(`Reset failed: ${e instanceof Error ? e.message : "unknown error"}`);
                    }
                  }}
                >
                  Reset Everything
                </Button>
              </div>
            </div>
          </Dialog>

        </main>
      </div>
    </div>
  );
}
