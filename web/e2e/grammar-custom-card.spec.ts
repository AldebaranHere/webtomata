// T-087: a custom grammar's card in the library must not hold a button inside a button (axe
// `nested-interactive`). The card is a plain container with two sibling buttons: one selects the
// grammar and one deletes it. These tests cover the axe guard (AC1), selecting by mouse and by
// keyboard (AC2), deleting with the keyboard without selecting (AC3), and the look at 360 px (AC5).
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';

// A title longer than the library card at 360 px, so that it must be cut off instead of pushing
// the delete button out of the card.
const LONG_TITLE =
	'Tata Bahasa dengan judul yang sangat panjang sekali supaya melewati lebar kartu Pustaka pada layar 360 piksel dan tetap terpotong';

async function openGrammar(page: Page): Promise<void> {
	await page.goto('/sandbox');
	const switcher = page.locator('.switcher-trigger');
	await switcher.waitFor();
	await switcher.click();
	const item = page.getByRole('option', { name: /Tata Bahasa/ });
	await item.waitFor();
	await item.click();
	await page.locator('.workstation').waitFor();
}

/**
 * Shows the library (on the phone layout it is a tab, and selecting a grammar leaves it) and
 * returns the custom cards, oldest first.
 */
async function showLibrary(page: Page, isMobile: boolean): Promise<Locator> {
	if (isMobile) await page.locator('#grammar-tab-pustaka').click();
	return page.locator('#grammar-pane-pustaka .custom-card');
}

/**
 * Adds a custom grammar with the library's "+ Tata Bahasa Baru" button, the way the locale test in
 * grammar-phone.spec.ts does, and returns its card. The new grammar becomes the selected one.
 */
async function addCustomGrammar(page: Page, isMobile: boolean): Promise<Locator> {
	const cards = await showLibrary(page, isMobile);
	const before = await cards.count();
	await page.locator('#grammar-pane-pustaka .btn-new').click();
	await expect(cards).toHaveCount(before + 1);
	const card = cards.nth(before);
	await expect(card).toBeAttached();
	await showLibrary(page, isMobile);
	return card;
}

/**
 * The built-in preset cards. A custom card also carries `.preset-card` (the specs use it), so
 * `:not(.custom-card)` keeps the two lists apart.
 */
function builtInPresets(page: Page): Locator {
	return page.locator('#grammar-pane-pustaka .preset-card:not(.custom-card)');
}

/** Selects the first built-in preset, so that the next action has a different grammar to select. */
async function selectFirstPreset(page: Page, isMobile: boolean): Promise<void> {
	if (isMobile) await page.locator('#grammar-tab-pustaka').click();
	const firstPreset = builtInPresets(page).first();
	await firstPreset.click();
	await expect(firstPreset).toHaveClass(/selected/);
}

/** The editor shows the custom grammar: `S -> aSb | λ`, the grammar that `+ Tata Bahasa Baru` adds. */
async function expectCustomGrammarInEditor(page: Page, title: string): Promise<void> {
	const editor = page.locator('#grammar-pane-editor');
	await expect(editor.locator('.active-item-title')).toHaveText(title);
	const firstRow = editor.locator('.matrix-row').first();
	await expect(firstRow.locator('.lhs-input')).toHaveValue('S');
	const alternatives = firstRow.locator('.alt-cell-input');
	await expect(alternatives).toHaveCount(2);
	await expect(alternatives.nth(0)).toHaveValue('aSb');
	await expect(alternatives.nth(1)).toHaveValue('λ');
}

test('AC1: a custom grammar in the library has no nested-interactive on desktop and phone (axe)', async ({
	page,
	isMobile
}) => {
	await openGrammar(page);
	const card = await addCustomGrammar(page, isMobile);
	await expect(card.locator('.card-title')).toHaveText(/^Tata Bahasa G\d+$/);

	await expectNoAxeViolations(page);
});

test('AC2: a click on the title, a click on the middle, and Tab then Enter or Space each select the grammar', async ({
	page,
	isMobile
}) => {
	await openGrammar(page);
	const card = await addCustomGrammar(page, isMobile);
	const title = await card.locator('.card-title').innerText();
	const selectButton = card.locator('.card-select');

	// 1. A click on the title.
	await selectFirstPreset(page, isMobile);
	await expect(card).not.toHaveClass(/selected/);
	await showLibrary(page, isMobile);
	await card.locator('.card-title').click();
	await expect(card).toHaveClass(/selected/);
	await expectCustomGrammarInEditor(page, title);

	// 2. A click on the middle of the card: the select button fills it.
	await selectFirstPreset(page, isMobile);
	await showLibrary(page, isMobile);
	await card.click();
	await expect(card).toHaveClass(/selected/);
	await expectCustomGrammarInEditor(page, title);

	// 3. Tab from the last built-in preset card to the select button, then Enter.
	await selectFirstPreset(page, isMobile);
	await showLibrary(page, isMobile);
	await builtInPresets(page).last().focus();
	await page.keyboard.press('Tab');
	await expect(selectButton).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(card).toHaveClass(/selected/);
	await expectCustomGrammarInEditor(page, title);

	// 4. The same with Space.
	await selectFirstPreset(page, isMobile);
	await showLibrary(page, isMobile);
	await builtInPresets(page).last().focus();
	await page.keyboard.press('Tab');
	await expect(selectButton).toBeFocused();
	await page.keyboard.press(' ');
	await expect(card).toHaveClass(/selected/);
	await expectCustomGrammarInEditor(page, title);
});

test('AC3: Tab reaches the × after the select button, and Enter deletes without selecting the grammar', async ({
	page,
	isMobile
}) => {
	await openGrammar(page);
	await addCustomGrammar(page, isMobile);
	const second = await addCustomGrammar(page, isMobile);
	const cards = page.locator('#grammar-pane-pustaka .custom-card');
	await expect(cards).toHaveCount(2);
	const first = cards.nth(0);
	const secondTitle = await second.locator('.card-title').innerText();

	// The grammar of the second card is the selected one; the first card is not selected.
	await expect(second).toHaveClass(/selected/);
	await expect(first).not.toHaveClass(/selected/);
	const editorTitle = page.locator('#grammar-pane-editor .active-item-title');
	await expect(editorTitle).toHaveText(secondTitle);

	// Keyboard: from the last built-in preset card, Tab reaches the first card's select button, and
	// the next Tab stop is its ×.
	await showLibrary(page, isMobile);
	await builtInPresets(page).last().focus();
	await page.keyboard.press('Tab');
	await expect(first.locator('.card-select')).toBeFocused();
	await page.keyboard.press('Tab');
	const deleteButton = first.locator('.btn-delete');
	await expect(deleteButton).toBeFocused();
	await expect(deleteButton).toHaveAccessibleName('Hapus tata bahasa kustom');

	// Enter deletes the first grammar and leaves the second one selected; the deleted grammar is
	// never selected on the way.
	await page.keyboard.press('Enter');
	await expect(cards).toHaveCount(1);
	await expect(cards.first().locator('.card-title')).toHaveText(secondTitle);
	await expect(cards.first()).toHaveClass(/selected/);
	await expect(editorTitle).toHaveText(secondTitle);
});

test('AC5: at 360 px both buttons show a focus ring, a long title truncates, and the × stays inside the card', async ({
	page
}) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.addInitScript((title) => {
		localStorage.setItem(
			'webtomata.grammar.custom',
			JSON.stringify([{ id: 'G1', title, grammar: 'S -> aSb | λ' }])
		);
	}, LONG_TITLE);
	await openGrammar(page);

	// At 360 px the layout is the phone one in both projects, so the library is a tab.
	const cards = await showLibrary(page, true);
	const card = cards.first();
	const title = card.locator('.card-title');
	const selectButton = card.locator('.card-select');
	const deleteButton = card.locator('.btn-delete');
	await expect(card).toBeVisible();
	await expect(title).toHaveText(LONG_TITLE);

	// No sideways scroll at 360 px.
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		)
	).toBe(false);

	// The × stays at the right edge of the card, and both buttons are at least 44 px high.
	const cardBox = (await card.boundingBox())!;
	const deleteBox = (await deleteButton.boundingBox())!;
	expect(deleteBox.x + deleteBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
	expect(deleteBox.height).toBeGreaterThanOrEqual(43.5);
	expect((await selectButton.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);

	// A long title is cut off with an ellipsis instead of widening the card.
	const titleStyle = await title.evaluate((el) => {
		const style = getComputedStyle(el);
		return {
			textOverflow: style.textOverflow,
			whiteSpace: style.whiteSpace,
			clipped: el.scrollWidth > el.clientWidth
		};
	});
	expect(titleStyle.textOverflow).toBe('ellipsis');
	expect(titleStyle.whiteSpace).toBe('nowrap');
	expect(titleStyle.clipped).toBe(true);

	// Keyboard focus shows the ring on the select button, and the card does not clip it.
	await builtInPresets(page).last().focus();
	await page.keyboard.press('Tab');
	await expect(selectButton).toBeFocused();
	const selectRing = await selectButton.evaluate((el) => {
		const style = getComputedStyle(el);
		return {
			focusVisible: el.matches(':focus-visible'),
			outlineStyle: style.outlineStyle,
			outlineWidth: style.outlineWidth
		};
	});
	expect(selectRing.focusVisible).toBe(true);
	expect(selectRing.outlineStyle).toBe('solid');
	expect(selectRing.outlineWidth).toBe('2px');
	expect(await card.evaluate((el) => getComputedStyle(el).overflow)).toBe('visible');

	// The same ring on the ×.
	await page.keyboard.press('Tab');
	await expect(deleteButton).toBeFocused();
	const deleteRing = await deleteButton.evaluate((el) => {
		const style = getComputedStyle(el);
		return {
			focusVisible: el.matches(':focus-visible'),
			outlineStyle: style.outlineStyle,
			outlineWidth: style.outlineWidth
		};
	});
	expect(deleteRing.focusVisible).toBe(true);
	expect(deleteRing.outlineStyle).toBe('solid');
	expect(deleteRing.outlineWidth).toBe('2px');
});
