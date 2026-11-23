// Per-line transition emphasis in PDA simulation (docs/agent/PLAN.md T-085):
// F-WWR (two transitions on q0 -> q0), F-FOUR (four transitions on q0 -> q1 with "+ 2 lagi"),
// no stale mark when no run is open, FSM untouched, and axe clean on desktop and phone.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { putRow } from './cross/db.ts';
import { pdaDocumentFrom, wwrSample } from '../src/lib/editor/pda-samples.ts';
import type { PdaDocument } from '../src/lib/editor/pda-document.ts';
import { serializePdaDocument } from '../src/lib/editor/pda-document.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const runPanel = (page: Page) => panel(page).locator('.run');
const input = (page: Page) => runPanel(page).getByLabel('String masukan');
const runButton = (page: Page, name: string | RegExp) =>
	runPanel(page).getByRole('button', { name });
const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());

async function openSeeded(page: Page, doc: PdaDocument, title: string) {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await putRow(page, {
		id: 'pda-taken-line',
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

async function step(page: Page, isMobile: boolean, times = 1) {
	for (let i = 0; i < times; i++) {
		await press(runButton(page, 'Langkah berikutnya'), isMobile);
	}
}

async function fontWeightOf(locator: Locator): Promise<number> {
	return locator.evaluate((el) => Number(getComputedStyle(el).fontWeight));
}

/** F-FOUR: four transitions between q0 and q1 so lines 0 and 1 show and 2, 3 hide under "+ 2 lagi". */
const fourDoc = (title: string): PdaDocument =>
	pdaDocumentFrom({
		title,
		kind: 'dpda',
		inputAlphabet: ['a', 'b', 'c', 'd'],
		stackAlphabet: ['A'],
		states: [
			[180, 200, 'q0'],
			[520, 200, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], [], 1],
			[0, 'b', [], [], 1],
			[0, 'c', [], [], 1],
			[0, 'd', [], [], 1]
		]
	});

test.describe('T-085 AC3 & AC6: F-WWR per-line emphasis and axe', () => {
	test('emphasizes only the fired line of q0->q0 on abba, keeps the arrow lit, and passes axe', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, wwrSample('WwR'), 'WwR');

		// AC5 / B4: before any run is started, no edge has data-taken-lines and no tspan is emphasized.
		await expect(page.locator('svg.world [data-taken-lines]')).toHaveCount(0);
		await expect(page.locator('svg.world .labels tspan.taken')).toHaveCount(0);

		const edge00 = page.locator('svg.world g.edge[data-edge="0>0"]');
		const label00 = page.locator('svg.world .labels text.label').filter({ hasText: 'a / ε / A' });
		const tspan0 = label00.locator('tspan').nth(0);
		const tspan1 = label00.locator('tspan').nth(1);

		await input(page).fill('abba');
		// Step 1: reads 'a' via 0>0 line 0 ("a / ε / A")
		await step(page, isMobile);
		await expect(edge00).toHaveAttribute('data-taken', 'true');
		await expect(edge00).toHaveAttribute('data-taken-lines', '0');
		await expect(label00).not.toHaveClass(/\btaken\b/);
		await expect(tspan0).toHaveClass(/\btaken\b/);
		await expect(tspan1).not.toHaveClass(/\btaken\b/);

		const w0Step1 = await fontWeightOf(tspan0);
		const w1Step1 = await fontWeightOf(tspan1);
		expect(w0Step1).toBeGreaterThan(w1Step1);
		expect(w0Step1).toBeGreaterThanOrEqual(600);

		// AC6: axe clean at a step with a marked line, on desktop and phone.
		await expectNoAxeViolations(page);

		// Step 2: reads 'b' via 0>0 line 1 ("b / ε / B")
		await step(page, isMobile);
		await expect(edge00).toHaveAttribute('data-taken', 'true');
		await expect(edge00).toHaveAttribute('data-taken-lines', '1');
		await expect(label00).not.toHaveClass(/\btaken\b/);
		await expect(tspan0).not.toHaveClass(/\btaken\b/);
		await expect(tspan1).toHaveClass(/\btaken\b/);

		const w0Step2 = await fontWeightOf(tspan0);
		const w1Step2 = await fontWeightOf(tspan1);
		expect(w1Step2).toBeGreaterThan(w0Step2);
		expect(w1Step2).toBeGreaterThanOrEqual(600);

		// Reset to step 0: no edge or line is marked.
		await press(runButton(page, 'Kembali ke awal'), isMobile);
		await expect(page.locator('svg.world [data-taken-lines]')).toHaveCount(0);
		await expect(page.locator('svg.world .labels tspan.taken')).toHaveCount(0);
	});
});

test.describe('T-085 AC4: F-FOUR overflow line emphasis', () => {
	test('emphasizes "+ 2 lagi" when hidden transition 2 or 3 fires, leaving lines 0 and 1 normal', async ({
		page,
		isMobile
	}) => {
		await openSeeded(page, fourDoc('Four'), 'Four');

		const edge01 = page.locator('svg.world g.edge[data-edge="0>1"]');
		const label01 = page.locator('svg.world .labels text.label').filter({ hasText: '+ 2 lagi' });
		const tspan0 = label01.locator('tspan').nth(0);
		const tspan1 = label01.locator('tspan').nth(1);
		const tspan2 = label01.locator('tspan').nth(2);

		// Position 2 ('c'): hidden under "+ 2 lagi"
		await input(page).fill('c');
		await step(page, isMobile);
		await expect(edge01).toHaveAttribute('data-taken', 'true');
		await expect(edge01).toHaveAttribute('data-taken-lines', '2');
		await expect(label01).not.toHaveClass(/\btaken\b/);
		await expect(tspan0).not.toHaveClass(/\btaken\b/);
		await expect(tspan1).not.toHaveClass(/\btaken\b/);
		await expect(tspan2).toHaveClass(/\btaken\b/);
		await expect(tspan2).toHaveText('+ 2 lagi');

		const w0 = await fontWeightOf(tspan0);
		const w1 = await fontWeightOf(tspan1);
		const w2 = await fontWeightOf(tspan2);
		expect(w2).toBeGreaterThan(w0);
		expect(w2).toBeGreaterThan(w1);
		expect(w2).toBeGreaterThanOrEqual(600);

		// Position 3 ('d'): also maps to line 2 ("+ 2 lagi")
		await input(page).fill('d');
		await step(page, isMobile);
		await expect(edge01).toHaveAttribute('data-taken', 'true');
		await expect(edge01).toHaveAttribute('data-taken-lines', '2');
		await expect(tspan0).not.toHaveClass(/\btaken\b/);
		await expect(tspan1).not.toHaveClass(/\btaken\b/);
		await expect(tspan2).toHaveClass(/\btaken\b/);
	});
});

test.describe('T-085 AC5 & B6: FSM canvas stays untouched', () => {
	test('FSM simulation never sets data-taken-lines or tspan.taken', async ({ page, isMobile }) => {
		await openSandbox(page);
		await panel(page).getByLabel('String masukan').fill('0101');
		await press(panel(page).getByRole('button', { name: 'Langkah berikutnya' }), isMobile);
		await expect(page.locator('svg.world g.edge[data-taken]')).toHaveCount(1);
		await expect(page.locator('svg.world [data-taken-lines]')).toHaveCount(0);
		await expect(page.locator('svg.world .labels tspan.taken')).toHaveCount(0);
	});
});
