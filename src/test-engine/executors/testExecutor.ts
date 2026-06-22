import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import createTestCafe from "testcafe";
import { db } from "@/db/client";
import { testCases, testFixtures, testResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTestSpec } from "@/test-engine/generators/testGenerator";
import type { TestCaseDefinition, TestFixtureDefinition, TestRunResult } from "@/test-engine/types";

export interface ExecuteFixtureOptions {
  browser?: string;
  headless?: boolean;
  onLog?: (line: string) => void;
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

  try {
    const runner = testcafe.createRunner();
    const browser = options.browser ?? (options.headless === false ? "chrome" : "chrome:headless");
    const startedAt = Date.now();
    const failedCount: number = await runner
      .src(specPath)
      .browsers(browser)
      .reporter("spec", logStream)
      .run();

    const status = failedCount === 0 ? "passed" : "failed";
    for (const testCase of cases) {
      results.push(buildResult(testCase, status, null, Date.now() - startedAt, {}, null));
    }
  } finally {
    await testcafe.close();
    await rm(dir, { recursive: true, force: true });
  }

  await persistResults(results);
  return results;
}

function buildResult(
  testCase: TestCaseDefinition,
  status: TestRunResult["status"],
  runIndex: number | null,
  durationMs: number,
  details: Record<string, unknown>,
  errorMessage: string | null,
): TestRunResult {
  return {
    id: randomUUID(),
    caseId: testCase.caseId,
    status,
    runIndex,
    durationMs,
    details,
    errorMessage,
    createdAt: new Date().toISOString(),
  };
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
  });
  if (!fixtureRow) return null;

  const caseRows = await db.query.testCases.findMany({
    where: eq(testCases.fixtureId, fixtureId),
  });

  const fixture: TestFixtureDefinition = {
    fixtureId: fixtureRow.fixtureId,
    suiteId: fixtureRow.suiteId,
    title: fixtureRow.title,
    baseUrl: fixtureRow.baseUrl ?? undefined,
    commonInput: fixtureRow.commonInput ?? {},
    setupScript: fixtureRow.setupScript ?? undefined,
    teardownScript: fixtureRow.teardownScript ?? undefined,
  };

  const cases: TestCaseDefinition[] = caseRows.map((row) => ({
    caseId: row.caseId,
    fixtureId: row.fixtureId,
    title: row.title,
    scriptType: row.scriptType,
    input: row.input ?? undefined,
    runs: row.runs ?? undefined,
    expected: row.expected ?? {},
    script: row.script ?? undefined,
  }));

  return { fixture, cases };
}
