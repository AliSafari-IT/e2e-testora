export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFunctionalRequirements } from "@/lib/queries";

export default async function RequirementsPage() {
  const requirements = await getFunctionalRequirements();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Functional Requirements</h1>
        <p className="text-muted-foreground">High-level domains covered by your test suites.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {requirements.map((fr) => (
          <Card key={fr.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{fr.title}</CardTitle>
                <Badge variant="outline">{fr.suites.length} suite(s)</Badge>
              </div>
              <CardDescription>{fr.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-xs text-muted-foreground">{fr.id}</code>
            </CardContent>
          </Card>
        ))}
        {requirements.length === 0 && (
          <p className="text-muted-foreground">
            No functional requirements yet. Run <code>pnpm db:seed</code> to load the example
            Authentication pack.
          </p>
        )}
      </div>
    </div>
  );
}
