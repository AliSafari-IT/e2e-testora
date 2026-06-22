export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTestCases } from "@/lib/queries";

export default async function CasesPage() {
  const cases = await getTestCases();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Cases</h1>
        <p className="text-muted-foreground">Single-run and multi-run scenarios driven by JSON test data.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cases.map((testCase) => (
          <Card key={testCase.caseId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{testCase.title}</CardTitle>
                <Badge variant={testCase.scriptType === "multi" ? "default" : "outline"}>
                  {testCase.scriptType}
                </Badge>
              </div>
              <CardDescription>Fixture: {testCase.fixture?.title ?? testCase.fixtureId}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(
                  testCase.scriptType === "multi" ? testCase.runs : testCase.input,
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        ))}
        {cases.length === 0 && <p className="text-muted-foreground">No test cases yet.</p>}
      </div>
    </div>
  );
}
