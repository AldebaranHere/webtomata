// The Konversi tab in every engine (T-038b): the fourth tab, the RNF stepper with its removed and
// added transitions, the read-only canvas and the 50-row grammar window. The full set lives in
// `e2e/pda-conversion.spec.ts`; this is the part that must hold in Firefox and WebKit too.
import { expect, expectNoAxeViolations, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow } from './db.ts';
import { wcwrSample } from '../../src/lib/editor/pda-samples.ts';
import type { PdaDocument } from '../../src/lib/editor/pda-document.ts';
import { serializePdaDocument } from '../../src/lib/editor/pda-document.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const convert = (page: Page) => panel(page).locator('.convert');

async function openSeeded(page: Page, doc: PdaDocument, title: string) {
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await page.waitForLoadState('networkidle');
	await putRow(page, {
		id: 'pda-conv-cross',
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
}

test('the Konversi tab walks the RNF, shows the canvas and has no sideways scroll', async ({
	page
}) => {
	await openSeeded(page, wcwrSample('wcwR'), 'wcwR');
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await convert(page).getByRole('button', { name: 'Mulai' }).click();
	await expect(convert(page).getByText('Langkah 1 dari 5')).toBeVisible();
	await convert(page).getByRole('button', { name: 'Maju' }).click();
	await convert(page).getByRole('button', { name: 'Maju' }).click();
	await expect(convert(page).getByText('Langkah 3 dari 5')).toBeVisible();
	await expect(convert(page).locator('.diff.removed li')).toHaveCount(1);
	await expect(convert(page).locator('.diff.added li')).toHaveCount(3);
	await expect(page.locator('.conversion-canvas figcaption')).toHaveText('Hasil (hanya baca): RNF');
	const scroll = await page.evaluate(() => ({
		width: document.documentElement.scrollWidth,
		window: window.innerWidth
	}));
	expect(scroll.width).toBeLessThanOrEqual(scroll.window + 1);
	await expectNoAxeViolations(page);
});

test('stage 2 reaches 76 rules and windows them', async ({ page }) => {
	await openSeeded(page, wcwrSample('wcwR'), 'wcwR');
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await convert(page).getByRole('button', { name: 'Mulai' }).click();
	await convert(page).getByRole('button', { name: 'Ke hasil' }).click();
	await convert(page).getByRole('button', { name: 'Ke tata bahasa' }).click();
	await expect(convert(page).getByText('Langkah 1 dari 14')).toBeVisible();
	await convert(page).getByRole('button', { name: 'Ke hasil' }).click();
	await expect(convert(page).getByText('76 aturan')).toBeVisible();
	await expect(convert(page).getByText('… 26 baris sebelumnya')).toBeVisible();
});
