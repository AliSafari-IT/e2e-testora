import type {
  FunctionalRequirementDefinition,
  TestSuiteDefinition,
  TestFixtureDefinition,
  TestCaseDefinition,
} from "@/test-engine/types";

/**
 * Video generation from a listing URL — the full ImmoStory happy path:
 * log in, paste a supported listing URL, let the app scrape it, then submit
 * the approval wizard to kick off rendering.
 *
 * Two flakiness traps on localhost Next.js dev are handled deliberately here
 * (both were silent test failures before):
 *
 *  1. Hydration race on controlled inputs. The SSR HTML for the login form and
 *     the listings URL field renders (so the elements *exist*) well before
 *     React hydrates and wires up their onChange handlers. A single typeText
 *     fired in that window lands characters in the DOM that the first React
 *     re-render then wipes — leaving the field empty in React state. The login
 *     setup and the wizard's Step 1 both gate on a hydration signal and re-type
 *     until the value sticks. For login, the signal is the submit button
 *     enabling (it is `disabled={loading || !isHydrated}`); for the URL field,
 *     it is the "Start" button enabling (it is disabled until canStart, i.e.
 *     React captured a non-empty jobUrl).
 *
 *  2. Submitting without driving every wizard step. The app deliberately
 *     renders a hidden, e2e-only generate button (`data-testid=
 *     "approve-generate-button"`, "driven by the main flow / e2e only") wired
 *     to the same handleApprove() as the visible "Create my video" CTA, present
 *     as soon as the job is awaiting_approval. Clicking it lets the test submit
 *     reliably instead of navigating the multi-step Brief/Shots/Script/Look/
 *     Produce wizard whose button labels ("Continue", "Create my video") and
 *     per-step requirements drift over time. Scraping auto-selects the
 *     listing's images, so the button enables once images are ready (it is
 *     disabled while selectedImageUrls is empty).
 */

// Shared deterministic login. Starts at /login (not /listings) so we never
// race the app's own client-side auth-redirect effect. See trap #1 above.
const LOGIN_SETUP_SCRIPT = [
  "const emailInput = Selector('[data-testid=\"login-email\"]');",
  "if (await emailInput.with({ timeout: 20000 }).exists) {",
  "  const passwordInput = Selector('[data-testid=\"login-password\"]');",
  "  const submitButton = Selector('[data-testid=\"login-submit\"]');",
  "  // Hydration gate: the submit button is disabled until isHydrated === true.",
  "  await t.expect(submitButton.hasAttribute('disabled')).notOk({ timeout: 120000 });",
  "  const password = process.env.IMMOSTORY_PASSWORD || '';",
  "  for (let attempt = 0; attempt < 3; attempt++) {",
  "    await t",
  "      .typeText(emailInput, 'asafarim@gmail.com', { replace: true })",
  "      .typeText(passwordInput, password, { replace: true });",
  "    if ((await emailInput.value) === 'asafarim@gmail.com' && (await passwordInput.value) === password) break;",
  "  }",
  "  await t.click(submitButton);",
  "  // Confirm the credentials were accepted. The app races its post-login",
  "  // navigation (push /listings vs replace /dashboard) and sometimes leaves",
  "  // the form mounted even once authenticated, so don't wait on the form",
  "  // clearing — confirm an authenticated session instead: a successful login",
  "  // runs api.setToken(), which writes 'auth_token' to localStorage.",
  "  let authed = false;",
  "  for (let i = 0; i < 60; i++) {",
  "    const hasToken = await t.eval(() => !!localStorage.getItem('auth_token'));",
  "    if (hasToken || !(await emailInput.exists)) { authed = true; break; }",
  "    await t.wait(1000);",
  "  }",
  "  if (!authed) {",
  "    const url = await t.eval(() => window.location.href);",
  "    const bodyText = (await Selector('body').innerText).slice(0, 300);",
  "    await t.expect(authed).ok('Login did not establish a session; URL: ' + url + '; page text: ' + bodyText);",
  "  }",
  "}",
  "await t.navigateTo('/en/listings');",
].join("\n");

const GENERATE_FROM_URL_SCRIPT = [
  "// Steps 1-2 — paste the listing URL, Start, and reach the approval wizard.",
  "// Each supported site routes to its OWN scraper/extractor (see the scraper",
  "// suite), and a *fresh* live scrape is non-deterministic per site: providers",
  "// rotate and anti-bot defenses mean one attempt can transiently fail or be",
  "// slow while another site succeeds. So drive Start with retries — paste",
  "// (hydration-gated, trap #1), Start, then wait a bounded window for the",
  "// wizard; if it doesn't appear (scrape flake / a transient error state),",
  "// return to the listings form and try again before failing the run.",
  "const urlInput = Selector('input[placeholder=\"https://www.immoweb.be/...\"]');",
  "const startButton = Selector('button').withText('Start').filterVisible().nth(0);",
  "const orientationSection = Selector('[data-tour=\"step-orientation\"]');",
  "let reachedWizard = false;",
  "for (let attempt = 0; attempt < 3 && !reachedWizard; attempt++) {",
  "  if (attempt > 0) await t.navigateTo('/en/listings');",
  "  await t.expect(urlInput.with({ timeout: 30000 }).exists).ok('Expected the URL input to appear');",
  "  for (let i = 0; i < 6; i++) {",
  "    await t.typeText(urlInput, run.url, { replace: true });",
  "    if ((await urlInput.value) === run.url && !(await startButton.hasAttribute('disabled'))) break;",
  "    await t.wait(1500);",
  "  }",
  "  await t.expect(startButton.hasAttribute('disabled')).notOk({ timeout: 10000 });",
  "  await t.click(startButton);",
  "  // Poll for the wizard up to a per-attempt budget. NB: a bare",
  "  // `await selector.exists` returns an immediate snapshot — it does NOT wait",
  "  // — so we poll explicitly rather than rely on a selector timeout here. The",
  "  // first attempt also pays for Next.js dev JIT-compiling /listings +",
  "  // /jobs/[id] on a cold start; later attempts run warm. A miss means the",
  "  // scrape flaked for this source, so the outer loop retries Start.",
  "  const deadline = Date.now() + (attempt === 0 ? 150000 : 90000);",
  "  while (Date.now() < deadline) {",
  "    if (await orientationSection.exists) { reachedWizard = true; break; }",
  "    await t.wait(2000);",
  "  }",
  "}",
  "await t.expect(reachedWizard).ok('Approval wizard did not load after starting the job across retries (live scrape may have failed for this source)');",
  "",
  "// Step 3 — submit via the hidden e2e-only generate button (see trap #2). It",
  "// is disabled until scraping auto-selects images, so wait for it to enable,",
  "// then click it via native JS since it lives in a hidden container.",
  "const generateButton = Selector('[data-testid=\"approve-generate-button\"]');",
  "await t.expect(generateButton.exists).ok('Expected the e2e generate button to be present');",
  "await t.expect(generateButton.hasAttribute('disabled')).notOk({ timeout: 60000 });",
  "await t.eval(() => {",
  "  const btn = document.querySelector('[data-testid=\"approve-generate-button\"]');",
  "  if (btn) btn.click();",
  "});",
  "",
  "// Step 4 — generation started: approving moves the job out of",
  "// awaiting_approval, so the approval wizard (orientation panel) unmounts.",
  "await t.expect(orientationSection.exists).notOk('Expected the job to leave awaiting_approval after submitting', { timeout: 60000 });",
].join("\n");

export const videoGenerationFR: FunctionalRequirementDefinition = {
  id: "video-generation-flow",
  title: "Video generation flow",
  description:
    "Create a marketing video from a supported real-estate listing URL: scrape, approve, render.",
  baseUrl: "http://localhost:3233",
};

export const createVideoFromUrlSuite: TestSuiteDefinition = {
  suiteId: "create-video-from-url",
  frId: "video-generation-flow",
  title: "Create Video From Listing URL",
  description: "End-to-end happy path from pasting a listing URL to kicking off rendering.",
};

export const listingsWizardFixture: TestFixtureDefinition = {
  fixtureId: "listings-wizard",
  suiteId: "create-video-from-url",
  title: "Listings page - video generation wizard",
  baseUrl: "/en/login",
  commonInput: {},
  setupScript: LOGIN_SETUP_SCRIPT,
};

export const videoGenerationTestCases: TestCaseDefinition[] = [
  {
    caseId: "generate-video-from-listing-url",
    fixtureId: "listings-wizard",
    title: "User can generate a video from a listing URL",
    scriptType: "scripted",
    // Two representative sources that both scrape reliably on localhost: a
    // Belgian portal (zimmo) and the DataDome-protected market leader (immoweb).
    runs: [
      { url: "https://www.zimmo.be/nl/meise-1860/te-koop/bedrijfsvastgoed/L36KT/" },
      { url: "https://www.immoweb.be/nl/zoekertje/huis/te-koop/houthalen-helchteren/3530/21654774" },
    ],
    expected: {},
    script: GENERATE_FROM_URL_SCRIPT,
  },
];
