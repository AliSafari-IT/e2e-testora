import { db } from "@/db/client";
import { functionalRequirements, testSuites, testFixtures, testCases, testResults } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { LastResult } from "@/lib/run-status";

/**
 * The most recent stored result per case (one row each), keyed by caseId. The
 * target domain a run executed against is kept in the result `details`, so the
 * Cases/Fixtures/Suites lists can show a domain badge alongside pass/fail.
 */
export async function getLastResultByCase(): Promise<Map<string, LastResult>> {
  const rows = await db
    .selectDistinctOn([testResults.caseId], {
      caseId: testResults.caseId,
      status: testResults.status,
      createdAt: testResults.createdAt,
      details: testResults.details,
    })
    .from(testResults)
    .orderBy(testResults.caseId, desc(testResults.createdAt));

  const map = new Map<string, LastResult>();
  for (const row of rows) {
    const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
    const target = (row.details as Record<string, unknown> | null)?.targetBaseUrl;
    map.set(row.caseId, {
      status: row.status,
      createdAt,
      targetBaseUrl: typeof target === "string" ? target : null,
    });
  }
  return map;
}

export async function getFunctionalRequirements() {
  return db.query.functionalRequirements.findMany({
    orderBy: desc(functionalRequirements.createdAt),
    with: { suites: true },
  });
}

export async function getFunctionalRequirementById(id: string) {
  return db.query.functionalRequirements.findFirst({
    where: eq(functionalRequirements.id, id),
    with: { suites: { orderBy: desc(testSuites.createdAt), with: { fixtures: true } } },
  });
}

export async function getTestSuites() {
  return db.query.testSuites.findMany({
    orderBy: desc(testSuites.createdAt),
    with: { functionalRequirement: true, fixtures: true },
  });
}

export async function getTestSuiteById(suiteId: string) {
  return db.query.testSuites.findFirst({
    where: eq(testSuites.suiteId, suiteId),
    with: {
      functionalRequirement: true,
      fixtures: { orderBy: desc(testFixtures.createdAt), with: { cases: true } },
    },
  });
}

/** Lightweight suite list for the Run page picker, with fixture/case counts. */
export async function getSuiteSummaries() {
  const suites = await db.query.testSuites.findMany({
    orderBy: desc(testSuites.createdAt),
    with: { fixtures: { with: { cases: { columns: { caseId: true } } } } },
  });
  return suites.map((suite) => ({
    suiteId: suite.suiteId,
    title: suite.title,
    fixtureCount: suite.fixtures.length,
    caseCount: suite.fixtures.reduce((total, fixture) => total + fixture.cases.length, 0),
  }));
}

/** Lightweight requirement list for the Run page picker, with suite/fixture/case counts. */
export async function getRequirementSummaries() {
  const requirements = await db.query.functionalRequirements.findMany({
    orderBy: desc(functionalRequirements.createdAt),
    with: { suites: { with: { fixtures: { with: { cases: { columns: { caseId: true } } } } } } },
  });
  return requirements.map((requirement) => {
    const fixtures = requirement.suites.flatMap((suite) => suite.fixtures);
    return {
      id: requirement.id,
      title: requirement.title,
      suiteCount: requirement.suites.length,
      fixtureCount: fixtures.length,
      caseCount: fixtures.reduce((total, fixture) => total + fixture.cases.length, 0),
    };
  });
}

export async function getTestFixtures() {
  return db.query.testFixtures.findMany({
    orderBy: desc(testFixtures.createdAt),
    with: { suite: true, cases: true },
  });
}

export async function getTestFixtureById(fixtureId: string) {
  return db.query.testFixtures.findFirst({
    where: eq(testFixtures.fixtureId, fixtureId),
    with: {
      suite: true,
      cases: { orderBy: desc(testCases.createdAt) },
    },
  });
}

export async function getTestCases() {
  return db.query.testCases.findMany({
    orderBy: desc(testCases.createdAt),
    with: { fixture: true },
  });
}

export async function getTestResults(limit = 50) {
  return db.query.testResults.findMany({
    orderBy: desc(testResults.createdAt),
    limit,
    with: { case: true },
  });
}

export interface ReportResultRow {
  id: string;
  status: string;
  runIndex: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  caseId: string;
  caseTitle: string;
  fixtureId: string;
  fixtureTitle: string;
  suiteId: string;
  suiteTitle: string;
  frId: string;
  frTitle: string;
  // The deployment origin this result ran against (e.g. http://localhost:3233),
  // used to attach a per-domain logo to exported reports.
  targetBaseUrl: string | null;
}

/**
 * Flattened results joined all the way up the hierarchy
 * (result → case → fixture → suite → functional requirement) so the Results
 * page can filter by any level and export a self-contained report.
 */
export async function getResultsForReport(limit = 1000): Promise<ReportResultRow[]> {
  const rows = await db.query.testResults.findMany({
    orderBy: desc(testResults.createdAt),
    limit,
    with: {
      case: {
        with: { fixture: { with: { suite: { with: { functionalRequirement: true } } } } },
      },
    },
  });

  return rows.map((row) => {
    const fixture = row.case?.fixture;
    const suite = fixture?.suite;
    const fr = suite?.functionalRequirement;
    const target = (row.details as Record<string, unknown> | null)?.targetBaseUrl;
    return {
      id: row.id,
      targetBaseUrl: typeof target === "string" ? target : null,
      status: row.status,
      runIndex: row.runIndex,
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      caseId: row.caseId,
      caseTitle: row.case?.title ?? row.caseId,
      fixtureId: fixture?.fixtureId ?? "",
      fixtureTitle: fixture?.title ?? "",
      suiteId: suite?.suiteId ?? "",
      suiteTitle: suite?.title ?? "",
      frId: fr?.id ?? "",
      frTitle: fr?.title ?? "",
    };
  });
}
