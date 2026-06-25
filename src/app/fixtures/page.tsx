export const dynamic = "force-dynamic";

import { FixtureCard } from "@/components/entities/fixture-card";
import { CollapsibleFixtureForm } from "@/components/forms/collapsible-fixture-form";
import { getTestFixtures, getTestSuites } from "@/lib/queries";

export default async function FixturesPage() {
  const [fixtures, suites] = await Promise.all([getTestFixtures(), getTestSuites()]);
  const suiteOptions = suites.map((suite) => ({ suiteId: suite.suiteId, title: suite.title }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Fixtures</h1>
        <p className="text-muted-foreground">Reusable environment setups shared by test cases.</p>
      </div>

      <CollapsibleFixtureForm suiteOptions={suiteOptions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {fixtures.map((fixture) => (
          <FixtureCard
            key={fixture.fixtureId}
            fixture={{
              fixtureId: fixture.fixtureId,
              suiteId: fixture.suiteId,
              title: fixture.title,
              baseUrl: fixture.baseUrl,
              commonInput: fixture.commonInput ?? {},
              caseCount: fixture.cases.length,
            }}
            suiteTitle={fixture.suite?.title}
            suiteOptions={suiteOptions}
          />
        ))}
        {fixtures.length === 0 && <p className="text-muted-foreground">No test fixtures yet.</p>}
      </div>
    </div>
  );
}
