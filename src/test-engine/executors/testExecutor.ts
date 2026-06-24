import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import createTestCafe from "testcafe";
import { db } from "@/db/client";
import { functionalRequirements, testCases, testFixtures, testResults, testSuites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTestSpec } from "@/test-engine/generators/testGenerator";
import { resolveFixtureBaseUrl } from "@/test-engine/resolveFixtureBaseUrl";
import type { TestCaseDefinition, TestFixtureDefinition, TestRunResult } from "@/test-engine/types";

export interface ExecuteFixtureOptions {
  browser?: string;
  headless?: boolean;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export async function executeFixture(
  fixture: TestFixtureDefinition,
  cases: TestCaseDefinition[],
  options: ExecuteFixtureOptions = {},
): Promise<TestRunResult[]> {
  const spec = generateTestSpec(fixture, cases);
  const dir = await mkdtemp(path.join(tmpdir(), "e2e-testora-"));
  const specPath = path.join(dir, `${fixture.fixtureId}.spec.js`);
  await writeFile(specPath, spec, "utf8");

  const testcafe = await createTestCafe();
  const results: TestRunResult[] = [];

  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      if (options.onLog) {
        const text = chunk.toString("utf8").replace(ANSI_PATTERN, "");
        for (const line of text.split("\n")) {
          if (line.trim().length > 0) options.onLog(line);
        }
      }
      callback();
    },
  });

  let abortHandler: (() => void) | undefined;
  try {
    const runner = testcafe.createRunner();
    abortHandler = () => { Promise.resolve(runner.stop()).catch(() => { /* suppress WebSocket close noise on cancel */ }); };
    options.signal?.addEventListener("abort", abortHandler);
    const browser = options.browser ?? (options.headless === false ? "chrome" : "chrome:headless");
    const startedAt = Date.now();
    // Capture per-test outcomes (name, duration, formatted errors) alongside the
    // human-readable spec stream, so stored results carry the *same* error text
    // shown in the live console — not just a fixture-level pass/fail.
    const captured: CapturedTest[] = [];
    // TestCafe accepts a reporter-plugin *factory* as a reporter `name` at
    // runtime, but its typings only permit built-in string names — hence the
    // cast. The "spec" reporter still streams to the live console.
    const reporters = [
      { name: "spec", output: logStream },
      { name: createCaptureReporter(captured) },
    ] as unknown as string;
    let failedCount: number;
    try {
      failedCount = await runner
        .src(specPath)
        .browsers(browser)
        .reporter(reporters)
        .run({
          // Local dev environments (Next.js JIT-compiling routes on first
          // request) can be much slower than production — give navigation
          // and in-page AJAX calls a generous ceiling on top of any explicit
          // per-selector timeouts in the test scripts themselves.
          pageLoadTimeout: 60000,
          ajaxRequestTimeout: 60000,
        });
    } catch (runErr) {
      // When the run is cancelled via runner.stop(), TestCafe / chrome-remote-interface
      // throws a "WebSocket connection closed" error. Swallow it silently if the
      // signal was aborted; otherwise re-throw so the caller sees a real failure.
      if (options.signal?.aborted) return results;
      throw runErr;
    }

    if (captured.length > 0) {
      // One result row per executed test (per run), mapped back to its case.
      const titleToCaseId = new Map(cases.map((testCase) => [testCase.title, testCase.caseId]));
      for (const test of captured) {
        const { title, runIndex } = parseTestName(test.name);
        const caseId = titleToCaseId.get(title) ?? title;
        const errorMessage = test.errs.length > 0 ? test.errs.join("\n\n").slice(0, 8000) : null;
        results.push(
          buildResult(caseId, test.failed ? "failed" : "passed", runIndex, test.durationMs, {}, errorMessage),
        );
      }
    } else {
      // Nothing captured (e.g. a compile/startup error before any test ran) —
      // still record the fixture-level outcome so the run is visible.
      const status = failedCount === 0 ? "passed" : "failed";
      const elapsed = Date.now() - startedAt;
      for (const testCase of cases) {
        results.push(buildResult(testCase.caseId, status, null, elapsed, {}, null));
      }
    }
  } finally {
    if (abortHandler) options.signal?.removeEventListener("abort", abortHandler);
    await testcafe.close();
    await rm(dir, { recursive: true, force: true });
  }

  await persistResults(results);
  return results;
}

function buildResult(
  caseId: string,
  status: TestRunResult["status"],
  runIndex: number | null,
  durationMs: number,
  details: Record<string, unknown>,
  errorMessage: string | null,
): TestRunResult {
  return {
    id: randomUUID(),
    caseId,
    status,
    runIndex,
    durationMs,
    details,
    errorMessage,
    createdAt: new Date().toISOString(),
  };
}

interface CapturedTest {
  name: string;
  errs: string[];
  durationMs: number;
  failed: boolean;
}

// Minimal view of the TestCafe ReporterPluginHost that our methods run on.
interface ReporterHost {
  formatError(err: unknown, prefix?: string): string;
}

/**
 * A custom TestCafe reporter that records each test's name, duration and
 * formatted errors into `collector`. TestCafe merges these methods onto a host
 * that provides `formatError()` (the very formatter the built-in reporters use
 * for their error blocks), so the captured text matches the live console.
 */
function createCaptureReporter(collector: CapturedTest[]) {
  return function reporterPluginFactory() {
    return {
      reportTaskStart() {},
      reportFixtureStart() {},
      reportTestDone(name: string, testRunInfo: { errs?: unknown[]; durationMs?: number }) {
        const host = this as unknown as ReporterHost;
        const rawErrs = Array.isArray(testRunInfo.errs) ? testRunInfo.errs : [];
        const errs = rawErrs.map((err) => host.formatError(err).replace(ANSI_PATTERN, "").trimEnd());
        collector.push({
          name,
          errs,
          durationMs: testRunInfo.durationMs ?? 0,
          failed: rawErrs.length > 0,
        });
      },
      reportTaskDone() {},
    };
  };
}

/** "Some title (run 2)" → { title: "Some title", runIndex: 1 }. */
function parseTestName(name: string): { title: string; runIndex: number | null } {
  const match = /^(.*?)\s+\(run (\d+)\)$/.exec(name);
  if (match) return { title: match[1] ?? name, runIndex: Number(match[2]) - 1 };
  return { title: name, runIndex: null };
}

async function persistResults(results: TestRunResult[]): Promise<void> {
  if (results.length === 0) return;
  await db.insert(testResults).values(
    results.map((result) => ({
      id: result.id,
      caseId: result.caseId,
      status: result.status,
      runIndex: result.runIndex,
      durationMs: result.durationMs,
      details: result.details,
      errorMessage: result.errorMessage,
    })),
  );
}

export async function loadFixtureWithCases(
  fixtureId: string,
): Promise<{ fixture: TestFixtureDefinition; cases: TestCaseDefinition[] } | null> {
  const fixtureRow = await db.query.testFixtures.findFirst({
    where: eq(testFixtures.fixtureId, fixtureId),
    with: { suite: { with: { functionalRequirement: true } } },
  });
  if (!fixtureRow) return null;

  const caseRows = await db.query.testCases.findMany({
    where: eq(testCases.fixtureId, fixtureId),
  });

  const fixture = mapFixtureRow(fixtureRow, fixtureRow.suite?.functionalRequirement?.baseUrl);
  const cases = caseRows.map(mapCaseRow);

  return { fixture, cases };
}

// A single fixture-worth of work, annotated with its suite title so the
// aggregated report can attribute each case to the right suite.
export interface RunUnit {
  suiteTitle: string;
  fixture: TestFixtureDefinition;
  cases: TestCaseDefinition[];
}

export interface RunPlan {
  label: string;
  units: RunUnit[];
}

type FixtureRow = typeof testFixtures.$inferSelect;
type CaseRow = typeof testCases.$inferSelect;

function mapFixtureRow(row: FixtureRow, frBaseUrl: string | null | undefined): TestFixtureDefinition {
  return {
    fixtureId: row.fixtureId,
    suiteId: row.suiteId,
    title: row.title,
    baseUrl: resolveFixtureBaseUrl(frBaseUrl, row.baseUrl),
    commonInput: row.commonInput ?? {},
    setupScript: row.setupScript ?? undefined,
    teardownScript: row.teardownScript ?? undefined,
  };
}

function mapCaseRow(row: CaseRow): TestCaseDefinition {
  return {
    caseId: row.caseId,
    fixtureId: row.fixtureId,
    title: row.title,
    scriptType: row.scriptType,
    input: row.input ?? undefined,
    runs: row.runs ?? undefined,
    expected: row.expected ?? {},
    script: row.script ?? undefined,
  };
}

/** Build a one-fixture run plan. */
export async function loadFixtureRunPlan(fixtureId: string): Promise<RunPlan | null> {
  const fixtureRow = await db.query.testFixtures.findFirst({
    where: eq(testFixtures.fixtureId, fixtureId),
    with: { suite: { with: { functionalRequirement: true } }, cases: true },
  });
  if (!fixtureRow) return null;

  return {
    label: `fixture "${fixtureRow.title}"`,
    units: [
      {
        suiteTitle: fixtureRow.suite?.title ?? fixtureRow.suiteId,
        fixture: mapFixtureRow(fixtureRow, fixtureRow.suite?.functionalRequirement?.baseUrl),
        cases: fixtureRow.cases.map(mapCaseRow),
      },
    ],
  };
}

/** Build a run plan covering every fixture in a suite. */
export async function loadSuiteRunPlan(suiteId: string): Promise<RunPlan | null> {
  const suiteRow = await db.query.testSuites.findFirst({
    where: eq(testSuites.suiteId, suiteId),
    with: { functionalRequirement: true, fixtures: { with: { cases: true } } },
  });
  if (!suiteRow) return null;

  const frBaseUrl = suiteRow.functionalRequirement?.baseUrl;
  return {
    label: `suite "${suiteRow.title}"`,
    units: suiteRow.fixtures.map((fixtureRow) => ({
      suiteTitle: suiteRow.title,
      fixture: mapFixtureRow(fixtureRow, frBaseUrl),
      cases: fixtureRow.cases.map(mapCaseRow),
    })),
  };
}

/** Build a run plan covering every fixture across every suite of a requirement. */
export async function loadRequirementRunPlan(frId: string): Promise<RunPlan | null> {
  const frRow = await db.query.functionalRequirements.findFirst({
    where: eq(functionalRequirements.id, frId),
    with: { suites: { with: { fixtures: { with: { cases: true } } } } },
  });
  if (!frRow) return null;

  const units: RunUnit[] = [];
  for (const suiteRow of frRow.suites) {
    for (const fixtureRow of suiteRow.fixtures) {
      units.push({
        suiteTitle: suiteRow.title,
        fixture: mapFixtureRow(fixtureRow, frRow.baseUrl),
        cases: fixtureRow.cases.map(mapCaseRow),
      });
    }
  }

  return { label: `requirement "${frRow.title}"`, units };
}
