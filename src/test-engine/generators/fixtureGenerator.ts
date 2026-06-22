import type { TestFixtureDefinition } from "@/test-engine/types";

export function generateFixtureScript(fixture: TestFixtureDefinition): string {
  const lines: string[] = [];
  lines.push(`fixture\`${fixture.title}\``);
  if (fixture.baseUrl) {
    lines.push(`  .page(\`${fixture.baseUrl}\`)`);
  }
  if (fixture.setupScript) {
    lines.push(`  .beforeEach(async t => {`);
    lines.push(`    ${fixture.setupScript}`);
    lines.push(`  })`);
  }
  if (fixture.teardownScript) {
    lines.push(`  .afterEach(async t => {`);
    lines.push(`    ${fixture.teardownScript}`);
    lines.push(`  })`);
  }
  return `${lines.join("\n")};`;
}
