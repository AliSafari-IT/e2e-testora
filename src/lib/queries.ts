import { db } from "@/db/client";
import { functionalRequirements, testSuites, testFixtures, testCases, testResults } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getFunctionalRequirements() {
  return db.query.functionalRequirements.findMany({
    orderBy: desc(functionalRequirements.createdAt),
    with: { suites: true },
  });
}

export async function getTestSuites() {
  return db.query.testSuites.findMany({
    orderBy: desc(testSuites.createdAt),
    with: { functionalRequirement: true, fixtures: true },
  });
}

export async function getTestFixtures() {
  return db.query.testFixtures.findMany({
    orderBy: desc(testFixtures.createdAt),
    with: { suite: true, cases: true },
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
