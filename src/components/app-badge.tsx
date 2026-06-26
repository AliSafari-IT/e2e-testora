"use client";

import { useEffect, useRef, useState } from "react";
import { Boxes, Check, ChevronDown } from "lucide-react";
import { useRun } from "@/components/run-provider";
import { PROJECTS, getProject } from "@/data/projects";
import { cn } from "@/lib/utils";

/**
 * Always-visible badge (top-right of every page) showing which app's catalog is
 * active — and a one-click switcher. Backed by the shared cookie, so switching
 * here re-filters the Cases / Requirements / Results / Run pages alike.
 */
export function AppBadge() {
  const { projectId, setProjectId } = useRun();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = getProject(projectId);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A single app means nothing to switch — still show the badge for orientation.
  const multi = PROJECTS.length > 1;

  return (
    <div ref={ref} className="fixed right-3 top-3 z-40 print:hidden">
      <button
        type="button"
        onClick={() => multi && setOpen((o) => !o)}
        title="Active app — the catalog every page is filtered to"
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-sm shadow-lg backdrop-blur transition-colors",
          multi && "hover:border-primary/60",
        )}
      >
        <Boxes className="h-4 w-4 text-primary" />
        <span className="hidden text-xs text-muted-foreground sm:inline">App</span>
        <span className="max-w-40 truncate font-semibold text-foreground">
          {active?.name ?? projectId}
        </span>
        {multi && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-64 overflow-hidden rounded-md border border-border bg-card p-1 shadow-xl">
          <p className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Switch app
          </p>
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProjectId(p.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                p.id === projectId && "bg-muted/60",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.baseUrl}</span>
              </span>
              {p.id === projectId && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
