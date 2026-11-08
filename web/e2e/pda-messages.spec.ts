// The PDA messages are loaded only with the PDA mode (Task T-063).
// M1: the FSM page never downloads a chunk that holds them.
// M2: the PDA mode shows the Tabel panel in Indonesian, and no raw key ever reaches the page.
// M3: the same in English, from the language saved before the page loads.
import { expect, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });

/** Every `.js` response body that the page receives, read when the collector is called. */
function collectScriptBodies(page: Page) {
	const bodies: Promise<string>[] = [];
	page.on('response', (response) => {
		if (!response.url().endsWith('.js')) return;
		bodies.push(response.text().catch(() => ''));
	});
	return () => Promise.all(bodies);
}

/** No element of the page shows a message key instead of its text. */
async function expectNoRawKeys(page: Page) {
	await expect(page.getByText(/^(pda_editor|pda_check|kind)\.[a-z_]+$/)).toHaveCount(0);
}

async function addState(page: Page, x: number, y: number) {
	await page.getByRole('button', { name: /^Tambah state/ }).click();
	await page.locator('.stage svg').click({ position: { x, y } });
}

/** One transition between two existing states, through the diagram tools and the label form. */
async function addTransition(page: Page, fromName: string, toName: string) {
	await page.getByRole('button', { name: /^Tambah transisi/ }).click();
	const stateBtn = (name: string) =>
		page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
	await stateBtn(fromName).click();
	await stateBtn(toName).click();
	const form = page.locator('.pda-label-form[role="dialog"]');
	await expect(form).toBeVisible();
	await form.getByRole('textbox', { name: /Baris 1.*Baca/i }).fill('a');
	await form.getByRole('button', { name: /Simpan/i }).click();
	await expect(form).toHaveCount(0);
}

test.describe('the PDA messages are lazy', () => {
	test('M1: the FSM page downloads the shared dictionary, but none of the PDA messages', async ({
		page
	}) => {
		const bodies = collectScriptBodies(page);
		await page.goto('/sandbox');
		await page.locator('.editor[data-ready]').waitFor();
		const scripts = await bodies();

		// The collector saw the dictionary: this makes the two absences below mean something.
		expect(scripts.some((body) => body.includes('Tersimpan di perangkat ini'))).toBe(true);
		expect(scripts.some((body) => body.includes('Transisi di antara'))).toBe(false);
		expect(scripts.some((body) => body.includes('Belum ada accepting state.'))).toBe(false);
	});

	test('M2: the PDA mode shows the Tabel panel in Indonesian, and no raw key', async ({ page }) => {
		await page.goto('/sandbox?mode=pda');
		await page.locator('.editor[data-ready]').waitFor();
		const side = panel(page);
		await expect(side).toBeVisible();

		// The empty machine: the title and the calm empty line.
		await expect(side.getByRole('heading', { name: 'Transisi (0)' })).toBeVisible();
		await expect(side.getByText('Belum ada transisi.')).toBeVisible();
		await expect(page.getByRole('radio', { name: 'DPDA', exact: true })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'NDPDA', exact: true })).toBeVisible();
		await expectNoRawKeys(page);

		// One transition, so that the table renders its five headers.
		await addState(page, 120, 200);
		await addState(page, 300, 200);
		await addTransition(page, 'q0', 'q1');

		await expect(side.getByRole('heading', { name: 'Transisi (1)' })).toBeVisible();
		for (const head of ['Dari', 'Baca', 'Pop', 'Push', 'Ke']) {
			await expect(side.getByRole('columnheader', { name: head })).toBeVisible();
		}
		await expectNoRawKeys(page);
	});

	test('M3: with English saved, the PDA mode shows the English texts', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('webtomata.lang', 'en'));
		await page.goto('/sandbox?mode=pda');
		await page.locator('.editor[data-ready]').waitFor();
		const side = panel(page);
		await expect(side.getByRole('heading', { name: 'Transitions (0)' })).toBeVisible();
		await expect(side.getByText('No transitions yet.')).toBeVisible();
		await expect(page.getByRole('radio', { name: 'DPDA', exact: true })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'NDPDA', exact: true })).toBeVisible();
		await expectNoRawKeys(page);
	});
});
