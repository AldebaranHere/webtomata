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
	await expect(button(page, 'Minimalkan')).toBeVisible();
	await button(page, 'Ke hasil').click();
	await expect(sentence(page)).toContainText('accepting state');
	await panel(page).getByRole('button', { name: 'Tutup' }).click();
	await expect(shown(page)).toHaveCount(0);

	// The example is complete, so the trace is one step that says so, and the end is the start.
	await operation(page, 'Tambah dead state').getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByText('Langkah 1 dari 1')).toBeVisible();
	await expect(button(page, 'Lengkapi')).toBeVisible();
	await expect(sentence(page)).toContainText('sudah lengkap');
	await expect(button(page, 'Ke hasil')).toBeDisabled();
	await expect(panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' })).toBeVisible();
});

test('the play button, named for the operation, plays the steps one after the other, and Jeda stops', async ({
	page
}) => {
	await openNdfsm(page);
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	await button(page, 'Konversi').click();
	await expect(button(page, 'Jeda')).toBeVisible();
	await expect(panel(page).getByText(/^Langkah [2-9]\d* dari/)).toBeVisible();
	await button(page, 'Jeda').click();
	await expect(button(page, 'Konversi')).toBeVisible();
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
		'Konversi',
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

test('complement flips the accepting states step by step, and opens as a new machine', async ({
	page
}) => {
	await openDfsm(page);
	await operation(page, 'Komplemen').getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByText('Langkah 1 dari 3')).toBeVisible();
	await expect(sentence(page)).toContainText('accepting state');
	await expect(button(page, 'Komplemen')).toBeVisible();
	await button(page, 'Ke hasil').click();
	const table = panel(page).getByRole('table', { name: 'Tabel transisi hasil' });
	await expect(table.getByRole('columnheader', { name: 'Terima' })).toBeVisible();
	// "Berakhiran 01" accepts at q2 only, so the complement accepts at q0 and q1.
	await expect(table.getByRole('row', { name: /^q0 .*✓/ })).toBeVisible();
	await expect(table.getByRole('row', { name: /^q2 .*✓/ })).toHaveCount(0);
	await panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' }).click();
	await expect(page.locator('.bar .title')).toHaveText('Komplemen dari Berakhiran 01');
});

test('complement says why it does not fit an NDFSM', async ({ page }) => {
	await openNdfsm(page);
	await expect(operation(page, 'Komplemen')).toContainText('Hanya untuk DFSM.');
	await expect(operation(page, 'Komplemen').getByRole('button')).toBeDisabled();
});

test('union needs a second machine, takes it from the list, and opens the result', async ({
	page
}) => {
	await openDfsm(page);
	const row = operation(page, 'Gabungan');
	await expect(row).toContainText('Simpan atau buat mesin lain dulu');
	await expect(row.getByRole('button')).toBeDisabled();

	// A copy of the machine is a second machine with the same alphabet.
	await page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await list.getByRole('button', { name: 'Tindakan untuk Berakhiran 01' }).click();
	await list.getByRole('button', { name: 'Duplikat' }).click();
	await expect(list.getByText('Berakhiran 01 (salinan)', { exact: true })).toBeVisible();
	await list.getByRole('button', { name: 'Tutup' }).click();

	await expect(row.getByRole('button')).toBeDisabled();
	await expectNoAxeViolations(page);
	const pick = row.getByRole('combobox', { name: 'Gabungkan dengan' });
	await pick.selectOption({ label: 'Berakhiran 01 (salinan) · DFSM' });
	await expect(row.getByRole('button')).toBeEnabled();
	await row.getByRole('button', { name: 'Mulai' }).click();

	await expect(panel(page).getByText('Langkah 1 dari 5')).toBeVisible();
	await expect(button(page, 'Gabungkan')).toBeVisible();
	await expect(sentence(page)).toContainText('Salin mesin pertama');
	await button(page, 'Maju').click();
	await expect(sentence(page)).toContainText('Salin mesin kedua');
	// Looking at the source shows the machine that the step copies.
	await button(page, 'Sumber').click();
	await expect(
		shown(page).getByRole('img', { name: /^Konversi: DFSM dengan 3 state$/ })
	).toBeVisible();
	await button(page, 'Hasil').click();
	await button(page, 'Ke hasil').click();
	await panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' }).click();
	await expect(page.locator('.bar .title')).toHaveText(
		'Gabungan Berakhiran 01 dan Berakhiran 01 (salinan)'
	);
	await expect(page.locator('.bar .count')).toHaveText('7 state');
});

test('"Konversi selesai!" shows for two seconds when the last step is reached, and again after a step back', async ({
	page
}) => {
	await openNdfsm(page);
	await operation(page, 'NDFSM → DFSM').getByRole('button', { name: 'Mulai' }).click();
	const done = panel(page).getByText('Konversi selesai!');
	await expect(panel(page).getByText(/^Langkah 1 dari/)).toBeVisible();
	await expect(done).toHaveCount(0);
	await button(page, 'Ke hasil').click();
	await expect(done).toBeVisible();
	// It goes by itself, after about two seconds.
	await expect(done).toHaveCount(0, { timeout: 4000 });
	// A step back and forward reaches the end again.
	await button(page, 'Mundur').click();
	await expect(done).toHaveCount(0);
	await button(page, 'Maju').click();
	await expect(done).toBeVisible();
});

/** Duplicates the open machine in "Mesin saya", so that there is a second machine of the same alphabet. */
async function addCopy(page: Page, title: string) {
	await page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await list.getByRole('button', { name: `Tindakan untuk ${title}` }).click();
	await list.getByRole('button', { name: 'Duplikat' }).click();
	await expect(list.getByText(`${title} (salinan)`, { exact: true })).toBeVisible();
	await list.getByRole('button', { name: 'Tutup' }).click();
}

const stageLine = (page: Page) => panel(page).locator('.stage');
const chip = (page: Page, n: number) =>
	panel(page)
		.getByRole('list', { name: 'Tahap' })
		.getByRole('button', { name: new RegExp(`^Tahap ${n}[: ]`) });

test('intersection of an NDFSM with a copy of itself goes through all seven stages, with chips that jump', async ({
	page
}) => {
	await openNdfsm(page);
	await addCopy(page, 'Pilihan dengan transisi ε');
	const row = operation(page, 'Irisan');
	await row
		.getByRole('combobox', { name: 'Irisan dengan' })
		.selectOption({ label: 'Pilihan dengan transisi ε (salinan) · NDFSM' });
	await row.getByRole('button', { name: 'Mulai' }).click();

	await expect(stageLine(page)).toHaveText('Tahap 1 dari 7 · Lengkapi mesin pertama menjadi DFSM');
	await expect(panel(page).getByText(/^Langkah 1 dari \d+ di tahap ini$/)).toBeVisible();
	await expect(button(page, 'Irisan')).toBeVisible();
	for (let n = 1; n <= 7; n++) await expect(chip(page, n)).toBeEnabled();
	await expect(chip(page, 1)).toHaveAttribute('aria-current', 'step');

	// A chip jumps to the start of its stage, and the canvas shows the machine of that stage.
	await chip(page, 5).click();
	await expect(stageLine(page)).toHaveText('Tahap 5 dari 7 · Gabungan kedua komplemen');
	await expect(panel(page).getByText(/^Langkah 1 dari 5 di tahap ini$/)).toBeVisible();
	await expect(sentence(page)).toContainText('Salin mesin pertama');
	await expect(shown(page)).toBeVisible();

	await button(page, 'Ke hasil').click();
	await expect(stageLine(page)).toHaveText(
		'Tahap 7 dari 7 · Komplemen hasil gabungan: inilah irisannya'
	);
	await expect(panel(page).getByText('Konversi selesai!')).toBeVisible();
	await panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' }).click();
	await expect(page.locator('.bar .title')).toHaveText(
		'Irisan Pilihan dengan transisi ε dan Pilihan dengan transisi ε (salinan)'
	);
});

test('a stage that has nothing to do is shown greyed, with the reason, and the player starts at stage 2', async ({
	page
}) => {
	await openDfsm(page);
	await addCopy(page, 'Berakhiran 01');
	const row = operation(page, 'Irisan');
	await row
		.getByRole('combobox', { name: 'Irisan dengan' })
		.selectOption({ label: 'Berakhiran 01 (salinan) · DFSM' });
	await row.getByRole('button', { name: 'Mulai' }).click();
	// "Berakhiran 01" is a complete DFSM, so the two "make complete" stages before the union are skipped.
	await expect(stageLine(page)).toHaveText('Tahap 2 dari 7 · Komplemen mesin pertama');
	await expect(chip(page, 1)).toBeDisabled();
	await expect(chip(page, 1)).toHaveAccessibleName(
		/^Tahap 1 dilewati: .*Tidak ada yang perlu dikerjakan\.$/
	);
	await expect(chip(page, 3)).toBeDisabled();
	await expect(chip(page, 6)).toBeEnabled();
	await expectNoAxeViolations(page);
	// Play goes on across the stages, and the last step is the end of stage 7.
	await button(page, 'Ke hasil').click();
	await expect(stageLine(page)).toContainText('Tahap 7 dari 7');
	await expectNoAxeViolations(page);
});

test('XOR of a machine with a copy of itself accepts nothing, and says that the machines are equivalent', async ({
	page
}) => {
	await openDfsm(page);
	await addCopy(page, 'Berakhiran 01');
	const row = operation(page, 'XOR');
	await expect(row).toContainText('Selisih simetris');
	await row
		.getByRole('combobox', { name: 'XOR dengan' })
		.selectOption({ label: 'Berakhiran 01 (salinan) · DFSM' });
	await row.getByRole('button', { name: 'Mulai' }).click();
	// "Berakhiran 01" is a complete DFSM: stages 1 and 2 are skipped, and the product is stage 3 of 3.
	await expect(stageLine(page)).toHaveText(
		'Tahap 3 dari 3 · Mesin produk: pasangan state kedua mesin'
	);
	await expect(chip(page, 1)).toBeDisabled();
	await expect(chip(page, 2)).toBeDisabled();
	await expect(chip(page, 3)).toBeEnabled();
	await expect(button(page, 'XOR')).toBeVisible();
	await expect(sentence(page)).toContainText('pasangan state');
	await expect(panel(page).getByText('Hasilnya tidak menerima string apa pun')).toHaveCount(0);
	await expectNoAxeViolations(page);
	await button(page, 'Ke hasil').click();
	await expect(
		panel(page).getByText('Hasilnya tidak menerima string apa pun: kedua mesin ekuivalen.')
	).toBeVisible();
	await expect(panel(page).getByText('Konversi selesai!')).toBeVisible();
	const table = panel(page).getByRole('table', { name: 'Tabel transisi hasil' });
	// The states of the product are pairs, and none of them accepts.
	await expect(table.getByRole('rowheader').first()).toHaveText('(q0, q0)');
	await expect(table.getByText('✓')).toHaveCount(0);
	await expectNoAxeViolations(page);
	await panel(page).getByRole('button', { name: 'Buka sebagai mesin baru' }).click();
	await expect(page.locator('.bar .title')).toHaveText(
		'XOR Berakhiran 01 dan Berakhiran 01 (salinan)'
	);
});

test('XOR of an NDFSM with a copy of itself has three stages, and the product ends the plan', async ({
	page
}) => {
	await openNdfsm(page);
	await addCopy(page, 'Pilihan dengan transisi ε');
	const row = operation(page, 'XOR');
	await row
		.getByRole('combobox', { name: 'XOR dengan' })
		.selectOption({ label: 'Pilihan dengan transisi ε (salinan) · NDFSM' });
	await row.getByRole('button', { name: 'Mulai' }).click();
	await expect(stageLine(page)).toHaveText('Tahap 1 dari 3 · Lengkapi mesin pertama menjadi DFSM');
	for (let n = 1; n <= 3; n++) await expect(chip(page, n)).toBeEnabled();
	await chip(page, 3).click();
	await expect(stageLine(page)).toHaveText(
		'Tahap 3 dari 3 · Mesin produk: pasangan state kedua mesin'
	);
	await expect(sentence(page)).toContainText('mesin pertama');
	await button(page, 'Ke hasil').click();
	await expect(stageLine(page)).toContainText('Tahap 3 dari 3');
	await expect(panel(page).getByText('kedua mesin ekuivalen')).toBeVisible();
});

test('every chip of the stages is at least 44 px, and the chips do not run out of the panel', async ({
	page
}) => {
	await openNdfsm(page);
	await addCopy(page, 'Pilihan dengan transisi ε');
	const row = operation(page, 'Irisan');
	await row
		.getByRole('combobox', { name: 'Irisan dengan' })
		.selectOption({ label: 'Pilihan dengan transisi ε (salinan) · NDFSM' });
	await row.getByRole('button', { name: 'Mulai' }).click();
	const box = (await panel(page).boundingBox())!;
	for (let n = 1; n <= 7; n++) {
		const b = (await chip(page, n).boundingBox())!;
		expect(b.width, `chip ${n}`).toBeGreaterThanOrEqual(44);
		expect(b.height, `chip ${n}`).toBeGreaterThanOrEqual(44);
		expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
	}
});

test('a conversion with one step says it is done at once', async ({ page }) => {
	await openDfsm(page);
	await operation(page, 'Tambah dead state').getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByText('Konversi selesai!')).toBeVisible();
});

test('Mesin → regex steps through the elimination, lights the state, and ends at the expression', async ({
	page
}) => {
	await openDfsm(page);
	const row = operation(page, 'Mesin → regex');
	await expect(row).toContainText('Cari ekspresi reguler');
	await row.getByRole('button', { name: 'Mulai' }).click();
	await expect(panel(page).getByRole('heading', { name: 'Mesin → regex' })).toBeFocused();
	await expect(panel(page).getByText(/^Langkah 1 dari \d+$/)).toBeVisible();
	await expect(shown(page)).toBeVisible();
	// No expression and no result machine before the end.
	await expect(panel(page).getByRole('region', { name: 'Ekspresi reguler' })).toHaveCount(0);
	await expect(button(page, 'Buka sebagai mesin baru')).toHaveCount(0);
	// The steps go on until the table of labels, and then a state is removed at each step.
	await expect(sentence(page)).toContainText('start state baru');
	await button(page, 'Maju').click();
	await button(page, 'Maju').click();
	await expect(sentence(page)).toContainText('Satu label untuk setiap pasangan state');
	const table = panel(page).getByRole('table', { name: 'Label: ekspresi untuk jalur antar state' });
	await expect(table.getByRole('columnheader')).toHaveText(['Dari', 'Ke', 'Label']);
	await button(page, 'Maju').click();
	await expect(sentence(page)).toContainText('Hapus state');
	await expect(table.locator('tr.hot').first()).toBeVisible();
	await expectNoAxeViolations(page);
	await button(page, 'Ke hasil').click();
	await expect(panel(page).getByText('Konversi selesai!')).toBeVisible();
	const result = panel(page).getByRole('region', { name: 'Ekspresi reguler' });
	await expect(result).toBeVisible();
	// The engine's expression for "Berakhiran 01" (the strings that end with 01), in Rich's notation.
	await expect(result).toHaveText('(1∪0(0∪10)*11)*0(0∪10)*1');
	await expect(table.getByRole('row')).toHaveCount(2);
	await expectNoAxeViolations(page);
});

test('Mesin → regex copies the expression', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'only Chrome lets a test grant the clipboard');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openDfsm(page);
	await operation(page, 'Mesin → regex').getByRole('button', { name: 'Mulai' }).click();
	await expect(button(page, 'Salin')).toHaveCount(0);
	await button(page, 'Ke hasil').click();
	const text = (await panel(page).getByRole('region', { name: 'Ekspresi reguler' }).textContent())!;
	await button(page, 'Salin').click();
	await expect(panel(page).getByText('Tersalin.')).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text.trim());
});

test('Mesin → regex has buttons of at least 44 px, and Tutup goes back to the list', async ({
	page
}) => {
	await openDfsm(page);
	await operation(page, 'Mesin → regex').getByRole('button', { name: 'Mulai' }).click();
	await button(page, 'Ke hasil').click();
	for (const name of ['Salin', 'Tutup', 'Mundur', 'Maju', 'Ke awal', 'Ke hasil']) {
		const b = (await button(page, name).boundingBox())!;
		expect(b.height, name).toBeGreaterThanOrEqual(44);
		expect(b.width, name).toBeGreaterThanOrEqual(44);
	}
	await button(page, 'Tutup').click();
	await expect(operation(page, 'Mesin → regex')).toBeVisible();
	await expect(shown(page)).toHaveCount(0);
});

// ---- Regex → NDFSM (S7-3b) ----

const regexRow = (page: Page) => panel(page).locator('li.form');
const field = (page: Page) => regexRow(page).getByRole('textbox', { name: 'Ekspresi reguler' });

test('Regex → NDFSM shows the alphabet of the text, builds the machine part by part, and opens it', async ({
	page
}) => {
	await openDfsm(page);
	await expect(regexRow(page)).toContainText('Tulis ekspresi reguler dulu.');
	await expect(regexRow(page).getByRole('button', { name: 'Regex → NDFSM' })).toBeDisabled();
	await field(page).fill('(a∪b)*abb');
	await expect(regexRow(page)).toContainText('Alfabet: a, b');
	await expect(regexRow(page).getByRole('button', { name: 'Regex → NDFSM' })).toBeEnabled();
	await regexRow(page).getByRole('button', { name: 'Regex → NDFSM' }).click();
	await expect(panel(page).getByRole('heading', { name: 'Regex → NDFSM' })).toBeFocused();
	await expect(panel(page).getByText('Ekspresi: (a∪b)*abb')).toBeVisible();
	await expect(panel(page).getByText(/^Langkah 1 dari \d+$/)).toBeVisible();
	await expect(sentence(page)).toContainText('Simbol a');
	// The canvas shows the machine that is built, not the one of the student.
	await expect(shown(page)).toBeVisible();
	await expect(button(page, 'Buka sebagai mesin baru')).toHaveCount(0);
	await expectNoAxeViolations(page);
	await button(page, 'Ke hasil').click();
	await expect(sentence(page)).toContainText('Konkatenasi (a∪b)*abb');
	await expect(panel(page).getByText('Konversi selesai!')).toBeVisible();
	await expectNoAxeViolations(page);
	await button(page, 'Buka sebagai mesin baru').click();
	await expect(page.locator('.bar .title')).toHaveText('NDFSM dari (a∪b)*abb');
});

test('the buttons put an operator at the caret of the field and keep the focus there', async ({
	page
}) => {
	await openDfsm(page);
	await field(page).fill('ab');
	await field(page).evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1));
	await regexRow(page).getByRole('button', { name: 'Sisipkan ∪, gabungan' }).click();
	await expect(field(page)).toHaveValue('a∪b');
	await expect(field(page)).toBeFocused();
	await regexRow(page).getByRole('button', { name: 'Sisipkan ε, string kosong' }).click();
	await expect(field(page)).toHaveValue('a∪εb');
	await field(page).press('End');
	await regexRow(page).getByRole('button', { name: 'Sisipkan *, bintang' }).click();
	await expect(field(page)).toHaveValue('a∪εb*');
	await regexRow(page).getByRole('button', { name: 'Sisipkan ∅, himpunan kosong' }).click();
	await expect(field(page)).toHaveValue('a∪εb*∅');
	await expect(regexRow(page)).toContainText('Alfabet: a, b');
});

test('Regex → NDFSM says where the mistake is, and a new letter clears the message', async ({
	page
}) => {
	await openDfsm(page);
	await field(page).fill('a∪');
	await field(page).press('Enter');
	await expect(regexRow(page)).toContainText(
		'Ekspresinya belum lengkap: ada bagian yang kurang setelah karakter ke-2.'
	);
	await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
	await expectNoAxeViolations(page);
	await field(page).fill('(a∪b');
	await expect(regexRow(page).getByText('belum lengkap')).toHaveCount(0);
	await field(page).press('Enter');
	await expect(regexRow(page)).toContainText('Tanda kurung di karakter ke-1 tidak punya pasangan.');
	// The player did not open, and the machine of the student is as it was.
	await expect(regexRow(page)).toBeVisible();
	await expect(shown(page)).toHaveCount(0);
});

test('Enter in the field starts the conversion, and Tutup keeps the text', async ({ page }) => {
	await openDfsm(page);
	await field(page).fill('ab*');
	await field(page).press('Enter');
	await expect(panel(page).getByText(/^Langkah 1 dari \d+$/)).toBeVisible();
	await button(page, 'Tutup').click();
	await expect(field(page)).toHaveValue('ab*');
});

test('the field and the buttons of the operators are at least 44 px', async ({ page }) => {
	await openDfsm(page);
	const boxes = [await field(page).boundingBox()];
	for (const b of await regexRow(page).getByRole('group').getByRole('button').all()) {
		boxes.push(await b.boundingBox());
	}
	expect(boxes).toHaveLength(8);
	const panelBox = (await panel(page).boundingBox())!;
	for (const b of boxes) {
		expect(b!.height).toBeGreaterThanOrEqual(44);
		expect(b!.width).toBeGreaterThanOrEqual(44);
		expect(b!.x + b!.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
	}
});

test('a finger puts an operator in the field and starts the conversion', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await openDfsm(page);
	await field(page).fill('ab');
	await field(page).evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1));
	await touchTap(page, regexRow(page).getByRole('button', { name: 'Sisipkan ∪, gabungan' }));
	await expect(field(page)).toHaveValue('a∪b');
	await touchTap(page, regexRow(page).getByRole('button', { name: 'Regex → NDFSM' }));
	await expect(panel(page).getByText(/^Langkah 1 dari \d+$/)).toBeVisible();
	await touchTap(page, button(page, 'Ke hasil'));
	await expect(button(page, 'Buka sebagai mesin baru')).toBeVisible();
});

test('the note about the notation has one line for each sign', async ({ page }) => {
	await openDfsm(page);
	await operation(page, 'Mesin → regex').getByRole('button', { name: 'Mulai' }).click();
	await button(page, 'Ke hasil').click();
	const notation = panel(page).locator('.notation li');
	await expect(notation).toHaveText([
		'∪ untuk gabungan',
		'ε untuk string kosong',
		'∅ untuk himpunan kosong'
	]);
});

// ---- Sederhanakan (S7-3c) ----

test('Sederhanakan names the rule and the parts, marks the new part, and ends at the shorter expression', async ({
	page
}) => {
	await openDfsm(page);
	await field(page).fill('a*∪aa');
	await regexRow(page).getByRole('button', { name: 'Sederhanakan' }).click();
	await expect(panel(page).getByRole('heading', { name: 'Sederhanakan' })).toBeFocused();
	await expect(panel(page).getByText('Ekspresi awal: a*∪aa')).toBeVisible();
	await expect(panel(page).getByText('Langkah 1 dari 1')).toBeVisible();
	await expect(sentence(page)).toContainText('α ∪ β = α jika L(β) ⊆ L(α)');
	await expect(sentence(page)).toContainText('a*∪aa menjadi a*');
	await expect(panel(page).locator('.now mark')).toHaveText('a*');
	// A conversion with one step is done at once, and the player has no machine to draw.
	await expect(panel(page).getByText('Konversi selesai!')).toBeVisible();
	await expect(shown(page)).toHaveCount(0);
	await expect(button(page, 'Buka sebagai mesin baru')).toHaveCount(0);
	await expect(panel(page).getByRole('region', { name: 'Ekspresi reguler' })).toHaveText('a*');
	await expectNoAxeViolations(page);
});

test('Sederhanakan goes through several identities, one at each step', async ({ page }) => {
	await openDfsm(page);
	await field(page).fill('(a∪∅)(εb)');
	await regexRow(page).getByRole('button', { name: 'Sederhanakan' }).click();
	await expect(panel(page).getByText('Langkah 1 dari 2')).toBeVisible();
	await expect(sentence(page)).toContainText('∅ ∪ α = α');
	await expect(panel(page).locator('.now code')).toHaveText('aεb');
	await button(page, 'Maju').click();
	await expect(sentence(page)).toContainText('εα = α');
	await expect(panel(page).locator('.now code')).toHaveText('ab');
	await expect(panel(page).getByRole('region', { name: 'Ekspresi reguler' })).toHaveText('ab');
});

test('Sederhanakan says when nothing can be shortened, and a mistake with its position', async ({
	page
}) => {
	await openDfsm(page);
	await field(page).fill('ab*');
	await regexRow(page).getByRole('button', { name: 'Sederhanakan' }).click();
	await expect(regexRow(page)).toContainText(
		'Ekspresinya sudah tidak bisa diperpendek dengan identitas yang ada.'
	);
	await field(page).fill('a∪');
	await expect(regexRow(page).getByText('sudah tidak bisa diperpendek')).toHaveCount(0);
	await regexRow(page).getByRole('button', { name: 'Sederhanakan' }).click();
	await expect(regexRow(page)).toContainText('Ekspresinya belum lengkap');
});

test('the result of Mesin → regex can go into the field of Sederhanakan', async ({ page }) => {
	await openDfsm(page);
	await operation(page, 'Mesin → regex').getByRole('button', { name: 'Mulai' }).click();
	await button(page, 'Ke hasil').click();
	await button(page, 'Pakai di Sederhanakan').click();
	await expect(field(page)).toHaveValue('(1∪0(0∪10)*11)*0(0∪10)*1');
	await expect(field(page)).toBeFocused();
	await expect(regexRow(page)).toContainText('Alfabet: 0, 1');
	await regexRow(page).getByRole('button', { name: 'Sederhanakan' }).click();
	// The expression of the engine has no identity left to use.
	await expect(regexRow(page)).toContainText('sudah tidak bisa diperpendek');
});

test('a finger starts Sederhanakan', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openDfsm(page);
	await field(page).fill('a*∪aa');
	await touchTap(page, regexRow(page).getByRole('button', { name: 'Sederhanakan' }));
	await expect(sentence(page)).toContainText('α ∪ β = α');
	await touchTap(page, button(page, 'Tutup'));
	await expect(field(page)).toHaveValue('a*∪aa');
});

test('the buttons of the two operations are at least 44 px, and disabled while the field is empty', async ({
	page
}) => {
	await openDfsm(page);
	for (const name of ['Regex → NDFSM', 'Sederhanakan']) {
		const b = regexRow(page).getByRole('button', { name });
		await expect(b).toBeDisabled();
		const box = (await b.boundingBox())!;
		expect(box.height, name).toBeGreaterThanOrEqual(44);
	}
	await field(page).fill('a');
	await expect(regexRow(page).getByRole('button', { name: 'Sederhanakan' })).toBeEnabled();
	await expectNoAxeViolations(page);
});

test('Sederhanakan turns the expression of a machine into the short plus', async ({ page }) => {
	await openDfsm(page);
	await field(page).fill('1*00*1((0∪11*0)0*1)*');
	await regexRow(page).getByRole('button', { name: 'Sederhanakan' }).click();
	await expect(sentence(page)).toContainText('αα* = α+');
	await button(page, 'Ke hasil').click();
	await expect(panel(page).getByRole('region', { name: 'Ekspresi reguler' })).toHaveText(
		'(1*0+1)+'
	);
	await expectNoAxeViolations(page);
});
