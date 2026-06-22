import type {
  FunctionalRequirementDefinition,
  TestSuiteDefinition,
  TestFixtureDefinition,
  TestCaseDefinition,
} from "@/test-engine/types";

export const authenticationFR: FunctionalRequirementDefinition = {
  id: "auth",
  title: "Authentication",
  description: "Covers all login and signup flows, including validation and rate limiting.",
};

export const loginFlowSuite: TestSuiteDefinition = {
  suiteId: "login-flow",
  frId: "auth",
  title: "Login Flow",
  description: "Covers all login scenarios using email/password.",
};

export const loginWithEmailFixture: TestFixtureDefinition = {
  fixtureId: "login-with-email",
  suiteId: "login-flow",
  title: "Login using email/password",
  baseUrl: "https://example-app.local/login",
  commonInput: {
    email: "test@example.com",
    password: "Password123!",
  },
};

export const loginTestCases: TestCaseDefinition[] = [
  {
    caseId: "valid-login",
    fixtureId: "login-with-email",
    title: "Valid login succeeds",
    scriptType: "single",
    input: { email: "test@example.com", password: "Password123!" },
    expected: { redirectTo: "/dashboard" },
  },
  {
    caseId: "invalid-password",
    fixtureId: "login-with-email",
    title: "Login fails with invalid password",
    scriptType: "multi",
    runs: [
      { email: "user1@example.com", password: "wrong" },
      { email: "user2@example.com", password: "incorrect" },
    ],
    expected: { errorMessage: "Invalid credentials" },
  },
  {
    caseId: "invalid-email-format",
    fixtureId: "login-with-email",
    title: "Login fails with invalid email format",
    scriptType: "single",
    input: { email: "not-an-email", password: "Password123!" },
    expected: { errorMessage: "Enter a valid email address" },
  },
  {
    caseId: "missing-fields",
    fixtureId: "login-with-email",
    title: "Login fails when fields are missing",
    scriptType: "multi",
    runs: [
      { email: "", password: "Password123!" },
      { email: "test@example.com", password: "" },
    ],
    expected: { errorMessage: "This field is required" },
  },
  {
    caseId: "rate-limit",
    fixtureId: "login-with-email",
    title: "Login is rate-limited after repeated failures",
    scriptType: "single",
    input: { email: "test@example.com", password: "wrong", attempts: 5 },
    expected: { errorMessage: "Too many attempts, try again later" },
  },
  {
    caseId: "brute-force-multi-run",
    fixtureId: "login-with-email",
    title: "Multi-run brute-force attempts are all rejected",
    scriptType: "multi",
    runs: [
      { email: "test@example.com", password: "guess1" },
      { email: "test@example.com", password: "guess2" },
      { email: "test@example.com", password: "guess3" },
    ],
    expected: { errorMessage: "Invalid credentials" },
  },
];
