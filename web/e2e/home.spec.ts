// The home page, on the production build. The engine version appears once the worker has loaded
// the WASM module, so this also checks that the script, the worker, the WASM file and the CSP work.
import { expectNoAxeViolations, expect, test } from './fixtures.ts';

const VERSION = /^\d+\.\d+\.\d+/;

test('the home page shows the engine version', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'WebTomata' })).toBeVisible();
	await expect(page.locator('.version code')).toHaveText(VERSION);
});

test('the home page has no accessibility violations', async ({ page }) => {
	await page.goto('/');
	// The scan starts only when the page has finished loading.
	await expect(page.locator('.version code')).toHaveText(VERSION);
	await expectNoAxeViolations(page);
});
