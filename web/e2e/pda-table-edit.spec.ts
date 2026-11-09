// The editable Tabel tab of the PDA editor (Task T-061): the Alfabet block, the State block, the
// editable transitions, the draft row, the refusals, one-step undo, touch sizes and axe.
// The fixtures are the machines F and H of docs/agent/PLAN.md, built through the diagram.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const alphabet = (page: Page, name: 'Alfabet input Σ' | 'Alfabet stack Γ') =>
	panel(page).getByRole('group', { name });
const states = (page: Page) => panel(page).getByRole('group', { name: 'State' });
const transitions = (page: Page) => panel(page).locator('.transitions');
const rows = (page: Page) => transitions(page).locator('tbody tr');
const toast = (page: Page) => page.getByRole('group', { name: 'Pesan' });
const status = (page: Page) => page.getByRole('status');

async function openPdaSandbox(page: Page) {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
}

async function addRailState(page: Page, x: number, y: number) {
	await page.getByRole('button', { name: /^Tambah state/ }).click();
	await page.locator('.stage svg').click({ position: { x, y } });
}

async function makeEdge(
	page: Page,
	fromName: string,
	toName: string,
	list: Array<{ read: string; pop: string; push: string }>
) {
	await page.getByRole('button', { name: /^Tambah transisi/ }).click();
	const stateBtn = (name: string) =>
		page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
	await stateBtn(fromName).click();
	await stateBtn(toName).click();

	const form = page.locator('.pda-label-form[role="dialog"]');
	await expect(form).toBeVisible();
	for (let i = 0; i < list.length; i++) {
		if (i > 0) {
			await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		}
		const row = list[i]!;
		if (row.read) {
			await form
				.getByRole('textbox', { name: new RegExp(`Baris ${i + 1}.*Baca`, 'i') })
				.fill(row.read);
		}
		if (row.pop) {
			await form
				.getByRole('textbox', { name: new RegExp(`Baris ${i + 1}.*Pop`, 'i') })
				.fill(row.pop);
		}
		if (row.push) {
			await form
				.getByRole('textbox', { name: new RegExp(`Baris ${i + 1}.*Push`, 'i') })
				.fill(row.push);
		}
	}
	await form.getByRole('button', { name: /Simpan/i }).click();
	await expect(form).toHaveCount(0);
}

/** Machine F: Σ {a, b}, Γ {A}, q0 start, q1 accepting, rows q0|a|ε|A|q0, q0|b|A|ε|q1, q1|b|A|ε|q1. */
async function buildF(page: Page) {
	await openPdaSandbox(page);
	await addRailState(page, 120, 200);
	await page.getByRole('button', { name: /^State q0/ }).click();
	await page.keyboard.press('m');
	await addRailState(page, 300, 200);
	await page.getByRole('button', { name: /^State q1/ }).click();
	await page.keyboard.press('a');
	await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
	await makeEdge(page, 'q0', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
	await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
}

/** Machine H: F plus (q1, a, ε → A, q1), so the edge q1 → q1 has two transitions. */
async function buildH(page: Page) {
	await openPdaSandbox(page);
	await addRailState(page, 120, 200);
	await page.getByRole('button', { name: /^State q0/ }).click();
	await page.keyboard.press('m');
	await addRailState(page, 300, 200);
	await page.getByRole('button', { name: /^State q1/ }).click();
	await page.keyboard.press('a');
	await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
	await makeEdge(page, 'q0', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
	await makeEdge(page, 'q1', 'q1', [
		{ read: 'a', pop: '', push: 'A' },
		{ read: 'b', pop: 'A', push: '' }
	]);
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByRole('heading', { name: 'Transisi (4)' })).toBeVisible();
}

/**
 * Machine K: q0 has a self-loop of four transitions (a, b, c, d), which is what makes the diagram
 * show `+ n lagi` (pda-diagram.ts draws the overflow only above three lines), and q1 one more.
 */
async function buildK(page: Page) {
	await openPdaSandbox(page);
	await addRailState(page, 200, 200);
	await page.getByRole('button', { name: /^State q0/ }).click();
	await page.keyboard.press('m');
	await addRailState(page, 380, 200);
	await page.getByRole('button', { name: /^State q1/ }).click();
	await page.keyboard.press('a');
	await makeEdge(page, 'q0', 'q0', [
		{ read: 'a', pop: '', push: '' },
		{ read: 'b', pop: '', push: '' },
		{ read: 'c', pop: '', push: '' },
		{ read: 'd', pop: '', push: '' }
	]);
	await makeEdge(page, 'q1', 'q1', [{ read: 'a', pop: '', push: '' }]);
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByRole('heading', { name: 'Transisi (5)' })).toBeVisible();
}

const field = (page: Page, n: number, name: string) =>
	rows(page)
		.nth(n - 1)
		.getByRole('textbox', { name: new RegExp(`Baris ${n}.*${name}`, 'i') });
const pick = (page: Page, n: number, name: string) =>
	rows(page)
		.nth(n - 1)
		.getByRole('combobox', { name: new RegExp(`Baris ${n}.*${name}`, 'i') });

test.describe('E1: the Alfabet block', () => {
	test('adds c, refuses eps / a b / a,b, and removes b with a toast that one Undo restores', async ({
		page
	}) => {
		await buildF(page);
		const sigma = alphabet(page, 'Alfabet input Σ');
		const gamma = alphabet(page, 'Alfabet stack Γ');
		const symbolField = sigma.getByRole('textbox', { name: 'Simbol baru' });

		// The two alphabets of F, as chips.
		await expect(sigma.locator('.chip')).toHaveCount(2);
		await expect(gamma.locator('.chip')).toHaveCount(1);
		await expect(gamma.locator('.chip').first()).toContainText('A');

		// A new input symbol appears as a chip and is announced.
		await symbolField.fill('c');
		await symbolField.press('Enter');
		await expect(sigma.locator('.chip').filter({ hasText: 'c' })).toHaveCount(1);
		await expect(status(page)).toContainText('Simbol c ditambahkan.');
		await expect(symbolField).toHaveValue('');

		// The reserved names: refused, nothing changes, the text stays in the field.
		const reserved = 'Nama simbol tidak boleh eps atau ε, dan tidak boleh berisi spasi atau koma.';
		for (const name of ['eps', 'a b', 'a,b']) {
			await symbolField.fill(name);
			await symbolField.press('Enter');
			await expect(sigma.getByText(reserved)).toBeVisible();
			await expect(sigma.locator('.chip')).toHaveCount(3);
			await expect(symbolField).toHaveValue(name);
			await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
		}
		await expect(sigma.getByRole('textbox', { name: 'Simbol baru' })).toHaveAttribute(
			'aria-invalid',
			'true'
		);

		// Removing b takes rows 2 and 3, and the toast says so with the count of F5.
		await sigma.getByRole('button', { name: 'Hapus simbol b' }).click();
		await expect(rows(page)).toHaveCount(1);
		await expect(panel(page).getByRole('heading', { name: 'Transisi (1)' })).toBeVisible();
		await expect(toast(page)).toContainText('Simbol b dihapus, beserta 2 transisi.');

		// One Urungkan brings back the symbol and its rows.
		await toast(page).getByRole('button', { name: 'Urungkan' }).click();
		await expect(rows(page)).toHaveCount(3);
		await expect(sigma.locator('.chip').filter({ hasText: 'b' })).toHaveCount(1);
	});
});

test.describe('E2: the State block', () => {
	test('renames with Enter, refuses a name in use, sets the start, toggles accepting, adds and deletes', async ({
		page
	}) => {
		await buildF(page);
		const block = states(page);

		// The two states of F, with their names.
		await expect(block.locator('.state-row')).toHaveCount(2);

		// Rename q1: a name in use is refused under the field, and the text stays.
		await block.getByRole('button', { name: 'q1', exact: true }).click();
		const nameField = block.getByRole('textbox', { name: 'Nama state' });
		await expect(nameField).toBeFocused();
		await nameField.fill('q0');
		await nameField.press('Enter');
		await expect(block.getByText('Nama q0 sudah dipakai state lain.')).toBeVisible();
		await expect(nameField).toHaveValue('q0');
		await expect(nameField).toHaveAttribute('aria-invalid', 'true');

		// A free name is sent with Enter.
		await nameField.fill('p1');
		await nameField.press('Enter');
		await expect(block.getByRole('button', { name: 'p1', exact: true })).toBeVisible();
		await expect(block.getByRole('textbox', { name: 'Nama state' })).toHaveCount(0);
		await expect(status(page)).toContainText('Nama state menjadi p1.');

		// The start state moves to p1, and it is one radio group.
		const startRadio = block.getByRole('radio', { name: 'p1: start state' });
		await startRadio.check();
		await expect(startRadio).toBeChecked();
		await expect(block.getByRole('radio', { name: 'q0: start state' })).not.toBeChecked();
		await expect(status(page)).toContainText('p1 menjadi start state.');

		// Accepting: off and on again.
		const accepting = block.getByRole('checkbox', { name: 'p1: accepting state' });
		await accepting.uncheck();
		await expect(accepting).not.toBeChecked();
		await expect(status(page)).toContainText('p1 bukan lagi accepting state.');
		await accepting.check();
		await expect(accepting).toBeChecked();

		// + State adds a third state, and it does not land on another one.
		await panel(page).getByRole('button', { name: '+ State' }).click();
		await expect(block.locator('.state-row')).toHaveCount(3);
		const centers = await page.locator('g[data-state] circle.state').evaluateAll((circles) =>
			circles.map((circle) => ({
				x: Number(circle.getAttribute('cx')),
				y: Number(circle.getAttribute('cy'))
			}))
		);
		expect(centers.length).toBe(3);
		const others = centers.slice(0, 2);
		const added = centers[2]!;
		for (const other of others) {
			expect(Math.hypot(other.x - added.x, other.y - added.y)).toBeGreaterThanOrEqual(72);
		}

		// Deleting a state takes its transitions and says how many, and one Undo restores both.
		await block.getByRole('button', { name: 'Hapus state q0' }).click();
		await expect(toast(page)).toContainText('State q0 dihapus, beserta 2 transisi.');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (1)' })).toBeVisible();
		await toast(page).getByRole('button', { name: 'Urungkan' }).click();
		await expect(block.locator('.state-row')).toHaveCount(3);
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
	});
});

test.describe('E3: a row that moves', () => {
	test('F4 on H: the edited row becomes row 2 and the focus follows it', async ({ page }) => {
		await buildH(page);
		await expect(rows(page)).toHaveCount(4);

		// Row 1 of H is q0|a|ε|A|q0; its Dari becomes q1, so it sorts after row 2.
		await pick(page, 1, 'Dari').selectOption('1');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (4)' })).toBeVisible();
		await expect(rows(page)).toHaveCount(4);

		const movedFrom = pick(page, 2, 'Dari');
		await expect(movedFrom).toHaveValue('1');
		await expect(movedFrom).toBeFocused();
		// The transition itself moved with the row: Baca a, Push A, Ke q0.
		await expect(pick(page, 2, 'Baca')).toHaveValue('a');
		await expect(field(page, 2, 'Push')).toHaveValue('A');
		await expect(pick(page, 2, 'Ke')).toHaveValue('0');
		// And the rows are still in the engine's order: row 1 is q0|b, row 3 is q1|a|…|q1.
		await expect(pick(page, 1, 'Dari')).toHaveValue('0');
		await expect(pick(page, 1, 'Baca')).toHaveValue('b');
		await expect(pick(page, 3, 'Baca')).toHaveValue('a');
		await expect(pick(page, 4, 'Baca')).toHaveValue('b');
		await expect(status(page)).toContainText('Baris 2 diubah.');
	});
});

test.describe('E4: the draft row', () => {
	test('Dari alone sends nothing, Ke sends it, and the same works from the keyboard', async ({
		page
	}) => {
		await buildF(page);
		const add = panel(page).getByRole('button', { name: '+ Tambah transisi' });

		// The draft row is at the bottom and is not a transition yet.
		await add.click();
		await expect(rows(page)).toHaveCount(4);
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();

		// Dari alone sends nothing.
		const draftRow = rows(page).nth(3);
		await draftRow.getByRole('combobox', { name: /Baris 4.*Dari/i }).selectOption('0');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
		await expect(rows(page)).toHaveCount(4);

		// Ke completes it: it becomes row 1 (ε before a), is announced, and keeps the focus.
		await draftRow.getByRole('combobox', { name: /Baris 4.*Ke/i }).selectOption('1');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (4)' })).toBeVisible();
		await expect(rows(page)).toHaveCount(4);
		await expect(status(page)).toContainText('Baris 1 ditambahkan.');
		const newFrom = pick(page, 1, 'Dari');
		await expect(newFrom).toHaveValue('0');
		await expect(newFrom).toBeFocused();
		await expect(pick(page, 1, 'Baca')).toHaveValue('ε');
		await expect(pick(page, 1, 'Ke')).toHaveValue('1');

		// The same with the keyboard only: Enter on the button, then the arrows of the selects.
		await add.focus();
		await page.keyboard.press('Enter');
		await expect(rows(page)).toHaveCount(5);
		await expect(panel(page).getByRole('heading', { name: 'Transisi (4)' })).toBeVisible();
		// The draft takes the focus on its Dari, so the keyboard never has to hunt for it.
		const draftFromKey = rows(page)
			.nth(4)
			.getByRole('combobox', { name: /Baris 5.*Dari/i });
		await expect(draftFromKey).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (4)' })).toBeVisible();
		for (let i = 0; i < 4; i++) {
			await page.keyboard.press('Tab');
		}
		await expect(
			rows(page)
				.nth(4)
				.getByRole('combobox', { name: /Baris 5.*Ke/i })
		).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (5)' })).toBeVisible();
		await expect(rows(page)).toHaveCount(5);
	});

	test('the draft keeps what was typed when the document changes around it', async ({ page }) => {
		await buildF(page);
		await panel(page).getByRole('button', { name: '+ Tambah transisi' }).click();
		const draftPush = rows(page)
			.nth(3)
			.getByRole('textbox', { name: /Baris 4.*Push/i });
		await draftPush.fill('A');

		// Another edit of the document: a new input symbol.
		const sigma = alphabet(page, 'Alfabet input Σ');
		await sigma.getByRole('textbox', { name: 'Simbol baru' }).fill('c');
		await sigma.getByRole('textbox', { name: 'Simbol baru' }).press('Enter');
		await expect(sigma.locator('.chip').filter({ hasText: 'c' })).toHaveCount(1);

		// The draft row is still there with its text.
		await expect(rows(page)).toHaveCount(4);
		await expect(
			rows(page)
				.nth(3)
				.getByRole('textbox', { name: /Baris 4.*Push/i })
		).toHaveValue('A');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
	});

	test('a Dari whose state is removed goes back to the placeholder', async ({ page }) => {
		await buildF(page);
		await panel(page).getByRole('button', { name: '+ Tambah transisi' }).click();
		const draftFrom = rows(page)
			.nth(3)
			.getByRole('combobox', { name: /Baris 4.*Dari/i });
		await draftFrom.selectOption('1');
		await expect(draftFrom).toHaveValue('1');
		await expect(
			rows(page)
				.nth(3)
				.getByRole('textbox', { name: /Baris 4.*Push/i })
		).toBeVisible();

		// Removing q1 takes the two transitions that use it, so the draft is the second row now.
		await states(page).getByRole('button', { name: 'Hapus state q1' }).click();
		await expect(rows(page)).toHaveCount(2);
		const gone = rows(page)
			.nth(1)
			.getByRole('combobox', { name: /Baris 2.*Dari/i });
		await expect(gone).toHaveValue('');
		// The draft itself survives, with everything else that was typed in it.
		await expect(gone).toBeVisible();
		await expect(panel(page).getByRole('heading', { name: 'Transisi (1)' })).toBeVisible();
	});
});

test.describe('E5: refusals', () => {
	test('F2 shows the duplicate under the row, and 65 symbols show string_too_long in the field', async ({
		page
	}) => {
		await buildF(page);

		// F2: the Dari of row 3 (q1|b|A|ε|q1) becomes q0, which is exactly row 2.
		await pick(page, 3, 'Dari').selectOption('0');

		await expect(panel(page).getByText('Transisi itu sudah ada di baris 2.')).toBeVisible();
		// Nothing changed: still three transitions, and the row is still the one of q1.
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
		await expect(field(page, 3, 'Push')).toHaveValue('ε');
		await expect(pick(page, 3, 'Baca')).toHaveValue('b');
		// The document itself still has the transition from q1, not the one that was refused.
		await tab(page, 'Definisi').click();
		await expect(panel(page).getByText('((q1, b, A), (q1, ε))')).toBeVisible();
		await expect(panel(page).getByText('((q0, b, A), (q1, ε))')).toHaveCount(1);
		await tab(page, 'Tabel').click();
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();

		// 65 symbols in Push: the document's limit, shown under the field.
		const push = field(page, 1, 'Push');
		await push.fill('A'.repeat(65));
		await push.press('Enter');
		await expect(
			panel(page).getByText('String pop atau push terlalu panjang (paling banyak 64 simbol).')
		).toBeVisible();
		await expect(push).toHaveAttribute('aria-invalid', 'true');
		await expect(push).toHaveValue('A'.repeat(65));
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
	});
});

test.describe('E6: one edit is one undo step', () => {
	test('F1 and F3 are each one Urungkan, and the alphabet comes back with the row', async ({
		page
	}) => {
		await buildF(page);

		// F1: Push A becomes AA on row 1, one undo puts A back.
		await field(page, 1, 'Push').fill('AA');
		await field(page, 1, 'Push').press('Enter');
		await expect(field(page, 1, 'Push')).toHaveValue('AA');
		await page.getByRole('button', { name: 'Urungkan' }).click();
		await expect(field(page, 1, 'Push')).toHaveValue('A');
		await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();

		// F3: Push AB on row 3 adds B to the stack alphabet; one undo takes both back.
		await field(page, 3, 'Push').fill('AB');
		await field(page, 3, 'Push').press('Enter');
		await expect(field(page, 3, 'Push')).toHaveValue('AB');
		await expect(alphabet(page, 'Alfabet stack Γ').locator('.chip')).toHaveCount(2);
		await page.getByRole('button', { name: 'Urungkan' }).click();
		await expect(field(page, 3, 'Push')).toHaveValue('ε');
		await expect(alphabet(page, 'Alfabet stack Γ').locator('.chip')).toHaveCount(1);
	});
});

test.describe('E7: touch sizes, sideways scroll and axe', () => {
	test('no axe violation on the Tabel tab of F and of H', async ({ page }) => {
		await buildF(page);
		await expectNoAxeViolations(page);
		await buildH(page);
		await expectNoAxeViolations(page);
	});

	test('phone: every control is at least 44 px high and a text field at least 16 px', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'the touch sizes are a phone rule');
		await buildF(page);

		const controls = panel(page).locator(
			'.alphabet button, .alphabet input, .states button, .states input, .transitions button, .transitions input, .transitions select'
		);
		const count = await controls.count();
		expect(count).toBeGreaterThan(10);
		for (let i = 0; i < count; i++) {
			const box = await controls.nth(i).boundingBox();
			expect(box!.height, `control ${i}`).toBeGreaterThanOrEqual(44);
		}

		const textFields = panel(page).locator(
			'.alphabet input[type="text"], .states input[type="text"], .transitions input[type="text"]'
		);
		const fields = await textFields.count();
		expect(fields).toBeGreaterThan(2);
		for (let i = 0; i < fields; i++) {
			const size = await textFields
				.nth(i)
				.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
			expect(size, `field ${i}`).toBeGreaterThanOrEqual(16);
		}

		// The table scrolls sideways with its first column fixed (the FSM rule).
		const scrollBox = transitions(page).locator('.wrap');
		const scrollable = await scrollBox.evaluate(
			(element) => element.scrollWidth > element.clientWidth
		);
		expect(scrollable).toBe(true);
		const firstTh = rows(page).first().locator('th.from');
		const before = (await firstTh.boundingBox())!;
		await scrollBox.evaluate((element) => (element.scrollLeft = 50));
		const after = (await firstTh.boundingBox())!;
		expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
	});
});

test.describe('E8: a marked row', () => {
	test('+ n lagi still marks its rows, and an edit clears the marks', async ({ page }) => {
		await buildK(page);

		// The self-loop of q0 has four transitions, so the diagram shows + 2 lagi.
		await page.getByRole('button', { name: /^Pilih/ }).click();
		const more = page.locator('.hit-overflow').first();
		await expect(more).toBeVisible();
		await more.click();

		await expect(tab(page, 'Tabel')).toHaveAttribute('aria-selected', 'true');
		const marked = transitions(page).locator('tbody tr[aria-current="true"]');
		await expect(marked).toHaveCount(4);

		// An edit of the document clears the marks, as before.
		await field(page, 3, 'Push').fill('AA');
		await field(page, 3, 'Push').press('Enter');
		await expect(transitions(page).locator('tbody tr[aria-current="true"]')).toHaveCount(0);
		await expect(panel(page).getByRole('heading', { name: 'Transisi (5)' })).toBeVisible();
	});
});
