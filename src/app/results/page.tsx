export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTestResults } from "@/lib/queries";
import { Download } from "lucide-react";

export default async function ResultsPage() {
  const results = await getTestResults(100);

  const payload = results.map((result) => ({
    suite: result.case?.fixtureId ?? "",
    fixture: result.case?.fixtureId ?? "",
    case: result.case?.title ?? result.caseId,
    status: result.status,
    details: { runIndex: result.runIndex, durationMs: result.durationMs, ...result.details },
  }));

  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(payload, null, 2),
  )}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Results</h1>
          <p className="text-muted-foreground">Latest stored test runs from e2e-testing-db.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={downloadHref} download="test-results.json">
            <Download className="h-4 w-4" />
            Download JSON
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>{results.length} result(s)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {results.map((result) => (
            <div key={result.id} className="flex items-center justify-between rounded-md border border-border px-4 py-2">
              <div className="flex flex-col">
                <span className="text-sm">{result.case?.title ?? result.caseId}</span>
                <span className="text-xs text-muted-foreground">
                  {result.durationMs != null ? `${result.durationMs}ms` : "duration unknown"}
                  {result.errorMessage ? ` — ${result.errorMessage}` : ""}
                </span>
              </div>
              <Badge variant={result.status === "passed" ? "success" : "destructive"}>
                {result.status}
              </Badge>
            </div>
          ))}
          {results.length === 0 && <p className="text-muted-foreground">No results recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
