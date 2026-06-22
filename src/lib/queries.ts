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
