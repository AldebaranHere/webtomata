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

/**
 * Opens the Sandbox and waits until the editor takes keys and touches (the page is drawn before
 * that). A first visit shows "Coba contoh" over an empty machine. Unless `example` is false, this
 * opens the example "Berakhiran 01" from it, so that a test starts with the three states that most
 * tests use. That example comes with test strings; they are removed unless `tests` is "keep", so
 * that the panel of a test is what it was before the examples existed.
 */
export async function openSandbox(
	page: Page,
	options: { example?: false; tests?: 'keep' } = {}
): Promise<void> {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	if (options.example === false) return;
	const example = page.getByRole('button', { name: /^(Berakhiran 01|Ending in 01)/ });
	if ((await example.count()) === 0) return;
	await example.click();
	await example.waitFor({ state: 'detached' });
	await page.locator('.editor[data-ready]').waitFor();
	if (options.tests !== 'keep') await clearTests(page);
}

/** Removes every test string of the open machine (an example opens with some). */
export async function clearTests(page: Page): Promise<void> {
	const remove = page.getByRole('button', { name: /^(Hapus|Remove) / });
	while ((await remove.count()) > 0) {
		await remove.first().click();
	}
	await expect(page.locator('.tests li')).toHaveCount(0);
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

/**
 * Waits for the transitions that are under way (and for those that wait for their delay) to end. A
 * tooltip that fades in has half-transparent colors for 100 ms, and axe reads them as a low color
 * contrast: that made a scan fail once in a while in CI (found with e2e/axe-fading.spec.ts). An
 * animation that never ends is not waited for, and the wait has a limit of two seconds.
 */
async function settleTransitions(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const ending = document
			.getAnimations()
			.filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
			.map((animation) => animation.finished.catch(() => undefined));
		await Promise.race([Promise.all(ending), new Promise((resolve) => setTimeout(resolve, 2000))]);
	});
}

/**
 * Fails, and names every rule that was broken and the elements, if axe finds a violation on the
 * page. For a color contrast it also says the colors and the ratio, so that a check that fails
 * once in a while in CI can be understood from its message alone.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
	await settleTransitions(page);
	const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	expect(
		violations.map((v) => {
			const where = v.nodes
				.slice(0, 3)
				.map((node) => {
					const data = node.any[0]?.data as
						{ fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
					const colors = data?.fgColor
						? ` [${data.fgColor} on ${data.bgColor}, ratio ${data.contrastRatio}]`
						: '';
					return `${node.target.join(' ')}${colors}`;
				})
				.join('; ');
			return `${v.id}: ${v.help} (${v.nodes.length} element(s)): ${where}`;
		}),
		'accessibility violations'
	).toEqual([]);
}
