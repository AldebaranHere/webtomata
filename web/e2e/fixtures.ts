// What every browser test shares: it fails when the page logs an error, throws, or loads
// something that fails, and it has a helper that scans a page with axe.
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

export { expect };

export const test = base.extend<{ watch: void; allowedProblem: RegExp | undefined }>({
	// Problems that a test causes on purpose (a blocked file, for example): a pattern for the text
	// of the problem. Use it with test.use({ allowedProblem: /pattern/ }). It is one pattern, not a
	// list, because Playwright reads a two-item array as [value, options].
	allowedProblem: [undefined, { option: true }],

	// Runs for every test. The problems are checked after the test, so that the first problem
	// does not hide the others.
	watch: [
		async ({ page, allowedProblem }, use) => {
			const problems: string[] = [];
			page.on('console', (message) => {
				if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
			});
			page.on('pageerror', (error) => problems.push(`uncaught error: ${error.message}`));
			page.on('requestfailed', (request) =>
				problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`)
			);
			page.on('response', (response) => {
				if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
			});
			await use();
			expect(problems.filter((p) => !allowedProblem?.test(p))).toEqual([]);
		},
		{ auto: true }
	]
});

// WCAG 2.0, 2.1 and 2.2 levels A and AA, and axe's best practices. No violation is allowed.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Opens the Sandbox and waits until the editor takes keys and touches (the page is drawn before that). */
export async function openSandbox(page: Page): Promise<void> {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
}

/**
 * Waits until the engine has answered once (the first check of the machine is done). A test that
 * reloads the page right after it opened must wait for this: the reload cancels the load of the
 * worker and of the WASM file that is still under way, and the page then logs a failed request
 * (seen in WebKit on a slow runner).
 */
export async function engineSettled(page: Page): Promise<void> {
	await expect(page.getByText('Memeriksa…')).toHaveCount(0);
}

/** Fails, and names every rule that was broken, if axe finds a violation on the page. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
	const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	expect(
		violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`),
		'accessibility violations'
	).toEqual([]);
}
