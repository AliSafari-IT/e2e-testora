import { Selector } from "testcafe";
import type TestController from "testcafe";

/**
 * Generic scenario executor used by generated TestCafe specs. It performs a
 * best-effort form fill + submit based on the input keys, then asserts any
 * expected.errorMessage / expected.redirectTo against the page. Replace or
 * extend this with app-specific selectors as the platform is wired to a real
 * target application.
 */
export async function runScenario(
  t: TestController,
  data: Record<string, unknown>,
  expected: Record<string, unknown>,
): Promise<void> {
  for (const [field, value] of Object.entries(data)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const input = Selector(`[name="${field}"], #${field}`);
    if (await input.exists) {
      await t.typeText(input, String(value), { replace: true });
    }
  }

  const submitButton = Selector('button[type="submit"], [data-testid="submit"]');
  if (await submitButton.exists) {
    await t.click(submitButton);
  }

  if (typeof expected.errorMessage === "string") {
    const errorEl = Selector('[role="alert"], .error, [data-testid="error"]');
    await t.expect(errorEl.exists).ok("Expected an error message to be displayed");
    await t.expect(errorEl.innerText).contains(expected.errorMessage as string);
  }

  if (typeof expected.redirectTo === "string") {
    await t.expect(t.eval(() => window.location.pathname)).eql(expected.redirectTo as string);
  }
}
