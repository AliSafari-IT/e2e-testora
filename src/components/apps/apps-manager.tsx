"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Lock, LockOpen, Pencil, Plus, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRun, type ClientProject } from "@/components/run-provider";
import { cn } from "@/lib/utils";

type Visibility = "public" | "private";

interface Draft {
  name: string;
  baseUrl: string;
  apiUrl: string;
  visibility: Visibility;
  key: string;
  productName: string;
  companyName: string;
}

const emptyDraft: Draft = {
  name: "",
  baseUrl: "",
  apiUrl: "",
  visibility: "public",
  key: "",
  productName: "",
  companyName: "",
};

/**
 * Manage the app registry: add apps (public or private with a key), edit them,
 * lock/unlock private apps, and delete user-created ones. Privacy is enforced
 * server-side — this UI only mirrors that state.
 */
export function AppsManager() {
  const router = useRouter();
  const { projects, refreshProjects } = useRun();

  const [mode, setMode] = useState<null | "add" | { editId: string }>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-app inline unlock state.
  const [unlockFor, setUnlockFor] = useState<string | null>(null);
  const [unlockKey, setUnlockKey] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  async function reload() {
    await refreshProjects();
    router.refresh();
  }

  function startAdd() {
    setMode("add");
    setDraft(emptyDraft);
    setError(null);
  }

  function startEdit(p: ClientProject) {
    setMode({ editId: p.id });
    setError(null);
    setDraft({
      name: p.name,
      baseUrl: p.baseUrl ?? "",
      apiUrl: p.apiUrl ?? "",
      visibility: p.visibility,
      key: "",
      productName: p.productName ?? "",
      companyName: p.companyName ?? "",
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const editId = mode && mode !== "add" ? mode.editId : null;
    // Only send a key when one was typed (editing keeps the existing key otherwise).
    const payload: Record<string, unknown> = {
      name: draft.name,
      baseUrl: draft.baseUrl,
      apiUrl: draft.apiUrl,
      visibility: draft.visibility,
      productName: draft.productName,
      companyName: draft.companyName,
    };
    if (draft.key) payload.key = draft.key;
    try {
      const res = await fetch(editId ? `/api/projects?id=${encodeURIComponent(editId)}` : "/api/projects", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(extractError(data) ?? "Could not save app");
        return;
      }
      setMode(null);
      setDraft(emptyDraft);
      await reload();
    } catch {
      setError("Could not save app");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: ClientProject) {
    if (!confirm(`Delete app "${p.name}" and all its tests and results? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(extractError(data) ?? "Could not delete app");
        return;
      }
      await reload();
    } catch {
      setError("Could not delete app");
    }
  }

  async function unlock(id: string) {
    if (!unlockKey.trim()) return;
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/projects/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, key: unlockKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setUnlockError(extractError(data) ?? "Incorrect key");
        return;
      }
      setUnlockFor(null);
      setUnlockKey("");
      await reload();
    } catch {
      setUnlockError("Could not unlock");
    } finally {
      setUnlockBusy(false);
    }
  }

  async function lock(id: string) {
    try {
      await fetch("/api/projects/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await reload();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Apps</h1>
          <p className="text-muted-foreground">
            Each app has its own test catalog. Private apps are locked behind a key — their
            requirements, fixtures, cases and results stay hidden until unlocked.
          </p>
        </div>
        {!mode && (
          <Button onClick={startAdd}>
            <Plus className="h-4 w-4" />
            Add app
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {mode && (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "add" ? "New app" : "Edit app"}</CardTitle>
            <CardDescription>
              {draft.visibility === "private"
                ? "Private apps require a key to view their data."
                : "Public apps are visible to everyone."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="My app" disabled={busy} />
              <Field label="Site base URL" value={draft.baseUrl} onChange={(v) => setDraft({ ...draft, baseUrl: v })} placeholder="https://app.example.com" disabled={busy} />
              <Field label="API base URL" value={draft.apiUrl} onChange={(v) => setDraft({ ...draft, apiUrl: v })} placeholder="https://api.example.com/api/v1" disabled={busy} />
              <Field label="Product name (branding, optional)" value={draft.productName} onChange={(v) => setDraft({ ...draft, productName: v })} disabled={busy} />
              <Field label="Company name (branding, optional)" value={draft.companyName} onChange={(v) => setDraft({ ...draft, companyName: v })} disabled={busy} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Visibility</span>
              <div className="flex gap-2">
                {(["public", "private"] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraft({ ...draft, visibility: v })}
                    disabled={busy}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                      draft.visibility === v
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {v === "private" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {draft.visibility === "private" && (
              <Field
                label={mode === "add" ? "Key" : "New key (leave blank to keep current)"}
                type="password"
                value={draft.key}
                onChange={(v) => setDraft({ ...draft, key: v })}
                placeholder="At least 4 characters"
                disabled={busy}
              />
            )}

            <div className="flex items-center gap-2">
              <Button onClick={() => void save()} disabled={busy || !draft.name.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {mode === "add" ? "Create app" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => { setMode(null); setError(null); }} disabled={busy}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {projects.length === 0 && (
          <p className="text-muted-foreground">No apps yet. Add one above.</p>
        )}
        {projects.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-foreground">{p.name}</span>
                    <VisibilityBadge project={p} />
                    {p.seeded && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        built-in
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.locked ? "Locked — unlock to view URLs & data" : p.baseUrl || "no site URL"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {p.locked ? (
                    <Button size="sm" variant="outline" onClick={() => { setUnlockFor(p.id); setUnlockKey(""); setUnlockError(null); }}>
                      <Unlock className="h-3.5 w-3.5" />
                      Unlock
                    </Button>
                  ) : (
                    <>
                      {p.visibility === "private" && (
                        <Button size="sm" variant="outline" onClick={() => void lock(p.id)} title="Lock again on this browser">
                          <LockOpen className="h-3.5 w-3.5" />
                          Lock
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {!p.seeded && (
                        <button
                          type="button"
                          onClick={() => void remove(p)}
                          title="Delete this app and its data"
                          className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {unlockFor === p.id && p.locked && (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      autoFocus
                      value={unlockKey}
                      onChange={(e) => setUnlockKey(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void unlock(p.id); }}
                      placeholder="App key"
                      disabled={unlockBusy}
                      className="h-9 w-56 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
                    />
                    <Button size="sm" onClick={() => void unlock(p.id)} disabled={unlockBusy || !unlockKey.trim()}>
                      {unlockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                      Unlock
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setUnlockFor(null)} disabled={unlockBusy}>
                      Cancel
                    </Button>
                  </div>
                  {unlockError && <p className="text-xs text-destructive">{unlockError}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VisibilityBadge({ project }: { project: ClientProject }) {
  if (project.visibility === "public") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        <Globe className="h-3 w-3" /> public
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        project.locked
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      )}
    >
      <Lock className="h-3 w-3" /> {project.locked ? "private — locked" : "private — unlocked"}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-9 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
      />
    </label>
  );
}

function extractError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") return err;
  // zod flatten shape: { fieldErrors: { key: [..] }, formErrors: [..] }
  if (err && typeof err === "object") {
    const fe = (err as { fieldErrors?: Record<string, string[]>; formErrors?: string[] });
    const first =
      Object.values(fe.fieldErrors ?? {}).flat()[0] ?? (fe.formErrors ?? [])[0];
    if (first) return first;
  }
  return null;
}
