import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { executeFixture, loadFixtureWithCases } from "@/test-engine/executors/testExecutor";
import { toJsonReport } from "@/test-engine/formatters/resultFormatter";
import { createRun, appendLog, completeRun, failRun } from "@/test-engine/executors/runLog";
import { db } from "@/db/client";
import { testSuites } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { TestCaseDefinition, TestFixtureDefinition } from "@/test-engine/types";

const requestSchema = z.object({ fixtureId: z.string().min(1) });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const loaded = await loadFixtureWithCases(parsed.data.fixtureId);
  if (!loaded) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  const { fixture, cases } = loaded;
  const runId = randomUUID();
  createRun(runId);

  void runInBackground(runId, fixture, cases);

  return NextResponse.json({ runId }, { status: 202 });
}

async function runInBackground(
  runId: string,
  fixture: TestFixtureDefinition,
  cases: TestCaseDefinition[],
): Promise<void> {
  try {
    appendLog(runId, `Starting run for fixture "${fixture.title}" (${cases.length} case(s))...`);
    const suite = await db.query.testSuites.findFirst({ where: eq(testSuites.suiteId, fixture.suiteId) });

    const results = await executeFixture(fixture, cases, {
      onLog: (line) => appendLog(runId, line),
    });

    const reports = toJsonReport(suite?.title ?? fixture.suiteId, fixture, cases, results);
    appendLog(runId, `Run complete: ${reports.length} case(s) executed.`);
    completeRun(runId, reports);
  } catch (error) {
    failRun(runId, error instanceof Error ? error.message : "Run failed");
  }
}
