export const dynamic = "force-dynamic";

import { getResultsForReport } from "@/lib/queries";
import { getActiveProjectId } from "@/lib/active-project";
import { ResultsExplorer } from "@/components/results/results-explorer";

export default async function ResultsPage() {
  const rows = await getResultsForReport(1000, await getActiveProjectId());
  return <ResultsExplorer rows={rows} />;
}
