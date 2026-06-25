export const dynamic = "force-dynamic";

import { SuiteCard } from "@/components/entities/suite-card";
import { CollapsibleSuiteForm } from "@/components/forms/collapsible-suite-form";
import { getTestSuites, getFunctionalRequirements } from "@/lib/queries";

export default async function SuitesPage() {
  const [suites, requirements] = await Promise.all([getTestSuites(), getFunctionalRequirements()]);
  const frOptions = requirements.map((fr) => ({ id: fr.id, title: fr.title }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Suites</h1>
        <p className="text-muted-foreground">Groupings of related flows under each requirement.</p>
      </div>

      <CollapsibleSuiteForm frOptions={frOptions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {suites.map((suite) => (
          <SuiteCard
            key={suite.suiteId}
            suite={{
              suiteId: suite.suiteId,
              frId: suite.frId,
              title: suite.title,
              description: suite.description,
              fixtureCount: suite.fixtures.length,
            }}
            frTitle={suite.functionalRequirement?.title}
            frOptions={frOptions}
          />
        ))}
        {suites.length === 0 && <p className="text-muted-foreground">No test suites yet.</p>}
      </div>
    </div>
  );
}
