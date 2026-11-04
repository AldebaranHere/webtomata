import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

async function openLanguage(page: Page, query = '') {
	await page.goto(`/sandbox?mode=language${query}`);
	await page.locator('.workstation').waitFor();
}

/**
 * Hand-derived proper order expectations (shortest first, then alphabetical/lexicographical).
 * None of these strings are read back from the implementation; they are derived from formal definitions.
 */
// L1: {ab, aca, b, ccab} over {a, b, c}
// Length 1: b
// Length 2: ab
// Length 3: aca
// Length 4: ccab
const HAND_DERIVED_L1 = ['b', 'ab', 'aca', 'ccab'];
const HAND_DERIVED_L1_LENGTHS = [1, 2, 3, 4];

// L7: {ab, bc} over {a, b, c}
// Length 2: ab, bc
const HAND_DERIVED_L7 = ['ab', 'bc'];
const HAND_DERIVED_L7_LENGTHS = [2, 2];

// L2: {ac, c, bab, bcaa} over {a, b, c}
// Length 1: c
// Length 2: ac
// Length 3: bab
// Length 4: bcaa
const HAND_DERIVED_L2 = ['c', 'ac', 'bab', 'bcaa'];
const HAND_DERIVED_L2_LENGTHS = [1, 2, 3, 4];

// Custom formula: {a, b}*
// Length 0: "" (represented by caret ^ or epsilon ε)
// Length 1: a, b
// Length 2: aa, ab, ba, bb
// Length 3: aaa, aab, aba, ...
const HAND_DERIVED_AB_STAR_10 = ['', 'a', 'b', 'aa', 'ab', 'ba', 'bb', 'aaa', 'aab', 'aba'];
const HAND_DERIVED_AB_STAR_10_LENGTHS = [0, 1, 1, 2, 2, 2, 2, 3, 3, 3];

// Custom formula: {a, b}* with min length 2 (|w| >= 2)
// Length 2: aa, ab, ba, bb
// Length 3: aaa, aab, aba, abb, baa, bab
const HAND_DERIVED_AB_STAR_MIN2_10 = [
	'aa',
	'ab',
	'ba',
	'bb',
	'aaa',
	'aab',
	'aba',
	'abb',
	'baa',
	'bab'
];
const HAND_DERIVED_AB_STAR_MIN2_10_LENGTHS = [2, 2, 2, 2, 3, 3, 3, 3, 3, 3];

test.describe('language workstation enumeration flow (desktop 1280x800)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project only');
	});

	test('preset selection and proper order enumeration against hand derivation', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLanguage(page);

		// 1. Select Preset L1: {ab, aca, b, ccab}
		const presetL1 = page
			.locator('.library-col .item-btn')
			.filter({ has: page.locator('.item-id', { hasText: /^L1$/ }) });
		await presetL1.click();

		// Wait for results list to populate
		const resultsList = page.locator('.string-ordered-list');
		await expect(resultsList).toBeVisible();

		const rows = resultsList.locator('.string-row');
		await expect(rows).toHaveCount(HAND_DERIVED_L1.length);

		for (let i = 0; i < HAND_DERIVED_L1.length; i++) {
			const row = rows.nth(i);
			await expect(row.locator('.row-num')).toHaveText(`${i + 1}.`);
			await expect(row.locator('.word-text')).toHaveText(HAND_DERIVED_L1[i]!);
			await expect(row.locator('.len-badge')).toHaveText(String(HAND_DERIVED_L1_LENGTHS[i]));
		}

		// Finite language with fewer strings than N (4 < 10) shows all with no error banner
		await expect(page.locator('.results-meta')).toContainText('4 string');
		await expect(page.locator('.error-banner[role="alert"]')).toHaveCount(0);

		// 2. Select Preset L7: {ab, bc}
		const presetL7 = page
			.locator('.library-col .item-btn')
			.filter({ has: page.locator('.item-id', { hasText: /^L7$/ }) });
		await presetL7.click();

		await expect(rows).toHaveCount(HAND_DERIVED_L7.length);
		for (let i = 0; i < HAND_DERIVED_L7.length; i++) {
			const row = rows.nth(i);
			await expect(row.locator('.row-num')).toHaveText(`${i + 1}.`);
			await expect(row.locator('.word-text')).toHaveText(HAND_DERIVED_L7[i]!);
			await expect(row.locator('.len-badge')).toHaveText(String(HAND_DERIVED_L7_LENGTHS[i]));
		}
		await expect(page.locator('.results-meta')).toContainText('2 string');
		await expect(page.locator('.error-banner[role="alert"]')).toHaveCount(0);

		// 3. Select Preset L2: {ac, c, bab, bcaa}
		const presetL2 = page
			.locator('.library-col .item-btn')
			.filter({ has: page.locator('.item-id', { hasText: /^L2$/ }) });
		await presetL2.click();

		await expect(rows).toHaveCount(HAND_DERIVED_L2.length);
		for (let i = 0; i < HAND_DERIVED_L2.length; i++) {
			const row = rows.nth(i);
			await expect(row.locator('.row-num')).toHaveText(`${i + 1}.`);
			await expect(row.locator('.word-text')).toHaveText(HAND_DERIVED_L2[i]!);
			await expect(row.locator('.len-badge')).toHaveText(String(HAND_DERIVED_L2_LENGTHS[i]));
		}
	});

	test('custom formula, alphabet badge, proper order, min length, string count, and empty symbol format', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLanguage(page);

		// Type custom formula {a, b}*
		const textarea = page.locator('#language-formula-input');
		await textarea.click();
		await textarea.fill('{a, b}*');

		// Inferred alphabet badge updates
		const alphabetBadge = page.locator('.alphabet-badge');
		await expect(alphabetBadge).toContainText('Σ = {a, b}');

		// Check first 10 strings against hand derivation
		const resultsList = page.locator('.string-ordered-list');
		await expect(resultsList).toBeVisible();

		const rows = resultsList.locator('.string-row');
		await expect(rows).toHaveCount(10);

		// Default empty string symbol is '^'
		await expect(rows.nth(0).locator('.word-text')).toHaveText('^');
		await expect(rows.nth(0).locator('.len-badge')).toHaveText('0');

		for (let i = 1; i < 10; i++) {
			await expect(rows.nth(i).locator('.word-text')).toHaveText(HAND_DERIVED_AB_STAR_10[i]!);
			await expect(rows.nth(i).locator('.len-badge')).toHaveText(
				String(HAND_DERIVED_AB_STAR_10_LENGTHS[i])
			);
		}

		// Change Format String Kosong to 'ε'
		const emptySelect = page.locator('#empty-sym-select');
		await emptySelect.selectOption('ε');
		await expect(rows.nth(0).locator('.word-text')).toHaveText('ε');

		// Switch back to '^'
		await emptySelect.selectOption('^');
		await expect(rows.nth(0).locator('.word-text')).toHaveText('^');

		// Test "Panjang Min (|w| >= M)": set min length to 2
		const minLenInput = page.locator('#min-len-input');
		await minLenInput.fill('2');

		await expect(rows).toHaveCount(10);
		for (let i = 0; i < 10; i++) {
			await expect(rows.nth(i).locator('.word-text')).toHaveText(HAND_DERIVED_AB_STAR_MIN2_10[i]!);
			await expect(rows.nth(i).locator('.len-badge')).toHaveText(
				String(HAND_DERIVED_AB_STAR_MIN2_10_LENGTHS[i])
			);
		}

		// Test "Jumlah String (N)": limit count to 5
		const maxCountInput = page.locator('#max-count-input');
		await maxCountInput.fill('5');

		await expect(rows).toHaveCount(5);
		await expect(page.locator('.results-meta')).toContainText('5 string');

		for (let i = 0; i < 5; i++) {
			await expect(rows.nth(i).locator('.word-text')).toHaveText(HAND_DERIVED_AB_STAR_MIN2_10[i]!);
		}
	});

	test('copy all button puts results in clipboard and disables on empty results', async ({
		page,
		context,
		browserName
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLanguage(page);

		const copyBtn = page.locator('.output-col .btn-primary');
		await expect(copyBtn).toBeEnabled();

		// Select preset L7: {ab, bc}
		const presetL7 = page
			.locator('.library-col .item-btn')
			.filter({ has: page.locator('.item-id', { hasText: /^L7$/ }) });
		await presetL7.click();
		await expect(page.locator('.string-row')).toHaveCount(2);

		if (browserName === 'webkit' || browserName === 'firefox') {
			// Skip clipboard permission / readText assertion on WebKit/Firefox
			await copyBtn.click();
			await expect(copyBtn).toContainText('Tersalin!');
		} else {
			await context.grantPermissions(['clipboard-read', 'clipboard-write']);
			await copyBtn.click();
			await expect(copyBtn).toContainText('Tersalin!');

			const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
			expect(clipboardText).toBe('ab\nbc');
		}

		// When formula has syntax error or results are empty, copy button is disabled
		const textarea = page.locator('#language-formula-input');
		await textarea.fill('{a, b'); // invalid syntax
		await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
		await expect(page.locator('.string-ordered-list')).toHaveCount(0);
		await expect(copyBtn).toBeDisabled();
	});

	test('invalid formula shows red error banner (role="alert") and no results list', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLanguage(page);

		const textarea = page.locator('#language-formula-input');
		await textarea.fill('∪ ∪ ∪');

		const errorBanner = page.locator('.error-banner[role="alert"]');
		await expect(errorBanner).toBeVisible();
		await expect(errorBanner.locator('.error-text')).not.toBeEmpty();

		// No results list rendered, empty results placeholder displayed
		await expect(page.locator('.string-ordered-list')).toHaveCount(0);
		await expect(page.locator('.empty-results')).toBeVisible();

		// Restoring valid formula hides error banner and restores results
		await textarea.fill('{a, b}');
		await expect(errorBanner).toHaveCount(0);
		await expect(page.locator('.string-ordered-list')).toBeVisible();
	});

	test('symbol toolbar buttons insert at cursor and restore focus to textarea', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLanguage(page);

		const textarea = page.locator('#language-formula-input');
		await textarea.click();
		await textarea.fill('{a}');

		// Position cursor before '}' (selectionStart = 2 in '{a}')
		await textarea.evaluate((el: HTMLTextAreaElement) => {
			el.setSelectionRange(2, 2);
		});

		// Click union operator '∪'
		const unionBtn = page.locator('.symbol-toolbar .sym-btn', { hasText: '∪' });
		await unionBtn.click();

		await expect(textarea).toHaveValue('{a∪}');
		await expect(textarea).toBeFocused();

		// Click '#a(w)'
		const countBtn = page.locator('.symbol-toolbar .sym-btn', { hasText: '#a(w)' });
		await countBtn.click();

		await expect(textarea).toHaveValue('{a∪#a(w)}');
		await expect(textarea).toBeFocused();
	});

	test('interface in English displays English titles, headers, and labels', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.addInitScript(() => localStorage.setItem('webtomata.lang', 'en'));
		await openLanguage(page);

		// Header in output column
		await expect(page.locator('.output-col .col-title')).toHaveText(
			'Enumeration Results (Proper Order)'
		);
		// Copy all button
		await expect(page.locator('.output-col .btn-primary')).toHaveText('Copy All');

		// Preset L1 title in English
		const presetL1 = page
			.locator('.library-col .item-btn')
			.filter({ has: page.locator('.item-id', { hasText: /^L1$/ }) });
		await expect(presetL1.locator('.item-name')).toContainText('Finite Set {ab, aca, b, ccab}');
		await expect(presetL1.locator('.item-desc')).toHaveText('Finite set of 4 words over a, b, c');

		// Results meta in English
		await presetL1.click();
		await expect(page.locator('.results-meta')).toContainText('Showing first 4 strings');
	});

	test('accessibility scans on desktop (1280x800) with results and with error banner', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLanguage(page);

		// State 1: Workstation with results
		await expect(page.locator('.string-ordered-list')).toBeVisible();
		await expectNoAxeViolations(page);

		// State 2: Workstation with error banner
		await page.locator('#language-formula-input').fill('{unclosed');
		await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
		await expectNoAxeViolations(page);
	});
});

test.describe('language workstation enumeration flow (phone 390x844)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, 'phone project only');
	});

	test('phone tabs flow, preset selection, and 44px touch targets', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openLanguage(page);

		const tablist = page.locator('.workstation [role="tablist"]');
		await expect(tablist).toBeVisible();

		const tabPustaka = tablist.locator('[role="tab"]').nth(0);
		const tabEditor = tablist.locator('[role="tab"]').nth(1);
		const tabHasil = tablist.locator('[role="tab"]').nth(2);

		// Switch to Pustaka tab
		await tabPustaka.click();
		await expect(tabPustaka).toHaveAttribute('aria-selected', 'true');
		const pustakaPane = page.locator('#language-pane-pustaka');
		await expect(pustakaPane).toBeVisible();

		// Tapping preset L2 selects it and automatically moves to Editor tab
		const presetL2 = pustakaPane
			.locator('.item-btn')
			.filter({ has: page.locator('.item-id', { hasText: /^L2$/ }) });
		await presetL2.click();

		await expect(tabEditor).toHaveAttribute('aria-selected', 'true');
		const editorPane = page.locator('#language-pane-editor');
		await expect(editorPane).toBeVisible();
		await expect(editorPane.locator('.active-item-title')).toContainText(
			'Himpunan Hingga {ac, c, bab, bcaa}'
		);
		await expect(page.locator('#language-formula-input')).toHaveValue('{ac, c, bab, bcaa}');

		// Verify 44px targets on Editor tab: symbol toolbar buttons
		const symButtons = editorPane.locator('.symbol-toolbar .sym-btn');
		const symCount = await symButtons.count();
		expect(symCount).toBeGreaterThan(0);
		for (let i = 0; i < symCount; i++) {
			const box = (await symButtons.nth(i).boundingBox())!;
			expect(box.height, `sym-btn ${i} height must be >= 44px`).toBeGreaterThanOrEqual(44);
			expect(box.width, `sym-btn ${i} width must be >= 44px`).toBeGreaterThanOrEqual(44);
		}

		// Switch to Hasil tab
		await tabHasil.click();
		await expect(tabHasil).toHaveAttribute('aria-selected', 'true');
		const hasilPane = page.locator('#language-pane-hasil');
		await expect(hasilPane).toBeVisible();

		// Verify 44px targets on Hasil tab: controls and copy button
		const minLenBox = (await hasilPane.locator('#min-len-input').boundingBox())!;
		const maxCountBox = (await hasilPane.locator('#max-count-input').boundingBox())!;
		const emptySymBox = (await hasilPane.locator('#empty-sym-select').boundingBox())!;
		const copyBtnBox = (await hasilPane.locator('.btn-primary').boundingBox())!;

		expect(minLenBox.height, 'min-len-input height must be >= 44px').toBeGreaterThanOrEqual(44);
		expect(maxCountBox.height, 'max-count-input height must be >= 44px').toBeGreaterThanOrEqual(44);
		expect(emptySymBox.height, 'empty-sym-select height must be >= 44px').toBeGreaterThanOrEqual(
			44
		);
		expect(copyBtnBox.height, 'copy button height must be >= 44px').toBeGreaterThanOrEqual(44);

		// Results on Hasil tab match L2 hand derivation
		const rows = hasilPane.locator('.string-row');
		await expect(rows).toHaveCount(HAND_DERIVED_L2.length);
		for (let i = 0; i < HAND_DERIVED_L2.length; i++) {
			await expect(rows.nth(i).locator('.word-text')).toHaveText(HAND_DERIVED_L2[i]!);
		}

		// Accessibility check on Hasil tab
		await expectNoAxeViolations(page);

		// Switch to Editor and check accessibility with error banner on phone
		await tabEditor.click();
		await page.locator('#language-formula-input').fill('{invalid');
		await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
		await expectNoAxeViolations(page);
	});
});
