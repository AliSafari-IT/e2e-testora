"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Loader2, PlayCircle, Terminal } from "lucide-react";

interface FixtureSummary {
  fixtureId: string;
  title: string;
  caseCount: number;
}

interface ReportEntry {
  suite: string;
  fixture: string;
  case: string;
  status: string;
  details: Record<string, unknown>;
}

export function RunPanel() {
  const searchParams = useSearchParams();
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(
    searchParams.get("fixtureId") ?? "",
  );
  const [running, setRunning] = useState(false);
  const [reports, setReports] = useState<ReportEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/fixtures")
      .then((res) => res.json())
      .then((data: FixtureSummary[]) => {
        setFixtures(data);
        if (!selectedFixtureId && data[0]) {
          setSelectedFixtureId(data[0].fixtureId);
        }
      });
  }, [selectedFixtureId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  async function copyLogs() {
    await navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function runFixture() {
    if (!selectedFixtureId) return;
    setRunning(true);
    setError(null);
    setReports(null);
    setLogs([]);
    eventSourceRef.current?.close();

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: selectedFixtureId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setRunning(false);
        return;
      }

      const eventSource = new EventSource(`/api/run/stream/${data.runId}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("log", (event) => {
        setLogs((prev) => [...prev, JSON.parse(event.data)]);
      });
      eventSource.addEventListener("done", (event) => {
        setReports(JSON.parse(event.data));
        setRunning(false);
        eventSource.close();
      });
      eventSource.addEventListener("error", (event) => {
        const messageEvent = event as MessageEvent<string>;
        setError(messageEvent.data ? JSON.parse(messageEvent.data) : "Run failed");
        setRunning(false);
        eventSource.close();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
      setRunning(false);
    }
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
          >
            {fixtures.length === 0 && <option value="">No fixtures available</option>}
            {fixtures.map((fixture) => (
              <option key={fixture.fixtureId} value={fixture.fixtureId}>
                {fixture.title} ({fixture.caseCount} cases)
              </option>
            ))}
          </select>
          <Button onClick={runFixture} disabled={running || !selectedFixtureId}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running..." : "Run fixture"}
          </Button>
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
            <div className="max-h-80 overflow-y-auto rounded-md bg-black/60 p-3 font-mono text-xs leading-relaxed text-green-300">
              {logs.length === 0 && <p className="text-muted-foreground">Waiting for output...</p>}
              {logs.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap">
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
