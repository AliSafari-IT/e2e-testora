export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTestFixtures } from "@/lib/queries";

export default async function FixturesPage() {
  const fixtures = await getTestFixtures();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Fixtures</h1>
        <p className="text-muted-foreground">Reusable environment setups shared by test cases.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {fixtures.map((fixture) => (
          <Card key={fixture.fixtureId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{fixture.title}</CardTitle>
                <Badge variant="outline">{fixture.cases.length} case(s)</Badge>
              </div>
              <CardDescription>Suite: {fixture.suite?.title ?? fixture.suiteId}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(fixture.commonInput, null, 2)}
              </pre>
              <Button asChild size="sm" variant="outline">
                <Link href={`/run?fixtureId=${fixture.fixtureId}`}>Run this fixture</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {fixtures.length === 0 && <p className="text-muted-foreground">No test fixtures yet.</p>}
      </div>
    </div>
  );
}
