"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Building2, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";

interface Entity {
  id: string;
  name: string;
  description: string | null;
  color: string;
  children: Entity[];
  _count: { useCases: number };
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function EntityForm({
  initial,
  onSave,
  onCancel,
  error,
}: {
  initial?: Partial<Entity>;
  onSave: (data: Partial<Entity>) => void;
  onCancel: () => void;
  error?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, description: description || null, color });
      }}
      className="space-y-4"
    >
      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>
      )}
      <Input
        label="Entity Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="e.g. Digital Banking, Retail"
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Optional description"
      />
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-300">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
          />
          <span className="text-sm text-slate-400 font-mono">{color}</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

function EntityRow({
  entity,
  onEdit,
  onDelete,
}: {
  entity: Entity;
  onEdit: (e: Entity) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 group">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entity.color }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-200">{entity.name}</span>
          {entity.description && (
            <p className="text-xs text-slate-500 truncate">{entity.description}</p>
          )}
        </div>
        <span className="text-xs text-slate-500">{entity._count.useCases} use cases</span>
        {entity.children.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300">
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={() => onEdit(entity)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(entity.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && entity.children.length > 0 && (
        <div className="ml-6 border-l border-slate-800 pl-3 mt-1">
          {entity.children.map((child) => (
            <EntityRow key={child.id} entity={child} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EntitiesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [mutationError, setMutationError] = useState("");

  function closeDialog() { setDialogOpen(false); setEditing(null); setMutationError(""); }

  const { data: entities = [], error: loadError } = useQuery<Entity[]>({
    queryKey: ["entities"],
    queryFn: () => apiFetch("/api/entities"),
  });

  const create = useMutation({
    mutationFn: (data: object) =>
      apiFetch("/api/entities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["entities"] }); closeDialog(); },
    onError: (e: Error) => setMutationError(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & object) =>
      apiFetch(`/api/entities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["entities"] }); closeDialog(); },
    onError: (e: Error) => setMutationError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/entities/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entities"] }),
  });

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Entities" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Business Entities</h2>
              <p className="text-sm text-slate-500">
                Organizational units that own use cases and QAP objectives
              </p>
            </div>
            <Button onClick={() => { setEditing(null); setMutationError(""); setDialogOpen(true); }}>
              <Plus className="w-4 h-4" />
              New Entity
            </Button>
          </div>

          {loadError && (
            <p className="mb-4 text-sm text-red-400 bg-red-950/40 rounded-lg px-4 py-2">
              {(loadError as Error).message}
            </p>
          )}

          <Card>
            <CardContent className="py-2">
              {entities.length === 0 ? (
                <div className="text-center text-slate-500 py-12 text-sm">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No entities yet. Create your first one.
                </div>
              ) : (
                <div>
                  {entities.map((entity) => (
                    <EntityRow
                      key={entity.id}
                      entity={entity}
                      onEdit={(e) => { setEditing(e); setMutationError(""); setDialogOpen(true); }}
                      onDelete={(id) => remove.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={dialogOpen}
            onClose={closeDialog}
            title={editing ? "Edit Entity" : "New Entity"}
          >
            <EntityForm
              initial={editing ?? undefined}
              error={mutationError}
              onSave={(data) => {
                if (editing) update.mutate({ id: editing.id, ...data });
                else create.mutate(data);
              }}
              onCancel={closeDialog}
            />
          </Dialog>
        </main>
      </div>
    </div>
  );
}
