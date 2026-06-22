import type { TestCaseDefinition, TestFixtureDefinition } from "@/test-engine/types";
import { generateFixtureScript } from "./fixtureGenerator";

function mergeInput(
  commonInput: Record<string, unknown>,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...commonInput, ...(override ?? {}) };
}

/**
 * Emits a TestCafe spec for one fixture and its test cases. Each generated
 * test delegates to runScenario(t, data, expected) from the scenario runner,
 * which is the pluggable boundary between generic platform code and a
 * specific app's selectors/assertions.
 */
export function generateTestSpec(
  fixture: TestFixtureDefinition,
  cases: TestCaseDefinition[],
): string {
  const header = [
    `import { runScenario } from "@/test-engine/executors/scenarioRunner";`,
    ``,
    generateFixtureScript(fixture),
    ``,
  ].join("\n");

  const body = cases
    .map((testCase) => generateCaseBlock(fixture, testCase))
    .join("\n\n");

  return `${header}\n${body}\n`;
}

function generateCaseBlock(fixture: TestFixtureDefinition, testCase: TestCaseDefinition): string {
  if (testCase.scriptType === "single") {
    const data = mergeInput(fixture.commonInput, testCase.input);
    return [
      `test(${JSON.stringify(testCase.title)}, async t => {`,
      `  await runScenario(t, ${JSON.stringify(data)}, ${JSON.stringify(testCase.expected)});`,
      `});`,
    ].join("\n");
  }

  const runs = (testCase.runs ?? []).map((run) => mergeInput(fixture.commonInput, run));
  return [
    `const runs_${safeIdent(testCase.caseId)} = ${JSON.stringify(runs)};`,
    `for (const [i, run] of runs_${safeIdent(testCase.caseId)}.entries()) {`,
    `  test(\`${testCase.title} (run \${i + 1})\`, async t => {`,
    `    await runScenario(t, run, ${JSON.stringify(testCase.expected)});`,
    `  });`,
    `}`,
  ].join("\n");
}

function safeIdent(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}
