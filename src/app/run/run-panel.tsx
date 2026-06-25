"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Check,
  Copy,
  Database,
  Globe,
  Loader2,
  PlayCircle,
  RotateCcw,
  StopCircle,
  Terminal,
} from "lucide-react";
import {
  useRun,
  type RunScope,
  type RunEnvironment,
} from "@/components/run-provider";
import { DomainBrandControl } from "@/components/run/domain-brand-control";
import { hostFromUrl } from "@/lib/domain-logos";
import { cn } from "@/lib/utils";

interface FixtureSummary {
  fixtureId: string;
  title: string;
  caseCount: number;
}

interface SuiteSummary {
  suiteId: string;
  title: string;
  fixtureCount: number;
  caseCount: number;
}

interface RequirementSummary {
  id: string;
  title: string;
  suiteCount: number;
  fixtureCount: number;
  caseCount: number;
}

const SCOPE_TABS: { scope: RunScope; label: string }[] = [
  { scope: "fixture", label: "Fixture" },
  { scope: "suite", label: "Test suite" },
  { scope: "requirement", label: "Functional requirement" },
  { scope: "all", label: "All requirements" },
];

// The "base scope" — which deployment a run targets. Picked once; every run
// (and rerun) follows it without touching any test content. "Default" sends no
// override, so the URLs baked into the seed data (local dev) are used.
interface EnvPreset {
  id: string;
  label: string;
  baseUrl: string;
  apiUrl: string;
}

// Preset URLs come from the environment so no app-specific deployment is baked
// into the tool. The "Remote" preset only appears when its env vars are set.
const LOCAL_BASE =
  process.env.NEXT_PUBLIC_WEBAPP_BASE_URL || "http://localhost:3233";
const LOCAL_API =
  process.env.NEXT_PUBLIC_WEBAPP_API_URL || "http://localhost:3234/api/v1";
const REMOTE_BASE = process.env.NEXT_PUBLIC_WEBAPP_REMOTE_BASE_URL || "";
const REMOTE_API = process.env.NEXT_PUBLIC_WEBAPP_REMOTE_API_URL || "";

const ENV_PRESETS: EnvPreset[] = [
  { id: "default", label: "Default (seed)", baseUrl: "", apiUrl: "" },
  { id: "local", label: "Local", baseUrl: LOCAL_BASE, apiUrl: LOCAL_API },
  ...(REMOTE_BASE
    ? [
        {
          id: "remote",
          label: "Remote",
          baseUrl: REMOTE_BASE,
          apiUrl: REMOTE_API,
        },
      ]
    : []),
  { id: "custom", label: "Custom…", baseUrl: "", apiUrl: "" },
];

function isWebEnv(env: RunEnvironment | null): boolean {
  if (!env?.baseUrl) return false;
  try {
    const host = new URL(env.baseUrl).hostname;
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return true;
  }
}

function environmentLabel(env: RunEnvironment | null): string {
  if (!env || (!env.baseUrl && !env.apiUrl)) return "Default (seed)";
  const preset = ENV_PRESETS.find(
    (p) =>
      p.id !== "default" &&
      p.id !== "custom" &&
      p.baseUrl === (env.baseUrl ?? "") &&
      p.apiUrl === (env.apiUrl ?? ""),
  );
  if (preset) return preset.label;
  try {
    return new URL(env.baseUrl ?? "").host || "Custom";
  } catch {
    return "Custom";
  }
}

/** A small pill showing which deployment a run targeted. */
function EnvBadge({ env }: { env: RunEnvironment | null }) {
  const web = isWebEnv(env);
  return (
    <span
      title={
        env?.baseUrl
          ? `Site ${env.baseUrl}${env.apiUrl ? ` · API ${env.apiUrl}` : ""}`
          : "Seed-data URLs"
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        web
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <Globe className="h-3 w-3" />
      {environmentLabel(env)}
    </span>
  );
}

// Colour a TestCafe console line by severity so failures stand out.
function logLineClassName(line: string): string {
  const l = line.trim();
  if (
    l.startsWith("×") || // failed test marker
    /^\d+\)/.test(l) || // error detail, e.g. "1) AssertionError: ..."
    /assertionerror|error[:\s]|exception|unhandled/i.test(l) ||
    /\b\d+\/\d+\s+failed\b/.test(l) || // "1/2 failed"
    /\bfailed\b/i.test(l)
  ) {
    return "text-red-400";
  }
  if (/^warning/i.test(l) || /warnings?\s*\(/i.test(l)) {
    return "text-yellow-300";
  }
  if (l.startsWith("√") || /\bpassed\b/i.test(l)) {
    return "text-emerald-300";
  }
  return "text-green-300/90";
}

export function RunPanel() {
  const searchParams = useSearchParams();
  // Run state lives in RunProvider (mounted in the layout) so it survives
  // navigating to other routes while a run is in progress.
  const {
    selectedFixtureId,
    setSelectedFixtureId,
    environment,
    setEnvironment,
    runEnvironment,
    running,
    logs,
    reports,
    error,
    runMeta,
    startRun,
    rerunFailed,
    failedCaseCount,
    cancelRun,
  } = useRun();
  const [scope, setScope] = useState<RunScope>("fixture");
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [copied, setCopied] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Re-fetch the three catalog lists (after mount, and after a re-seed) while
  // preserving the current selections.
  const refreshCatalog = useCallback(async () => {
    const [f, s, r] = await Promise.all([
      fetch("/api/fixtures").then(
        (res) => res.json() as Promise<FixtureSummary[]>,
      ),
      fetch("/api/suites").then((res) => res.json() as Promise<SuiteSummary[]>),
      fetch("/api/requirements").then(
        (res) => res.json() as Promise<RequirementSummary[]>,
      ),
    ]);
    setFixtures(f);
    setSuites(s);
    setRequirements(r);
    setSelectedSuiteId((current) => current || s[0]?.suiteId || "");
    setSelectedRequirementId((current) => current || r[0]?.id || "");
    return { f, s, r };
  }, []);

  async function reseed() {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSeedMessage({
          type: "error",
          text: typeof data.error === "string" ? data.error : "Re-seed failed",
        });
        return;
      }
      const { f } = await refreshCatalog();
      if (!selectedFixtureId && f[0]) setSelectedFixtureId(f[0].fixtureId);
      setSeedMessage({
        type: "success",
        text: `Tests updated — ${data.requirements} requirements, ${data.suites} suites, ${data.fixtures} fixtures, ${data.cases} cases.`,
      });
    } catch (err) {
      setSeedMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Re-seed failed",
      });
    } finally {
      setSeeding(false);
    }
  }

  // Which environment preset the dropdown shows. Reconciled with the persisted
  // environment (restored asynchronously by the provider) so a reload reflects
  // the last choice; "custom" when the stored URLs don't match a known preset.
  const [envPresetId, setEnvPresetId] = useState<string>("default");

  useEffect(() => {
    setEnvPresetId((current) => {
      if (current === "custom") return current; // don't disrupt active custom editing
      const match = ENV_PRESETS.find(
        (preset) =>
          preset.id !== "custom" &&
          preset.baseUrl === (environment.baseUrl ?? "") &&
          preset.apiUrl === (environment.apiUrl ?? ""),
      );
      if (match) return match.id;
      return environment.baseUrl || environment.apiUrl ? "custom" : "default";
    });
  }, [environment]);

  function applyPreset(id: string) {
    setEnvPresetId(id);
    const preset = ENV_PRESETS.find((p) => p.id === id);
    if (!preset || id === "custom") return; // custom keeps the current URLs, edited inline
    setEnvironment(
      preset.baseUrl || preset.apiUrl
        ? { baseUrl: preset.baseUrl, apiUrl: preset.apiUrl }
        : {},
    );
  }

  useEffect(() => {
    void refreshCatalog().then(({ f }) => {
      if (!selectedFixtureId) {
        setSelectedFixtureId(
          searchParams.get("fixtureId") ?? f[0]?.fixtureId ?? "",
        );
      }
    });
    // Only needs to run once on mount to populate the dropdowns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The currently selected id and a human label for the active scope, so the
  // single Run button and disabled-state logic don't branch every way. "all"
  // needs no id.
  const selectedId =
    scope === "fixture"
      ? selectedFixtureId
      : scope === "suite"
        ? selectedSuiteId
        : scope === "requirement"
          ? selectedRequirementId
          : "";
  const scopeLabel =
    scope === "fixture"
      ? "fixture"
      : scope === "suite"
        ? "suite"
        : scope === "requirement"
          ? "requirement"
          : "all requirements";
  const canRun = scope === "all" ? true : Boolean(selectedId);
  // Totals shown for the "all" scope.
  const allTotals = requirements.reduce(
    (acc, r) => ({
      fixtures: acc.fixtures + r.fixtureCount,
      cases: acc.cases + r.caseCount,
    }),
    { fixtures: 0, cases: 0 },
  );

  const totalCases = useMemo(() => {
    if (scope === "fixture")
      return (
        fixtures.find((f) => f.fixtureId === selectedFixtureId)?.caseCount ?? 0
      );
    if (scope === "suite")
      return suites.find((s) => s.suiteId === selectedSuiteId)?.caseCount ?? 0;
    if (scope === "requirement")
      return (
        requirements.find((r) => r.id === selectedRequirementId)?.caseCount ?? 0
      );
    return allTotals.cases;
  }, [
    scope,
    selectedFixtureId,
    selectedSuiteId,
    selectedRequirementId,
    fixtures,
    suites,
    requirements,
    allTotals.cases,
  ]);

  const progressTotal = runMeta?.totalRuns ?? totalCases;

  const completedCases = useMemo(() => {
    // TestCafe marks completed tests with a leading √ or ×. A retried fixture can
    // re-print lines, so never report more than the planned total.
    const counted = logs.filter((line) => /^\s*[√×]/.test(line)).length;
    return progressTotal > 0 ? Math.min(counted, progressTotal) : counted;
  }, [logs, progressTotal]);

  const progressPercent =
    progressTotal > 0
      ? Math.min(100, (completedCases / progressTotal) * 100)
      : 0;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  async function copyLogs() {
    await navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Target environment</CardTitle>
          <CardDescription>
            Point the run at a deployment — the same tests run against local or
            remote with no change to their content. APIs use this base; UI
            smokes open it in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="h-9 rounded-md border border-border bg-muted px-3 text-sm"
              value={envPresetId}
              onChange={(event) => applyPreset(event.target.value)}
              disabled={running}
            >
              {ENV_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            {envPresetId !== "custom" && (
              <span className="text-xs text-muted-foreground">
                {environment.baseUrl
                  ? `Site ${environment.baseUrl} · API ${environment.apiUrl}`
                  : "Using the URLs from the seed data."}
              </span>
            )}
          </div>

          {envPresetId === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Site base URL
                <input
                  className="h-9 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
                  placeholder="https://app.example.com"
                  value={environment.baseUrl ?? ""}
                  onChange={(event) =>
                    setEnvironment({
                      ...environment,
                      baseUrl: event.target.value.trim() || undefined,
                    })
                  }
                  disabled={running}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                API base URL
                <input
                  className="h-9 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
                  placeholder="https://api.example.com/api/v1"
                  value={environment.apiUrl ?? ""}
                  onChange={(event) =>
                    setEnvironment({
                      ...environment,
                      apiUrl: event.target.value.trim() || undefined,
                    })
                  }
                  disabled={running}
                />
              </label>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <DomainBrandControl
              host={hostFromUrl(environment.baseUrl) ?? "localhost"}
              disabled={running}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Select what to run</CardTitle>
              <CardDescription>
                Run a single fixture, or a whole suite / functional requirement
                to execute every fixture beneath it with TestCafe.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reseed()}
              disabled={running || seeding}
              title="Re-seed the catalog from the test definitions (adds new tests, updates changed ones)"
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {seeding ? "Updating..." : "Update tests"}
            </Button>
          </div>
          {seedMessage && (
            <p
              className={cn(
                "text-xs",
                seedMessage.type === "error"
                  ? "text-destructive"
                  : "text-emerald-400",
              )}
            >
              {seedMessage.text}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/40 p-1">
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab.scope}
                type="button"
                onClick={() => setScope(tab.scope)}
                disabled={running}
                className={cn(
                  "rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                  scope === tab.scope
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {scope === "fixture" && (
              <select
                className="h-9 rounded-md border border-border bg-muted px-3 text-sm"
                value={selectedFixtureId}
                onChange={(event) => setSelectedFixtureId(event.target.value)}
                disabled={running}
              >
                {fixtures.length === 0 && (
                  <option value="">No fixtures available</option>
                )}
                {fixtures.map((fixture) => (
                  <option key={fixture.fixtureId} value={fixture.fixtureId}>
                    {fixture.title} ({fixture.caseCount} cases)
                  </option>
                ))}
              </select>
            )}

            {scope === "suite" && (
              <select
                className="h-9 rounded-md border border-border bg-muted px-3 text-sm"
                value={selectedSuiteId}
                onChange={(event) => setSelectedSuiteId(event.target.value)}
                disabled={running}
              >
                {suites.length === 0 && (
                  <option value="">No suites available</option>
                )}
                {suites.map((suite) => (
                  <option key={suite.suiteId} value={suite.suiteId}>
                    {suite.title} ({suite.fixtureCount} fixtures,{" "}
                    {suite.caseCount} cases)
                  </option>
                ))}
              </select>
            )}

            {scope === "requirement" && (
              <select
                className="h-9 rounded-md border border-border bg-muted px-3 text-sm"
                value={selectedRequirementId}
                onChange={(event) =>
                  setSelectedRequirementId(event.target.value)
                }
                disabled={running}
              >
                {requirements.length === 0 && (
                  <option value="">No requirements available</option>
                )}
                {requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.title} ({requirement.suiteCount} suites,{" "}
                    {requirement.fixtureCount} fixtures, {requirement.caseCount}{" "}
                    cases)
                  </option>
                ))}
              </select>
            )}

            {scope === "all" && (
              <span className="text-sm text-muted-foreground">
                Runs every functional requirement — {requirements.length}{" "}
                requirement(s), {allTotals.fixtures} fixtures, {allTotals.cases}{" "}
                cases — against the selected target.
              </span>
            )}

            <Button
              onClick={() => startRun({ scope, id: selectedId })}
              disabled={running || !canRun}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {running ? "Running..." : `Run ${scopeLabel}`}
            </Button>
            {running && (
              <Button variant="destructive" onClick={() => void cancelRun()}>
                <StopCircle className="h-4 w-4" />
                Cancel
              </Button>
            )}
            {running && (
              <span className="text-xs text-muted-foreground">
                The run keeps streaming if you switch pages.
              </span>
            )}
          </div>
          {error && running && (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {running && progressTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              Run progress
            </CardTitle>
            <CardDescription>
              {completedCases} of {progressTotal} test runs completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={completedCases}
              max={progressTotal}
              showLabel
              variant="accent"
              size="lg"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Running {runMeta?.label ?? scopeLabel}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {(running || logs.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Live console
                  <EnvBadge env={runEnvironment} />
                </CardTitle>
                <CardDescription>
                  {running
                    ? "TestCafe is running..."
                    : "Output from the last run."}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={copyLogs}
                disabled={logs.length === 0}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy log"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto rounded-md bg-black/60 p-3 font-mono text-xs leading-relaxed">
              {logs.length === 0 && (
                <p className="text-muted-foreground">Waiting for output...</p>
              )}
              {logs.map((line, index) => (
                <div
                  key={index}
                  className={cn("whitespace-pre-wrap", logLineClassName(line))}
                >
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {error && !running && (
        <Card>
          <CardContent className="p-5 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {reports && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Run results
                  <EnvBadge env={runEnvironment} />
                </CardTitle>
                <CardDescription>
                  {reports.length} result(s) ·{" "}
                  {reports.filter((r) => r.status === "passed").length} passed
                  {failedCaseCount > 0 && (
                    <span className="text-destructive">
                      {" "}
                      · {failedCaseCount} failed
                    </span>
                  )}
                </CardDescription>
              </div>
              {failedCaseCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void rerunFailed()}
                  disabled={running}
                >
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Rerun failed ({failedCaseCount})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {reports.map((report, index) => {
              const failed = report.status !== "passed";
              return (
                <div
                  key={`${report.fixtureId}-${report.caseId}-${index}`}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-4 py-2",
                    failed
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border",
                  )}
                >
                  <span className="text-sm">{report.case}</span>
                  <Badge variant={failed ? "destructive" : "success"}>
                    {report.status}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
