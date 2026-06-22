import { z } from "zod";
import type {
  FunctionalRequirementDefinition,
  TestSuiteDefinition,
  TestFixtureDefinition,
  TestCaseDefinition,
} from "@/test-engine/types";

const frSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
});

const suiteSchema = z.object({
  suiteId: z.string().min(1),
  frId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
});

const fixtureSchema = z.object({
  fixtureId: z.string().min(1),
  suiteId: z.string().min(1),
  title: z.string().min(1),
  baseUrl: z.string().url().optional(),
  commonInput: z.record(z.unknown()).default({}),
  setupScript: z.string().optional(),
  teardownScript: z.string().optional(),
});

const caseSchema = z.object({
  caseId: z.string().min(1),
  fixtureId: z.string().min(1),
  title: z.string().min(1),
  scriptType: z.enum(["single", "multi"]),
  input: z.record(z.unknown()).optional(),
  runs: z.array(z.record(z.unknown())).optional(),
  expected: z.record(z.unknown()),
});

export function parseFunctionalRequirement(json: unknown): FunctionalRequirementDefinition {
  return frSchema.parse(json);
}

export function parseTestSuite(json: unknown): TestSuiteDefinition {
  return suiteSchema.parse(json);
}

export function parseTestFixture(json: unknown): TestFixtureDefinition {
  return fixtureSchema.parse(json);
}

export function parseTestCase(json: unknown): TestCaseDefinition {
  const parsed = caseSchema.parse(json);
  if (parsed.scriptType === "multi" && (!parsed.runs || parsed.runs.length === 0)) {
    throw new Error(`Test case "${parsed.caseId}" is multi-run but has no runs defined.`);
  }
  if (parsed.scriptType === "single" && !parsed.input) {
    throw new Error(`Test case "${parsed.caseId}" is single-run but has no input defined.`);
  }
  return parsed;
}
