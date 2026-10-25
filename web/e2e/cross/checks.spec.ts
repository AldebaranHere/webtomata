// S6-1 in every engine: the engine (in its worker) checks the machine after each change, and the page
// shows the result calmly: a count, a list on request, a mark on the states that it is about.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const nodes = (page: Page) => page.locator('svg.world g.node');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const summary = (page: Page) => panel(page).getByRole('button', { name: /hal perlu dilihat/ });
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

test('a complete machine has nothing to look at, and no state is marked', async ({ page }) => {
	await openSandbox(page);
	await expect(panel(page).getByText('Mesin ini lengkap.')).toBeVisible();
	await expect(summary(page)).toHaveCount(0);
	await expect(page.locator('svg.world g.flag')).toHaveCount(0);
	await expectNoAxeViolations(page);
});

test('a state without transitions is found: a count, a list on request, a mark, and a press selects it', async ({
	page
}) => {
	await openSandbox(page);
	await expect(panel(page).getByText('Mesin ini lengkap')).toBeVisible();
	// The page is drawn before it takes keys: try until the new state is there.
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(4);
	}).toPass();

	// The new state has no transition for 0 and for 1, and cannot be reached: three things.
	await expect(summary(page)).toContainText('3 hal perlu dilihat');
	// Calm: the list is closed until it is asked for.
	await expect(summary(page)).toHaveAttribute('aria-expanded', 'false');
	await expect(panel(page).getByText('belum punya transisi')).toHaveCount(0);
	await expect(page.locator('svg.world g.flag')).toHaveCount(1);
	await expect(state(page, 'q3')).toHaveAttribute('aria-label', /ada hal yang perlu dilihat/);

	await summary(page).click();
	await expect(summary(page)).toHaveAttribute('aria-expanded', 'true');
	await expect(
		panel(page).getByText('State q3 belum punya transisi untuk simbol 0.')
	).toBeVisible();
	await expect(
		panel(page).getByText('State q3 tidak bisa dicapai dari start state.')
	).toBeVisible();
	await expectNoAxeViolations(page);

	// Select another state, then press the check: the state that it is about is selected and focused.
	await state(page, 'q0').click();
	await panel(page)
		.getByRole('button', { name: /State q3 belum punya transisi untuk simbol 0/ })
		.click();
	await expect(state(page, 'q3')).toHaveAttribute('aria-pressed', 'true');
	await expect(state(page, 'q3')).toBeFocused();

	// The machine is edited and the answer follows: delete the new state, and it is complete again.
	await page.keyboard.press('Delete');
	await expect(panel(page).getByText('Mesin ini lengkap')).toBeVisible();
	await expect(page.locator('svg.world g.flag')).toHaveCount(0);
});

test('without a start state: one error that says what to do', async ({ page, isMobile }) => {
	await openSandbox(page);
	await expect(panel(page).getByText('Mesin ini lengkap')).toBeVisible();
	if (isMobile) await state(page, 'q0').tap();
	else await state(page, 'q0').click();
	await page.keyboard.press('m');
	await expect(summary(page)).toContainText('1 hal perlu dilihat');
	await summary(page).click();
	await expect(
		panel(page).getByText('Belum ada start state. Pilih satu state, lalu tekan M.')
	).toBeVisible();
});
