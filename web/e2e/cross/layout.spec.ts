// S9 in every engine: "Tata letak otomatis". The library is a worker that starts when it is used;
// the result is one step of the history. See docs/decisions/0026-auto-layout-with-dagre.md.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const menu = (page: Page) => page.getByRole('menu', { name: 'Menu' });
const item = (page: Page) => page.getByRole('menuitem', { name: 'Tata letak otomatis' });
const bar = (page: Page) => page.getByRole('button', { name: 'Tata letak otomatis' });
const nodes = (page: Page) => page.locator('svg.world g.node');

/** The place of each state in the world (the view is not part of the machine). */
const places = async (page: Page) =>
	(await nodes(page).evaluateAll((all) =>
		all.map((e) => {
			const circle = e.querySelector('circle.state')!;
			return {
				name: e.getAttribute('aria-label')!.split(',')[0]!,
				x: Number(circle.getAttribute('cx')),
				y: Number(circle.getAttribute('cy'))
			};
		})
	)) as { name: string; x: number; y: number }[];

async function openMenuOnEmptyCanvas(page: Page) {
	// A spot that no state or edge is near.
	await canvas(page).click({ button: 'right', position: { x: 16, y: 16 } });
	await expect(menu(page)).toBeVisible();
}

async function openNdfsm(page: Page) {
	await openSandbox(page, { example: false });
	await page
		.getByRole('region', { name: 'Coba contoh' })
		.getByRole('button', { name: /^Pilihan dengan transisi ε/ })
		.click();
	await expect(nodes(page)).toHaveCount(3);
}

test('the menu of the empty canvas offers it when there are states', async ({ page }) => {
	await openSandbox(page);
	await openMenuOnEmptyCanvas(page);
	await expect(item(page)).toBeVisible();
	await expect(menu(page).getByRole('menuitem', { name: 'Tambah state di sini' })).toBeVisible();
});

test('a machine with no state has no such item and no button', async ({ page }) => {
	await openSandbox(page, { example: false });
	await page
		.getByRole('region', { name: 'Coba contoh' })
		.getByRole('button', { name: 'Mulai dari kanvas kosong' })
		.click();
	await expect(bar(page)).toHaveCount(0);
	await openMenuOnEmptyCanvas(page);
	await expect(item(page)).toHaveCount(0);
	await expect(menu(page).getByRole('menuitem', { name: 'Tambah state di sini' })).toBeVisible();
});

test('a laptop has a button in the bar, a phone does not (it has the menu)', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	if (isMobile) await expect(bar(page)).toBeHidden();
	else await expect(bar(page)).toBeVisible();
});

test('it places the states left to right, the start state first, with room between them, and is one step to undo', async ({
	page
}) => {
	await openNdfsm(page);
	const before = await places(page);
	await openMenuOnEmptyCanvas(page);
	await item(page).click();
	// A message with Urungkan says it was done.
	const toast = page.getByRole('group', { name: 'Pesan' });
	await expect(toast).toContainText('Tata letak otomatis selesai.');
	await expect
		.poll(async () => JSON.stringify(await places(page)))
		.not.toBe(JSON.stringify(before));

	const after = await places(page);
	const start = after.find((s) => s.name === 'State q0')!;
	expect(Math.min(...after.map((s) => s.x))).toBe(start.x);
	for (const a of after) {
		for (const b of after) {
			if (a.name < b.name) {
				expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.name} and ${b.name}`).toBeGreaterThanOrEqual(
					72
				);
			}
		}
	}
	// One undo brings every state back to where it was.
	await toast.getByRole('button', { name: 'Urungkan' }).click();
	await expect.poll(async () => JSON.stringify(await places(page))).toBe(JSON.stringify(before));
});

test('the button of the bar does the same, and the machine is the same machine', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a laptop only');
	await openNdfsm(page);
	await page.getByRole('tab', { name: 'Definisi' }).click();
	const before = await page.getByRole('tabpanel', { name: 'Definisi' }).innerText();
	await bar(page).click();
	await expect(page.getByRole('group', { name: 'Pesan' })).toContainText(
		'Tata letak otomatis selesai.'
	);
	expect(await page.getByRole('tabpanel', { name: 'Definisi' }).innerText()).toBe(before);
});

test('pressing it twice gives the same places: the same machine, the same layout', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a laptop only');
	await openNdfsm(page);
	await bar(page).click();
	await expect(page.getByRole('group', { name: 'Pesan' })).toBeVisible();
	const first = await places(page);
	await bar(page).click();
	await expect.poll(async () => JSON.stringify(await places(page))).toBe(JSON.stringify(first));
});

test('the library is not loaded with the page: its worker is asked for when the layout is used', async ({
	page
}) => {
	const asked: string[] = [];
	page.on('request', (request) => {
		if (/layout\.worker/.test(request.url())) asked.push(request.url());
	});
	await openSandbox(page);
	await page.waitForTimeout(500);
	expect(asked).toEqual([]);
	await openMenuOnEmptyCanvas(page);
	await item(page).click();
	await expect(page.getByRole('group', { name: 'Pesan' })).toBeVisible();
	expect(asked.length).toBeGreaterThan(0);
});

test.describe('a layout that cannot be made', () => {
	test.use({ allowedProblem: /layout\.worker/ });

	test('says so calmly, changes nothing, and the editor goes on', async ({ page }) => {
		await page.route(/layout\.worker.*\.js/, (route) => route.abort());
		await openNdfsm(page);
		const before = await places(page);
		await openMenuOnEmptyCanvas(page);
		await item(page).click();
		await expect(
			page.getByText('Tata letak otomatis belum bisa dijalankan. Coba lagi.')
		).toBeVisible();
		expect(await places(page)).toEqual(before);
		await expect(page.getByRole('group', { name: 'Pesan' })).toHaveCount(0);
		// The editor still takes a state.
		await expect(async () => {
			await canvas(page).focus();
			await page.keyboard.press('n');
			expect(await nodes(page).count()).toBe(4);
		}).toPass();
	});
});

test('the menu with the new item passes axe', async ({ page }) => {
	await openSandbox(page);
	await openMenuOnEmptyCanvas(page);
	await expectNoAxeViolations(page);
});
