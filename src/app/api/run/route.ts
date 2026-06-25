import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  executeFixture,
  loadFixtureRunPlan,
  loadSuiteRunPlan,
  loadRequirementRunPlan,
  loadSelectionRunPlan,
  type RunPlan,
} from "@/test-engine/executors/testExecutor";
import { toJsonReport } from "@/test-engine/formatters/resultFormatter";
import { createRun, appendLog, completeRun, failRun, getRun, hasActiveRun } from "@/test-engine/executors/runLog";
import type { FormattedReport } from "@/test-engine/types";

// A run can be scoped to a single fixture, a whole suite, a whole functional
// requirement (every fixture beneath it), or an explicit set of cases (the
// basis for "rerun failed"). Exactly one shape is given.
const requestSchema = z.union([
  z.object({ fixtureId: z.string().min(1) }),
  z.object({ suiteId: z.string().min(1) }),
  z.object({ frId: z.string().min(1) }),
  z.object({
    cases: z
      .array(z.object({ fixtureId: z.string().min(1), caseId: z.string().min(1) }))
      .min(1),
  }),
]);

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Only one TestCafe run at a time — concurrent browser launches in this
  // single process cause "Cannot establish browser connection" failures.
  if (hasActiveRun()) {
    return NextResponse.json(
      { error: "A test run is already in progress. Wait for it to finish or cancel it first." },
      { status: 409 },
    );
  }

  const data = parsed.data;
  const plan =
    "fixtureId" in data
      ? await loadFixtureRunPlan(data.fixtureId)
      : "suiteId" in data
        ? await loadSuiteRunPlan(data.suiteId)
        : "frId" in data
          ? await loadRequirementRunPlan(data.frId)
          : await loadSelectionRunPlan(data.cases);

  if (!plan) {
    return NextResponse.json({ error: "Run target not found" }, { status: 404 });
  }

  const runnableUnits = plan.units.filter((unit) => unit.cases.length > 0);
  if (runnableUnits.length === 0) {
    return NextResponse.json({ error: "No test cases to run for this selection" }, { status: 400 });
  }

  const runId = randomUUID();
  createRun(runId);

  void runInBackground(runId, { ...plan, units: runnableUnits });

  return NextResponse.json({ runId }, { status: 202 });
}

async function runInBackground(runId: string, plan: RunPlan): Promise<void> {
  try {
    const totalCases = plan.units.reduce((total, unit) => total + unit.cases.length, 0);
    appendLog(
      runId,
      `Starting run for ${plan.label} — ${plan.units.length} fixture(s), ${totalCases} case(s)...`,
    );

    const run = getRun(runId);
    const signal = run?.abortController.signal;
    const reports: FormattedReport[] = [];

    for (const unit of plan.units) {
      if (signal?.aborted) break;
      if (plan.units.length > 1) {
        appendLog(runId, `── Fixture: ${unit.fixture.title} (${unit.cases.length} case(s)) ──`);
      }
      try {
        reports.push(...(await runUnitWithRetry(runId, unit, signal)));
      } catch (error) {
        if (signal?.aborted) break;
        // A fixture that can't even start its browser shouldn't sink the whole
        // run — record its cases as errored and carry on to the next fixture.
        const message = error instanceof Error ? error.message : "Fixture failed to run";
        appendLog(runId, `✖ Fixture "${unit.fixture.title}" could not run: ${message}`);
        reports.push(...errorReports(unit, message));
      }
    }

    appendLog(runId, `Run complete: ${reports.length} case(s) executed.`);
    completeRun(runId, reports);
  } catch (error) {
    const run = getRun(runId);
    if (!run?.done) {
      failRun(runId, error instanceof Error ? error.message : "Run failed");
    }
  }
}

// Browser launch is the flaky step (esp. when many fixtures run in sequence in
// the dev server). Retry once on a connection/launch failure with a short pause.
async function runUnitWithRetry(
  runId: string,
  unit: RunPlan["units"][number],
  signal: AbortSignal | undefined,
): Promise<FormattedReport[]> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const results = await executeFixture(unit.fixture, unit.cases, {
        onLog: (line) => appendLog(runId, line),
        signal,
      });
      return toJsonReport(unit.suiteTitle, unit.fixture, unit.cases, results);
    } catch (error) {
      if (signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const launchFailed = /establish.*browser connection|browser connection|unable to establish|browser disconnected/i.test(
        message,
      );
      if (launchFailed && attempt < maxAttempts) {
        appendLog(
          runId,
          `Browser did not start for "${unit.fixture.title}" (attempt ${attempt}/${maxAttempts}). Retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 4000));
        continue;
      }
      throw error;
    }
  }
  return [];
}

// Synthesize error reports for a fixture whose browser never started, so the
// failure is visible in the results (and rerunnable via "rerun failed").
function errorReports(unit: RunPlan["units"][number], message: string): FormattedReport[] {
  return unit.cases.map((testCase) => ({
    suite: unit.suiteTitle,
    fixture: unit.fixture.title,
    fixtureId: unit.fixture.fixtureId,
    caseId: testCase.caseId,
    case: testCase.title,
    status: "error" as const,
    details: { errorMessage: message },
  }));
}
