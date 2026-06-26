export const dynamic = "force-dynamic";

import { CollapsibleRequirementForm } from "@/components/forms/collapsible-requirement-form";
import { RequirementCard } from "@/components/entities/requirement-card";
import { getFunctionalRequirements } from "@/lib/queries";
import { getActiveProjectId } from "@/lib/active-project";

export default async function RequirementsPage() {
  const requirements = await getFunctionalRequirements(await getActiveProjectId());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Functional Requirements</h1>
        <p className="text-muted-foreground">High-level domains covered by your test suites.</p>
      </div>

      <CollapsibleRequirementForm />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {requirements.map((fr) => (
          <RequirementCard
            key={fr.id}
            fr={{ id: fr.id, title: fr.title, description: fr.description, suiteCount: fr.suites.length, baseUrl: fr.baseUrl }}
          />
        ))}
        {requirements.length === 0 && (
          <p className="text-muted-foreground">
            No functional requirements yet. Create one above, or run <code>pnpm db:seed</code> to
            load the example Authentication pack.
          </p>
        )}
      </div>
    </div>
  );
}
