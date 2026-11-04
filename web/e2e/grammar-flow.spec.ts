import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

async function openGrammar(page: Page) {
	await page.goto('/sandbox?mode=grammar');
	await page.locator('.workstation').waitFor();
}

const SIX_PHASE_GRAMMAR = {
	id: 'G_FLOW_SIX_PHASES',
	title: 'Tata Bahasa Uji 6 Fase',
	grammar: 'S -> a S b | A | U\nA -> B\nB -> b B | λ\nU -> U c'
};

const CYK_TEST_GRAMMAR = {
	id: 'G_FLOW_CYK_TEST',
	title: 'Tata Bahasa Uji CYK',
	grammar: 'S -> A B | λ\nA -> a\nB -> b'
};

test.describe('grammar workstation matrix editing (desktop 1280x800)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project only');
	});

	test('desktop matrix editing: new grammar, space/pipe alts, backspace, symbol bar, prune on blur, add/delete row, error banner', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openGrammar(page);

		// 1. Create a new grammar
		const btnNew = page.locator('.btn-new');
		await btnNew.click();

		const rows = page.locator('.matrix-row');
		await expect(rows).toHaveCount(1);
		const row0 = rows.nth(0);
		await expect(row0.locator('.lhs-input')).toHaveValue('S');

		// Row 0 starts with ['aSb', 'λ']
		const alts = row0.locator('.alt-cell-input');
		await expect(alts).toHaveCount(2);

		// Focus first alt, fill 'AB'
		await alts.nth(0).click();
		await alts.nth(0).fill('AB');
		await expect(alts.nth(0)).toHaveValue('AB');

		// Press space -> adds second alternative box immediately after and focuses it
		await page.keyboard.press('Space');
		await expect(alts).toHaveCount(3);
		await expect(alts.nth(1)).toBeFocused();
		await expect(alts.nth(1)).toHaveValue('');

		// Type 'a'
		await page.keyboard.type('a');
		await expect(alts.nth(1)).toHaveValue('a');

		// Press '|' -> adds third alternative box and focuses it
		await page.keyboard.press('|');
		await expect(alts).toHaveCount(4);
		await expect(alts.nth(2)).toBeFocused();
		await expect(alts.nth(2)).toHaveValue('');

		// Backspace on empty box removes it and focuses the previous one (alt 1)
		await page.keyboard.press('Backspace');
		await expect(alts).toHaveCount(3);
		await expect(alts.nth(1)).toBeFocused();
		await expect(alts.nth(1)).toHaveValue('a');

		// Symbol bar inserts 'ε' at the cursor
		const symbolBar = row0.locator('.inline-symbol-bar');
		await expect(symbolBar).toBeVisible();
		const epsBtn = symbolBar.locator('.inline-sym-btn', { hasText: 'ε' });
		await epsBtn.click();
		await expect(alts.nth(1)).toHaveValue('aε');

		// Add an empty box via "+" button, then focus outside row to verify it is removed on blur
		const addAltBtn = row0.locator('.btn-add-alt');
		await addAltBtn.click();
		await expect(alts).toHaveCount(4);
		await expect(alts.last()).toHaveValue('');

		// Focus outside the row (e.g. library col title) to trigger handleRowFocusOut
		await page.locator('#grammar-pane-pustaka .col-title').click();
		await expect(alts).toHaveCount(3);

		// '+ Tambah Baris' adds a row and focuses it
		const addRowBtn = page.locator('.btn-add-row');
		await addRowBtn.click();
		await expect(rows).toHaveCount(2);
		const row1 = rows.nth(1);
		await expect(row1.locator('.alt-cell-input').first()).toBeFocused();

		// Put text in row1 so handleRowFocusOut does not prune it on blur
		await row1.locator('.alt-cell-input').first().fill('B');

		// Right-click menu deletes a row
		await row1.locator('.td-arrow').click({ button: 'right' });
		const contextMenu = page.locator('.custom-context-menu');
		await expect(contextMenu).toBeVisible();
		const deleteItem = contextMenu.locator('.context-menu-item.delete-item');
		await deleteItem.click();
		await expect(contextMenu).toBeHidden();
		await expect(rows).toHaveCount(1);

		// Error banner (role="alert"): valid grammar hides it, invalid grammar shows it
		await expect(page.locator('.error-banner[role="alert"]')).toBeHidden();

		// Add second row with A -> λ, and row 0 with 11 A's (exceeding nullable budget > 10)
		await addRowBtn.click();
		await expect(rows).toHaveCount(2);
		await rows.nth(1).locator('.lhs-input').fill('A');
		await rows.nth(1).locator('.alt-cell-input').first().fill('λ');
		await rows.nth(0).locator('.alt-cell-input').first().fill('AAAAAAAAAAA');

		const errorBanner = page.locator('.error-banner[role="alert"]');
		await expect(errorBanner).toBeVisible();
		await expect(errorBanner).toContainText('terlalu banyak variabel nullable');

		// Restoring valid grammar hides the error banner
		await rows.nth(0).locator('.alt-cell-input').first().fill('a');
		await expect(errorBanner).toBeHidden();
	});
});

test.describe('grammar workstation matrix editing (phone 390x844)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, 'phone project only');
	});

	test('phone matrix editing: tab strip, taps, space/pipe alts, backspace, symbol bar, touch delete button', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openGrammar(page);

		const tablist = page.locator('.workstation [role="tablist"]');
		const tabPustaka = tablist.locator('[role="tab"]', { hasText: 'Pustaka' });
		await tabPustaka.click();

		const btnNew = page.locator('.btn-new');
		await btnNew.click();

		// Creating a custom grammar switches to Editor tab
		const tabEditor = tablist.locator('[role="tab"]', { hasText: 'Editor' });
		await expect(tabEditor).toHaveAttribute('aria-selected', 'true');

		const rows = page.locator('.matrix-row');
		await expect(rows).toHaveCount(1);
		const row0 = rows.nth(0);
		const alts = row0.locator('.alt-cell-input');

		// Focus first alt and fill 'AB'
		await alts.nth(0).click();
		await alts.nth(0).fill('AB');

		// Press space -> second alternative box created and focused
		await page.keyboard.press('Space');
		await expect(alts).toHaveCount(3);
		await expect(alts.nth(1)).toBeFocused();

		// Type 'a'
		await page.keyboard.type('a');
		await expect(alts.nth(1)).toHaveValue('a');

		// Press '|' -> third alternative box created and focused
		await page.keyboard.press('|');
		await expect(alts).toHaveCount(4);
		await expect(alts.nth(2)).toBeFocused();

		// Backspace on empty box removes it and focuses previous
		await page.keyboard.press('Backspace');
		await expect(alts).toHaveCount(3);
		await expect(alts.nth(1)).toBeFocused();

		// Symbol bar inserts 'ε'
		const symbolBar = row0.locator('.inline-symbol-bar');
		await expect(symbolBar).toBeVisible();
		const epsBtn = symbolBar.locator('.inline-sym-btn', { hasText: 'ε' });
		await epsBtn.click();
		await expect(alts.nth(1)).toHaveValue('aε');

		// Dismiss inline symbol bar by tapping header before tapping add row button
		await page.locator('#grammar-pane-editor .col-title').click();
		await expect(symbolBar).toBeHidden();

		// '+ Tambah Baris' adds row
		const addRowBtn = page.locator('.btn-add-row');
		await addRowBtn.scrollIntoViewIfNeeded();
		await addRowBtn.click();
		await expect(rows).toHaveCount(2);

		// Touch delete button (.btn-delete-row) of T-024 removes row
		const deleteBtnRow1 = rows.nth(1).locator('.btn-delete-row');
		await expect(deleteBtnRow1).toBeVisible();
		await deleteBtnRow1.click();
		await expect(rows).toHaveCount(1);
	});
});

test.describe('six CNF phases walkthrough & hand derivation (desktop)', () => {
	test.beforeEach(async ({ page, isMobile }) => {
		test.skip(isMobile, 'desktop project only');
		await page.addInitScript((grammarData) => {
			localStorage.setItem('webtomata.grammar.custom', JSON.stringify([grammarData]));
			localStorage.setItem('webtomata.grammar.selected_id', grammarData.id);
		}, SIX_PHASE_GRAMMAR);
	});

	test('walk through phases 1 to 6 with Selanjutnya, back with Sebelumnya, and jump with pills', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openGrammar(page);

		const cnfPane = page.locator('#grammar-pane-cnf');
		await expect(cnfPane).toBeVisible();

		const stepCounter = cnfPane.locator('.step-counter');
		const stepTitle = cnfPane.locator('.step-title');
		const prevBtn = cnfPane.locator('.nav-btn', { hasText: 'Sebelumnya' });
		const nextBtn = cnfPane.locator('.nav-btn', { hasText: 'Selanjutnya' });
		const stepPills = cnfPane.locator('.step-pill');
		await expect(stepPills).toHaveCount(6);

		// Helper to read rule chips
		const getChips = async (type: 'removed' | 'added') => {
			const group = cnfPane.locator(`.diff-group.${type}`);
			if ((await group.count()) === 0) return [];
			return group.locator('.diff-pill').allTextContents();
		};

		// === Phase 1: Isolasi Simbol Awal ===
		await expect(stepCounter).toHaveText('1 / 6');
		await expect(stepTitle).toHaveText('Isolasi Simbol Awal');
		await expect(prevBtn).toBeDisabled();
		await expect(nextBtn).toBeEnabled();
		expect(await getChips('removed')).toEqual([]);
		expect(await getChips('added')).toEqual(['S0 → S']);
		await expect(cnfPane.locator('.rule-count')).toHaveText('8 aturan');

		// === Phase 2: Eliminasi Aturan ε (Nullable) ===
		await nextBtn.click();
		await expect(stepCounter).toHaveText('2 / 6');
		await expect(stepTitle).toHaveText('Eliminasi Aturan ε (Nullable)');
		expect(await getChips('removed')).toEqual(['B → λ']);
		expect(await getChips('added')).toEqual(['S0 → λ', 'B → b', 'S → a b']);
		await expect(cnfPane.locator('.rule-count')).toHaveText('10 aturan');

		// === Phase 3: Eliminasi Aturan Unit (A → B) ===
		await nextBtn.click();
		await expect(stepCounter).toHaveText('3 / 6');
		await expect(stepTitle).toHaveText('Eliminasi Aturan Unit (A → B)');
		expect(await getChips('removed')).toEqual(['S0 → S', 'A → B', 'S → A', 'S → U']);
		expect(await getChips('added')).toEqual([
			'S0 → a b',
			'S0 → a S b',
			'S0 → b',
			'S0 → b B',
			'S0 → U c',
			'A → b',
			'A → b B',
			'S → b',
			'S → b B',
			'S → U c'
		]);
		await expect(cnfPane.locator('.rule-count')).toHaveText('16 aturan');

		// === Phase 4: Eliminasi Simbol Tak Berguna (Useless) ===
		await nextBtn.click();
		await expect(stepCounter).toHaveText('4 / 6');
		await expect(stepTitle).toHaveText('Eliminasi Simbol Tak Berguna (Useless)');
		expect(await getChips('removed')).toEqual([
			'S0 → U c',
			'A → b',
			'A → b B',
			'S → U c',
			'U → U c'
		]);
		expect(await getChips('added')).toEqual([]);
		await expect(cnfPane.locator('.rule-count')).toHaveText('11 aturan');

		// === Phase 5: Isolasi Terminal pada Aturan Campuran ===
		await nextBtn.click();
		await expect(stepCounter).toHaveText('5 / 6');
		await expect(stepTitle).toHaveText('Isolasi Terminal pada Aturan Campuran');
		expect(await getChips('removed')).toEqual([
			'S0 → a b',
			'S0 → a S b',
			'S0 → b B',
			'B → b B',
			'S → a b',
			'S → a S b',
			'S → b B'
		]);
		expect(await getChips('added')).toEqual([
			'S0 → T_a S T_b',
			'S0 → T_a T_b',
			'S0 → T_b B',
			'B → T_b B',
			'S → T_a S T_b',
			'S → T_a T_b',
			'S → T_b B',
			'T_a → a',
			'T_b → b'
		]);
		await expect(cnfPane.locator('.rule-count')).toHaveText('13 aturan');

		// === Phase 6: Binarisasi Aturan Panjang (Panjang ≥ 3) ===
		await nextBtn.click();
		await expect(stepCounter).toHaveText('6 / 6');
		await expect(stepTitle).toHaveText('Binarisasi Aturan Panjang (Panjang ≥ 3)');
		expect(await getChips('removed')).toEqual(['S0 → T_a S T_b', 'S → T_a S T_b']);
		expect(await getChips('added')).toEqual([
			'S0 → T_a X',
			'S → T_a X_1',
			'X → S T_b',
			'X_1 → S T_b'
		]);
		await expect(cnfPane.locator('.rule-count')).toHaveText('15 aturan');
		await expect(nextBtn).toBeDisabled();

		// Back with 'Sebelumnya'
		await prevBtn.click();
		await expect(stepCounter).toHaveText('5 / 6');
		await expect(stepTitle).toHaveText('Isolasi Terminal pada Aturan Campuran');

		// Jump with numbered pills
		await stepPills.nth(0).click(); // Phase 1
		await expect(stepCounter).toHaveText('1 / 6');
		await expect(stepTitle).toHaveText('Isolasi Simbol Awal');

		await stepPills.nth(3).click(); // Phase 4
		await expect(stepCounter).toHaveText('4 / 6');
		await expect(stepTitle).toHaveText('Eliminasi Simbol Tak Berguna (Useless)');

		await stepPills.nth(5).click(); // Phase 6
		await expect(stepCounter).toHaveText('6 / 6');
		await expect(stepTitle).toHaveText('Binarisasi Aturan Panjang (Panjang ≥ 3)');
	});
});

test.describe('CYK tester & English locale (desktop)', () => {
	test.beforeEach(async ({ page, isMobile }) => {
		test.skip(isMobile, 'desktop project only');
		await page.addInitScript((grammarData) => {
			localStorage.setItem('webtomata.grammar.custom', JSON.stringify([grammarData]));
			localStorage.setItem('webtomata.grammar.selected_id', grammarData.id);
		}, CYK_TEST_GRAMMAR);
	});

	test('CYK testing: accepted string, empty string, rejected string, example chips, top pyramid cell highlight', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openGrammar(page);

		// Switch to CYK tab
		const cykTabBtn = page.locator('.tab-btn', { hasText: 'Uji String (CYK)' });
		await cykTabBtn.click();

		const cykPane = page.locator('#grammar-pane-cyk');
		await expect(cykPane).toBeVisible();

		const inputField = cykPane.locator('#cyk-test-word');
		const testBtn = cykPane.locator('.test-btn');

		// 1. Accepted string: "ab"
		await inputField.fill('ab');
		await testBtn.click();

		const verdict = cykPane.locator('.cyk-verdict');
		await expect(verdict).toHaveClass(/accepted/);
		await expect(verdict.locator('.verdict-title')).toContainText('DITERIMA');
		await expect(verdict.locator('.verdict-sub')).toContainText('w ∈ L(G)');
		await expect(verdict.locator('.verdict-sub')).toContainText('ab');
		await expect(verdict.locator('.verdict-sub')).toContainText('S');

		// Top cell of the CYK table pyramid is highlighted exactly when string is accepted
		const topAcceptingCell = cykPane.locator('.cyk-cell.top-accepting');
		await expect(topAcceptingCell).toBeVisible();
		await expect(topAcceptingCell).toContainText('S');

		// 2. Empty string: "" / "ε"
		await inputField.fill('');
		await testBtn.click();
		await expect(verdict).toHaveClass(/accepted/);
		await expect(verdict.locator('.verdict-title')).toContainText('DITERIMA');
		await expect(verdict.locator('.verdict-sub')).toContainText('w ∈ L(G)');
		await expect(verdict.locator('.verdict-sub')).toContainText('ε');

		// 3. Rejected string: "ba"
		await inputField.fill('ba');
		await testBtn.click();
		await expect(verdict).toHaveClass(/rejected/);
		await expect(verdict.locator('.verdict-title')).toContainText('DITOLAK');
		await expect(verdict.locator('.verdict-sub')).toContainText('w ∉ L(G)');
		await expect(verdict.locator('.verdict-sub')).toContainText('ba');
		await expect(cykPane.locator('.cyk-cell.top-accepting')).toHaveCount(0);

		// 4. Example chips fill the field: select CNF_ORDER preset
		const presetCard = page.locator('.preset-card', { hasText: 'Urutan Eliminasi Simbol' });
		await presetCard.click();
		await cykTabBtn.click();

		const samplePills = cykPane.locator('.sample-pill');
		await expect(samplePills).toHaveCount(4);
		await samplePills.nth(0).click(); // 'a'
		await expect(inputField).toHaveValue('a');
		await expect(verdict).toHaveClass(/accepted/);
	});

	test('English interface: tab names, stepper buttons, and CYK verdict show English text', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openGrammar(page);

		// Switch to English
		await page.locator('button[lang="en"]').click();

		// Output column tab buttons in English
		const tabCnf = page.locator('.tab-btn', { hasText: 'CNF Transformation (6 Phases)' });
		const tabCyk = page.locator('.tab-btn', { hasText: 'String Testing (CYK)' });
		await expect(tabCnf).toBeVisible();
		await expect(tabCyk).toBeVisible();

		// Stepper buttons in English
		await tabCnf.click();
		const cnfPane = page.locator('#grammar-pane-cnf');
		await expect(cnfPane.locator('.nav-btn', { hasText: 'Previous' })).toBeVisible();
		await expect(cnfPane.locator('.nav-btn', { hasText: 'Next' })).toBeVisible();

		// CYK verdict in English
		await tabCyk.click();
		const cykPane = page.locator('#grammar-pane-cyk');
		await cykPane.locator('#cyk-test-word').fill('ab');
		await cykPane.locator('.test-btn').click();

		const verdict = cykPane.locator('.cyk-verdict');
		await expect(verdict.locator('.verdict-title')).toHaveText('ACCEPTED');
		await expect(verdict.locator('.verdict-sub')).toContainText(
			'w ∈ L(G) — string "ab" can be derived from S'
		);

		// Switch back to Indonesian
		await page.locator('button[lang="id"]').click();
	});
});

test.describe('grammar workstation axe accessibility checks', () => {
	test('desktop axe: error banner, CNF middle phase, CYK accepted/rejected, expanded legend', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop project only');
		await page.setViewportSize({ width: 1280, height: 800 });
		await openGrammar(page);

		// 1. Expanded legend card
		const legendHeader = page.locator('.legend-header');
		await legendHeader.click();
		await expect(page.locator('.legend-content')).toBeVisible();
		await expectNoAxeViolations(page);
		await legendHeader.click(); // collapse

		// 2. CNF at middle phase (phase 3)
		const cnfTabBtn = page.locator('.tab-btn', { hasText: 'Transformasi CNF' });
		await cnfTabBtn.click();
		const stepPills = page.locator('#grammar-pane-cnf .step-pill');
		await stepPills.nth(2).click(); // phase 3
		await expect(page.locator('#grammar-pane-cnf .step-counter')).toHaveText('3 / 6');
		await expectNoAxeViolations(page);

		// 3. CYK tab with accepted verdict
		const cykTabBtn = page.locator('.tab-btn', { hasText: 'Uji String (CYK)' });
		await cykTabBtn.click();
		const cykPane = page.locator('#grammar-pane-cyk');
		await cykPane.locator('#cyk-test-word').fill('a');
		await cykPane.locator('.test-btn').click();
		await expect(cykPane.locator('.cyk-verdict')).toHaveClass(/accepted/);
		await expectNoAxeViolations(page);

		// 4. CYK tab with rejected verdict
		await cykPane.locator('#cyk-test-word').fill('b');
		await cykPane.locator('.test-btn').click();
		await expect(cykPane.locator('.cyk-verdict')).toHaveClass(/rejected/);
		await expectNoAxeViolations(page);

		// 5. Matrix with error banner
		const rows = page.locator('.matrix-row');
		const addRowBtn = page.locator('.btn-add-row');
		await addRowBtn.click();
		await rows.last().locator('.lhs-input').fill('X');
		await rows.last().locator('.alt-cell-input').first().fill('λ');
		await rows.nth(0).locator('.alt-cell-input').first().fill('XXXXXXXXXXX');
		await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
		await expectNoAxeViolations(page);
	});

	test('phone axe: every tab (Pustaka, Editor with error and legend, CNF phase 3, CYK verdicts)', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'phone project only');
		await page.setViewportSize({ width: 390, height: 844 });
		await openGrammar(page);

		const tablist = page.locator('.workstation [role="tablist"]');
		const tabPustaka = tablist.locator('[role="tab"]', { hasText: 'Pustaka' });
		const tabEditor = tablist.locator('[role="tab"]', { hasText: 'Editor' });
		const tabCnf = tablist.locator('[role="tab"]', { hasText: 'CNF' });
		const tabCyk = tablist.locator('[role="tab"]', { hasText: 'CYK' });

		// Tab 1: Pustaka
		await tabPustaka.click();
		await expectNoAxeViolations(page);

		// Tab 2: Editor with expanded legend
		await tabEditor.click();
		const legendHeader = page.locator('.legend-header');
		await legendHeader.click();
		await expect(page.locator('.legend-content')).toBeVisible();
		await expectNoAxeViolations(page);
		await legendHeader.click();

		// Tab 3: CNF at middle phase (phase 3)
		await tabCnf.click();
		const stepPills = page.locator('#grammar-pane-cnf .step-pill');
		await stepPills.nth(2).click();
		await expect(page.locator('#grammar-pane-cnf .step-counter')).toHaveText('3 / 6');
		await expectNoAxeViolations(page);

		// Tab 4: CYK with accepted verdict
		await tabCyk.click();
		const cykPane = page.locator('#grammar-pane-cyk');
		await cykPane.locator('#cyk-test-word').fill('a');
		await cykPane.locator('.test-btn').click();
		await expect(cykPane.locator('.cyk-verdict')).toHaveClass(/accepted/);
		await expectNoAxeViolations(page);

		// Tab 4: CYK with rejected verdict
		await cykPane.locator('#cyk-test-word').fill('b');
		await cykPane.locator('.test-btn').click();
		await expect(cykPane.locator('.cyk-verdict')).toHaveClass(/rejected/);
		await expectNoAxeViolations(page);

		// Tab 2: Editor with error banner
		await tabEditor.click();
		const rows = page.locator('.matrix-row');
		const addRowBtn = page.locator('.btn-add-row');
		await addRowBtn.scrollIntoViewIfNeeded();
		await addRowBtn.click();
		await rows.last().locator('.lhs-input').fill('X');
		await rows.last().locator('.alt-cell-input').first().fill('λ');
		await rows.nth(0).locator('.alt-cell-input').first().fill('XXXXXXXXXXX');
		await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
		await expectNoAxeViolations(page);
	});
});

test.describe('CYK tester with opened CNF grammar (T-029)', () => {
	test('open CNF result of CNF_UNIT_CHAIN and verify strings in CYK', async ({
		page,
		isMobile
	}) => {
		if (isMobile) {
			await page.setViewportSize({ width: 390, height: 844 });
		} else {
			await page.setViewportSize({ width: 1280, height: 800 });
		}
		await openGrammar(page);

		// Select preset CNF_UNIT_CHAIN: "Rantai Aturan Unit (Fase 3)"
		if (isMobile) {
			const tablist = page.locator('.workstation [role="tablist"]');
			const tabs = tablist.locator('[role="tab"]');
			await tabs.nth(0).click(); // Pustaka tab
		}

		const presetCard = page.locator('#grammar-pane-pustaka .preset-card', {
			hasText: 'Rantai Aturan Unit (Fase 3)'
		});
		await presetCard.click();

		const cnfPane = page.locator('#grammar-pane-cnf');

		if (isMobile) {
			const tablist = page.locator('.workstation [role="tablist"]');
			const tabs = tablist.locator('[role="tab"]');
			await tabs.nth(2).click(); // CNF tab
		}

		await expect(cnfPane).toBeVisible();

		// Step 6 of CNF
		const stepPills = cnfPane.locator('.step-pill');
		await stepPills.nth(5).click();

		const openResultBtn = cnfPane.locator('.btn-open-result');
		await expect(openResultBtn).toBeVisible();
		await openResultBtn.click();

		// Navigate to CYK tab
		if (isMobile) {
			const tablist = page.locator('.workstation [role="tablist"]');
			const tabs = tablist.locator('[role="tab"]');
			await tabs.nth(3).click(); // CYK tab
		} else {
			const cykTabBtn = page.locator('.tab-btn', { hasText: 'Uji String (CYK)' });
			await cykTabBtn.click();
		}

		const cykPane = page.locator('#grammar-pane-cyk');
		await expect(cykPane).toBeVisible();

		const inputField = cykPane.locator('#cyk-test-word');
		const testBtn = cykPane.locator('.test-btn');
		const verdict = cykPane.locator('.cyk-verdict');

		const testWord = async (word: string, expectedStatus: 'accepted' | 'rejected') => {
			await inputField.fill(word);
			await testBtn.click();
			await expect(verdict).toHaveClass(new RegExp(expectedStatus));
		};

		// Accepted strings in L(G) = {bb} ∪ c⁺
		await testWord('bb', 'accepted');
		await testWord('c', 'accepted');
		await testWord('ccc', 'accepted');

		// Rejected strings
		await testWord('b', 'rejected');
		await testWord('bc', 'rejected');
	});
});
