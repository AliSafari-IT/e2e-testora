export const dynamic = "force-dynamic";

import { getResultsForReport } from "@/lib/queries";
import { ResultsExplorer } from "@/components/results/results-explorer";

export default async function ResultsPage() {
  const rows = await getResultsForReport(1000);
  return <ResultsExplorer rows={rows} />;
}
