"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaseForm } from "@/components/forms/case-form";
import { DeleteButton } from "@/components/delete-button";
import { Pencil, X, Copy, Check } from "lucide-react";

type ScriptType = "single" | "multi" | "scripted";

interface CaseCardProps {
  testCase: {
    caseId: string;
    fixtureId: string;
    title: string;
    scriptType: ScriptType;
    input?: Record<string, unknown> | null;
    runs?: Record<string, unknown>[] | null;
    expected?: Record<string, unknown> | null;
    script?: string | null;
  };
  fixtureTitle?: string;
  fixtureOptions: { fixtureId: string; title: string }[];
}

export function CaseCard({ testCase, fixtureTitle, fixtureOptions }: CaseCardProps) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const scriptText =
    testCase.scriptType === "scripted"
      ? testCase.script ?? ""
      : JSON.stringify(testCase.scriptType === "multi" ? testCase.runs : testCase.input, null, 2);

  async function handleCopy() {
    await navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <CaseForm mode="edit" initial={testCase} fixtureOptions={fixtureOptions} onSuccess={() => setEditing(false)} />
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{testCase.title}</CardTitle>
          <Badge variant={testCase.scriptType === "single" ? "outline" : "default"}>{testCase.scriptType}</Badge>
        </div>
        <CardDescription>
          {testCase.caseId}
          {fixtureTitle ? ` · ${fixtureTitle}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" className="h-7 px-2" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{scriptText}</pre>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <DeleteButton url={`/api/cases/${testCase.caseId}`} confirmText={`Delete case "${testCase.title}"?`} />
        </div>
      </CardContent>
    </Card>
  );
}
