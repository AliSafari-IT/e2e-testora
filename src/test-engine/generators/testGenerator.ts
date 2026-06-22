import { fileURLToPath } from "node:url";
import path from "node:path";
import type { TestCaseDefinition, TestFixtureDefinition } from "@/test-engine/types";
import { generateFixtureScript } from "./fixtureGenerator";

// Generated specs run as standalone files via TestCafe's own compiler, which
// has no knowledge of the "@/*" tsconfig path alias, so the scenario runner
// must be imported by absolute filesystem path instead.
const scenarioRunnerPath = path
  .resolve(path.dirname(fileURLToPath(import.meta.url)), "../executors/scenarioRunner.js")
  .replace(/\\/g, "/");

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
    `import { Selector } from "testcafe";`,
    `import { runScenario } from ${JSON.stringify(scenarioRunnerPath)};`,
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
  if (testCase.scriptType === "scripted") {
    if (testCase.runs && testCase.runs.length > 0) {
      // Scripted + runs: loop over runs, exposing each as `run` in scope so
      // the script body can parameterize itself (e.g. run.url) instead of
      // hardcoding a single value.
      const runs = testCase.runs.map((run) => mergeInput(fixture.commonInput, run));
      return [
        `const runs_${safeIdent(testCase.caseId)} = ${JSON.stringify(runs)};`,
        `for (const [i, run] of runs_${safeIdent(testCase.caseId)}.entries()) {`,
        `  test(\`${testCase.title} (run \${i + 1})\`, async t => {`,
        indent(testCase.script ?? "", "    "),
        `  });`,
        `}`,
      ].join("\n");
    }
    return [`test(${JSON.stringify(testCase.title)}, async t => {`, testCase.script ?? "", `});`].join(
      "\n",
    );
  }

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

function indent(code: string, prefix: string): string {
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : line))
    .join("\n");
}
