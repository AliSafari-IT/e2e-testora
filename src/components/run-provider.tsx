"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface ReportEntry {
  suite: string;
  fixture: string;
  fixtureId: string;
  caseId: string;
  case: string;
  status: string;
  details: Record<string, unknown>;
}

// A run can be scoped to a single fixture, a whole suite, a whole functional
// requirement (every fixture beneath it runs in turn), or "all" requirements at
// once. The "all" scope needs no id.
export type RunScope = "fixture" | "suite" | "requirement" | "all";

export interface RunTarget {
  scope: RunScope;
  id: string;
}

// The "base scope" for a run: which deployment the tests target. Empty fields
// fall back to whatever the seed data hardcodes (local dev).
export interface RunEnvironment {
  baseUrl?: string;
  apiUrl?: string;
}

interface RunContextValue {
  selectedFixtureId: string;
  setSelectedFixtureId: (id: string) => void;
  environment: RunEnvironment;
  setEnvironment: (env: RunEnvironment) => void;
  // The environment the currently displayed run was launched with (may differ
  // from `environment` if the user changed the selector after starting).
  runEnvironment: RunEnvironment | null;
  running: boolean;
  logs: string[];
  reports: ReportEntry[] | null;
  error: string | null;
  runId: string | null;
  startRun: (target: RunTarget) => Promise<void>;
  rerunFailed: () => Promise<void>;
  failedCaseCount: number;
  cancelRun: () => Promise<void>;
}

// Maps an id-based run scope to the request-body key the /api/run endpoint
// expects. ("all" is handled separately — it carries no id.)
const SCOPE_BODY_KEY: Record<"fixture" | "suite" | "requirement", "fixtureId" | "suiteId" | "frId"> = {
  fixture: "fixtureId",
  suite: "suiteId",
  requirement: "frId",
};

/**
 * The unique (fixture, case) pairs that did not pass in a result set. Deduped
 * across multi-run cases (one entry per result) so a case is rerun once even if
 * several of its runs failed. Entries missing ids (e.g. an older run) are
 * skipped so they never produce an unrunnable request.
 */
function collectFailedCases(reports: ReportEntry[] | null): { fixtureId: string; caseId: string }[] {
  if (!reports) return [];
  const seen = new Set<string>();
  const out: { fixtureId: string; caseId: string }[] = [];
  for (const report of reports) {
    if (report.status === "passed") continue;
    if (!report.fixtureId || !report.caseId) continue;
    const key = `${report.fixtureId}::${report.caseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fixtureId: report.fixtureId, caseId: report.caseId });
  }
  return out;
}

const RunContext = createContext<RunContextValue | null>(null);

// Persist the active run id so a full page reload can re-attach to the same
// server-side run (the stream replays its full log + final result on connect).
const STORAGE_KEY = "e2e_active_run";
// Persist the chosen target environment across reloads.
const ENV_STORAGE_KEY = "e2e_run_environment";
// Persist the environment a run was launched with, so a resumed run still shows
// the correct target badge after a reload.
const RUN_ENV_STORAGE_KEY = "e2e_active_run_environment";

/**
 * Holds the run state and the live SSE connection. It lives in the root layout,
 * so it survives client-side navigation between routes — start a run on /run,
 * then browse /results or /fixtures while it keeps streaming in the background.
 * The run itself executes server-side regardless; this just keeps the client
 * attached to it instead of tearing the stream down when /run unmounts.
 */
export function RunProvider({ children }: { children: React.ReactNode }) {
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [environment, setEnvironmentState] = useState<RunEnvironment>({});
  const [runEnvironment, setRunEnvironment] = useState<RunEnvironment | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [reports, setReports] = useState<ReportEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  // Guards the generic "connection closed" error that browsers fire right after
  // a normal stream completion, so it isn't mistaken for a stale/unknown run.
  const finishedRef = useRef(false);

  const attach = useCallback((id: string, opts?: { resuming?: boolean }) => {
    esRef.current?.close();
    finishedRef.current = false;
    setRunId(id);
    setRunning(true);
    setLogs([]);
    setReports(null);
    setError(null);

    const es = new EventSource(`/api/run/stream/${id}`);
    esRef.current = es;

    es.addEventListener("log", (event) => {
      setLogs((prev) => [...prev, JSON.parse((event as MessageEvent<string>).data)]);
    });
    es.addEventListener("done", (event) => {
      finishedRef.current = true;
      setReports(JSON.parse((event as MessageEvent<string>).data));
      setRunning(false);
      es.close();
    });
    es.addEventListener("error", (event) => {
      const message = (event as MessageEvent<string>).data;
      if (message) {
        finishedRef.current = true;
        try {
          setError(JSON.parse(message));
        } catch {
          setError("Run failed");
        }
        setRunning(false);
        es.close();
        return;
      }
      // No payload + closed connection that never delivered a result means the
      // run id is unknown to the server (e.g. it restarted). Drop it quietly.
      if (es.readyState === EventSource.CLOSED && !finishedRef.current) {
        setRunning(false);
        es.close();
        if (opts?.resuming) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setRunId(null);
        }
      }
    });
  }, []);

  // On first mount, resume any run recorded before a reload.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored) {
      attach(stored, { resuming: true });
      try {
        const envRaw = localStorage.getItem(RUN_ENV_STORAGE_KEY);
        if (envRaw) setRunEnvironment(JSON.parse(envRaw));
      } catch {
        /* ignore */
      }
    }
    return () => esRef.current?.close();
  }, [attach]);

  // Restore the chosen target environment.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENV_STORAGE_KEY);
      if (raw) setEnvironmentState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const setEnvironment = useCallback((env: RunEnvironment) => {
    setEnvironmentState(env);
    try {
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(env));
    } catch {
      /* ignore */
    }
  }, []);

  const cancelRun = useCallback(async () => {
    if (!runId) return;
    esRef.current?.close();
    try {
      await fetch(`/api/run/${runId}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setRunning(false);
    setError("Run cancelled");
    setRunId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, [runId]);

  // Shared launcher: POST a run request body, then attach to its stream.
  const beginRun = useCallback(
    async (body: Record<string, unknown>) => {
      setRunning(true);
      setError(null);
      setReports(null);
      setLogs([]);
      // Attach the selected base scope so the same run can target local or
      // production without any change to the test content.
      const envUsed: RunEnvironment = { baseUrl: environment.baseUrl, apiUrl: environment.apiUrl };
      setRunEnvironment(envUsed);
      try {
        localStorage.setItem(RUN_ENV_STORAGE_KEY, JSON.stringify(envUsed));
      } catch {
        /* ignore */
      }
      const payload = {
        ...body,
        ...(environment.baseUrl ? { baseUrl: environment.baseUrl } : {}),
        ...(environment.apiUrl ? { apiUrl: environment.apiUrl } : {}),
      };
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
          setRunning(false);
          return;
        }
        try {
          localStorage.setItem(STORAGE_KEY, data.runId);
        } catch {
          /* ignore */
        }
        attach(data.runId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Run failed");
        setRunning(false);
      }
    },
    [attach, environment],
  );

  const startRun = useCallback(
    async (target: RunTarget) => {
      if (target.scope === "all") {
        await beginRun({ all: true });
        return;
      }
      if (!target.id) return;
      await beginRun({ [SCOPE_BODY_KEY[target.scope]]: target.id });
    },
    [beginRun],
  );

  // Re-execute just the cases that didn't pass in the current result set —
  // works for any prior scope, since it re-targets the cases by id.
  const rerunFailed = useCallback(async () => {
    const cases = collectFailedCases(reports);
    if (cases.length === 0) return;
    await beginRun({ cases });
  }, [reports, beginRun]);

  const failedCaseCount = collectFailedCases(reports).length;

  return (
    <RunContext.Provider
      value={{
        selectedFixtureId,
        setSelectedFixtureId,
        environment,
        setEnvironment,
        runEnvironment,
        running,
        logs,
        reports,
        error,
        runId,
        startRun,
        rerunFailed,
        failedCaseCount,
        cancelRun,
      }}
    >
      {children}
    </RunContext.Provider>
  );
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used within a RunProvider");
  return ctx;
}
