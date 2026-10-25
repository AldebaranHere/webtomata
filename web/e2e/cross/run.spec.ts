// S6-2 in every engine: run one string. The engine answers once, and the page steps through the
// answer: the symbols that were read, the lines of the computation, the active states and the
// edge just taken on the diagram, and a calm verdict.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const field = (page: Page) => panel(page).getByLabel('String masukan');
const go = (page: Page) => panel(page).getByRole('button', { name: /^(Jalankan|Jeda)$/ });
const button = (page: Page, name: string) => panel(page).getByRole('button', { name });
const chips = (page: Page) => panel(page).getByRole('list', { name: 'Simbol yang dibaca' });
const active = (page: Page) => page.locator('svg.world g.node[data-active]');
const taken = (page: Page) => page.locator('svg.world g.edge[data-taken]');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

/** Runs a string and stops at the first step, so that a test steps by hand and never waits for the timer. */
async function runAndStop(page: Page, input: string) {
	await field(page).fill(input);
	await go(page).click();
	await button(page, 'Jeda').click();
	// The pause may come before the first step (the button is then off), or after it.
	const start = button(page, 'Kembali ke awal');
	if (await start.isEnabled()) await start.click();
}

test('a string that is accepted: the verdict comes at the end of the play, the diagram follows', async ({
	page
}) => {
	await openSandbox(page);
	await field(page).fill('01');
	await go(page).click();
	// The first step: the start state is active, nothing was read, and there is no verdict yet.
	await expect(chips(page).getByRole('listitem')).toHaveText(['0', '1']);
	// Every 700 ms a step; the last step gives the verdict.
	await expect(panel(page).getByText('Diterima', { exact: true })).toBeVisible({ timeout: 5000 });
	await expect(active(page)).toHaveCount(1);
	await expect(active(page)).toHaveAttribute('aria-label', /^State q2/);
	await expect(taken(page)).toHaveCount(1);
	await expect(taken(page)).toHaveAttribute('data-edge', '1>2');
	await expect(chips(page).locator('[aria-current="step"]')).toHaveText('1');
	await expect(panel(page).getByText('q0 –0→ q1')).toBeVisible();
	await expect(panel(page).getByText('q1 –1→ q2')).toBeVisible();
	// The play stopped at the end: the button offers to run again.
	await expect(go(page)).toHaveText('Jalankan');
	await expectNoAxeViolations(page);
});

test('a string that is rejected is said calmly, with the reason', async ({ page }) => {
	await openSandbox(page);
	await runAndStop(page, '0');
	await button(page, 'Langkah berikutnya').click();
	await expect(panel(page).getByText('Ditolak', { exact: true })).toBeVisible();
	await expect(
		panel(page).getByText('Tidak ada state aktif yang accepting.', { exact: true })
	).toBeVisible();
	await expect(button(page, 'Langkah berikutnya')).toBeDisabled();
});

test('steps go forward and back by hand, and the diagram and the list follow', async ({ page }) => {
	await openSandbox(page);
	await runAndStop(page, '010');
	await expect(active(page)).toHaveAttribute('aria-label', /^State q0/);
	await expect(taken(page)).toHaveCount(0);
	await expect(button(page, 'Langkah sebelumnya')).toBeDisabled();
	await expect(panel(page).getByText('Belum ada simbol yang dibaca.')).toBeVisible();

	await button(page, 'Langkah berikutnya').click();
	await expect(active(page)).toHaveAttribute('aria-label', /^State q1/);
	await expect(taken(page)).toHaveAttribute('data-edge', '0>1');
	await expect(panel(page).getByText('Langkah 1 dari 3')).toBeVisible();

	await button(page, 'Langkah berikutnya').click();
	await expect(active(page)).toHaveAttribute('aria-label', /^State q2/);
	await expect(panel(page).getByText('q1 –1→ q2')).toBeVisible();
	// No verdict until the last step.
	await expect(panel(page).getByText('Diterima', { exact: true })).toHaveCount(0);

	await button(page, 'Langkah sebelumnya').click();
	await expect(active(page)).toHaveAttribute('aria-label', /^State q1/);
	await expect(panel(page).getByText('q1 –1→ q2')).toHaveCount(0);

	await button(page, 'Kembali ke awal').click();
	await expect(active(page)).toHaveAttribute('aria-label', /^State q0/);
	await expect(panel(page).getByText(/^Langkah \d/)).toHaveCount(0);
});

test('a live region says each step', async ({ page }) => {
	await openSandbox(page);
	await runAndStop(page, '01');
	const said = panel(page).locator('[aria-live]');
	await expect(said).toHaveText('Mulai. State aktif: q0.');
	await button(page, 'Langkah berikutnya').click();
	await expect(said).toHaveText('Membaca 0 (1 dari 2). State aktif: q1.');
});

test('a symbol that is not in the alphabet is said in words, and nothing runs', async ({
	page
}) => {
	await openSandbox(page);
	await field(page).fill('012');
	await go(page).click();
	await expect(panel(page).getByText('Simbol "2" (posisi 3) tidak ada di alfabet.')).toBeVisible();
	await expect(active(page)).toHaveCount(0);
	await expect(chips(page)).toHaveCount(0);
});

test('a machine without a start state says what to do', async ({ page, isMobile }) => {
	await openSandbox(page);
	await expect(panel(page).getByText('Mesin ini lengkap.')).toBeVisible();
	if (isMobile) await state(page, 'q0').tap();
	else await state(page, 'q0').click();
	await page.keyboard.press('m');
	await field(page).fill('01');
	await go(page).click();
	await expect(
		panel(page).getByText('Belum ada start state. Pilih satu state, lalu tekan M.')
	).toBeVisible();
});

test('an empty string runs, as the empty string', async ({ page }) => {
	await openSandbox(page);
	await go(page).click();
	await expect(panel(page).getByText('Ditolak', { exact: true })).toBeVisible();
	await expect(chips(page).getByRole('listitem')).toHaveCount(0);
});

test('a change of the machine or of the string clears the run', async ({ page }) => {
	await openSandbox(page);
	await runAndStop(page, '01');
	await button(page, 'Langkah berikutnya').click();
	await expect(active(page)).toHaveCount(1);

	// Editing the string.
	await field(page).fill('011');
	await expect(active(page)).toHaveCount(0);
	await expect(chips(page)).toHaveCount(0);
	await expect(button(page, 'Langkah sebelumnya')).toBeDisabled();

	// Editing the machine; the string stays in the field.
	await runAndStop(page, '011');
	await expect(active(page)).toHaveCount(1);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		await expect(active(page)).toHaveCount(0);
	}).toPass();
	await expect(chips(page)).toHaveCount(0);
	await expect(field(page)).toHaveValue('011');
});

test('the next-step button starts a run too, at step one, and does not play', async ({ page }) => {
	await openSandbox(page);
	await field(page).fill('010');
	await button(page, 'Langkah berikutnya').click();
	await expect(chips(page).getByRole('listitem')).toHaveText(['0', '1', '0']);
	await expect(active(page)).toHaveAttribute('aria-label', /^State q1/);
	// It waits for the next press: nothing moves by itself.
	await page.waitForTimeout(1500);
	await expect(active(page)).toHaveAttribute('aria-label', /^State q1/);
	await expect(go(page)).toHaveText('Jalankan');
	await button(page, 'Langkah berikutnya').click();
	await expect(active(page)).toHaveAttribute('aria-label', /^State q2/);
});

test('the next-step button says why a string cannot run', async ({ page }) => {
	await openSandbox(page);
	await field(page).fill('012');
	await button(page, 'Langkah berikutnya').click();
	await expect(panel(page).getByText('Simbol "2" (posisi 3) tidak ada di alfabet.')).toBeVisible();
});

test('pressing Enter in the field runs it', async ({ page }) => {
	await openSandbox(page);
	await field(page).fill('01');
	await field(page).press('Enter');
	await expect(panel(page).getByText('Diterima', { exact: true })).toBeVisible({ timeout: 5000 });
});
