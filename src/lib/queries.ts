import { db } from "@/db/client";
import { functionalRequirements, testSuites, testFixtures, testCases, testResults } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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
    return {
      id: row.id,
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
