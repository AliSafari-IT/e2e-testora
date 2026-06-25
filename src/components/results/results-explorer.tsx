"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Copy, FileCode2, FileJson, Filter, Loader2, Trash2, X } from "lucide-react";
import type { ReportResultRow } from "@/lib/queries";
import { buildHtmlReport, buildJsonReport, dateStamp, summarize, type ReportBrand } from "@/lib/report";
import { saveTextFile } from "@/lib/save-file";
import { getDomainBrands, hostFromUrl } from "@/lib/domain-logos";

interface Option {
  id: string;
  title: string;
}

function distinct(rows: ReportResultRow[], idKey: keyof ReportResultRow, titleKey: keyof ReportResultRow): Option[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    const id = String(row[idKey] ?? "");
    if (!id) continue;
    if (!map.has(id)) map.set(id, String(row[titleKey] ?? id));
  }
  return [...map.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function errorPreview(message: string): string {
  const firstLine = message.split("\n").find((l) => l.trim()) ?? message;
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}…` : firstLine;
}

/** The configured branding for the distinct domains present in the exported rows. */
function brandsForRows(rows: ReportResultRow[]): ReportBrand[] {
  const stored = getDomainBrands();
  const hosts = new Set<string>();
  for (const row of rows) {
    const host = hostFromUrl(row.targetBaseUrl);
    if (host) hosts.add(host);
  }
  const out: ReportBrand[] = [];
  for (const host of hosts) {
    const brand = stored[host];
    if (brand) out.push({ host, ...brand });
  }
  return out;
}

const selectClass =
  "h-9 w-full rounded-md border border-border bg-muted px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function ResultsExplorer({ rows: initialRows }: { rows: ReportResultRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [frId, setFrId] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"json" | "html" | null>(null);
  const [done, setDone] = useState<"json" | "html" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorRow, setErrorRow] = useState<ReportResultRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; row: ReportResultRow } | null>(null);
  const headerCbRef = useRef<HTMLInputElement>(null);

  const frOptions = useMemo(() => distinct(rows, "frId", "frTitle"), [rows]);
  const suiteScope = useMemo(() => rows.filter((r) => !frId || r.frId === frId), [rows, frId]);
  const suiteOptions = useMemo(() => distinct(suiteScope, "suiteId", "suiteTitle"), [suiteScope]);
  const fixtureScope = useMemo(
    () => suiteScope.filter((r) => !suiteId || r.suiteId === suiteId),
    [suiteScope, suiteId],
  );
  const fixtureOptions = useMemo(() => distinct(fixtureScope, "fixtureId", "fixtureTitle"), [fixtureScope]);
  const caseScope = useMemo(
    () => fixtureScope.filter((r) => !fixtureId || r.fixtureId === fixtureId),
    [fixtureScope, fixtureId],
  );
  const caseOptions = useMemo(() => distinct(caseScope, "caseId", "caseTitle"), [caseScope]);
  const statusOptions = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() : null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (frId && r.frId !== frId) return false;
      if (suiteId && r.suiteId !== suiteId) return false;
      if (fixtureId && r.fixtureId !== fixtureId) return false;
      if (caseId && r.caseId !== caseId) return false;
      if (status && r.status !== status) return false;
      const ts = new Date(r.createdAt).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      if (q) {
        const hay = `${r.caseTitle} ${r.fixtureTitle} ${r.suiteTitle} ${r.frTitle} ${r.errorMessage ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, frId, suiteId, fixtureId, caseId, status, from, to, search]);

  const summary = useMemo(() => summarize(filtered), [filtered]);
  const hasFilters = Boolean(frId || suiteId || fixtureId || caseId || status || from || to || search);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someFilteredSelected = filtered.some((r) => selected.has(r.id));

  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  // Close the context menu on any outside interaction.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function clearFilters() {
    setSearch("");
    setFrId("");
    setSuiteId("");
    setFixtureId("");
    setCaseId("");
    setStatus("");
    setFrom("");
    setTo("");
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function describeFilters(): string[] {
    const out: string[] = [];
    const label = (opts: Option[], id: string) => opts.find((o) => o.id === id)?.title ?? id;
    if (frId) out.push(`Functional requirement: ${label(frOptions, frId)}`);
    if (suiteId) out.push(`Suite: ${label(suiteOptions, suiteId)}`);
    if (fixtureId) out.push(`Fixture: ${label(fixtureOptions, fixtureId)}`);
    if (caseId) out.push(`Test case: ${label(caseOptions, caseId)}`);
    if (status) out.push(`Status: ${status}`);
    if (from) out.push(`From: ${new Date(from).toLocaleString()}`);
    if (to) out.push(`To: ${new Date(to).toLocaleString()}`);
    if (search) out.push(`Search: "${search}"`);
    return out;
  }

  async function exportRows(kind: "json" | "html", rowsToExport: ReportResultRow[], filters: string[]) {
    if (rowsToExport.length === 0 || busy) return;
    setBusy(kind);
    try {
      const meta = { generatedAt: new Date().toISOString(), filters };
      const content =
        kind === "json"
          ? buildJsonReport(rowsToExport, meta)
          : buildHtmlReport(rowsToExport, meta, brandsForRows(rowsToExport));
      const fallback = kind === "json" ? "test-results" : "test-report";
      const outcome = await saveTextFile(content, {
        suggestedName: `${fallback}_${dateStamp()}.${kind}`,
        mimeType: kind === "json" ? "application/json" : "text/html",
        extension: kind,
        description: kind === "json" ? "JSON test report" : "HTML test report",
      });
      if (outcome !== "cancelled") {
        setDone(kind);
        setTimeout(() => setDone(null), 1800);
      }
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setBusy(null);
    }
  }

  async function deleteIds(ids: string[], label: string) {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} ${label}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        window.alert("Failed to delete results.");
        return;
      }
      const removed = new Set(ids);
      setRows((prev) => prev.filter((r) => !removed.has(r.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err) {
      console.error("Delete failed", err);
      window.alert("Failed to delete results.");
    }
  }

  // Context menu acts on the selection if the right-clicked row is part of it,
  // otherwise on just that row.
  const menuTargetRows =
    menu && selected.has(menu.row.id) && selected.size > 0 ? selectedRows : menu ? [menu.row] : [];
  const menuIsSelection = menuTargetRows.length > 1 || (menu != null && selected.has(menu.row.id) && selected.size > 0);

  function copyError() {
    if (!errorRow?.errorMessage) return;
    navigator.clipboard.writeText(errorRow.errorMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Results</h1>
          <p className="text-muted-foreground">Filter, select and export stored runs as a shareable report.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportRows("html", filtered, describeFilters())}
            disabled={filtered.length === 0 || busy !== null}
          >
            {busy === "html" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done === "html" ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <FileCode2 className="h-4 w-4" />
            )}
            Export HTML
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportRows("json", filtered, describeFilters())}
            disabled={filtered.length === 0 || busy !== null}
          >
            {busy === "json" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done === "json" ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
            Export JSON
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs text-muted-foreground">Search</span>
            <input
              className={selectClass}
              placeholder="case, fixture, error text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Functional requirement</span>
            <select
              className={selectClass}
              value={frId}
              onChange={(e) => {
                setFrId(e.target.value);
                setSuiteId("");
                setFixtureId("");
                setCaseId("");
              }}
            >
              <option value="">All</option>
              {frOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Suite</span>
            <select
              className={selectClass}
              value={suiteId}
              onChange={(e) => {
                setSuiteId(e.target.value);
                setFixtureId("");
                setCaseId("");
              }}
            >
              <option value="">All</option>
              {suiteOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Fixture</span>
            <select
              className={selectClass}
              value={fixtureId}
              onChange={(e) => {
                setFixtureId(e.target.value);
                setCaseId("");
              }}
            >
              <option value="">All</option>
              {fixtureOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Test case</span>
            <select className={selectClass} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">All</option>
              {caseOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <input type="datetime-local" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <input type="datetime-local" className={selectClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {filtered.length} of {rows.length} result(s)
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-3">
                <span className="text-emerald-500">{summary.passed} passed</span>
                <span className="text-red-500">{summary.failed} failed</span>
                {summary.other > 0 && <span className="text-yellow-500">{summary.other} other</span>}
                <span>· {summary.passRate}% pass rate</span>
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => deleteIds(filtered.map((r) => r.id), "filtered result(s)")}
              disabled={filtered.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Delete all filtered ({filtered.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <span className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRows("html", selectedRows, [...describeFilters(), `Selection: ${selectedRows.length} result(s)`])}
                disabled={busy !== null}
              >
                <FileCode2 className="h-4 w-4" />
                Send to HTML
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRows("json", selectedRows, [...describeFilters(), `Selection: ${selectedRows.length} result(s)`])}
                disabled={busy !== null}
              >
                <FileJson className="h-4 w-4" />
                Send to JSON
              </Button>
              <Button variant="destructive" size="sm" onClick={() => deleteIds([...selected], "selected result(s)")}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-muted-foreground">No results match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">
                      <input
                        ref={headerCbRef}
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-violet-500"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Select all filtered"
                      />
                    </th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Case</th>
                    <th className="py-2 pr-3">Fixture</th>
                    <th className="py-2 pr-3">Suite</th>
                    <th className="py-2 pr-3">Duration</th>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isSelected = selected.has(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-border/60 align-top ${isSelected ? "bg-muted/40" : ""}`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu({ x: e.clientX, y: e.clientY, row: r });
                        }}
                      >
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-violet-500"
                            checked={isSelected}
                            onChange={() => toggleRow(r.id)}
                            aria-label="Select result"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            variant={
                              r.status === "passed"
                                ? "success"
                                : r.status === "failed" || r.status === "error"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          {r.caseTitle}
                          {r.runIndex != null && <span className="text-muted-foreground"> · run {r.runIndex + 1}</span>}
                          <div className="text-xs text-muted-foreground">{r.frTitle}</div>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.fixtureTitle}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.suiteTitle}</td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                          {r.durationMs != null ? `${r.durationMs} ms` : "—"}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2">
                          {r.errorMessage ? (
                            <button
                              type="button"
                              onClick={() => setErrorRow(r)}
                              title="Click to view the full error"
                              className="max-w-[320px] truncate text-left font-mono text-xs text-red-500 underline-offset-2 hover:underline"
                            >
                              {errorPreview(r.errorMessage)}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right-click context menu */}
      {menu && (
        <div
          className="fixed z-50 w-56 overflow-hidden rounded-md border border-border bg-card py-1 text-sm shadow-lg"
          style={{ top: Math.min(menu.y, window.innerHeight - 200), left: Math.min(menu.x, window.innerWidth - 230) }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.row.errorMessage && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                setErrorRow(menu.row);
                setMenu(null);
              }}
            >
              View error
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
            onClick={() => {
              exportRows("html", menuTargetRows, [
                ...describeFilters(),
                `Selection: ${menuTargetRows.length} result(s)`,
              ]);
              setMenu(null);
            }}
          >
            <FileCode2 className="h-4 w-4" />
            Send {menuIsSelection ? `${menuTargetRows.length} selected` : "this"} to HTML
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
            onClick={() => {
              exportRows("json", menuTargetRows, [
                ...describeFilters(),
                `Selection: ${menuTargetRows.length} result(s)`,
              ]);
              setMenu(null);
            }}
          >
            <FileJson className="h-4 w-4" />
            Send {menuIsSelection ? `${menuTargetRows.length} selected` : "this"} to JSON
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-500 hover:bg-muted"
            onClick={() => {
              deleteIds(
                menuTargetRows.map((r) => r.id),
                menuIsSelection ? "selected result(s)" : "result",
              );
              setMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete {menuIsSelection ? `${menuTargetRows.length} selected` : "this"}
          </button>
        </div>
      )}

      {/* Full error modal */}
      <Dialog open={errorRow != null} onOpenChange={(open) => !open && setErrorRow(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{errorRow?.caseTitle}</DialogTitle>
            <DialogDescription>
              {errorRow ? `${errorRow.fixtureTitle} · ${new Date(errorRow.createdAt).toLocaleString()}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={copyError}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-red-400">
            {errorRow?.errorMessage ?? ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
