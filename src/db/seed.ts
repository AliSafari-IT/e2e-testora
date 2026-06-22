import { db } from "@/db/client";
import { functionalRequirements, testSuites, testFixtures, testCases } from "@/db/schema";
import {
  authenticationFR,
  loginFlowSuite,
  loginWithEmailFixture,
  loginTestCases,
} from "@/data/authentication";

async function main() {
  await db
    .insert(functionalRequirements)
    .values(authenticationFR)
    .onConflictDoUpdate({ target: functionalRequirements.id, set: authenticationFR });

  await db
    .insert(testSuites)
    .values(loginFlowSuite)
    .onConflictDoUpdate({ target: testSuites.suiteId, set: loginFlowSuite });

  await db
    .insert(testFixtures)
    .values(loginWithEmailFixture)
    .onConflictDoUpdate({ target: testFixtures.fixtureId, set: loginWithEmailFixture });

  for (const testCase of loginTestCases) {
    await db
      .insert(testCases)
      .values(testCase)
      .onConflictDoUpdate({ target: testCases.caseId, set: testCase });
  }

  console.log("Seeded Authentication functional requirement, suite, fixture and cases.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
