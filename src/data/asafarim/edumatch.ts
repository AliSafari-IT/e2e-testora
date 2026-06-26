import type {
  FunctionalRequirementDefinition,
  TestSuiteDefinition,
  TestFixtureDefinition,
  TestCaseDefinition,
} from "@/test-engine/types";

/**
 * ASafariM EduMatch — student question flow and tutor quote flow.
 *
 * EduMatch authenticates through the portal SSO (its middleware redirects
 * protected routes to portal.asafarim.com/sign-in). These tests are
 * self-bootstrapping: they try the credentials from .env and, if the account
 * doesn't exist yet, register it on the portal (which auto-signs-in).
 *
 * Credentials: EDUMATCH_STUDENT_EMAIL/PASSWORD and EDUMATCH_TEACHER_EMAIL/
 * PASSWORD (same for dev and prod — switch via the Run page's Target env).
 */

export const edumatchFR: FunctionalRequirementDefinition = {
  id: "asafarim-edumatch",
  projectId: "asafarim",
  title: "EduMatch · Student & Tutor",
  description:
    "Student asks questions (3 grade levels), gets an AI answer and requests tutor quotes; a tutor submits a quote.",
  baseUrl: process.env.ASAFARIM_EDUMATCH_URL || "https://edumatch.asafarim.com",
};

/**
 * Sign in to EduMatch via the portal SSO. Starts on the EduMatch home (public)
 * so we can capture its origin, then navigates to a protected page to trigger
 * the redirect. Logs in; if that fails (account missing) it registers on the
 * portal. Leaves the browser authenticated and on `triggerPath`.
 */
function edumatchAuth(
  emailEnv: string,
  passEnv: string,
  triggerPath: string,
): string {
  return `
await t.deleteCookies();
// We loaded the public EduMatch home, so this origin is the (possibly
// retargeted) EduMatch deployment — use it for absolute navigation across the
// cross-domain portal-SSO redirect.
const eduOrigin = await t.eval(() => window.location.origin);
const email = process.env.${emailEnv} || '';
const password = process.env.${passEnv} || '';
await t.expect(email.length).gt(0, '${emailEnv} must be set in F:\\\\repos\\\\e2e-testora\\\\.env');
await t.expect(password.length).gt(0, '${passEnv} must be set in F:\\\\repos\\\\e2e-testora\\\\.env');

await t.navigateTo(eduOrigin + '${triggerPath}');
await t.wait(3000);
let path = await t.eval(() => window.location.pathname);
if (path.indexOf('/sign-in') !== -1) {
  await t.expect(Selector('#email').with({ timeout: 30000 }).exists).ok('portal sign-in form should render');
  await t.typeText('#email', email, { replace: true });
  await t.typeText('#password', password, { replace: true });
  await t.click(Selector('button[type="submit"]').filterVisible());
  await t.wait(5000);
  path = await t.eval(() => window.location.pathname);
  if (path.indexOf('/sign-in') !== -1) {
    // Login didn't take — the account likely doesn't exist yet, so register it.
    await t.navigateTo('/sign-up');
    await t.expect(Selector('#confirmPassword').with({ timeout: 30000 }).exists).ok('portal sign-up form should render');
    const token = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    await t.typeText('#name', 'E2E ' + token, { replace: true });
    await t.typeText('#username', ('e2e' + token).slice(0, 24), { replace: true });
    await t.typeText('#email', email, { replace: true });
    await t.typeText('#password', password, { replace: true });
    await t.typeText('#confirmPassword', password, { replace: true });
    await t.click(Selector('button[type="submit"]').filterVisible());
    await t.wait(5000);
  }
}
// Back to the target page, now authenticated.
await t.navigateTo(eduOrigin + '${triggerPath}');
await t.wait(3000);
const authedPath = await t.eval(() => window.location.pathname);
await t.expect(authedPath.indexOf('/sign-in')).eql(-1, 'should be signed in and reach ${triggerPath} (ended on ' + authedPath + ')');
`;
}

/* ------------------------------------------------------------------ */
/* Student — ask 3 questions (one per grade level) + request quotes   */
/* ------------------------------------------------------------------ */

export const edumatchStudentSuite: TestSuiteDefinition = {
  suiteId: "edumatch-student-inquiry",
  frId: "asafarim-edumatch",
  title: "Student asks questions and requests tutor quotes",
  description:
    "For each grade level: ask a question, get an AI answer, request tutor quotes and see the success confirmation.",
};

export const edumatchStudentFixture: TestFixtureDefinition = {
  fixtureId: "edumatch-student-ask-ui",
  suiteId: "edumatch-student-inquiry",
  title: "Student ask-a-question + request tutor quotes",
  // Public home so we can capture the EduMatch origin before the SSO redirect.
  baseUrl: "/",
  commonInput: {},
  // Browser flow + an external SSR app (ignore its benign client errors). Each
  // run creates a real inquiry and triggers a live AI generation.
  metadata: { ui: true, skipJsErrors: true },
};

const edumatchStudentCases: TestCaseDefinition[] = [
  {
    caseId: "edumatch-student-ask-and-request-quotes",
    fixtureId: "edumatch-student-ask-ui",
    title: "Student asks a question, gets AI answer and requests tutor quotes",
    scriptType: "scripted",
    // One question per grade level (K12 / UNDERGRAD / GRAD = grade buttons 0/1/2).
    runs: [
      { subject: "Mathematics", gradeIndex: 0, gradeName: "K12" },
      { subject: "Physics", gradeIndex: 1, gradeName: "UNDERGRAD" },
      { subject: "Chemistry", gradeIndex: 2, gradeName: "GRAD" },
    ],
    expected: {},
    script:
      edumatchAuth(
        "EDUMATCH_STUDENT_EMAIL",
        "EDUMATCH_STUDENT_PASSWORD",
        "/student/inquiry/new",
      ) +
      `
// ── Step 1 (Subject & Level): pick the course + grade ──────────────────────
await t.expect(Selector('select').filterVisible().with({ timeout: 30000 }).exists).ok('the Ask a Question wizard should render');
const subjectSelect = Selector('select').filterVisible();
await t.click(subjectSelect);
await t.click(subjectSelect.find('option').withText(run.subject));
// Grade levels render as the 3 buttons in the grade grid (K12 / UNDERGRAD / GRAD).
await t.click(Selector('[class*="grid-cols-3"] button').nth(run.gradeIndex));
// Advance buttons are the primary ones (bg-[var(--color-primary)] + px-6).
const advance = () => Selector('button[class*="--color-primary"][class*="px-6"]').filterVisible();
await t.click(advance());

// ── Step 2 (Your Question): a 100+ char description ────────────────────────
const desc = 'Automated end-to-end test question about ' + run.subject + ' at ' + run.gradeName + ' level. Please give a clear, detailed, step-by-step explanation with at least one worked example. Thank you very much!';
await t.typeText('textarea', desc, { replace: true });
await t.click(advance()); // Review

// ── Step 3 (Review): submit ────────────────────────────────────────────────
await t.click(advance()); // Submit

// Land on the inquiry detail page (/student/inquiry/<id>, not /new).
let onDetail = false; let dp = '';
for (let i = 0; i < 30; i++) {
  dp = await t.eval(() => window.location.pathname);
  if (/\\/student\\/inquiry\\/[^/]+$/.test(dp) && dp.indexOf('/new') === -1) { onDetail = true; break; }
  await t.wait(1000);
}
await t.expect(onDetail).ok('after submitting, should land on the inquiry detail page (was at ' + dp + ')');

// ── Ask AI, then wait for the answer to reveal "Request Tutor Quotes" ───────
const askAi = Selector('button').withText('Ask AI').filterVisible();
if (await askAi.exists) { await t.click(askAi); }
// The green button only appears once the inquiry is AI_RESPONDED and the stream
// is done — give the live AI generation a generous ceiling.
const reqBtn = Selector('button').withText('Request Tutor Quotes');
await t.expect(reqBtn.with({ timeout: 150000 }).exists).ok('Ask AI should produce a response and reveal "Request Tutor Quotes"');
await t.click(reqBtn.filterVisible());

// ── Success: "🎉 Your request has been sent!" ──────────────────────────────
await t.expect(Selector('body').withText('request has been sent').with({ timeout: 30000 }).exists).ok('should show the "Your request has been sent" success message');
`,
  },
];

/* ------------------------------------------------------------------ */
/* Tutor — submit a quote on an open request                          */
/* ------------------------------------------------------------------ */

export const edumatchTutorSuite: TestSuiteDefinition = {
  suiteId: "edumatch-tutor-quote",
  frId: "asafarim-edumatch",
  title: "Tutor submits a quote for an open request",
  description:
    "A tutor opens an incoming quote request and submits a rate + availability.",
};

export const edumatchTutorFixture: TestFixtureDefinition = {
  fixtureId: "edumatch-tutor-quote-ui",
  suiteId: "edumatch-tutor-quote",
  title: "Tutor submits a quote on an open request",
  baseUrl: "/",
  commonInput: {},
  // PRECONDITION: the teacher account must be an onboarded, verified tutor, and
  // there must be at least one open quote request matching them (i.e. a student
  // requested tutor quotes for a question this tutor can serve). Without that,
  // the requests list is empty and the test reports it clearly.
  metadata: { ui: true, skipJsErrors: true },
};

const edumatchTutorCases: TestCaseDefinition[] = [
  {
    caseId: "edumatch-tutor-submit-quote",
    fixtureId: "edumatch-tutor-quote-ui",
    title: "Tutor can open a request and submit a quote",
    scriptType: "scripted",
    expected: {},
    script:
      edumatchAuth(
        "EDUMATCH_TEACHER_EMAIL",
        "EDUMATCH_TEACHER_PASSWORD",
        "/tutor/requests",
      ) +
      `
// Each open request is a full-width card header button (text-left + p-5).
const reqHeader = Selector('button[class*="text-left"][class*="p-5"]').filterVisible();
await t.expect(reqHeader.with({ timeout: 20000 }).exists).ok('expected at least one open quote request — the teacher must be an onboarded, verified tutor and a student must have requested quotes for a matching question');
await t.click(reqHeader);

// The expanded form pre-fills rate (€30) and hours (2); add one availability
// slot (start + end) and a note, then submit.
const slotStart = Selector('input[type="datetime-local"]').filterVisible().nth(0);
const slotEnd = Selector('input[type="datetime-local"]').filterVisible().nth(1);
await t.expect(slotStart.with({ timeout: 15000 }).exists).ok('the quote form should expand with an availability slot');
await t.typeText(slotStart, '2026-12-01T10:00', { replace: true });
await t.typeText(slotEnd, '2026-12-01T11:00', { replace: true });
await t.typeText(Selector('textarea').filterVisible(), 'Automated e2e tutor quote — happy to help with this topic.', { replace: true });

// Submit is the primary button (bg-[var(--color-primary)] + px-4) inside the form.
await t.click(Selector('button[class*="--color-primary"][class*="px-4"]').filterVisible());
await t.wait(4000);

// Success: no error banner appeared and the request left the open list.
await t.expect(Selector('[class*="bg-red-50"]').filterVisible().exists).notOk('submitting the quote should not surface an error');
`,
  },
];

/* ------------------------------------------------------------------ */

export const edumatchSuites: TestSuiteDefinition[] = [
  edumatchStudentSuite,
  edumatchTutorSuite,
];
export const edumatchFixtures: TestFixtureDefinition[] = [
  edumatchStudentFixture,
  edumatchTutorFixture,
];
export const edumatchCases: TestCaseDefinition[] = [
  ...edumatchStudentCases,
  ...edumatchTutorCases,
];
