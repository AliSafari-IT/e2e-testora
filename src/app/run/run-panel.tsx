"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Loader2, PlayCircle, StopCircle, Terminal } from "lucide-react";
import { useRun } from "@/components/run-provider";
import { cn } from "@/lib/utils";

interface FixtureSummary {
  fixtureId: string;
  title: string;
  caseCount: number;
}

// Colour a TestCafe console line by severity so failures stand out.
function logLineClassName(line: string): string {
  const l = line.trim();
  if (
    l.startsWith("×") || // failed test marker
    /^\d+\)/.test(l) || // error detail, e.g. "1) AssertionError: ..."
    /assertionerror|error[:\s]|exception|unhandled/i.test(l) ||
    /\b\d+\/\d+\s+failed\b/.test(l) || // "1/2 failed"
    /\bfailed\b/i.test(l)
  ) {
    return "text-red-400";
  }
  if (/^warning/i.test(l) || /warnings?\s*\(/i.test(l)) {
    return "text-yellow-300";
  }
  if (l.startsWith("√") || /\bpassed\b/i.test(l)) {
    return "text-emerald-300";
  }
  return "text-green-300/90";
}

export function RunPanel() {
  const searchParams = useSearchParams();
  // Run state lives in RunProvider (mounted in the layout) so it survives
  // navigating to other routes while a run is in progress.
  const { selectedFixtureId, setSelectedFixtureId, running, logs, reports, error, startRun, cancelRun } =
    useRun();
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/fixtures")
      .then((res) => res.json())
      .then((data: FixtureSummary[]) => {
        setFixtures(data);
        if (!selectedFixtureId) {
          setSelectedFixtureId(searchParams.get("fixtureId") ?? data[0]?.fixtureId ?? "");
        }
      });
    // Only needs to run once on mount to populate the dropdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  async function copyLogs() {
    await navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Select a fixture</CardTitle>
          <CardDescription>Choose a fixture to execute with TestCafe.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-border bg-muted px-3 text-sm"
            value={selectedFixtureId}
            onChange={(event) => setSelectedFixtureId(event.target.value)}
            disabled={running}
          >
            {fixtures.length === 0 && <option value="">No fixtures available</option>}
            {fixtures.map((fixture) => (
              <option key={fixture.fixtureId} value={fixture.fixtureId}>
                {fixture.title} ({fixture.caseCount} cases)
              </option>
            ))}
          </select>
          <Button onClick={() => startRun(selectedFixtureId)} disabled={running || !selectedFixtureId}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running..." : "Run fixture"}
          </Button>
          {running && (
            <Button variant="destructive" onClick={() => void cancelRun()}>
              <StopCircle className="h-4 w-4" />
              Cancel
            </Button>
          )}
          {running && (
            <span className="text-xs text-muted-foreground">
              The run keeps streaming if you switch pages.
            </span>
          )}
        </CardContent>
      </Card>

      {(running || logs.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Live console
                </CardTitle>
                <CardDescription>
                  {running ? "TestCafe is running..." : "Output from the last run."}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={copyLogs} disabled={logs.length === 0}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy log"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto rounded-md bg-black/60 p-3 font-mono text-xs leading-relaxed">
              {logs.length === 0 && <p className="text-muted-foreground">Waiting for output...</p>}
              {logs.map((line, index) => (
                <div key={index} className={cn("whitespace-pre-wrap", logLineClassName(line))}>
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {reports && (
        <Card>
          <CardHeader>
            <CardTitle>Run results</CardTitle>
            <CardDescription>{reports.length} case(s) executed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {reports.map((report, index) => (
              <div
                key={`${report.case}-${index}`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-2"
              >
                <span className="text-sm">{report.case}</span>
                <Badge variant={report.status === "passed" ? "success" : "destructive"}>
                  {report.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
