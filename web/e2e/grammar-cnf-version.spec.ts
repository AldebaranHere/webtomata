import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const GRAMMAR_R1 = {
	id: 'G_R1_TEST',
	title: 'Tata Bahasa R1',
	grammar: 'S -> x B y | z B y | z B | x\nB -> x'
};

async function openGrammar(page: Page) {
	await page.goto('/sandbox?mode=grammar');
	await page.locator('.workstation').waitFor();
}

async function ensureCnfTab(page: Page, isMobile: boolean) {
	if (isMobile) {
		const cnfTab = page.locator('#grammar-tab-cnf');
		if (await cnfTab.isVisible()) {
			await cnfTab.click();
		}
	}
	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();
	return cnfPane;
}

test.describe('CNF version toggle (AC3, AC4, AC5)', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
		page.on('pageerror', (err) => console.log('PAGE ERROR:', err));
		await page.addInitScript((grammarData) => {
			localStorage.setItem('webtomata.grammar.custom', JSON.stringify([grammarData]));
			localStorage.setItem('webtomata.grammar.selected_id', grammarData.id);
		}, GRAMMAR_R1);
	});

	test('toggling between long and short version on R1 preserves step and updates rule counts and notes (AC3)', async ({
		page,
		isMobile
	}) => {
		await openGrammar(page);
		const cnfPane = await ensureCnfTab(page, isMobile);

		const toggle = cnfPane.locator('.version-toggle');
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute('role', 'radiogroup');
		await expect(toggle).toHaveAttribute('aria-label', 'Versi konversi CNF');

		const longRadio = cnfPane.locator('.version-radio', { hasText: 'Versi panjang' });
		const shortRadio = cnfPane.locator('.version-radio', { hasText: 'Versi ringkas' });

		// Default is "Versi panjang"
		await expect(longRadio).toHaveAttribute('aria-checked', 'true');
		await expect(longRadio).toHaveAttribute('tabindex', '0');
		await expect(shortRadio).toHaveAttribute('aria-checked', 'false');
		await expect(shortRadio).toHaveAttribute('tabindex', '-1');

		// Step to Phase 4
		const stepPills = cnfPane.locator('.step-pill');
		await stepPills.nth(3).click();
		await expect(cnfPane.locator('.step-counter')).toHaveText('4 / 6');

		// Choose "Versi ringkas" while on Phase 4 -> preserves Phase 4
		await shortRadio.click();
		await expect(shortRadio).toHaveAttribute('aria-checked', 'true');
		await expect(longRadio).toHaveAttribute('aria-checked', 'false');
		await expect(cnfPane.locator('.step-counter')).toHaveText('4 / 6');

		// Step to Phase 5 in short version -> 7 rules, note present
		const nextBtn = cnfPane.locator('.nav-btn', { hasText: 'Selanjutnya' });
		await nextBtn.click();
		await expect(cnfPane.locator('.step-counter')).toHaveText('5 / 6');
		await expect(cnfPane.locator('.rule-count')).toHaveText('7 aturan');
		const stepNote = cnfPane.locator('.step-note');
		await expect(stepNote).toBeVisible();
		await expect(stepNote).toContainText('Versi ringkas: terminal yang sudah punya variabel');

		// Step to Phase 6 in short version -> 8 rules, note present
		await nextBtn.click();
		await expect(cnfPane.locator('.step-counter')).toHaveText('6 / 6');
		await expect(cnfPane.locator('.rule-count')).toHaveText('8 aturan');
		await expect(stepNote).toBeVisible();
		await expect(stepNote).toContainText(
			'Versi ringkas: variabel pembantu yang sama dipakai bersama'
		);

		// Switch back to "Versi panjang" while on Phase 6 -> preserves Phase 6, restores 10 rules, note disappears
		await longRadio.click();
		await expect(longRadio).toHaveAttribute('aria-checked', 'true');
		await expect(cnfPane.locator('.step-counter')).toHaveText('6 / 6');
		await expect(cnfPane.locator('.rule-count')).toHaveText('10 aturan');
		await expect(stepNote).toHaveCount(0);

		// Step back to Phase 5 in long version -> restores 8 rules, note disappears
		const prevBtn = cnfPane.locator('.nav-btn', { hasText: 'Sebelumnya' });
		await prevBtn.click();
		await expect(cnfPane.locator('.step-counter')).toHaveText('5 / 6');
		await expect(cnfPane.locator('.rule-count')).toHaveText('8 aturan');
		await expect(stepNote).toHaveCount(0);
	});

	test('keyboard roving tabindex and arrow navigation (AC3)', async ({ page, isMobile }) => {
		await openGrammar(page);
		const cnfPane = await ensureCnfTab(page, isMobile);

		const longRadio = cnfPane.locator('.version-radio', { hasText: 'Versi panjang' });
		const shortRadio = cnfPane.locator('.version-radio', { hasText: 'Versi ringkas' });

		await longRadio.focus();
		await expect(longRadio).toBeFocused();

		// ArrowRight -> selects short version and moves focus
		await page.keyboard.press('ArrowRight');
		await expect(shortRadio).toBeFocused();
		await expect(shortRadio).toHaveAttribute('aria-checked', 'true');
		await expect(shortRadio).toHaveAttribute('tabindex', '0');
		await expect(longRadio).toHaveAttribute('aria-checked', 'false');
		await expect(longRadio).toHaveAttribute('tabindex', '-1');

		// ArrowLeft -> selects long version and moves focus
		await page.keyboard.press('ArrowLeft');
		await expect(longRadio).toBeFocused();
		await expect(longRadio).toHaveAttribute('aria-checked', 'true');
		await expect(longRadio).toHaveAttribute('tabindex', '0');

		// ArrowDown -> selects short version
		await page.keyboard.press('ArrowDown');
		await expect(shortRadio).toBeFocused();
		await expect(shortRadio).toHaveAttribute('aria-checked', 'true');

		// ArrowUp -> selects long version
		await page.keyboard.press('ArrowUp');
		await expect(longRadio).toBeFocused();
		await expect(longRadio).toHaveAttribute('aria-checked', 'true');
	});

	test('version choice is persisted in localStorage and malformed value falls back to long (AC3)', async ({
		page,
		isMobile
	}) => {
		await openGrammar(page);
		const cnfPane = await ensureCnfTab(page, isMobile);

		const shortRadio = cnfPane.locator('.version-radio', { hasText: 'Versi ringkas' });
		await shortRadio.click();
		await expect(shortRadio).toHaveAttribute('aria-checked', 'true');

		// Reload and check choice is kept
		await page.reload();
		await page.locator('.workstation').waitFor();
		const reloadedPane = await ensureCnfTab(page, isMobile);
		const reloadedShortRadio = reloadedPane.locator('.version-radio', { hasText: 'Versi ringkas' });
		await expect(reloadedShortRadio).toHaveAttribute('aria-checked', 'true');

		// Invalidate stored value to "x"
		await page.evaluate(() => {
			localStorage.setItem('webtomata.grammar.cnf_version', 'x');
		});
		await page.reload();
		await page.locator('.workstation').waitFor();
		const fallbackPane = await ensureCnfTab(page, isMobile);
		const fallbackLongRadio = fallbackPane.locator('.version-radio', { hasText: 'Versi panjang' });
		await expect(fallbackLongRadio).toHaveAttribute('aria-checked', 'true');
	});

	test('works in English locale with translated labels and notes (AC3)', async ({
		page,
		isMobile
	}) => {
		await page.addInitScript(() => {
			localStorage.setItem('webtomata.lang', 'en');
		});
		await openGrammar(page);
		const cnfPane = await ensureCnfTab(page, isMobile);

		const toggle = cnfPane.locator('.version-toggle');
		await expect(toggle).toHaveAttribute('aria-label', 'CNF conversion version');

		const longRadio = cnfPane.locator('.version-radio', { hasText: 'Long version' });
		const shortRadio = cnfPane.locator('.version-radio', { hasText: 'Short version' });
		await expect(longRadio).toBeVisible();
		await expect(shortRadio).toBeVisible();

		// Switch to Short version and step to Phase 5
		await shortRadio.click();
		const stepPills = cnfPane.locator('.step-pill');
		await stepPills.nth(4).click();

		const stepNote = cnfPane.locator('.step-note');
		await expect(stepNote).toBeVisible();
		await expect(stepNote).toContainText('Short version: a terminal with an existing variable');
	});

	test('rapid double toggle ends on the version of the second click (AC5)', async ({
		page,
		isMobile
	}) => {
		await openGrammar(page);
		const cnfPane = await ensureCnfTab(page, isMobile);

		const longRadio = cnfPane.locator('.version-radio', { hasText: 'Versi panjang' });
		const shortRadio = cnfPane.locator('.version-radio', { hasText: 'Versi ringkas' });

		// Click short then long rapidly without waiting for pipeline
		await shortRadio.click();
		await longRadio.click();

		await expect(longRadio).toHaveAttribute('aria-checked', 'true');
		await expect(shortRadio).toHaveAttribute('aria-checked', 'false');

		// Step to phase 5 -> should show long version count (8 rules)
		const stepPills = cnfPane.locator('.step-pill');
		await stepPills.nth(4).click();
		await expect(cnfPane.locator('.rule-count')).toHaveText('8 aturan');
	});

	test('touch targets, responsive width, no horizontal scroll at 375px, and axe (AC4)', async ({
		page
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await openGrammar(page);
		const cnfPane = await ensureCnfTab(page, true);

		const toggle = cnfPane.locator('.version-toggle');
		await expect(toggle).toBeVisible();

		const longRadio = cnfPane.locator('.version-radio', { hasText: 'Versi panjang' });
		const shortRadio = cnfPane.locator('.version-radio', { hasText: 'Versi ringkas' });

		const longBox = await longRadio.boundingBox();
		const shortBox = await shortRadio.boundingBox();
		expect(longBox).not.toBeNull();
		expect(shortBox).not.toBeNull();
		expect(longBox!.height).toBeGreaterThanOrEqual(43.5);
		expect(shortBox!.height).toBeGreaterThanOrEqual(43.5);

		// On phone, control is as wide as the column
		const toggleBox = await toggle.boundingBox();
		const paneBox = await cnfPane.boundingBox();
		expect(toggleBox).not.toBeNull();
		expect(paneBox).not.toBeNull();
		// Toggle should span almost the full width of pane (minus paddings/margins)
		expect(toggleBox!.width).toBeGreaterThanOrEqual(paneBox!.width - 32);

		// No horizontal scrolling at 375 px
		const hasHorizontalScroll = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(hasHorizontalScroll).toBe(false);

		// Axe accessibility check
		await expectNoAxeViolations(page);
	});
});
