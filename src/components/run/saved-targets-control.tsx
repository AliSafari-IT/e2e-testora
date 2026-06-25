"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Globe, Plus, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunEnvironment } from "@/components/run-provider";
import { getDomainBrand, hostFromUrl, setDomainBrand } from "@/lib/domain-logos";
import {
  type SavedTarget,
  getSavedTargets,
  removeSavedTarget,
  upsertSavedTarget,
} from "@/lib/saved-targets";

function hostOf(url?: string): string {
  return hostFromUrl(url) ?? "localhost";
}

/**
 * A named address book for test targets. Type to filter/recall a saved target —
 * picking one auto-fills the site + API URLs AND loads its product/company
 * branding. Type a new name to save the current target. Each entry has a ✕ to
 * forget it.
 */
export function SavedTargetsControl({
  environment,
  onApply,
  disabled,
}: {
  environment: RunEnvironment;
  onApply: (env: RunEnvironment) => void;
  disabled?: boolean;
}) {
  const [targets, setTargets] = useState<SavedTarget[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTargets(getSavedTargets());
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return targets;
    return targets.filter((t) =>
      `${t.name} ${t.baseUrl} ${t.apiUrl}`.toLowerCase().includes(needle),
    );
  }, [targets, trimmed]);

  const nameMatch = targets.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());
  const hasCurrent = Boolean(environment.baseUrl || environment.apiUrl);

  function applyTarget(target: SavedTarget) {
    // Load the branding snapshot onto its host first, so the brand panel (keyed
    // by host) shows it the moment the environment — and thus the host — changes.
    if (target.brand) setDomainBrand(hostOf(target.baseUrl), target.brand);
    onApply({ baseUrl: target.baseUrl || undefined, apiUrl: target.apiUrl || undefined });
    setQuery(target.name);
    setOpen(false);
  }

  function saveCurrent(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || !hasCurrent) return;
    const brand = getDomainBrand(hostOf(environment.baseUrl));
    const next = upsertSavedTarget({
      name: trimmedName,
      baseUrl: environment.baseUrl ?? "",
      apiUrl: environment.apiUrl ?? "",
      brand: Object.keys(brand).length ? brand : undefined,
    });
    setTargets(next);
    setOpen(false);
  }

  function deleteTarget(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    setTargets(removeSavedTarget(id));
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5" />
        Saved targets — recall a name to fill the URLs + branding, or save the current one.
      </div>

      <div className="relative">
        <Bookmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Recall or name a target…"
          disabled={disabled}
          className="h-9 w-full rounded-md border border-border bg-muted pl-9 pr-9 text-sm"
        />
        {/* Quick-save the current target under the typed name. */}
        {hasCurrent && trimmed && (
          <button
            type="button"
            onClick={() => saveCurrent(trimmed)}
            disabled={disabled}
            title={nameMatch ? `Update "${trimmed}"` : `Save current as "${trimmed}"`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-primary disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
          {filtered.length === 0 && !trimmed && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No saved targets yet. Pick a preset or enter URLs below, set branding, then type a name
              here and save.
            </p>
          )}

          {filtered.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => applyTarget(target)}
              className="group flex w-full items-center gap-3 rounded px-2 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                {target.brand?.productLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={target.brand.productLogo} alt="" className="max-h-8 max-w-full object-contain" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{target.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {hostOf(target.baseUrl)}
                  {target.brand?.productName ? ` · ${target.brand.productName}` : ""}
                </span>
              </span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(event) => deleteTarget(event, target.id)}
                title="Forget this target"
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}

          {/* Create / update affordance when a name is typed. */}
          {trimmed && (
            <button
              type="button"
              onClick={() => saveCurrent(trimmed)}
              disabled={!hasCurrent}
              className={cn(
                "mt-1 flex w-full items-center gap-2 rounded border-t border-border px-3 py-2 text-left text-sm transition-colors",
                hasCurrent ? "text-primary hover:bg-primary/10" : "cursor-not-allowed text-muted-foreground",
              )}
            >
              <Plus className="h-4 w-4" />
              {nameMatch ? `Update “${trimmed}” with the current target` : `Save current target as “${trimmed}”`}
              {!hasCurrent && <span className="ml-auto text-xs">set URLs first</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
