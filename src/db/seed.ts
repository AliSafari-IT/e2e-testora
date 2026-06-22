import { db } from "@/db/client";
import { functionalRequirements, testSuites, testFixtures, testCases } from "@/db/schema";
import type {
  FunctionalRequirementDefinition,
  TestSuiteDefinition,
  TestFixtureDefinition,
  TestCaseDefinition,
} from "@/test-engine/types";
import {
  authenticationFR,
  loginFlowSuite,
  loginWithEmailFixture,
  loginTestCases,
} from "@/data/authentication";
import {
  videoGenerationFR,
  createVideoFromUrlSuite,
  listingsWizardFixture,
  videoGenerationTestCases,
} from "@/data/video-generation";
import {
  listingScrapingFR,
  scraperSitesSuite,
  scraperRoutingFixture,
  scraperLiveFixture,
  scraperTestCases,
} from "@/data/scraper";
import {
  registrationFR,
  registerFlowSuite,
  registerApiFixture,
  registerUiFixture,
  registrationTestCases,
} from "@/data/registration";

interface SeedBundle {
  fr: FunctionalRequirementDefinition;
  suites: TestSuiteDefinition[];
  fixtures: TestFixtureDefinition[];
  cases: TestCaseDefinition[];
}

const bundles: SeedBundle[] = [
  {
    fr: authenticationFR,
    suites: [loginFlowSuite],
    fixtures: [loginWithEmailFixture],
    cases: loginTestCases,
  },
  {
    fr: videoGenerationFR,
    suites: [createVideoFromUrlSuite],
    fixtures: [listingsWizardFixture],
    cases: videoGenerationTestCases,
  },
  {
    fr: listingScrapingFR,
    suites: [scraperSitesSuite],
    fixtures: [scraperRoutingFixture, scraperLiveFixture],
    cases: scraperTestCases,
  },
  {
    fr: registrationFR,
    suites: [registerFlowSuite],
    fixtures: [registerApiFixture, registerUiFixture],
    cases: registrationTestCases,
  },
];

async function main() {
  for (const bundle of bundles) {
    await db
      .insert(functionalRequirements)
      .values(bundle.fr)
      .onConflictDoUpdate({ target: functionalRequirements.id, set: bundle.fr });

    for (const suite of bundle.suites) {
      await db
        .insert(testSuites)
        .values(suite)
        .onConflictDoUpdate({ target: testSuites.suiteId, set: suite });
    }

    for (const fixture of bundle.fixtures) {
      await db
        .insert(testFixtures)
        .values(fixture)
        .onConflictDoUpdate({ target: testFixtures.fixtureId, set: fixture });
    }

    for (const testCase of bundle.cases) {
      await db
        .insert(testCases)
        .values(testCase)
        .onConflictDoUpdate({ target: testCases.caseId, set: testCase });
    }

    console.log(
      `Seeded "${bundle.fr.title}" (${bundle.suites.length} suite(s), ${bundle.fixtures.length} fixture(s), ${bundle.cases.length} case(s)).`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
