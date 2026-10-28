// Q4b, the tab "Umpan balik" of the page of a question: "Periksa jawaban", the structure, the verdict, the two
// lists of wrong strings, the computation of the shortest one with its guiding question, "Coba di Simulasi",
// and the hints. The machines of the student are put in the saved record of the question (the way a student's
// work is there after a reload), so that each case is exact; the grading itself is tested against the real
// engine in the unit tests.
import { engineSettled, expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow } from './cross/db.ts';
import { ENDS_WITH_1, ONE_OFF, RIGHT, docJson } from './question-machines.ts';
import type { Spec } from './question-machines.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const feedback = (page: Page) => panel(page).locator('#panel-pane-feedback');
const check = (page: Page) =>
	feedback(page).getByRole('button', {
		name: /^(Periksa jawaban|Periksa lagi|Check my answer|Check again)$/
	});
const result = (page: Page) => feedback(page).getByRole('status');

/** Opens the question with this machine saved as the work of the student. */
async function openWith(page: Page, spec: Spec, id = 'berakhiran-10') {
	await page.goto(`/soal/${id}`);
	await page.locator('.editor[data-ready]').waitFor();
	// The checks of the first page start the engine: a reload while it loads would cancel the request.
	await engineSettled(page);
	await putRow(page, { id: `soal:${id}`, doc: docJson(spec) });
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(feedback(page)).toBeVisible();
}

test('the tab Umpan balik is first and open, with a button and no result yet', async ({ page }) => {
	// Even when the Sandbox left another tab as the last one that was open.
	await page.addInitScript(() => localStorage.setItem('webtomata.panel.tab', 'table'));
	await page.goto('/soal/berakhiran-10');
	await page.locator('.editor[data-ready]').waitFor();
	const tabs = panel(page).getByRole('tab');
	await expect(tabs).toHaveText(['Umpan balik', 'Simulasi', 'Tabel', 'Definisi']);
	await expect(panel(page).getByRole('tab', { name: 'Umpan balik' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(feedback(page)).toContainText('Bangun mesinmu, lalu periksa.');
	await expect(check(page)).toHaveText('Periksa jawaban');
	// The Sandbox has no such tab.
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.getByRole('tab', { name: 'Umpan balik' })).toHaveCount(0);
});

test('says "Tepat." for a right answer, with the structure as valid', async ({ page }) => {
	await openWith(page, RIGHT);
	await check(page).click();
	await expect(result(page)).toContainText('Struktur valid.');
	await expect(result(page)).toContainText('Setiap state punya transisi untuk 0, 1.');
	await expect(result(page)).toContainText('Tepat.');
	await expect(result(page)).toContainText('menerima semua string yang diminta');
	await expect(result(page).getByRole('heading', { level: 4 })).toHaveCount(0);
	await expect(check(page)).toHaveText('Periksa lagi');
	await expectNoAxeViolations(page);
});

test('shows the verdict first and the line "Struktur valid." after it, so that the verdict is seen without scrolling', async ({
	page
}) => {
	await openWith(page, ONE_OFF);
	await check(page).click();
	const verdict = result(page).locator('.card', { hasText: 'Belum tepat, tapi sudah dekat.' });
	const structure = result(page).locator('.card', { hasText: 'Struktur valid.' });
	await expect(verdict).toBeVisible();
	await expect(structure).toBeVisible();
	const verdictBox = (await verdict.boundingBox())!;
	const structureBox = (await structure.boundingBox())!;
	expect(verdictBox.y).toBeLessThan(structureBox.y);
	// The verdict is right under the button, and inside the panel without scrolling it.
	const buttonBox = (await check(page).boundingBox())!;
	expect(verdictBox.y).toBeGreaterThan(buttonBox.y);
	expect(verdictBox.y - (buttonBox.y + buttonBox.height)).toBeLessThan(40);
	// The same for a right answer.
	await openWith(page, RIGHT);
	await check(page).click();
	const right = result(page).locator('.card', { hasText: 'Tepat.' });
	const valid = result(page).locator('.card', { hasText: 'Struktur valid.' });
	expect((await right.boundingBox())!.y).toBeLessThan((await valid.boundingBox())!.y);
});

test('on a phone of 360 px the whole verdict is in view in the panel, without scrolling it', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the panel of a phone is small');
	await page.setViewportSize({ width: 360, height: 740 });
	await openWith(page, RIGHT);
	await check(page).click();
	const verdict = result(page).locator('.card', { hasText: 'Tepat.' });
	await expect(verdict).toBeVisible();
	const card = (await verdict.boundingBox())!;
	const panelBox = (await panel(page).boundingBox())!;
	expect(card.y + card.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
});

test('says "dekat" for one wrong string, with the computation and one guiding question', async ({
	page
}) => {
	await openWith(page, ONE_OFF);
	await check(page).click();
	await expect(result(page)).toContainText('Belum tepat, tapi sudah dekat.');
	await expect(result(page)).toContainText('menolak beberapa string yang seharusnya diterima');
	// The machine rejects "10" and the solution accepts it: the list is "Ditolak mesinmu...".
	await expect(
		result(page).getByRole('heading', { name: 'Ditolak mesinmu, padahal seharusnya diterima' })
	).toBeVisible();
	await expect(result(page).getByRole('button', { name: 'Coba 10 di Simulasi' })).toBeVisible();
	await expect(result(page)).toContainText('Tidak ada. Bagian ini sudah benar.');
	await expect(
		result(page).getByRole('heading', { name: 'Komputasi string terpendek yang salah: 10' })
	).toBeVisible();
	await expect(result(page).locator('.rows li')).toHaveText(['s –1→ b', 'b –0→ q0 ← di sini']);
	await expect(result(page)).toContainText(
		'Setelah 10, mesinmu ada di q0. Apakah itu yang perlu diingat mesin?'
	);
	await expectNoAxeViolations(page);
});

test('says "Belum tepat." and lists wrong strings of both sides, shortest first, when many are wrong', async ({
	page
}) => {
	await openWith(page, ENDS_WITH_1);
	await check(page).click();
	await expect(result(page)).toContainText('Belum tepat.');
	await expect(result(page)).toContainText('Coba jalankan string pendek dulu.');
	await expect(
		result(page).getByRole('heading', { name: 'Diterima mesinmu, padahal seharusnya ditolak' })
	).toBeVisible();
	await expect(result(page).locator('.chips').first().locator('button').first()).toHaveText('1');
	await expect(result(page)).toContainText('Daftar ini dipotong');
});

test('names the structure and gives no verdict for a missing transition', async ({ page }) => {
	await openWith(page, {
		...RIGHT,
		transitions: RIGHT.transitions.filter(([from, on]) => !(from === 1 && on === '0'))
	});
	await check(page).click();
	await expect(result(page)).toContainText('Lihat dulu strukturnya.');
	await expect(result(page)).toContainText('State q1 belum punya transisi untuk simbol 0');
	await expect(result(page)).not.toContainText('Tepat.');
	await expect(result(page)).not.toContainText('Belum tepat');
	await expect(result(page)).not.toContainText('Struktur valid.');
});

test('names the structure for the kind of machine, and for too many states', async ({ page }) => {
	await openWith(page, { ...RIGHT, kind: 'ndfsm' });
	await check(page).click();
	await expect(result(page)).toContainText('Soal ini meminta DFSM.');
	await openWith(
		page,
		{
			alphabet: ['a', 'b'],
			states: ['p', 'q', 'r'],
			accepting: [0],
			transitions: [
				[0, 'a', 1],
				[1, 'a', 2],
				[2, 'a', 0],
				[0, 'b', 0],
				[1, 'b', 1],
				[2, 'b', 2]
			]
		},
		'jumlah-a-genap'
	);
	await check(page).click();
	await expect(result(page)).toContainText('Soal ini membatasi 2 state. Mesinmu punya 3.');
	await expect(result(page)).not.toContainText('Tepat.');
});

test('"Coba di Simulasi" opens Simulasi with a run of the shortest wrong string', async ({
	page
}) => {
	await openWith(page, ONE_OFF);
	await check(page).click();
	await result(page).getByRole('button', { name: 'Coba di Simulasi' }).click();
	await expect(panel(page).getByRole('tab', { name: 'Simulasi' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(panel(page).locator('#panel-pane-simulation .chips li')).toHaveText(['1', '0']);
});

test('a chip of a list runs that string in Simulasi', async ({ page }) => {
	await openWith(page, ENDS_WITH_1);
	await check(page).click();
	await result(page)
		.getByRole('button', { name: /^Coba 11 di Simulasi$/ })
		.first()
		.click();
	await expect(panel(page).locator('#panel-pane-simulation .chips li')).toHaveText(['1', '1']);
});

test('the result stays when another tab is open, and says that it is old when the machine changes', async ({
	page
}) => {
	await openWith(page, RIGHT);
	await check(page).click();
	await expect(result(page)).toContainText('Tepat.');
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await expect(feedback(page)).toBeHidden();
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await panel(page).getByRole('tab', { name: 'Umpan balik' }).click();
	await expect(result(page)).toContainText('Tepat.');
	await expect(result(page)).toContainText(
		'Mesinmu sudah berubah. Periksa lagi untuk hasil terbaru.'
	);
	await check(page).click();
	await expect(result(page)).not.toContainText('sudah berubah');
});

// The failed request of the last step is what the test is about.
test.describe('a solution that cannot be fetched', () => {
	test.use({ allowedProblem: /jawaban\.json|ERR_FAILED/ });

	test('asks for the solution only when the student checks, and says calmly when it cannot be read', async ({
		page
	}) => {
		const asked: string[] = [];
		page.on('request', (request) => {
			if (request.url().endsWith('jawaban.json')) asked.push(request.url());
		});
		await openWith(page, RIGHT);
		expect(asked).toEqual([]);
		await check(page).click();
		await expect(result(page)).toContainText('Tepat.');
		expect(asked).toHaveLength(1);
		// The file cannot be fetched: the check says so, and the machine is not changed.
		await page.route('**/jawaban.json', (route) => route.abort());
		await check(page).click();
		await expect(result(page)).toContainText('Pemeriksaan belum bisa dijalankan.');
		await expect(result(page)).toContainText('Mesinmu tidak berubah.');
	});
});

test('the words follow the language of the page', async ({ page }) => {
	await openWith(page, ONE_OFF);
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(panel(page).getByRole('tab', { name: 'Feedback' })).toBeVisible();
	await check(page).click();
	await expect(result(page)).toContainText('Not quite, but close.');
	await expect(result(page)).toContainText(
		'Your machine rejects some strings that it should accept.'
	);
});

test('shows the hints one at a time, and only when asked', async ({ page, isMobile }) => {
	await page.goto('/soal/berakhiran-10');
	await page.locator('.editor[data-ready]').waitFor();
	const statement = page.locator('.statement');
	if (isMobile) await statement.getByRole('button', { name: 'Lihat soal', exact: true }).click();
	await expect(statement.getByRole('heading', { name: 'Petunjuk' })).toBeVisible();
	await expect(statement.locator('.hints li')).toHaveCount(0);
	const next = statement.getByRole('button', { name: /^Tampilkan petunjuk berikutnya/ });
	await expect(next).toHaveText('Tampilkan petunjuk berikutnya (1 dari 2)');
	await next.click();
	await expect(statement.locator('.hints li')).toHaveCount(1);
	await expect(statement.locator('.hints li').first()).toContainText('State tidak perlu mengingat');
	await expect(next).toHaveText('Tampilkan petunjuk berikutnya (2 dari 2)');
	await next.click();
	await expect(statement.locator('.hints li')).toHaveCount(2);
	await expect(statement.getByRole('button', { name: /^Tampilkan petunjuk/ })).toHaveCount(0);
	// A shown hint stays; the hints of another question start closed.
	await page.goto('/soal/jumlah-a-genap');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.locator('.statement .hints li')).toHaveCount(0);
});

test('the buttons and chips are at least 44 px', async ({ page }) => {
	await openWith(page, ENDS_WITH_1);
	await check(page).click();
	await expect(result(page)).toContainText('Belum tepat.');
	for (const target of [
		check(page),
		result(page).getByRole('button', { name: 'Coba di Simulasi' }),
		...(await result(page).locator('.chips button').all())
	]) {
		const box = (await target.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(43.5);
		expect(box.width).toBeGreaterThanOrEqual(43.5);
	}
});
