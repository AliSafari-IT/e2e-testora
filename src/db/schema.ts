import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const testStatusEnum = pgEnum("test_status", [
  "pending",
  "running",
  "passed",
  "failed",
  "error",
]);

export const scriptTypeEnum = pgEnum("script_type", ["single", "multi", "scripted"]);

export const functionalRequirements = pgTable("functional_requirements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testSuites = pgTable("test_suites", {
  suiteId: text("suite_id").primaryKey(),
  frId: text("fr_id")
    .notNull()
    .references(() => functionalRequirements.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testFixtures = pgTable("test_fixtures", {
  fixtureId: text("fixture_id").primaryKey(),
  suiteId: text("suite_id")
    .notNull()
    .references(() => testSuites.suiteId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  baseUrl: text("base_url"),
  commonInput: jsonb("common_input").$type<Record<string, unknown>>().default({}),
  setupScript: text("setup_script"),
  teardownScript: text("teardown_script"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testCases = pgTable("test_cases", {
  caseId: text("case_id").primaryKey(),
  fixtureId: text("fixture_id")
    .notNull()
    .references(() => testFixtures.fixtureId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scriptType: scriptTypeEnum("script_type").notNull().default("single"),
  input: jsonb("input").$type<Record<string, unknown>>().default({}),
  runs: jsonb("runs").$type<Record<string, unknown>[]>().default([]),
  expected: jsonb("expected").$type<Record<string, unknown>>().default({}),
  // Raw TestCafe test body for scriptType "scripted" — used for multi-step
  // flows that don't fit the generic fill-fields/submit/assert model.
  script: text("script"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testResults = pgTable("test_results", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => testCases.caseId, { onDelete: "cascade" }),
  status: testStatusEnum("status").notNull().default("pending"),
  runIndex: integer("run_index"),
  durationMs: integer("duration_ms"),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const functionalRequirementsRelations = relations(functionalRequirements, ({ many }) => ({
  suites: many(testSuites),
}));

export const testSuitesRelations = relations(testSuites, ({ one, many }) => ({
  functionalRequirement: one(functionalRequirements, {
    fields: [testSuites.frId],
    references: [functionalRequirements.id],
  }),
  fixtures: many(testFixtures),
}));

export const testFixturesRelations = relations(testFixtures, ({ one, many }) => ({
  suite: one(testSuites, {
    fields: [testFixtures.suiteId],
    references: [testSuites.suiteId],
  }),
  cases: many(testCases),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  fixture: one(testFixtures, {
    fields: [testCases.fixtureId],
    references: [testFixtures.fixtureId],
  }),
  results: many(testResults),
}));

export const testResultsRelations = relations(testResults, ({ one }) => ({
  case: one(testCases, {
    fields: [testResults.caseId],
    references: [testCases.caseId],
  }),
}));
