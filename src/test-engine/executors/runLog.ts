import { EventEmitter } from "node:events";

export interface RunRecord {
  emitter: EventEmitter;
  lines: string[];
  done: boolean;
  result?: unknown;
  error?: string;
}

// Each Next.js route handler is compiled into its own bundle, so a plain
// module-level singleton would not actually be shared between /api/run and
// /api/run/stream/[runId]. Anchoring it on globalThis keeps a single Map
// across route bundles within the same Node process.
const globalForRuns = globalThis as unknown as { __e2eTestoraRuns?: Map<string, RunRecord> };
const runs = globalForRuns.__e2eTestoraRuns ?? new Map<string, RunRecord>();
globalForRuns.__e2eTestoraRuns = runs;

export function createRun(runId: string): void {
  runs.set(runId, { emitter: new EventEmitter(), lines: [], done: false });
}

export function appendLog(runId: string, line: string): void {
  const run = runs.get(runId);
  if (!run) return;
  run.lines.push(line);
  run.emitter.emit("log", line);
}

export function completeRun(runId: string, result: unknown): void {
  const run = runs.get(runId);
  if (!run) return;
  run.done = true;
  run.result = result;
  run.emitter.emit("done", result);
}

export function failRun(runId: string, error: string): void {
  const run = runs.get(runId);
  if (!run) return;
  run.done = true;
  run.error = error;
  run.emitter.emit("error", error);
}

export function getRun(runId: string): RunRecord | undefined {
  return runs.get(runId);
}
