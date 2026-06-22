import { NextResponse } from "next/server";
import { getTestFixtures } from "@/lib/queries";

export async function GET() {
  const fixtures = await getTestFixtures();
  return NextResponse.json(
    fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      title: fixture.title,
      caseCount: fixture.cases.length,
    })),
  );
}
