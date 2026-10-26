// S7-1, the tab "Konversi": the list of operations (with the reason when one does not fit), the
// player that steps through the trace of the engine, and the result that opens as a new machine.
// Chrome only (desktop and phone); the engines of the other browsers run the same page code.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchTap } from './touch.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page) => panel(page).getByRole('tab', { name: 'Konversi' });
// The row of an operation, found by its name (a reason in another row may mention "NDFSM → DFSM").
const operation = (page: Page, name: string) =>
	panel(page)
		.locator('li')
		.filter({ has: page.locator('.name').getByText(name, { exact: true }) });
const sentence = (page: Page) => panel(page).locator('.sentence');
const shown = (page: Page) => page.locator('.conversion-canvas');
const button = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true });

/** The example with ε-transitions, an NDFSM, opened from "Coba contoh". */
async function openNdfsm(page: Page) {
	await openSandbox(page, { example: false });
	await page.getByRole('button', { name: /^Pilihan dengan transisi ε/ }).click();
	await expect(page.getByRole('button', { name: /^Pilihan dengan/ })).toHaveCount(0);
	await tab(page).click();
}

async function openDfsm(page: Page) {
	await openSandbox(page);
	await tab(page).click();
}

test('the list says why an operation does not fit, and keeps it visible', async ({ page }) => {
	await openDfsm(page);
	const determinize = operation(page, 'NDFSM → DFSM');
	await expect(determinize).toContainText('Mesin ini sudah DFSM.');
	await expect(determinize.getByRole('button')).toBeDisabled();
	await expect(operation(page, 'Minimalkan DFSM').getByRole('button')).toBeEnabled();
	await expect(operation(page, 'Tambah dead state').getByRole('button')).toBeEnabled();
});

test('an NDFSM cannot be minimized, and the list says so', async ({ page }) => {
	await openNdfsm(page);
	await expect(operation(page, 'NDFSM → DFSM').getByRole('button')).toBeEnabled();
	await expect(operation(page, 'Minimalkan DFSM')).toContainText('Hanya untuk DFSM.');
	await expect(operation(page, 'Minimalkan DFSM').getByRole('button')).toBeDisabled();
});

test('NDFSM → DFSM steps through the trace, shows the result on the canvas, and opens it as a new machine', async ({
	page
}) => {
	await openNdfsm(page);
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByRole('heading', { name: 'NDFSM → DFSM' })).toBeFocused();
	await expect(panel(page).getByText(/^Langkah 1 dari \d+$/)).toBeVisible();
	// The first steps are the ε-closures, and the picture is still the machine we started from.
	await expect(sentence(page)).toContainText('ε-closure');
	await expect(shown(page)).toBeVisible();
	await expect(button(page, 'Mundur')).toBeDisabled();
	await expect(panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' })).toHaveCount(0);

	await button(page, 'Maju').click();
	await expect(panel(page).getByText(/^Langkah 2 dari \d+$/)).toBeVisible();
	await button(page, 'Mundur').click();
	await expect(panel(page).getByText(/^Langkah 1 dari \d+$/)).toBeVisible();

	await button(page, 'Ke hasil').click();
	await expect(button(page, 'Maju')).toBeDisabled();
	await expect(panel(page).getByRole('table', { name: 'Tabel transisi hasil' })).toBeVisible();
	await expect(
		shown(page).getByRole('img', { name: /^Konversi: DFSM dengan \d+ state$/ })
	).toBeVisible();

	// The source can be looked at, and the result comes back.
	await button(page, 'Sumber').click();
	await expect(
		shown(page).getByRole('img', { name: /^Konversi: NDFSM dengan 3 state$/ })
	).toBeVisible();
	await button(page, 'Hasil').click();

	await panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' }).click();
	await expect(page.locator('.bar .title')).toHaveText('DFSM dari Pilihan dengan transisi ε');
	await expect(shown(page)).toHaveCount(0);
	// The first machine is still in the list, unchanged.
	await page.getByRole('button', { name: /^Mesin saya \(2\)/ }).click();
	await expect(
		page.getByRole('dialog').getByText('Pilihan dengan transisi ε', { exact: true })
	).toBeVisible();
});

test('minimize and the dead state each step to their end', async ({ page }) => {
	await openDfsm(page);
	await operation(page, 'Minimalkan DFSM').getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByRole('heading', { name: 'Minimalkan DFSM' })).toBeFocused();
	await button(page, 'Ke hasil').click();
	await expect(sentence(page)).toContainText('accepting state');
	await panel(page).getByRole('button', { name: 'Tutup' }).click();
	await expect(shown(page)).toHaveCount(0);

	// The example is complete, so the trace is one step that says so, and the end is the start.
	await operation(page, 'Tambah dead state').getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByText('Langkah 1 dari 1')).toBeVisible();
	await expect(sentence(page)).toContainText('sudah lengkap');
	await expect(button(page, 'Ke hasil')).toBeDisabled();
	await expect(panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' })).toBeVisible();
});

test('Putar plays the steps one after the other, and Jeda stops', async ({ page }) => {
	await openNdfsm(page);
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	await button(page, 'Putar').click();
	await expect(button(page, 'Jeda')).toBeVisible();
	await expect(panel(page).getByText(/^Langkah [2-9]\d* dari/)).toBeVisible();
	await button(page, 'Jeda').click();
	await expect(button(page, 'Putar')).toBeVisible();
});

test('a change of the machine closes the steps, and another tab keeps them', async ({ page }) => {
	await openNdfsm(page);
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	await expect(shown(page)).toBeVisible();
	// Another tab shows the editor; coming back finds the same step.
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await expect(shown(page)).toHaveCount(0);
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await expect(shown(page)).toBeVisible();
	await expect(panel(page).getByText(/^Langkah 1 dari/)).toBeVisible();
	// A change of the machine makes the steps old.
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await expect(
		operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' })
	).toBeVisible();
	await expect(shown(page)).toHaveCount(0);
});

test('every target is at least 44 px, and the tabs fit the panel', async ({ page }) => {
	await openNdfsm(page);
	for (const target of [
		tab(page),
		operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' })
	]) {
		const box = (await target.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
	}
	await expect(tab(page)).toBeInViewport();
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	for (const name of [
		'Ke awal',
		'Mundur',
		'Putar',
		'Maju',
		'Ke hasil',
		'Tutup',
		'Hasil',
		'Sumber'
	]) {
		const box = (await button(page, name).boundingBox())!;
		expect(box.height, name).toBeGreaterThanOrEqual(44);
		expect(box.width, name).toBeGreaterThanOrEqual(44);
	}
});

test('a finger starts a conversion and steps through it', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openNdfsm(page);
	await touchTap(page, operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }));
	await expect(panel(page).getByText(/^Langkah 1 dari/)).toBeVisible();
	await touchTap(page, button(page, 'Maju'));
	await expect(panel(page).getByText(/^Langkah 2 dari/)).toBeVisible();
	await touchTap(page, button(page, 'Ke hasil'));
	await expect(panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' })).toBeVisible();
});

test('axe finds nothing in the list or in the player, at the start and at the end', async ({
	page
}) => {
	await openNdfsm(page);
	await expectNoAxeViolations(page);
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	await expectNoAxeViolations(page);
	await button(page, 'Ke hasil').click();
	await expectNoAxeViolations(page);
	await button(page, 'Sumber').click();
	await expectNoAxeViolations(page);
});
