// S5-1 in every engine: the tabs of the panel (Simulasi, Tabel, Definisi), the formal definition,
// and the switch between DFSM and NDFSM. See docs/ux/editor-interactions.md.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const nodes = (page: Page) => page.locator('svg.world g.node');
const kind = (page: Page, name: 'DFSM' | 'NDFSM') =>
	panel(page).getByRole('radio', { name, exact: true });

test('the panel has four tabs, and it starts on Simulasi', async ({ page }) => {
	await openSandbox(page);
	await expect(panel(page).getByRole('tab')).toHaveText([
		'Simulasi',
		'Tabel',
		'Definisi',
		'Konversi'
	]);
	await expect(tab(page, 'Simulasi')).toHaveAttribute('aria-selected', 'true');
	await expect(panel(page).getByRole('tabpanel')).toHaveCount(1);
	await expect(panel(page).getByLabel('String masukan')).toBeVisible();
	await expectNoAxeViolations(page);
});

test('Definisi shows the machine in the notation of Rich, as text', async ({ page }) => {
	await openSandbox(page);
	await tab(page, 'Definisi').click();
	const pane = panel(page).getByRole('tabpanel', { name: 'Definisi' });
	await expect(pane.getByText('M = (K, Σ, δ, s, A)', { exact: true })).toBeVisible();
	await expect(pane.getByText('= {q0, q1, q2}')).toBeVisible();
	await expect(pane.getByText('= {0, 1}')).toBeVisible();
	await expect(pane.getByText('= q0', { exact: true })).toBeVisible();
	await expect(pane.getByText('= {q2}')).toBeVisible();
	await expect(pane.getByText('δ(q0, 0) = q1')).toBeVisible();
	await expect(pane.getByText('δ(q2, 1) = q0')).toBeVisible();
	await expectNoAxeViolations(page);
});

test('an edit in the diagram is in Definisi at once, and undo takes it back', async ({ page }) => {
	await openSandbox(page);
	await tab(page, 'Definisi').click();
	const pane = panel(page).getByRole('tabpanel', { name: 'Definisi' });
	await expect(pane.getByText('= {q0, q1, q2}')).toBeVisible();
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(4);
	}).toPass();
	await expect(pane.getByText('= {q0, q1, q2, q3}')).toBeVisible();
	await page.keyboard.press('Control+z');
	await expect(pane.getByText('= {q0, q1, q2}')).toBeVisible();
});

test('DFSM and NDFSM: one undo step, the notation follows, and a screen reader hears it', async ({
	page
}) => {
	await openSandbox(page);
	await tab(page, 'Definisi').click();
	await expect(kind(page, 'DFSM')).toHaveAttribute('aria-checked', 'true');
	await kind(page, 'NDFSM').click();
	await expect(kind(page, 'NDFSM')).toHaveAttribute('aria-checked', 'true');
	const pane = panel(page).getByRole('tabpanel', { name: 'Definisi' });
	await expect(pane.getByText('M = (K, Σ, Δ, s, A)', { exact: true })).toBeVisible();
	await expect(pane.getByText('(q0, 0, q1) ∈ Δ')).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Jenis mesin menjadi NDFSM.');
	// The same switch is in the Tabel tab, and the history is the one history.
	await tab(page, 'Tabel').click();
	await expect(kind(page, 'NDFSM')).toHaveAttribute('aria-checked', 'true');
	await page.getByRole('button', { name: 'Urungkan' }).locator('visible=true').first().click();
	await expect(kind(page, 'DFSM')).toHaveAttribute('aria-checked', 'true');
});

test('the arrow keys move between the tabs, and only the open tab is a Tab stop', async ({
	page
}) => {
	await openSandbox(page);
	await tab(page, 'Simulasi').focus();
	await page.keyboard.press('ArrowRight');
	await expect(tab(page, 'Tabel')).toBeFocused();
	await expect(tab(page, 'Tabel')).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('End');
	await expect(tab(page, 'Konversi')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(tab(page, 'Simulasi')).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(tab(page, 'Konversi')).toBeFocused();
	await page.keyboard.press('Home');
	await expect(tab(page, 'Simulasi')).toBeFocused();
	await expect(tab(page, 'Tabel')).toHaveAttribute('tabindex', '-1');
});

test('the last tab is remembered after a reload', async ({ page }) => {
	await openSandbox(page);
	await tab(page, 'Definisi').click();
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(tab(page, 'Definisi')).toHaveAttribute('aria-selected', 'true');
	await expect(panel(page).getByText('M = (K, Σ, δ, s, A)', { exact: true })).toBeVisible();
});

test('what was typed in Simulasi is still there after a visit to another tab', async ({ page }) => {
	await openSandbox(page);
	await panel(page).getByLabel('String masukan').fill('0101');
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByLabel('String masukan')).toBeHidden();
	await tab(page, 'Simulasi').click();
	await expect(panel(page).getByLabel('String masukan')).toHaveValue('0101');
});

test('Salin copies the definition, or says plainly that it could not', async ({ page }) => {
	await openSandbox(page);
	await tab(page, 'Definisi').click();
	await panel(page).getByRole('button', { name: 'Salin' }).click();
	await expect(
		panel(page).getByText(
			/^(Tersalin\.|Tidak bisa menyalin\. Pilih teksnya, lalu salin sendiri\.)$/
		)
	).toBeVisible();
});

test('a name that looks like markup is shown as text', async ({ page }) => {
	await openSandbox(page);
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: /^State q0(,|$)/ }).click();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Control+a');
	await page.keyboard.type('<b>x</b>');
	await page.keyboard.press('Enter');
	await tab(page, 'Definisi').click();
	await expect(panel(page).getByText('<b>x</b>').first()).toBeVisible();
	await expect(panel(page).locator('b')).toHaveCount(0);
});
