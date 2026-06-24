"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CaseForm } from "@/components/forms/case-form";
import { Plus, X } from "lucide-react";
import Link from "next/link";

interface FixtureOption {
  fixtureId: string;
  title: string;
}

interface CollapsibleCaseFormProps {
  fixtureOptions: FixtureOption[];
}

export function CollapsibleCaseForm({ fixtureOptions }: CollapsibleCaseFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {!open && (
        <Button onClick={() => setOpen(true)} className="self-start">
          <Plus className="h-4 w-4" />
          Add a test case
        </Button>
      )}

      {open && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Add a test case</CardTitle>
              <CardDescription>
                Pick a fixture, then add single-run or multi-run JSON test data — or a scripted case
                carrying raw TestCafe code for multi-step flows. No seeding required.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close form">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {fixtureOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                A test case needs a fixture to live under. Create one first on the{" "}
                <Link href="/fixtures" className="text-accent underline-offset-4 hover:underline">
                  Fixtures
                </Link>{" "}
                page (open a suite to add a fixture), then come back here.
              </p>
            ) : (
              <CaseForm fixtureOptions={fixtureOptions} onSuccess={() => setOpen(false)} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
