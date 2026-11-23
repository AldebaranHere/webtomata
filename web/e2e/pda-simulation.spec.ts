// The Simulasi tab of the PDA editor (docs/agent/PLAN.md T-038a; design/screens/pda-simulation-conversion.md,
// section 1): the default tab, a run of one string with the stack and the used edge, the verdict
// and its reason, the peak, a stopped run, the many-strings list, the refusals, and the phone.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { putRow } from './cross/db.ts';
import {
	anbnSample,
	pdaDocumentFrom,
	wcwrSample,
	wwrSample
} from '../src/lib/editor/pda-samples.ts';
import type { PdaDocument } from '../src/lib/editor/pda-document.ts';
import { serializePdaDocument } from '../src/lib/editor/pda-document.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const runPanel = (page: Page) => panel(page).locator('.run');
const input = (page: Page) => runPanel(page).getByLabel('String masukan');
const runButton = (page: Page, name: string | RegExp) =>
	runPanel(page).getByRole('button', { name });
const stack = (page: Page) => runPanel(page).locator('.stack');
const cells = (page: Page) => stack(page).locator('.cells li');
const verdict = (page: Page) => runPanel(page).locator('.verdict');
/** The visible step line; the live region says the same words to a screen reader. */
const stepLine = (page: Page) => runPanel(page).locator('.heading .muted');
const tests = (page: Page) => panel(page).locator('.tests');
const testRow = (page: Page, name: string | RegExp) =>
	tests(page)
		.getByRole('listitem')
		.filter({ has: page.getByRole('button', { name }) });
const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());

/** A PDA record, opened as the latest one. The page must already be on the site (IndexedDB's origin). */
async function openSeeded(page: Page, doc: PdaDocument, title: string) {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await putRow(page, {
		id: 'pda-sim',
		recordVersion: 1,
		type: 'pda',
		title,
		kind: doc.kind,
		createdAt: 1,
		updatedAt: 1,
		openedAt: Date.now(),
		doc: serializePdaDocument(doc)
	});
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.locator('p.title')).toHaveText(title);
	await expect(panel(page)).toBeVisible();
}

/** One step of the run: the field holds the string, and the button walks the trace. */
async function step(page: Page, isMobile: boolean, times = 1) {
	for (let i = 0; i < times; i++) {
		await press(runButton(page, 'Langkah berikutnya'), isMobile);
	}
}

async function startRunWith(page: Page, text: string, isMobile: boolean) {
	await input(page).fill(text);
	await step(page, isMobile);
}

/** The task's F-LOOP: one state, an ε-transition that pushes `A`, so a run is stopped by the stack. */
const loopDoc = (title: string): PdaDocument =>
	pdaDocumentFrom({
		title,
		kind: 'ndpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A'],
		states: [[180, 200, 'q0']],
		start: 0,
		accepting: [],
		transitions: [[0, null, [], ['A'], 0]]
	});

test.describe('E1: the tab and the field', () => {
	test('a fresh PDA visit opens Simulasi, with the input, the four buttons and the hint', async ({
		page
	}) => {
		await page.goto('/sandbox?mode=pda');
		await page.locator('.editor[data-ready]').waitFor();
		// Leave the first-run card of the empty record.
		await page
			.getByRole('button', { name: /^(Mulai dari kanvas kosong|Start from an empty canvas)$/ })
			.click();
		await expect(panel(page)).toBeVisible();
		await expect(tab(page, 'Simulasi')).toHaveAttribute('aria-selected', 'true');

		await expect(input(page)).toBeVisible();
		await expect(runPanel(page).getByText('Kosongkan untuk string kosong (ε).')).toBeVisible();
		const names = ['Kembali ke awal', 'Langkah sebelumnya', 'Langkah berikutnya', 'Jalankan'];
		for (const name of names) {
			await expect(runButton(page, name)).toBeVisible();
		}
		// Nothing ran yet: no stack, no verdict, no peak.
		await expect(stack(page)).toHaveCount(0);
		await expect(verdict(page)).toHaveCount(0);
		await expectNoAxeViolations(page);
	});
});

test.describe('E2: one run on the DPDA aⁿbⁿ', () => {
	test('aabb: the stack, the used edge, the ring, the verdict and the peak', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, anbnSample('AnBn'), 'AnBn');
		await startRunWith(page, 'aabb', isMobile);

		// The first press of "Langkah berikutnya" makes the run and shows its first step (index 1).
		await expect(stepLine(page)).toHaveText('Langkah 2 dari 5');
		await expect(cells(page)).toHaveCount(1);
		await expect(cells(page).nth(0)).toContainText('A');
		await expect(stack(page).getByText('State: q0')).toBeVisible();
		// The used edge is q0 → q0, and its label is the one of the step.
		await expect(page.locator('svg.world g.edge[data-taken]')).toHaveAttribute('data-edge', '0>0');
		await expect(page.locator('svg.world .labels text.label.taken')).toHaveText('a / ε / A');
		await expect(page.locator('svg.world g.node[data-active]')).toHaveAttribute('data-state', '0');

		await step(page, isMobile);
		await expect(cells(page)).toHaveCount(2);
		await expect(cells(page).nth(0)).toContainText('A');
		await expect(cells(page).nth(1)).toContainText('A');

		await step(page, isMobile);
		await expect(cells(page)).toHaveCount(1);
		await expect(page.locator('svg.world g.edge[data-taken]')).toHaveAttribute('data-edge', '0>1');
		await expect(page.locator('svg.world .labels text.label.taken')).toHaveText('b / A / ε');
		await expect(page.locator('svg.world g.node[data-active]')).toHaveAttribute('data-state', '1');

		await step(page, isMobile);
		await expect(stack(page).getByText('kosong')).toBeVisible();
		await expect(verdict(page)).toHaveAttribute('data-verdict', 'accepted');
		await expect(verdict(page)).toContainText('Diterima');
		await expect(runPanel(page)).toContainText('Yang ditunjukkan: komputasi yang menerima');
		await expect(runPanel(page)).toContainText('Konfigurasi bersamaan terbanyak: 1');
		await expect(runPanel(page)).toContainText(
			'Banyaknya komputasi yang hidup di satu tingkat BFS. DPDA selalu 1.'
		);
		await expect(stepLine(page)).toHaveText('Langkah 5 dari 5');

		// Back to the start: step 1 of 5, the stack empty.
		await press(runButton(page, 'Kembali ke awal'), isMobile);
		await expect(stepLine(page)).toHaveText('Langkah 1 dari 5');
		await expect(stack(page).getByText('kosong')).toBeVisible();
		await expect(cells(page)).toHaveCount(0);
		await expectNoAxeViolations(page);
	});

	test('the first stack cell is the top, with two kinds of symbol', async ({ page, isMobile }) => {
		await openSeeded(page, wcwrSample('WcWr'), 'WcWr');
		await startRunWith(page, 'ab', isMobile);
		// a pushes A, b pushes B: the top of the stack is B, and the column draws it first.
		await step(page, isMobile);
		await expect(cells(page)).toHaveCount(2);
		await expect(cells(page).nth(0)).toContainText('B');
		await expect(cells(page).nth(1)).toContainText('A');
	});

	test('abb: Ditolak with the engine’s reason and the furthest line', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, anbnSample('AnBn'), 'AnBn');
		await startRunWith(page, 'abb', isMobile);
		await step(page, isMobile);
		await expect(verdict(page)).toHaveAttribute('data-verdict', 'rejected');
		await expect(verdict(page)).toContainText('Ditolak');
		await expect(verdict(page)).toContainText('masih ada 1 simbol input yang belum dibaca');
		await expect(runPanel(page)).toContainText('Yang ditunjukkan: komputasi yang paling jauh');
	});
});

test.describe('E3: the NDPDA wwᴿ and the peak', () => {
	test('abba is accepted with peak 3', async ({ page, isMobile }) => {
		await openSeeded(page, wwrSample('WwR'), 'WwR');
		await startRunWith(page, 'abba', isMobile);
		await step(page, isMobile, 4);
		await expect(verdict(page)).toHaveAttribute('data-verdict', 'accepted');
		await expect(runPanel(page)).toContainText('Konfigurasi bersamaan terbanyak: 3');
	});
});

test.describe('E4: a stopped run and the stack window', () => {
	test('the loop stops at once, and the stack shows 8, then 7 and the rest', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, loopDoc('Loop'), 'Loop');
		await startRunWith(page, 'a', isMobile);

		// The box shows as soon as the engine answers, on step 1 (B3).
		await expect(verdict(page)).toHaveAttribute('data-verdict', 'stopped');
		await expect(verdict(page)).toContainText('Dihentikan: batas kedalaman stack tercapai.');
		await expect(runPanel(page)).toContainText('Konfigurasi bersamaan terbanyak: 1');
		await expect(runPanel(page)).toContainText('Dijelajahi: 501 konfigurasi');

		// 8 steps: 8 cells, and no overflow cell (one step is the start, one is done above).
		await step(page, isMobile, 7);
		await expect(cells(page)).toHaveCount(8);
		await expect(stack(page).getByText(/lagi$/)).toHaveCount(0);

		// 12 steps: the top 7 and 5 more.
		await step(page, isMobile, 4);
		await expect(cells(page)).toHaveCount(8);
		await expect(cells(page).last()).toHaveText('… 5 lagi');

		await expectNoAxeViolations(page);
	});
});

test.describe('E5: the computation list', () => {
	test('a row jumps to its step, and a long trace keeps the last 50 rows', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop project');
		await openSeeded(page, loopDoc('Loop'), 'Loop');
		await startRunWith(page, 'a', isMobile);

		// 4 more steps: the rows of steps 2 to 5 exist, and a row jumps back to step 2.
		await step(page, isMobile, 4);
		await expect(runPanel(page).locator('.rows button.row')).toHaveCount(6);
		await runPanel(page).locator('.rows button.row').nth(1).click();
		await expect(stepLine(page)).toHaveText('Langkah 2 dari 501');
		await expect(runPanel(page).locator('.rows button.row.current .n')).toHaveText('2');

		// 60 steps: the list shows the last 50 and says how many are before them.
		await step(page, isMobile, 58);
		await expect(runPanel(page).locator('.rows button.row')).toHaveCount(50);
		await expect(runPanel(page).locator('.rows li.muted')).toHaveText('… 10 baris sebelumnya');
		await expectNoAxeViolations(page);
	});
});

test.describe('E6: many strings', () => {
	test('three strings, their peaks, a row run, a refusal, a machine change and a tab round-trip', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, anbnSample('AnBn'), 'AnBn');
		await expect(tab(page, 'Simulasi')).toHaveAttribute('aria-selected', 'true');

		const add = async (text: string) => {
			await tests(page).getByRole('textbox', { name: 'Tambah string' }).fill(text);
			await press(tests(page).getByRole('button', { name: 'Tambah' }), isMobile);
		};
		await add('aabb');
		await add('abb');
		await add('');

		const aabb = testRow(page, 'Jalankan aabb');
		const abb = testRow(page, 'Jalankan abb');
		const empty = testRow(page, 'Jalankan string kosong');
		await expect(aabb.locator('.badge')).toHaveText('Diterima');
		await expect(aabb.locator('.peak')).toHaveText('1');
		await expect(abb.locator('.badge')).toHaveText('Ditolak');
		await expect(empty.locator('.badge')).toHaveText('Ditolak');

		// A row runs its string above, and the field shows the same string.
		await press(abb.getByRole('button', { name: 'Jalankan abb' }), isMobile);
		await expect(input(page)).toHaveValue('abb');
		await step(page, isMobile);
		await expect(verdict(page)).toContainText('Ditolak');

		// A symbol that is not in the alphabet is a calm refusal, not Ditolak.
		await add('c');
		const refused = testRow(page, 'Jalankan c');
		await expect(refused.locator('.badge')).toHaveText('Tidak bisa dijalankan');
		await expect(refused.locator('.peak')).toHaveText('—');
		await expect(tests(page)).toContainText('tidak ada di alfabet');

		// An edit of the machine clears the answers at once (the badge asks again), then re-asks.
		await page.getByRole('application', { name: 'Kanvas mesin' }).focus();
		await page.keyboard.press('n');
		await expect(page.locator('svg.world g.node')).toHaveCount(3);
		await expect(aabb.locator('.badge')).toHaveText('Memeriksa…', { timeout: 2_000 });
		await expect(aabb.locator('.badge')).toHaveText('Diterima', { timeout: 5_000 });
		await tab(page, 'Tabel').click();
		await tab(page, 'Simulasi').click();
		await expect(testRow(page, 'Jalankan aabb').locator('.badge')).toHaveText('Diterima');
		await expectNoAxeViolations(page);
	});
});

test.describe('E7: what cannot be run', () => {
	// The engine-failure case blocks the WASM file on purpose.
	test.use({ allowedProblem: /./ });

	test('an unknown symbol and a machine without a start state say why', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, anbnSample('AnBn'), 'AnBn');
		await startRunWith(page, 'c', isMobile);
		await expect(runPanel(page).getByText(/Simbol "c".*tidak ada di alfabet/)).toBeVisible();
		await expect(verdict(page)).toHaveCount(0);

		await openSeeded(page, { ...anbnSample('NoStart'), start: null }, 'NoStart');
		await startRunWith(page, 'a', isMobile);
		await expect(runPanel(page).getByText('Mesin belum punya start state.')).toBeVisible();
		await expect(verdict(page)).toHaveCount(0);
	});

	test('an engine failure is a calm notice with a retry', async ({ page, isMobile }) => {
		await page.route('**/*.wasm', (route) => route.abort());
		await page.goto('/sandbox?mode=pda');
		await page.locator('.editor[data-ready]').waitFor();
		const card = page.locator('.first-run');
		if ((await card.count()) > 0) {
			await card.getByRole('button', { name: /Mulai dari kanvas kosong/ }).click();
		}
		await input(page).fill('a');
		await step(page, isMobile);
		await expect(runPanel(page).getByText('Engine berhenti.')).toBeVisible();
		await expect(runButton(page, 'Coba lagi')).toBeVisible();
	});
});

test.describe('E8: the phone', () => {
	test('every control is 44 px, there is no sideways scroll, and axe is clean', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'phone project');
		await page.setViewportSize({ width: 360, height: 740 });
		await openSeeded(page, anbnSample('AnBn'), 'AnBn');
		await startRunWith(page, 'aabb', isMobile);

		for (const name of [
			'Kembali ke awal',
			'Langkah sebelumnya',
			'Langkah berikutnya',
			'Jalankan'
		]) {
			const box = await runButton(page, name).boundingBox();
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
		const over = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(over).toBeLessThanOrEqual(0);
		await expectNoAxeViolations(page);
	});
});
