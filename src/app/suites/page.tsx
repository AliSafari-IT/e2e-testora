export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTestSuites } from "@/lib/queries";

export default async function SuitesPage() {
  const suites = await getTestSuites();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Suites</h1>
        <p className="text-muted-foreground">Groupings of related flows under each requirement.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {suites.map((suite) => (
          <Card key={suite.suiteId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{suite.title}</CardTitle>
                <Badge variant="outline">{suite.fixtures.length} fixture(s)</Badge>
              </div>
              <CardDescription>{suite.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>FR: {suite.functionalRequirement?.title ?? suite.frId}</span>
              <span>&middot;</span>
              <code>{suite.suiteId}</code>
            </CardContent>
          </Card>
        ))}
        {suites.length === 0 && (
          <p className="text-muted-foreground">No test suites yet.</p>
        )}
      </div>
    </div>
  );
}
