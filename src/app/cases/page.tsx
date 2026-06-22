export const dynamic = "force-dynamic";

import { CaseCard } from "@/components/entities/case-card";
import { getTestCases, getTestFixtures } from "@/lib/queries";

export default async function CasesPage() {
  const [cases, fixtures] = await Promise.all([getTestCases(), getTestFixtures()]);
  const fixtureOptions = fixtures.map((fixture) => ({ fixtureId: fixture.fixtureId, title: fixture.title }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Cases</h1>
        <p className="text-muted-foreground">Single-run, multi-run and scripted scenarios driven by test data.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cases.map((testCase) => (
          <CaseCard
            key={testCase.caseId}
            testCase={{
              caseId: testCase.caseId,
              fixtureId: testCase.fixtureId,
              title: testCase.title,
              scriptType: testCase.scriptType,
              input: testCase.input,
              runs: testCase.runs,
              expected: testCase.expected,
              script: testCase.script,
            }}
            fixtureTitle={testCase.fixture?.title}
            fixtureOptions={fixtureOptions}
          />
        ))}
        {cases.length === 0 && <p className="text-muted-foreground">No test cases yet.</p>}
      </div>
    </div>
  );
}
