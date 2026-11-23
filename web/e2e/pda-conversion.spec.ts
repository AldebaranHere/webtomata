// The Konversi tab of the PDA editor (T-038b; design/screens/pda-simulation-conversion.md,
// section 2, frame C): the RNF stepper, the grammar stepper, the read-only canvas, the window and
// "Buka PDA ini sebagai mesin baru". The grammar handoff (AC5) is added after the seam merge.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow, records } from './cross/db.ts';
import { pdaDocumentFrom, wcwrSample } from '../src/lib/editor/pda-samples.ts';
import type { PdaDocument } from '../src/lib/editor/pda-document.ts';
import { serializePdaDocument } from '../src/lib/editor/pda-document.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const convert = (page: Page) => panel(page).locator('.convert');
const sentence = (page: Page) => convert(page).locator('.sentence');
const chips = (page: Page) => convert(page).locator('.chips button');
const removed = (page: Page) => convert(page).locator('.diff.removed li');
const added = (page: Page) => convert(page).locator('.diff.added li');
const rules = (page: Page) => convert(page).locator('ol.rules li');
const canvas = (page: Page) => page.locator('.conversion-canvas');

/** A PDA record, opened as the latest one. The page must already be on the site. */
async function openSeeded(page: Page, doc: PdaDocument, title: string) {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await page.waitForLoadState('networkidle');
	await putRow(page, {
		id: 'pda-conv',
		recordVersion: 1,
		type: 'pda',
		title,
		kind: doc.kind,
		createdAt: 1,
		updatedAt: 1,
		openedAt: Date.now(),
		doc: serializePdaDocument({ ...doc, title })
	});
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.locator('p.title')).toHaveText(title);
	await expect(panel(page)).toBeVisible();
}

async function openConversion(page: Page) {
	await tab(page, 'Konversi').click();
	await expect(convert(page)).toBeVisible();
}

async function start(page: Page) {
	await convert(page).getByRole('button', { name: 'Mulai' }).click();
	await expect(chips(page).first()).toBeVisible();
}

async function next(page: Page, times = 1) {
	for (let i = 0; i < times; i++) {
		await convert(page).getByRole('button', { name: 'Maju' }).click();
	}
}

async function last(page: Page) {
	await convert(page).getByRole('button', { name: 'Ke hasil' }).click();
}

const one = (): PdaDocument =>
	pdaDocumentFrom({
		title: 'F-ONE',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A', 'B', 'C'],
		states: [
			[180, 200, 'p'],
			[440, 200, 'q']
		],
		start: 0,
		accepting: [1],
		transitions: [[0, 'a', [], ['A', 'B', 'C'], 1]]
	});

const noStart = (): PdaDocument => ({
	...pdaDocumentFrom({
		title: 'F-NOSTART',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A'],
		states: [[180, 200, 'q0']],
		accepting: [0],
		transitions: []
	}),
	start: null
});

/** F-MANY: one pop-nothing transition; the RNF step adds one transition per stack symbol. */
const many = (): PdaDocument =>
	pdaDocumentFrom({
		title: 'F-MANY',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: Array.from({ length: 51 }, (_, i) => `S${i + 1}`),
		states: [
			[180, 200, 'p'],
			[440, 200, 'q']
		],
		start: 0,
		accepting: [1],
		transitions: [[0, 'a', [], [], 1]]
	});

test.describe('E1: the tab and the RNF stepper', () => {
	test('desktop: F-WCW walks 5 steps, shows Dihapus/Ditambah and opens the RNF as a new PDA', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop layout');
		const doc = wcwrSample('wcwR');
		await openSeeded(page, doc, 'wcwR');
		const before = await records(page);
		const sourceBefore = before.find((row) => row.id === 'pda-conv')!;

		await openConversion(page);
		await start(page);
		await expect(
			convert(page).getByRole('heading', { name: 'restricted normal form (RNF)' })
		).toBeVisible();
		await expect(convert(page).getByText('Langkah 1 dari 5')).toBeVisible();
		await expect(sentence(page)).toContainText('Awali dengan transisi');

		await next(page, 2);
		await expect(convert(page).getByText('Langkah 3 dari 5')).toBeVisible();
		await expect(removed(page)).toHaveCount(1);
		await expect(removed(page).first()).toContainText('a / ε / A');
		await expect(added(page)).toHaveCount(3);
		await expect(canvas(page)).toBeVisible();
		await expect(canvas(page).locator('figcaption')).toHaveText('Hasil (hanya baca): RNF');

		const after = await records(page);
		expect(after.find((row) => row.id === 'pda-conv')!.doc).toBe(sourceBefore.doc);
		await expect(page.getByRole('button', { name: /Urungkan/ })).toBeDisabled();

		await last(page);
		await expect(
			convert(page).getByRole('button', { name: 'Buka PDA ini sebagai mesin baru' })
		).toBeVisible();
		await convert(page).getByRole('button', { name: 'Buka PDA ini sebagai mesin baru' }).click();
		await expect(page.locator('p.title')).toHaveText('wcwR (RNF)');
		await expect(page.locator('.bar .count')).toHaveText('4 state');

		const saved = await records(page);
		expect(saved.find((row) => row.id === 'pda-conv')!.doc).toBe(sourceBefore.doc);
		expect(saved.some((row) => row.title === 'wcwR (RNF)')).toBe(true);
	});

	test('desktop: F-ONE shows the expansion step, and F-NOSTART shows the calm refusal', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop layout');
		await openSeeded(page, one(), 'F-ONE');
		await openConversion(page);
		await start(page);
		await expect(convert(page).getByText('Langkah 1 dari 3')).toBeVisible();
		await last(page);
		await expect(removed(page)).toHaveCount(1);
		await expect(removed(page).first()).toContainText('a / ε / ABC');
		await expect(added(page)).toHaveCount(4);

		await openSeeded(page, noStart(), 'F-NOSTART');
		await openConversion(page);
		await convert(page).getByRole('button', { name: 'Mulai' }).click();
		await expect(convert(page).locator('.note')).toContainText('PDA belum punya start state');
		await expect(chips(page)).toHaveCount(0);
		await expectNoAxeViolations(page);
	});

	test('desktop: a step with more than 50 added transitions is windowed', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop layout');
		await openSeeded(page, many(), 'F-MANY');
		await openConversion(page);
		await start(page);
		await last(page);
		await expect(added(page)).toHaveCount(51);
		await expect(convert(page).getByText('… 2 baris sebelumnya')).toBeVisible();
		await expectNoAxeViolations(page);
	});
});

test.describe('E2: the grammar stepper and the close', () => {
	test('desktop: stage 2 reaches 76 rules, windows them, and Tutup leaves the document and history', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop layout');
		const doc = wcwrSample('wcwR');
		await openSeeded(page, doc, 'wcwR');
		const before = (await records(page)).find((row) => row.id === 'pda-conv')!;
		await openConversion(page);
		await start(page);
		await last(page);
		await convert(page).getByRole('button', { name: 'Ke tata bahasa' }).click();
		await expect(convert(page).getByText('Langkah 1 dari 14')).toBeVisible();
		await expect(convert(page).getByText('1 aturan')).toBeVisible();
		await last(page);
		await expect(convert(page).getByText('76 aturan')).toBeVisible();
		await expect(convert(page).getByText('… 26 baris sebelumnya')).toBeVisible();
		await expect(rules(page)).toHaveCount(51);
		await expect(
			convert(page).getByRole('heading', { name: 'tata bahasa bebas konteks (CFG)' })
		).toBeVisible();
		await expectNoAxeViolations(page);

		await convert(page).getByRole('button', { name: 'Tutup konversi' }).click();
		await expect(convert(page).getByRole('button', { name: 'Mulai' })).toBeVisible();
		await expect(canvas(page)).toHaveCount(0);
		await expect(page.locator('p.title')).toHaveText('wcwR');
		await expect(page.getByRole('button', { name: /Urungkan/ })).toBeDisabled();
		expect((await records(page)).find((row) => row.id === 'pda-conv')!.doc).toBe(before.doc);
		await expectNoAxeViolations(page);
	});

	test('desktop: an edit closes an open conversion', async ({ page, isMobile }) => {
		test.skip(isMobile, 'desktop layout');
		await openSeeded(page, wcwrSample('wcwR'), 'wcwR');
		await openConversion(page);
		await start(page);
		await expect(chips(page).first()).toBeVisible();
		await tab(page, 'Tabel').click();
		await panel(page).getByRole('radio', { name: 'NDPDA', exact: true }).click();
		await tab(page, 'Konversi').click();
		await expect(chips(page)).toHaveCount(0);
		await expect(convert(page).getByRole('button', { name: 'Mulai' })).toBeVisible();
	});
});

test.describe('E3: phone and axe', () => {
	test('phone: the Konversi tab has no sideways scroll and 44 px controls', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'phone layout');
		await openSeeded(page, wcwrSample('wcwR'), 'wcwR');
		await openConversion(page);
		await start(page);
		const scroll = await page.evaluate(() => ({
			width: document.documentElement.scrollWidth,
			window: window.innerWidth
		}));
		expect(scroll.width).toBeLessThanOrEqual(scroll.window + 1);
		const box = await convert(page).getByRole('button', { name: 'Maju' }).boundingBox();
		expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		await expectNoAxeViolations(page);
		await next(page, 2);
		await expectNoAxeViolations(page);
	});
});

test.describe('E4: AC5, the grammar handoff', () => {
	test('desktop: opens the grammar with the engine names, 76 rules and the source PDA unchanged', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop layout');
		const doc = wcwrSample('wcwR');
		await openSeeded(page, doc, 'wcwR');
		const before = (await records(page)).find((row) => row.id === 'pda-conv')!;
		await openConversion(page);
		await start(page);
		await last(page);
		await convert(page).getByRole('button', { name: 'Ke tata bahasa' }).click();
		await expect(convert(page).getByText('Langkah 1 dari 14')).toBeVisible();
		await last(page);
		await convert(page).getByRole('button', { name: 'Buka sebagai tata bahasa' }).click();

		await expect(page).toHaveURL(/\?mode=grammar/);
		await expect(page.getByRole('button', { name: /Tata Bahasa/ }).first()).toBeVisible();
		await expect(page.locator('.active-item-title')).toHaveText('wcwR (CFG)');
		await expect(page.locator('.custom-card.selected .card-title')).toHaveText('wcwR (CFG)');

		const saved = await page.evaluate(() => {
			const list = JSON.parse(localStorage.getItem('webtomata.grammar.custom') ?? '[]') as Array<{
				id: string;
				title: string;
				grammar: string;
			}>;
			const item = list.find((entry) => entry.title === 'wcwR (CFG)');
			let rules = 0;
			if (item) {
				for (const line of item.grammar.split('\n')) {
					const arrow = line.indexOf(' -> ');
					rules += line.slice(arrow + 4).split(' | ').length;
				}
			}
			return {
				id: item?.id ?? '',
				title: item?.title ?? '',
				text: item?.grammar ?? '',
				rules,
				selected: localStorage.getItem('webtomata.grammar.selected_id')
			};
		});
		expect(saved.title).toBe('wcwR (CFG)');
		expect(saved.selected).toBe(saved.id);
		expect(saved.rules).toBe(76);
		expect(saved.text).toContain('V_');
		expect(saved.text).not.toContain('<q');

		const after = (await records(page)).find((row) => row.id === 'pda-conv')!;
		expect(after.doc).toBe(before.doc);
	});
});
