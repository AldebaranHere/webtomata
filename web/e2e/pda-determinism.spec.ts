// The determinism badge of the PDA editor (Task T-062, E1 to E7): the badge and its tones, the
// disclosure list with the reason sentences, Tunjukkan in both tabs, the badge after an edit, the
// answers of a busy engine, and the phone.
//
// E8 of the task is T-051's own E8 ("the engine is not requested before the first draw"), which
// must pass unedited; it runs as part of pda-panel and is not repeated here.
import {
	expect,
	expectNoAxeViolations,
	openPda as openPdaSandbox,
	openSandbox,
	test
} from './fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const badge = (page: Page) => panel(page).locator('.pda-determinism');
const toggle = (page: Page) => badge(page).locator('button.badge');
const plain = (page: Page) => badge(page).locator('p.badge');
const cards = (page: Page) => badge(page).locator('li.card');
const note = (page: Page) => badge(page).locator('.note');
const live = (page: Page) => panel(page).locator('.pda-live');
const transitions = (page: Page) => panel(page).locator('.transitions');
const markedRows = (page: Page) => transitions(page).locator('tbody tr[aria-current="true"]');
const edgeNode = (page: Page, from: number, to: number) =>
	page.locator(`g.edge-node[data-edge="${from}>${to}"]`);

async function addState(page: Page, x: number, y: number) {
	await page.getByRole('button', { name: /^Tambah state/ }).click();
	await page.locator('.stage svg').click({ position: { x, y } });
}

/** Makes a state the start state (m) or an accepting state (a), as the editor's keys do. */
async function markState(page: Page, name: string, key: 'm' | 'a') {
	await page.getByRole('button', { name: new RegExp(`^State ${name}`) }).click();
	await page.keyboard.press(key);
}

async function makeEdge(
	page: Page,
	fromName: string,
	toName: string,
	rows: Array<{ read: string; pop: string; push: string }>
) {
	await page.getByRole('button', { name: /^Tambah transisi/ }).click();
	await page.getByRole('button', { name: new RegExp(`^State ${fromName}`) }).click();
	await page.getByRole('button', { name: new RegExp(`^State ${toName}`) }).click();
	const form = page.locator('.pda-label-form[role="dialog"]');
	await expect(form).toBeVisible();
	for (let i = 0; i < rows.length; i++) {
		if (i > 0) await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		const row = rows[i]!;
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

/** Machine G of the plan: q0 start, q1 accepting, and the ε row that competes with two rows. */
async function buildG(page: Page) {
	await openPdaSandbox(page);
	await addState(page, 120, 200);
	await markState(page, 'q0', 'm');
	await addState(page, 300, 200);
	await markState(page, 'q1', 'a');
	await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
	await makeEdge(page, 'q0', 'q1', [
		{ read: 'b', pop: 'A', push: '' },
		{ read: 'ε', pop: '', push: '' }
	]);
	await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByRole('heading', { name: 'Transisi (4)' })).toBeVisible();
}

/** Machine F of the plan: a DPDA with no competing pair. */
async function buildF(page: Page) {
	await openPdaSandbox(page);
	await addState(page, 120, 200);
	await markState(page, 'q0', 'm');
	await addState(page, 300, 200);
	await markState(page, 'q1', 'a');
	await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
	await makeEdge(page, 'q0', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
	await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByRole('heading', { name: 'Transisi (3)' })).toBeVisible();
}

/** Opens the list of pairs, which is closed when the page opens. */
async function openList(page: Page) {
	await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
	await toggle(page).click();
	await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
}

/** Adds a row of q0 on `a` with pop A and push A: it competes with row 1 of F and with nothing else. */
async function addCompetingRow(page: Page) {
	await transitions(page)
		.getByRole('button', { name: /^\+ Tambah transisi/ })
		.click();
	const draft = transitions(page).locator('tbody tr.draft');
	await expect(draft).toBeVisible();
	await draft.locator('.f-read').selectOption('a');
	await draft.locator('.f-pop').fill('A');
	await draft.locator('.f-push').fill('A');
	await draft.locator('.f-from').selectOption({ label: 'q0' });
	await draft.locator('.f-to').selectOption({ label: 'q0' });
	await expect(draft).toHaveCount(0);
}

test.describe('E1: the badge for the four cases, and the kind switch', () => {
	test('desktop: no badge before a transition, and Deterministik for F', async ({ page }) => {
		await openPdaSandbox(page);
		// No transition: no badge at all, and no live region text yet.
		await expect(badge(page)).toHaveCount(0);
		await expect(live(page)).toHaveText('');

		await buildF(page);

		// F has no competing pair: plain text in the success tone, and not a button.
		await expect(plain(page)).toHaveText('Deterministik');
		await expect(plain(page)).toHaveClass(/tone-success/);
		await expect(toggle(page)).toHaveCount(0);

		// With every transition gone the badge goes too. The engine is already up here, so a short
		// wait is enough to be sure that its answer for the machine with no transition came back.
		for (let i = 0; i < 3; i++) {
			await transitions(page)
				.locator('tbody tr')
				.first()
				.getByRole('button', { name: 'Hapus baris 1' })
				.click();
		}
		await expect(transitions(page).locator('tbody tr')).toHaveCount(0);
		await page.waitForTimeout(500);
		await expect(badge(page)).toHaveCount(0);
	});

	test('desktop: G is neutral as an NDPDA and a warning as a DPDA, in both tabs', async ({
		page
	}) => {
		await buildG(page);

		await expect(toggle(page)).toHaveAttribute(
			'aria-label',
			'Non-deterministik · 2 pasangan bersaing'
		);
		await expect(toggle(page)).toHaveClass(/tone-neutral/);
		await expect(toggle(page)).toContainText('pasangan bersaing');

		// The kind switch changes the text and the tone at once.
		await panel(page).getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(toggle(page)).toHaveAttribute('aria-label', 'Bukan DPDA · 2 pasangan bersaing');
		await expect(toggle(page)).toHaveClass(/tone-warning/);

		// The same badge, in the Definisi tab.
		await tab(page, 'Definisi').click();
		await expect(tab(page, 'Definisi')).toHaveAttribute('aria-selected', 'true');
		await expect(toggle(page)).toHaveAttribute('aria-label', 'Bukan DPDA · 2 pasangan bersaing');
		await expect(toggle(page)).toHaveClass(/tone-warning/);

		await panel(page).getByRole('radio', { name: 'NDPDA', exact: true }).click();
		await expect(toggle(page)).toHaveAttribute(
			'aria-label',
			'Non-deterministik · 2 pasangan bersaing'
		);
		await expect(toggle(page)).toHaveClass(/tone-neutral/);
	});
});

test.describe('E2: the disclosure list', () => {
	test('desktop: closed at the start, then the two cards of G with their sentences and the note', async ({
		page
	}) => {
		await buildG(page);

		const button = toggle(page);
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await expect(badge(page).locator('.pairs')).toBeHidden();

		// A click opens it.
		await button.click();
		await expect(button).toHaveAttribute('aria-expanded', 'true');
		await expect(badge(page).locator('.pairs')).toBeVisible();
		await expect(cards(page)).toHaveCount(2);

		// The first card: the state, the two transitions as the diagram writes them, and F1.
		const first = cards(page).first();
		await expect(first).toContainText('q0:');
		await expect(first).toContainText('ε / ε / ε ↔ a / ε / A');
		await expect(first).toContainText(
			'Salah satunya tidak membaca input, dan pop ε adalah awalan dari pop ε.'
		);
		await expect(first.getByRole('button', { name: 'Tunjukkan' })).toBeVisible();

		// The second card: the other pair of F1.
		const second = cards(page).nth(1);
		await expect(second).toContainText('ε / ε / ε ↔ b / A / ε');
		await expect(second).toContainText(
			'Salah satunya tidak membaca input, dan pop ε adalah awalan dari pop A.'
		);

		// The note of an NDPDA, and then of a DPDA.
		await expect(note(page)).toHaveText(
			'Pada NDPDA ini boleh. Pada DPDA setiap pasangan menjadi kesalahan.'
		);
		await panel(page).getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(note(page)).toHaveText(
			'Pada DPDA ini tidak boleh. Ubah salah satu transisi, atau pilih NDPDA.'
		);
	});

	test('desktop: Enter and Space open and close the list', async ({ page }) => {
		await buildG(page);

		const button = toggle(page);
		await button.focus();
		await page.keyboard.press('Enter');
		await expect(button).toHaveAttribute('aria-expanded', 'true');
		await page.keyboard.press('Space');
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await page.keyboard.press('Space');
		await expect(button).toHaveAttribute('aria-expanded', 'true');
	});
});

test.describe('E3: Tunjukkan with the Tabel tab open', () => {
	test('desktop: first edge selected, rows 1 and 2 marked, focus on row 1, and a second press clears', async ({
		page
	}) => {
		await buildG(page);
		await openList(page);

		const show = cards(page).first().getByRole('button', { name: 'Tunjukkan' });
		await show.focus();
		await page.keyboard.press('Enter');

		// The first transition of the pair is q0 → q1: that edge is selected.
		await expect(edgeNode(page, 0, 1)).toHaveAttribute('aria-pressed', 'true');
		// Both rows of the pair carry the accent bar and aria-current.
		await expect(markedRows(page)).toHaveCount(2);
		await expect(transitions(page).locator('tbody tr').nth(0)).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(transitions(page).locator('tbody tr').nth(1)).toHaveAttribute(
			'aria-current',
			'true'
		);
		// The focus is on the Dari field of the first row.
		await expect(transitions(page).locator('tbody tr').nth(0).locator('.f-from')).toBeFocused();
		// The announcement names the two rows.
		await expect(live(page)).toHaveText('Baris 1 dan 2 ditunjukkan.');
		// The button of the shown pair is pressed.
		await expect(show).toHaveAttribute('aria-pressed', 'true');

		// Pressed again: the marks, the edge selection and the message are cleared. The focus is in
		// the table now, so this press is a click on the same button.
		await show.click();
		await expect(markedRows(page)).toHaveCount(0);
		await expect(edgeNode(page, 0, 1)).toHaveAttribute('aria-pressed', 'false');
		await expect(show).toHaveAttribute('aria-pressed', 'false');
		await expect(live(page)).toHaveText('');
		// The editor says that the selection is cleared.
		await expect(page.getByRole('status')).toContainText('Pilihan dibatalkan.');

		// A third press is a new request, not the first one again: with the focus somewhere else,
		// it comes back to the Dari field of row 1.
		await panel(page).getByRole('radio', { name: 'DPDA', exact: true }).focus();
		await show.click();
		await expect(transitions(page).locator('tbody tr').nth(0).locator('.f-from')).toBeFocused();
		await expect(markedRows(page)).toHaveCount(2);
	});
});

test.describe('E4: Tunjukkan with the Definisi tab open', () => {
	test('desktop: the first edge is selected, the focus stays on the button, no table', async ({
		page
	}) => {
		await buildG(page);
		await tab(page, 'Definisi').click();
		await expect(tab(page, 'Definisi')).toHaveAttribute('aria-selected', 'true');
		await openList(page);

		const show = cards(page).first().getByRole('button', { name: 'Tunjukkan' });
		await show.focus();
		await page.keyboard.press('Enter');

		await expect(edgeNode(page, 0, 1)).toHaveAttribute('aria-pressed', 'true');
		await expect(show).toHaveAttribute('aria-pressed', 'true');
		// The focus stays on the button: nothing outside the panel moves it (amended 2026-11-09).
		await expect(show).toBeFocused();
		// There is no table in this tab.
		await expect(panel(page).locator('.pda-table')).toHaveCount(0);
		// The announcement is the same as in the Tabel tab.
		await expect(live(page)).toHaveText('Baris 1 dan 2 ditunjukkan.');
	});
});

test.describe('E5: the badge after an edit', () => {
	test('desktop: an edit that removes the pair gives Deterministik and forgets the shown pair', async ({
		page
	}) => {
		await buildG(page);
		await openList(page);
		await cards(page).first().getByRole('button', { name: 'Tunjukkan' }).click();
		await expect(markedRows(page)).toHaveCount(2);

		// Delete the ε row (row 1) from the table: the two pairs go with it.
		await transitions(page)
			.locator('tbody tr')
			.nth(0)
			.getByRole('button', { name: 'Hapus baris 1' })
			.click();

		await expect(plain(page)).toHaveText('Deterministik');
		await expect(toggle(page)).toHaveCount(0);
		await expect(markedRows(page)).toHaveCount(0);

		// A competing row again: the badge is a button again, and its list starts closed, not open
		// from the time it was open before the machine became deterministic.
		await addCompetingRow(page);
		await expect(toggle(page)).toBeVisible();
		await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(badge(page).locator('.pairs')).toBeHidden();
		// The card of the new pair is there, behind the closed list.
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toBeHidden();
	});

	test('desktop: an edit that adds a competing transition to F gives one pair', async ({
		page
	}) => {
		await buildF(page);
		await expect(plain(page)).toHaveText('Deterministik');

		await addCompetingRow(page);

		await expect(toggle(page)).toHaveAttribute(
			'aria-label',
			'Non-deterministik · 1 pasangan bersaing'
		);
		await openList(page);
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('a / ε / A ↔ a / A / A');
		await expect(cards(page).first()).toContainText(
			'Keduanya membaca a, dan pop ε adalah awalan dari pop A.'
		);
	});
});

test.describe('E6: two quick edits and a busy engine', () => {
	test('desktop: the badge ends on the last document, not on an older answer', async ({ page }) => {
		// The engine is held at the door until the two edits are done: every question that the page
		// asked before that is answered late, and only the last document may be shown.
		const held: Array<() => void> = [];
		await page.route('**/*.wasm', async (route) => {
			await new Promise<void>((release) => held.push(release));
			await route.continue();
		});
		await buildF(page);
		// The engine has not answered anything yet, so there is no badge to show.
		await expect(badge(page)).toHaveCount(0);

		// Edit 1: a competing row.
		await addCompetingRow(page);
		// Edit 2, at once: remove that row again from the table.
		await transitions(page)
			.locator('tbody tr')
			.nth(1)
			.getByRole('button', { name: 'Hapus baris 2' })
			.click();

		// Let the engine answer everything that it was asked.
		for (const release of held.splice(0)) release();
		await expect(plain(page)).toHaveText('Deterministik');
		await expect(toggle(page)).toHaveCount(0);
	});
});

test.describe('E7: the phone and axe', () => {
	// A scan of axe on a machine that the test builds takes about 7 s on a quiet machine and about
	// 36 s while another worker shares it (measured 2026-11-09). The timeout is the only thing that
	// moves here; every assertion stays as it is (the precedent is T-064 for the heavy unit tests).
	test.describe.configure({ timeout: 60_000 });

	test('phone: the visible text is short, the aria-label is full, and every control is 44 px', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'the phone rule');
		await buildG(page);
		// 360 px, the narrowest phone the design names.
		await page.setViewportSize({ width: 360, height: 740 });

		const button = toggle(page);
		await expect(button).toHaveAttribute('aria-label', 'Non-deterministik · 2 pasangan bersaing');
		await expect(button.locator('.short')).toBeVisible();
		await expect(button.locator('.long')).toBeHidden();
		await expect(button.locator('.short')).toHaveText('Non-det. · 2 ▾');

		const box = await button.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);

		await openList(page);
		const shows = cards(page).getByRole('button', { name: 'Tunjukkan' });
		await expect(shows).toHaveCount(2);
		for (let i = 0; i < 2; i++) {
			const cardBox = await shows.nth(i).boundingBox();
			expect(cardBox!.height, `card ${i}`).toBeGreaterThanOrEqual(44);
		}

		// Nothing overflows sideways in the panel.
		const overflows = await panel(page).evaluate(
			(element) => element.scrollWidth > element.clientWidth + 1
		);
		expect(overflows).toBe(false);

		// The DPDA text is short on a phone too, and keeps its full name.
		await panel(page).getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(button).toHaveAttribute('aria-label', 'Bukan DPDA · 2 pasangan bersaing');
		await expect(button.locator('.short')).toHaveText('Bukan DPDA · 2 ▾');
	});

	test('desktop: axe finds no violation with no badge, and with Deterministik', async ({
		page
	}) => {
		await openPdaSandbox(page);
		// No transition: no badge.
		await expectNoAxeViolations(page);
		await buildF(page);
		await expect(plain(page)).toHaveText('Deterministik');
		await expectNoAxeViolations(page);
	});

	test('desktop: axe finds no violation with the neutral and the warning list open', async ({
		page
	}) => {
		await buildG(page);
		// Neutral, with the list open.
		await expect(toggle(page)).toHaveClass(/tone-neutral/);
		await openList(page);
		await expect(cards(page)).toHaveCount(2);
		await expectNoAxeViolations(page);

		// Warning, with the list open.
		await panel(page).getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(toggle(page)).toHaveClass(/tone-warning/);
		await expectNoAxeViolations(page);
	});
});

// ---- T-070: the dashed competing edges, the second edge of a pair, and the FSM guard ----

/** The drawn group of an edge, or of the edge's line. */
const edgeGroup = (page: Page, from: number, to: number) =>
	page.locator(`svg.world g.edge[data-edge="${from}>${to}"]`);

/** What the browser resolves for the stroke of an edge line, from the component's CSS. */
async function lineStyle(page: Page, from: number, to: number) {
	return edgeGroup(page, from, to)
		.locator('path.line')
		.evaluate((element) => {
			const style = getComputedStyle(element);
			return { dash: style.strokeDasharray, width: style.strokeWidth, stroke: style.stroke };
		});
}

/** The exact class of a drawn edge; `classList.contains` keeps "chosen" apart from "also-chosen". */
const hasClass = (page: Page, from: number, to: number, name: string) =>
	edgeGroup(page, from, to).evaluate(
		(element, className) => element.classList.contains(className),
		name
	);

test.describe('T-070 F3: dashes and the second edge of a pair', () => {
	test('G is dashed as a DPDA, solid as an NDPDA, and Tunjukkan marks the second edge', async ({
		page
	}) => {
		await buildG(page);
		const dpda = panel(page).getByRole('radio', { name: 'DPDA', exact: true });
		const ndpda = panel(page).getByRole('radio', { name: 'NDPDA', exact: true });
		await dpda.click();
		await expect(toggle(page)).toHaveClass(/tone-warning/);

		// The two edges that hold a competing transition are dashed; q1>q1 holds none.
		const first = await lineStyle(page, 0, 1);
		const second = await lineStyle(page, 0, 0);
		expect(first.dash).not.toBe('none');
		expect(second.dash).not.toBe('none');
		expect(first.dash).toBe(second.dash);
		expect((await lineStyle(page, 1, 1)).dash).toBe('none');

		// An NDPDA draws every edge solid, although the engine's two pairs are the same.
		await ndpda.click();
		await expect(toggle(page)).toHaveClass(/tone-neutral/);
		for (const [from, to] of [
			[0, 1],
			[0, 0],
			[1, 1]
		] as const) {
			expect((await lineStyle(page, from, to)).dash, `edge ${from}>${to}`).toBe('none');
		}

		// Back to a DPDA: the two again.
		await dpda.click();
		await expect(toggle(page)).toHaveClass(/tone-warning/);
		expect((await lineStyle(page, 0, 1)).dash).not.toBe('none');
		expect((await lineStyle(page, 0, 0)).dash).not.toBe('none');

		// Tunjukkan on pair 1: the first edge is chosen, the second is marked, and neither loses its
		// dash (a selected competing edge never looks like an ordinary solid edge).
		await openList(page);
		const show = cards(page).first().getByRole('button', { name: 'Tunjukkan' });
		await show.click();
		expect(await hasClass(page, 0, 1, 'chosen')).toBe(true);
		expect(await hasClass(page, 0, 0, 'also-chosen')).toBe(true);
		expect(await hasClass(page, 0, 0, 'chosen')).toBe(false);
		await expect(edgeGroup(page, 0, 0)).toHaveAttribute('data-also-chosen', 'true');
		await expect(page.locator('svg.world text.label.also-chosen')).toHaveCount(1);

		const chosenLine = await lineStyle(page, 0, 1);
		const markedLine = await lineStyle(page, 0, 0);
		expect(markedLine.width).toBe(chosenLine.width);
		expect(chosenLine.dash).not.toBe('none');
		expect(markedLine.dash).not.toBe('none');

		// The selection is one edge: only the first edge node is pressed.
		await expect(edgeNode(page, 0, 1)).toHaveAttribute('aria-pressed', 'true');
		await expect(edgeNode(page, 0, 0)).toHaveAttribute('aria-pressed', 'false');
		await expect(edgeNode(page, 1, 1)).toHaveAttribute('aria-pressed', 'false');

		// A second press clears both marks; the dashes stay, because the machine is still a DPDA.
		await show.click();
		expect(await hasClass(page, 0, 1, 'chosen')).toBe(false);
		expect(await hasClass(page, 0, 0, 'also-chosen')).toBe(false);
		expect((await lineStyle(page, 0, 1)).dash).not.toBe('none');
		expect((await lineStyle(page, 0, 0)).dash).not.toBe('none');

		// Pair 2 lies on one edge: nothing extra to mark.
		await cards(page).nth(1).getByRole('button', { name: 'Tunjukkan' }).click();
		await expect(page.locator('svg.world [data-also-chosen]')).toHaveCount(0);

		// The ε row goes: no pair, no dash. A new competing row: one pair, and only its edge dashes.
		await transitions(page)
			.locator('tbody tr')
			.nth(0)
			.getByRole('button', { name: 'Hapus baris 1' })
			.click();
		await expect(plain(page)).toHaveText('Deterministik');
		await expect(page.locator('svg.world g.edge.dashed')).toHaveCount(0);
		await addCompetingRow(page);
		await expect(toggle(page)).toHaveAttribute('aria-label', 'Bukan DPDA · 1 pasangan bersaing');
		expect((await lineStyle(page, 0, 0)).dash).not.toBe('none');
		expect((await lineStyle(page, 0, 1)).dash).toBe('none');
	});

	test('phone at 360 px: the dashes and the second edge of the pair are there', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'the phone rule');
		await buildG(page);
		await page.setViewportSize({ width: 360, height: 740 });
		await panel(page).getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(toggle(page)).toHaveClass(/tone-warning/);
		expect((await lineStyle(page, 0, 1)).dash).not.toBe('none');
		expect((await lineStyle(page, 0, 0)).dash).not.toBe('none');
		expect((await lineStyle(page, 1, 1)).dash).toBe('none');
		await openList(page);
		await cards(page).first().getByRole('button', { name: 'Tunjukkan' }).click();
		expect(await hasClass(page, 0, 0, 'also-chosen')).toBe(true);
		await expect(edgeNode(page, 0, 0)).toHaveAttribute('aria-pressed', 'false');
	});
});

test.describe('T-070 AC1: the FSM drawing with the default props', () => {
	test('every edge and label of the FSM diagram keeps the pre-change class, and no attribute is added', async ({
		page
	}) => {
		await openSandbox(page);
		const edges = await page
			.locator('svg.world g.edge')
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('class')));
		const labels = await page
			.locator('svg.world text.label')
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('class')));
		const pressed = await page
			.locator('svg.world g.edge-node')
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-pressed')));

		// The values of origin/staging (c79da5f), captured before the component changed: six
		// edges, six labels and six edge buttons, all with the plain class. Svelte appends its
		// scope token (`svelte-1df1flw` then) to every element that a scoped rule matches; that
		// token changes with the component's CSS, so the check compares the names without it.
		const semantic = (classes: Array<string | null>) =>
			classes.map((value) =>
				(value ?? '')
					.split(/\s+/)
					.filter((name) => !name.startsWith('svelte-'))
					.join(' ')
			);
		expect(semantic(edges)).toEqual(['edge', 'edge', 'edge', 'edge', 'edge', 'edge']);
		expect(semantic(labels)).toEqual(['label', 'label', 'label', 'label', 'label', 'label']);
		expect(pressed).toEqual(['false', 'false', 'false', 'false', 'false', 'false']);

		// The new drawing must not appear with the default props.
		await expect(page.locator('svg.world g.edge.dashed')).toHaveCount(0);
		await expect(page.locator('svg.world g.edge.also-chosen')).toHaveCount(0);
		await expect(page.locator('svg.world [data-also-chosen]')).toHaveCount(0);
	});
});
