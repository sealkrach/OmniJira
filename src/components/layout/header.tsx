"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Settings2, CircleCheck, CircleX, CircleDot, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LlmStatus = "idle" | "checking" | "ok" | "error" | "unconfigured";

interface LlmHealth {
  ok: boolean;
  configured: boolean;
  model: string;
  latency?: number;
  error?: string;
}

interface LlmSettings {
  configured: boolean;
  keySource: "database" | "env" | "none";
  model: string;
}

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"] as const;

function LlmStatusIcon({ status, latency }: { status: LlmStatus; latency?: number }) {
  if (status === "checking") {
    return <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />;
  }
  if (status === "ok") {
    return (
      <span className="flex items-center gap-1 text-emerald-400" title={latency ? `${latency}ms` : "Connected"}>
        <CircleCheck className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">{latency ? `${latency}ms` : "OK"}</span>
      </span>
    );
  }
  if (status === "error") {
    return <CircleX className="w-4 h-4 text-red-400" />;
  }
  if (status === "unconfigured") {
    return <CircleDot className="w-4 h-4 text-slate-500" />;
  }
  return <CircleDot className="w-4 h-4 text-slate-600" />;
}

export function Header({ title }: { title: string }) {
  const { data: session } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LlmStatus>("idle");
  const [llmLatency, setLlmLatency] = useState<number | undefined>();
  const [llmError, setLlmError] = useState("");

  // Settings form state
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>("gpt-4o-mini");
  const [keySource, setKeySource] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  const checkHealth = useCallback(async () => {
    setLlmStatus("checking");
    setLlmError("");
    try {
      const res = await fetch("/api/llm/health");
      const data: LlmHealth = await res.json();
      if (!data.configured) {
        setLlmStatus("unconfigured");
      } else if (data.ok) {
        setLlmStatus("ok");
        setLlmLatency(data.latency);
      } else {
        setLlmStatus("error");
        setLlmError(data.error ?? "Unknown error");
      }
    } catch {
      setLlmStatus("error");
      setLlmError("Network error");
    }
  }, []);

  // Check health on mount
  useEffect(() => { checkHealth(); }, [checkHealth]);

  async function openSettings() {
    try {
      const res = await fetch("/api/llm/settings");
      const data: LlmSettings = await res.json();
      setModel(data.model ?? "gpt-4o-mini");
      setKeySource(data.keySource);
    } catch { /* ignore */ }
    setApiKey("");
    setSaveError("");
    setSaveOk(false);
    setSettingsOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    try {
      const res = await fetch("/api/llm/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Save failed"); return; }
      setSaveOk(true);
      setApiKey("");
      setKeySource("database");
      checkHealth();
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
      <h1 className="font-semibold text-white text-base">{title}</h1>

      <div className="flex items-center gap-3">

        {/* LLM health indicator */}
        <button
          onClick={checkHealth}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
          title={llmError || "Click to re-check LLM connection"}
        >
          <LlmStatusIcon status={llmStatus} latency={llmLatency} />
        </button>

        {/* LLM settings */}
        <button
          onClick={openSettings}
          className="text-slate-400 hover:text-slate-200 transition-colors"
          title="LLM Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-800" />

        {/* User info */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <User className="w-4 h-4" />
          <span>{session?.user?.email}</span>
          {session?.user?.role === "ADMIN" && (
            <span className="bg-indigo-600/20 text-indigo-400 text-xs px-1.5 py-0.5 rounded">Admin</span>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* LLM Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title="LLM Settings">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
            <LlmStatusIcon status={llmStatus} latency={llmLatency} />
            <span>
              {llmStatus === "unconfigured" && "Not configured — add an API key below"}
              {llmStatus === "ok" && `Connected · ${llmLatency}ms`}
              {llmStatus === "error" && `Error: ${llmError}`}
              {llmStatus === "checking" && "Checking…"}
              {llmStatus === "idle" && "Unknown"}
            </span>
          </div>

          {keySource === "env" && (
            <p className="text-xs text-amber-400 bg-amber-950/30 rounded px-3 py-2">
              API key is set via environment variable. Saving here will override it in the database.
            </p>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {saveError && <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">{saveError}</p>}
            {saveOk && <p className="text-sm text-emerald-400 bg-emerald-950/40 rounded-lg px-3 py-2">Saved successfully.</p>}

            <Input
              label={keySource === "database" ? "New API Key (leave blank to keep current)" : "OpenAI API Key"}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-proj-..."
            />
            <Select label="Model" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>

            <div className="flex gap-2 justify-between pt-1">
              <Button type="button" variant="ghost" onClick={checkHealth} disabled={llmStatus === "checking"}>
                <RefreshCw className={`w-3.5 h-3.5 ${llmStatus === "checking" ? "animate-spin" : ""}`} />
                Test
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving || !apiKey}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Dialog>
    </header>
  );
}
