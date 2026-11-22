// The Simulasi tab of the PDA editor in every engine (T-038a): the tab opens first, a run of
// aabb reaches Diterima with its peak, the stack is top-first, the used edge is stroked, and a
// stopped run shows its neutral box at once. The full set lives in `e2e/pda-simulation.spec.ts`;
// this is the part that must hold in Firefox and WebKit too.
import { expect, expectNoAxeViolations, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow } from './db.ts';
import { anbnSample, pdaDocumentFrom } from '../../src/lib/editor/pda-samples.ts';
import type { PdaDocument } from '../../src/lib/editor/pda-document.ts';
import { serializePdaDocument } from '../../src/lib/editor/pda-document.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const runPanel = (page: Page) => panel(page).locator('.run');

async function openSeeded(page: Page, doc: PdaDocument, title: string) {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await putRow(page, {
		id: 'pda-cross',
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
}

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

test('the Simulasi tab opens first, and aabb is accepted with its stack, its edge and its peak', async ({
	page
}) => {
	await openSeeded(page, anbnSample('AnBn'), 'AnBn');
	await expect(panel(page).getByRole('tab', { name: 'Simulasi' })).toHaveAttribute(
		'aria-selected',
		'true'
	);

	await runPanel(page).getByLabel('String masukan').fill('aabb');
	for (let i = 0; i < 4; i++) {
		await runPanel(page).getByRole('button', { name: 'Langkah berikutnya' }).click();
	}
	await expect(runPanel(page).locator('.verdict')).toContainText('Diterima');
	await expect(runPanel(page)).toContainText('Konfigurasi bersamaan terbanyak: 1');
	await expect(runPanel(page).locator('.stack').getByText('kosong')).toBeVisible();
	await expect(page.locator('svg.world g.edge[data-taken]')).toHaveAttribute('data-edge', '1>1');
	await expectNoAxeViolations(page);
});

test('a stopped run shows its neutral box at once', async ({ page }) => {
	await openSeeded(page, loopDoc('Loop'), 'Loop');
	await runPanel(page).getByLabel('String masukan').fill('a');
	await runPanel(page).getByRole('button', { name: 'Langkah berikutnya' }).click();
	await expect(runPanel(page).locator('.verdict')).toHaveAttribute('data-verdict', 'stopped');
	await expect(runPanel(page).locator('.verdict')).toContainText(
		'Dihentikan: batas kedalaman stack tercapai.'
	);
	await expect(runPanel(page)).toContainText('Dijelajahi: 501 konfigurasi');
	await expectNoAxeViolations(page);
});
