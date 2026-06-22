import { NextResponse } from "next/server";
import { z } from "zod";
import { executeFixture, loadFixtureWithCases } from "@/test-engine/executors/testExecutor";
import { toJsonReport } from "@/test-engine/formatters/resultFormatter";
import { db } from "@/db/client";
import { testSuites } from "@/db/schema";
import { eq } from "drizzle-orm";

const requestSchema = z.object({ fixtureId: z.string().min(1) });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const loaded = await loadFixtureWithCases(parsed.data.fixtureId);
  if (!loaded) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  const { fixture, cases } = loaded;
  const suite = await db.query.testSuites.findFirst({ where: eq(testSuites.suiteId, fixture.suiteId) });

  const results = await executeFixture(fixture, cases);
  const reports = toJsonReport(suite?.title ?? fixture.suiteId, fixture, cases, results);

  return NextResponse.json({ reports });
}
