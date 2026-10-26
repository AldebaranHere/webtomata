// X1 in every engine: the first run ("Coba contoh" over an empty machine), the examples that open
// in one click, and the one-minute tour. See docs/decisions/0025-examples-and-first-run.md.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { records } from './db.ts';

const nodes = (page: Page) => page.locator('svg.world g.node');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const card = (page: Page) => page.getByRole('region', { name: 'Coba contoh' });
const example = (page: Page, name: string | RegExp) => card(page).getByRole('button', { name });
const tourLink = (page: Page) => card(page).getByRole('button', { name: /^Tur 1 menit/ });
const tour = (page: Page) => page.getByRole('dialog', { name: 'Tur 1 menit' });
const help = (page: Page) => page.getByRole('button', { name: /^Bantuan/ });
const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());
const status = (page: Page) => page.locator('.save');
const savedTests = async (page: Page) =>
	((await records(page))[0] as { tests?: string[] } | undefined)?.tests ?? [];

test('the first visit shows Coba contoh over an empty machine, and saves that empty machine', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await expect(card(page)).toBeVisible();
	await expect(card(page).getByRole('heading', { name: 'Coba contoh' })).toBeVisible();
	await expect(card(page).getByRole('listitem')).toHaveCount(3);
	await expect(example(page, /^Berakhiran 01/)).toContainText('Menerima string yang diakhiri 01.');
	await expect(example(page, /^Berakhiran 01/)).toContainText('DFSM');
	await expect(example(page, /^Pilihan dengan transisi ε/)).toContainText('NDFSM');
	await expect(
		card(page).getByText('Tersimpan di perangkat ini. Tanpa akun, tanpa pelacakan.')
	).toBeVisible();
	await expect(tourLink(page)).toBeVisible();
	await expect(nodes(page)).toHaveCount(0);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	expect(JSON.parse((await records(page))[0]!.doc).states).toEqual([]);
	await expectNoAxeViolations(page);
});

for (const [name, states, strings, kind, title] of [
	['Berakhiran 01', 3, 5, 'dfsm', 'Berakhiran 01'],
	['Jumlah a genap', 2, 6, 'dfsm', 'Jumlah a genap'],
	['Pilihan dengan transisi ε', 3, 5, 'ndfsm', 'Pilihan dengan transisi ε']
] as const) {
	test(`one click opens "${name}" in the place of the empty machine, and it is still there after a reload`, async ({
		page
	}) => {
		await openSandbox(page, { example: false });
		await example(page, new RegExp(`^${name}`)).click();
		await expect(card(page)).toHaveCount(0);
		await expect(nodes(page)).toHaveCount(states);
		await expect(page.locator('.editor .title')).toHaveText(title);
		// The example comes with strings to test, and their results.
		await expect(page.locator('.tests li')).toHaveCount(strings);
		await expect(page.locator('.tests li .badge')).not.toContainText(['Memeriksa…']);
		await expect(status(page)).toHaveClass(/saved/);
		await expect.poll(async () => (await records(page)).length).toBe(1);
		const [saved] = await records(page);
		expect(saved).toMatchObject({ title, kind });
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		await expect(card(page)).toHaveCount(0);
		await expect(nodes(page)).toHaveCount(states);
		await expect(page.locator('.tests li')).toHaveCount(strings);
	});
}

test('the results of an example agree with what it says: accepted strings are accepted', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await example(page, /^Pilihan dengan transisi ε/).click();
	const results = page.locator('.tests li');
	await expect(results).toHaveCount(5);
	await expect(results.filter({ hasText: 'aaa' }).locator('.badge')).toHaveText('Diterima');
	await expect(results.filter({ hasText: 'ab' }).locator('.badge')).toHaveText('Ditolak');
	await expect(results.filter({ hasText: 'ε' }).locator('.badge')).toHaveText('Diterima');
});

test('"Mulai dari kanvas kosong" takes the card away and the canvas takes a state', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await card(page).getByRole('button', { name: 'Mulai dari kanvas kosong' }).click();
	await expect(card(page)).toHaveCount(0);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(1);
	}).toPass();
});

test('a state added with the keyboard makes the card go away by itself', async ({ page }) => {
	await openSandbox(page, { example: false });
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(1);
	}).toPass();
	await expect(card(page)).toHaveCount(0);
});

test('an example never overwrites work: from a new machine it is put in that machine, and the first stays', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await expect(nodes(page)).toHaveCount(3);
	await expect(status(page).first()).toHaveClass(/saved/);
	await press(page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ }), isMobile);
	const dialog = page.getByRole('dialog', { name: 'Mesin saya' });
	await press(dialog.getByRole('button', { name: 'Mesin baru' }), isMobile);
	await expect(card(page)).toBeVisible();
	await expect(nodes(page)).toHaveCount(0);
	await example(page, /^Jumlah a genap/).click();
	await expect(nodes(page)).toHaveCount(2);
	await expect(status(page).first()).toHaveClass(/saved/);
	// Two machines, not three: the empty one was filled, and the first one is as it was.
	await expect.poll(async () => (await records(page)).length).toBe(2);
	const titles = (await records(page)).map((r) => r.title).sort();
	expect(titles).toEqual(['Berakhiran 01', 'Jumlah a genap']);
});

test('the tour: five steps, back and next, and it is seen when it is closed', async ({ page }) => {
	await openSandbox(page, { example: false });
	await tourLink(page).click();
	await expect(tour(page)).toBeVisible();
	await expect(tour(page).getByText('Langkah 1 dari 5')).toBeVisible();
	await expect(tour(page).getByRole('heading', { name: 'Tambah state' })).toBeVisible();
	await expect(tour(page).getByRole('button', { name: 'Kembali' })).toHaveCount(0);
	await tour(page).getByRole('button', { name: 'Berikutnya' }).click();
	await expect(
		tour(page).getByRole('heading', { name: 'Hubungkan dengan transisi' })
	).toBeVisible();
	await tour(page).getByRole('button', { name: 'Kembali' }).click();
	await expect(tour(page).getByText('Langkah 1 dari 5')).toBeVisible();
	for (let i = 0; i < 4; i++) await tour(page).getByRole('button', { name: 'Berikutnya' }).click();
	await expect(tour(page).getByText('Langkah 5 dari 5')).toBeVisible();
	await expect(tour(page).getByRole('button', { name: 'Berikutnya' })).toHaveCount(0);
	await expectNoAxeViolations(page);
	await tour(page).getByRole('button', { name: 'Selesai' }).click();
	await expect(tour(page)).toHaveCount(0);
	// Seen: the card does not offer it any more, also after a reload.
	await expect(tourLink(page)).toHaveCount(0);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(card(page)).toBeVisible();
	await expect(tourLink(page)).toHaveCount(0);
});

test('the tour is skipped with Lewati, and with Esc, and both count as seen', async ({ page }) => {
	await openSandbox(page, { example: false });
	await tourLink(page).click();
	await tour(page).getByRole('button', { name: 'Lewati' }).click();
	await expect(tour(page)).toHaveCount(0);
	await expect(tourLink(page)).toHaveCount(0);
	// Another visitor on a clean device: Esc.
	await page.evaluate(() => localStorage.removeItem('webtomata.tour'));
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await tourLink(page).click();
	await expect(tour(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(tour(page)).toHaveCount(0);
	await expect(tourLink(page)).toHaveCount(0);
});

test('the ? button opens the tour at any time, also after the tour was seen, and the tour links to Panduan', async ({
	page
}) => {
	await openSandbox(page, { tests: 'keep' });
	await help(page).click();
	await expect(tour(page)).toBeVisible();
	await tour(page).getByRole('button', { name: 'Lewati' }).click();
	await expect(tour(page)).toHaveCount(0);
	await help(page).click();
	await expect(tour(page)).toBeVisible();
	await expect(tour(page).getByRole('link', { name: 'Buka Panduan' })).toHaveAttribute(
		'href',
		/\/panduan\/?$/
	);
});

test('the run field ignores a space at the ends of the string', async ({ page }) => {
	await openSandbox(page);
	await page.getByRole('complementary', { name: 'Panel' }).getByLabel('String masukan').fill('01 ');
	await page
		.getByRole('complementary', { name: 'Panel' })
		.getByRole('button', { name: 'Langkah berikutnya' })
		.click();
	await expect(
		page
			.getByRole('complementary', { name: 'Panel' })
			.getByRole('list', { name: 'Simbol yang dibaca' })
			.getByRole('listitem')
	).toHaveText(['0', '1']);
});

test('the example test strings are saved as the record of the machine', async ({ page }) => {
	await openSandbox(page, { example: false });
	await example(page, /^Berakhiran 01/).click();
	await expect(status(page)).toHaveClass(/saved/);
	await expect.poll(() => savedTests(page)).toEqual(['01', '', '101', '0', '10']);
});

test('a student who deletes every state is working: the card does not come back', async ({
	page
}) => {
	await openSandbox(page);
	await expect(nodes(page)).toHaveCount(3);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		expect(await nodes(page).count()).toBe(0);
	}).toPass();
	await expect(card(page)).toHaveCount(0);
	// After a reload the machine is still empty, and the card is offered again: it is a new visit.
	await expect(status(page)).toHaveClass(/saved/);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(card(page)).toBeVisible();
});

// What each step of the tour shows: the controls as pictures, with the names and keys of the real
// buttons (they are read from the same list), and where to find them.
const STEPS = [
	['Tambah state', ['Tambah state', 'S']],
	['Hubungkan dengan transisi', ['Tambah transisi', 'T']],
	[
		'Tandai start dan accepting',
		['Pilih', 'V', 'M', 'Jadikan start state', 'Klik dua kali', 'Jadikan accepting']
	],
	['Jalankan satu string', ['Jalankan', 'Langkah berikutnya']],
	['Uji banyak string', ['Tambah string', 'Tambah']]
] as const;

test('every step of the tour draws the control that it is about, with the name of the real button', async ({
	page,
	isMobile
}) => {
	// Each step has a scan of axe, which takes a few seconds on a busy runner: the default 30 s is too short.
	test.setTimeout(90_000);
	await openSandbox(page, { example: false });
	// The names of the real tools, before the dialog makes the page inert.
	const rail = page.getByRole('toolbar', { name: 'Alat editor' });
	for (const name of ['Tambah state', 'Tambah transisi', 'Pilih']) {
		await expect(rail.getByRole('button', { name })).toHaveCount(1);
	}
	await tourLink(page).click();
	for (const [index, [title, shown]] of STEPS.entries()) {
		await expect(tour(page).getByRole('heading', { name: title })).toBeVisible();
		const pictures = tour(page).locator('.shows');
		await expect(pictures).toBeVisible();
		for (const text of shown) await expect(pictures).toContainText(text);
		// Where to find them: the words follow the layout.
		const where = index < 3 ? 'bilah alat' : 'panel Simulasi';
		const place = isMobile
			? index < 3
				? 'di bagian bawah layar'
				: 'di bawah kanvas'
			: index < 3
				? 'di kiri kanvas'
				: 'di kanan kanvas';
		await expect(tour(page).getByText(`Ada di ${where}, ${place}.`)).toBeVisible();
		await expectNoAxeViolations(page);
		if (index < STEPS.length - 1)
			await tour(page).getByRole('button', { name: 'Berikutnya' }).click();
	}
});

for (const width of [320, 375, 412]) {
	test(`the tour fits a screen ${width} px wide: the pictures, the words and the buttons are all reachable`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 640 });
		await openSandbox(page, { example: false });
		await tourLink(page).click();
		for (let index = 0; index < STEPS.length; index++) {
			const box = (await tour(page).boundingBox())!;
			expect(box.x, `step ${index + 1}`).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
			expect(box.y + box.height).toBeLessThanOrEqual(640);
			const next = tour(page).getByRole('button', {
				name: index < STEPS.length - 1 ? 'Berikutnya' : 'Selesai'
			});
			await expect(next).toBeInViewport();
			expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
			// Nothing in the pictures is cut off sideways.
			const overflow = await tour(page)
				.locator('.shows')
				.evaluate((e) => e.scrollWidth - e.clientWidth);
			expect(overflow).toBeLessThanOrEqual(0);
			if (index < STEPS.length - 1) await next.click();
		}
	});
}

// Nothing to run, test or copy exists before a machine is chosen: the panel waits for one.
const sidePanel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });

test('while Coba contoh is up there is no panel, and an example brings it', async ({ page }) => {
	await openSandbox(page, { example: false });
	await expect(card(page)).toBeVisible();
	await expect(sidePanel(page)).toHaveCount(0);
	await expect(page.getByRole('tab')).toHaveCount(0);
	await example(page, /^Berakhiran 01/).click();
	await expect(sidePanel(page)).toBeVisible();
	await expect(sidePanel(page).getByRole('tab')).toHaveCount(4);
});

test('"Mulai dari kanvas kosong" brings the panel', async ({ page }) => {
	await openSandbox(page, { example: false });
	await expect(sidePanel(page)).toHaveCount(0);
	await card(page).getByRole('button', { name: 'Mulai dari kanvas kosong' }).click();
	await expect(sidePanel(page)).toBeVisible();
});

test('a state added with the keyboard brings the panel too', async ({ page }) => {
	await openSandbox(page, { example: false });
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(1);
	}).toPass();
	await expect(sidePanel(page)).toBeVisible();
});

test('a machine that has no state has nothing to copy: Definisi says so, with no Salin', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await card(page).getByRole('button', { name: 'Mulai dari kanvas kosong' }).click();
	await sidePanel(page).getByRole('tab', { name: 'Definisi' }).click();
	const pane = sidePanel(page).getByRole('tabpanel', { name: 'Definisi' });
	await expect(pane.getByText('Belum ada state untuk didefinisikan.')).toBeVisible();
	await expect(pane.getByRole('button', { name: 'Salin' })).toHaveCount(0);
	await expect(pane.getByText('M = (K, Σ, δ, s, A)', { exact: true })).toHaveCount(0);
	// The first state brings the definition.
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(1);
	}).toPass();
	await expect(pane.getByRole('button', { name: 'Salin' })).toBeVisible();
});
