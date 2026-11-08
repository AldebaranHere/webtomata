import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { parsePdaDocumentText } from '../src/lib/editor/pda-document.ts';
import { touchDragAt } from './touch.ts';

async function openSandbox(page: Page, query = '') {
	await page.goto(`/sandbox${query}`);
	await page.locator('.editor[data-ready]').waitFor();
}

async function switchToPda(page: Page) {
	const trigger = page.locator('.switcher-trigger');
	await trigger.waitFor();
	await trigger.click();
	const popover = page.locator('.switcher-popover[role="listbox"]');
	await expect(popover).toBeVisible();
	const pdaOption = popover.getByRole('option', { name: /^Otomata Pushdown \(PDA\)/ });
	await pdaOption.click();
	await expect(page.locator('.editor[data-ready]')).toBeVisible();
}

test.describe('E1: Mode switcher and URL persistence', () => {
	test('PDA switcher item is enabled, switches mode, updates URL and survives reload', async ({
		page
	}) => {
		await openSandbox(page);

		const trigger = page.locator('.switcher-trigger');
		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		// PDA item is enabled with no "Segera Hadir" badge
		const pdaOption = popover.getByRole('option', { name: /^Otomata Pushdown \(PDA\)/ });
		await expect(pdaOption).toBeVisible();
		await expect(pdaOption).not.toHaveClass(/disabled/);
		await expect(pdaOption).not.toContainText('Segera Hadir');

		// TM item remains disabled
		const tmItem = popover.locator('.switcher-item.disabled');
		await expect(tmItem).toContainText('Mesin Turing');

		// Click PDA option
		await pdaOption.click();
		await expect(page).toHaveURL(/mode=pda/);

		const storedMode = await page.evaluate(() => localStorage.getItem('webtomata_sandbox_mode'));
		expect(storedMode).toBe('pda');

		// PDA editor shell is rendered: .editor with tool rail, empty-canvas hint, no first-run card, no tab strip
		const editor = page.locator('.editor[data-ready]');
		await expect(editor).toBeVisible();
		await expect(editor.locator('.rail')).toBeVisible();
		await expect(editor.locator('.hint')).toHaveText('Pilih alat Tambah state, lalu klik kanvas.');
		await expect(page.locator('.first-run')).toHaveCount(0);
		await expect(page.locator('.tab-strip')).toHaveCount(0);

		// Survives reload
		await page.reload();
		await expect(page.locator('.editor[data-ready]')).toBeVisible();
		await expect(page).toHaveURL(/mode=pda/);
		await expect(page.locator('.trigger-current')).toHaveText('Otomata Pushdown (PDA)');

		// Return to FSM
		await trigger.click();
		const fsmOption = page
			.locator('.switcher-popover[role="listbox"]')
			.getByRole('option', { name: /^Mesin FSM/ });
		await fsmOption.click();
		await expect(page).not.toHaveURL(/mode=pda/);
		await expect(page.locator('.trigger-current')).toHaveText('Mesin FSM');
	});
});

test.describe('E2: Label form opening mechanisms', () => {
	test('desktop: Enter on edge, double click label, menu item, and tool creation', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop project for 4 opening mechanisms');
		await openSandbox(page, '?mode=pda');

		// Add state q0 and q1
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		await addBtn.click();
		const stage = page.locator('.stage svg');
		await stage.click({ position: { x: 200, y: 200 } });
		await stage.click({ position: { x: 350, y: 200 } });

		// Connect q0 to q1 with Transisi tool
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.click();
		const q0 = page.getByRole('button', { name: /^State q0/ });
		const q1 = page.getByRole('button', { name: /^State q1/ });
		await q0.click();
		await q1.click();

		// Opening 1: Automatically opens after making transition with Transisi tool
		const form = page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();
		// Put ε in read field so edge 0>1 exists in the document
		await form.getByRole('button', { name: /Ketik ε/i }).click();
		await form.getByRole('button', { name: /Simpan/i }).click();
		await expect(form).toHaveCount(0);

		// Switch back to Select tool
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();

		// Opening 2: Enter on selected edge
		const edgeLabel = page.locator('.labels text.label').first();
		await edgeLabel.click({ force: true });
		await page.keyboard.press('Enter');
		await expect(form).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(form).toHaveCount(0);

		// Opening 3: Double click on label
		await edgeLabel.dblclick({ force: true });
		await expect(form).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(form).toHaveCount(0);

		// Opening 4: Context menu item "Ubah transisi"
		await edgeLabel.click({ button: 'right', force: true });
		const menu = page.locator('.menu[role="menu"]');
		await expect(menu).toBeVisible();
		const menuItem = menu.getByRole('menuitem', { name: 'Ubah transisi' });
		await expect(menuItem).toBeVisible();
		await menuItem.click();
		await expect(form).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(form).toHaveCount(0);
	});

	test('phone: touch opening mechanisms open bottom sheet', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'phone project only');
		await openSandbox(page, '?mode=pda');

		// Add state q0 and q1
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		await addBtn.tap();
		const stage = page.locator('.stage svg');
		await stage.tap({ position: { x: 120, y: 150 } });
		await stage.tap({ position: { x: 260, y: 150 } });

		// Transisi tool
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.tap();
		const q0 = page.getByRole('button', { name: /^State q0/ });
		const q1 = page.getByRole('button', { name: /^State q1/ });
		await q0.tap();
		await q1.tap();

		// Bottom sheet opens
		const sheet = page.locator('aside.pda-sheet');
		await expect(sheet).toBeVisible();
		await expect(page.locator('.pda-label-popover')).toHaveCount(0);

		const form = sheet.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();
		await form.getByRole('button', { name: /^Batal/ }).tap();
		await expect(sheet).toHaveCount(0);
	});
});

test.describe('E3: Typing and sending transitions', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project for full form interaction');
	});

	test('fields, tab order, Ketik ε, Ctrl+E, refusal message, add/delete rows', async ({ page }) => {
		await openSandbox(page, '?mode=pda');

		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		await addBtn.click();
		const stage = page.locator('.stage svg');
		await stage.click({ position: { x: 200, y: 200 } });
		await stage.click({ position: { x: 380, y: 200 } });

		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.click();
		await page.getByRole('button', { name: /^State q0/ }).click();
		await page.getByRole('button', { name: /^State q1/ }).click();

		const form = page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();

		// Tab order verification:
		// row 0: Baca -> Pop -> Push -> Hapus -> Tambah transisi -> Ketik ε -> Batal -> Simpan
		const readInput = form.getByRole('textbox', { name: /Baris 1.*Baca/i });
		const popInput = form.getByRole('textbox', { name: /Baris 1.*Pop/i });
		const pushInput = form.getByRole('textbox', { name: /Baris 1.*Push/i });
		const deleteRowBtn = form.getByRole('button', { name: /Hapus baris 1/i });
		const addRowBtn = form.getByRole('button', { name: /Transisi lain di antara/i });
		const epsBtn = form.getByRole('button', { name: /Ketik ε/i });
		const cancelBtn = form.getByRole('button', { name: /Batal/i });
		const saveBtn = form.getByRole('button', { name: /Simpan/i });

		await expect(readInput).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(popInput).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(pushInput).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(deleteRowBtn).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(addRowBtn).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(epsBtn).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(cancelBtn).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(saveBtn).toBeFocused();

		// Type 'a' in Baca, ε in Pop via button, 'A' in Push
		await readInput.click();
		await page.keyboard.type('a');
		await popInput.click();
		await epsBtn.click(); // writes ε
		await pushInput.click();
		await page.keyboard.press('Control+e'); // writes ε
		await page.keyboard.press('Backspace');
		await page.keyboard.type('A');

		// Simpan via button
		await saveBtn.click();
		await expect(form).toHaveCount(0);

		// Label in diagram shows "a / ε / A"
		const labelText = page.locator('.labels text.label').first();
		await expect(labelText).toContainText('a / ε / A');

		// Reopen by Enter and test refusal
		await page.getByRole('button', { name: /^Pilih/ }).click();
		await page.locator('.labels text.label').first().click({ force: true });
		await page.keyboard.press('Enter');
		await expect(form).toBeVisible();

		// Refused row: 'ab' when input alphabet is single-character
		const rInput = form.getByRole('textbox', { name: /Baris 1.*Baca/i });
		await rInput.fill('ab');
		await form.getByRole('button', { name: /Simpan/i }).click();

		// Form stays open with refusal message
		await expect(form).toBeVisible();
		const refusalAlert = form.locator('.problem');
		await expect(refusalAlert).toBeVisible();
		await expect(refusalAlert).toContainText('ab');

		// Delete row: removes edge and toast offers Urungkan
		await form.getByRole('button', { name: /Hapus baris 1/i }).click();
		await form.getByRole('button', { name: /Simpan/i }).click();
		await expect(form).toHaveCount(0);
		await expect(page.locator('.edge-node[data-edge="0>1"]')).toHaveCount(0);

		// Urungkan restores edge
		const undoBtn = page.getByRole('button', { name: /^Urungkan/ });
		await undoBtn.click();
		await expect(page.locator('.labels text.label').first()).toBeVisible();
	});
});

test.describe('E4: + n lagi overflow button behavior', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project');
	});

	test('select tool selects edge; delete tool deletes edge on + n lagi press', async ({ page }) => {
		await openSandbox(page, '?mode=pda');

		// Create q0 and loop edge with 4 transitions
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		await addBtn.click();
		const stage = page.locator('.stage svg');
		await stage.click({ position: { x: 250, y: 250 } });

		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.click();
		const q0 = page.getByRole('button', { name: /^State q0/ });
		await q0.click();
		await q0.click(); // self loop

		const form = page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();

		// Add 4 transitions:
		// Row 1: a/ε/A
		await form.getByRole('textbox', { name: /Baris 1.*Baca/i }).fill('a');
		await form.getByRole('textbox', { name: /Baris 1.*Push/i }).fill('A');

		// Row 2: b/ε/B
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 2.*Baca/i }).fill('b');
		await form.getByRole('textbox', { name: /Baris 2.*Push/i }).fill('B');

		// Row 3: c/ε/C
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 3.*Baca/i }).fill('c');
		await form.getByRole('textbox', { name: /Baris 3.*Push/i }).fill('C');

		// Row 4: d/ε/D
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 4.*Baca/i }).fill('d');
		await form.getByRole('textbox', { name: /Baris 4.*Push/i }).fill('D');

		await form.getByRole('button', { name: /Simpan/i }).click();
		await expect(form).toHaveCount(0);

		// Label shows 2 lines and '+ 2 lagi'
		const edgeLabel = page.locator('.labels text.label').first();
		await expect(edgeLabel).toContainText('+ 2 lagi');

		// 1. In Select tool: clicking '+ 2 lagi' selects edge exactly once and stays selected
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();

		const overflowHit = page.locator('.hit-overflow').first();
		await overflowHit.click();
		const edgeNode = page.locator('.edge-node[data-edge="0>0"]');
		await expect(edgeNode).toHaveAttribute('aria-pressed', 'true');

		// 2. In Delete tool: clicking deletes the edge with toast offering Urungkan
		const deleteBtn = page.getByRole('button', { name: /^Hapus/ });
		await deleteBtn.click();
		await overflowHit.click();

		await expect(page.locator('.edge-node[data-edge="0>0"]')).toHaveCount(0);
		const toast = page.locator('.toast');
		await expect(toast).toBeVisible();
		await toast.getByRole('button', { name: /Urungkan/i }).click();
		await expect(page.locator('.edge-node[data-edge="0>0"]')).toBeVisible();

		// After Urungkan, verify that all 4 transitions are fully restored
		await selectBtn.click();
		await overflowHit.click();
		await expect(edgeNode).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Enter');
		const reopenedForm = page.locator('.pda-label-form[role="dialog"]');
		await expect(reopenedForm).toBeVisible();
		await expect(reopenedForm.locator('.row')).toHaveCount(4);
		await reopenedForm.getByRole('button', { name: /Batal/i }).click();
	});
});

test.describe('E5: Building wwᴿ sample automaton', () => {
	test('build wwrSample, undo and redo, verify stored document', async ({ page, isMobile }) => {
		await openSandbox(page, '?mode=pda');

		// Add state q0 at (180, 200) and q1 at (440, 200)
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		if (isMobile) await addBtn.tap();
		else await addBtn.click();

		const stage = page.locator('.stage svg');
		if (isMobile) {
			await stage.tap({ position: { x: 180, y: 200 } });
			await stage.tap({ position: { x: 320, y: 200 } });
		} else {
			await stage.click({ position: { x: 180, y: 200 } });
			await stage.click({ position: { x: 440, y: 200 } });
		}

		// Connect q0 -> q1 with ε / ε / ε
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		if (isMobile) await transBtn.tap();
		else await transBtn.click();

		const q0 = page.getByRole('button', { name: /^State q0/ });
		const q1 = page.getByRole('button', { name: /^State q1/ });
		if (isMobile) {
			await q0.tap();
			await q1.tap();
		} else {
			await q0.click();
			await q1.click();
		}

		const form = isMobile
			? page.locator('aside.pda-sheet .pda-label-form')
			: page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();

		// Put ε in read field so transition 0 -> 1 is ε / ε / ε
		const epsBtn = form.getByRole('button', { name: /Ketik ε/i });
		if (isMobile) await epsBtn.tap();
		else await epsBtn.click();

		// Save default ε / ε / ε
		const saveBtn = form.getByRole('button', { name: /Simpan/i });
		if (isMobile) await saveBtn.tap();
		else await saveBtn.click();
		await expect(form).toHaveCount(0);

		// q0 self loops: a/ε/A and b/ε/B
		if (isMobile) {
			await q0.tap();
			await q0.tap();
		} else {
			await q0.click();
			await q0.click();
		}
		await expect(form).toBeVisible();
		await form.getByRole('textbox', { name: /Baris 1.*Baca/i }).fill('a');
		await form.getByRole('textbox', { name: /Baris 1.*Push/i }).fill('A');
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 2.*Baca/i }).fill('b');
		await form.getByRole('textbox', { name: /Baris 2.*Push/i }).fill('B');
		if (isMobile) await saveBtn.tap();
		else await saveBtn.click();
		await expect(form).toHaveCount(0);

		// q1 self loops: a/A/ε and b/B/ε
		if (isMobile) {
			await q1.tap();
			await q1.tap();
		} else {
			await q1.click();
			await q1.click();
		}
		await expect(form).toBeVisible();
		await form.getByRole('textbox', { name: /Baris 1.*Baca/i }).fill('a');
		await form.getByRole('textbox', { name: /Baris 1.*Pop/i }).fill('A');
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 2.*Baca/i }).fill('b');
		await form.getByRole('textbox', { name: /Baris 2.*Pop/i }).fill('B');
		if (isMobile) await saveBtn.tap();
		else await saveBtn.click();
		await expect(form).toHaveCount(0);

		// Set q0 as start state and q1 as accepting state
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		if (isMobile) await selectBtn.tap();
		else await selectBtn.click();

		if (isMobile) await q0.tap();
		else await q0.click();
		await page.keyboard.press('m'); // set start state

		if (isMobile) await q1.tap();
		else await q1.click();
		await page.keyboard.press('a'); // toggle accepting shortcut

		// Undo everything with undo button
		const undoBtn = page.getByRole('button', { name: /^Urungkan/ }).filter({ visible: true });
		while (await undoBtn.isEnabled()) {
			if (isMobile) await undoBtn.tap();
			else await undoBtn.click();
		}

		// Redo everything
		const redoBtn = page.getByRole('button', { name: /^Ulangi/ }).filter({ visible: true });
		while (await redoBtn.isEnabled()) {
			if (isMobile) await redoBtn.tap();
			else await redoBtn.click();
		}

		// Wait for save
		await expect(page.locator('.save')).toHaveClass(/saved/);

		// Verify stored document transitions match wwrSample
		const pdaRecordDoc = await page.evaluate(async () => {
			const req = indexedDB.open('webtomata');
			return new Promise<string>((resolve, reject) => {
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction('machines', 'readonly');
					const getAll = tx.objectStore('machines').getAll();
					getAll.onsuccess = () => {
						const items = getAll.result as { type?: string; doc: string }[];
						const pda = items.find((r) => r.type === 'pda');
						db.close();
						resolve(pda?.doc ?? '');
					};
					getAll.onerror = () => reject(getAll.error);
				};
				req.onerror = () => reject(req.error);
			});
		});

		const parsed = parsePdaDocumentText(pdaRecordDoc);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			const doc = parsed.value;
			expect(doc.states).toHaveLength(2);
			expect(doc.start).toBe(0);
			expect(doc.accepting).toContain(1);
			expect(doc.transitions).toHaveLength(5);
		}
	});
});

test.describe('E6: Flush on mode switch', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project');
	});

	test('edits flush immediately on mode switch and remain when switching back', async ({
		page
	}) => {
		await openSandbox(page, '?mode=pda');

		// Add state q0
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		await addBtn.click();
		await page.locator('.stage svg').click({ position: { x: 250, y: 250 } });

		// Immediately switch to FSM mode without waiting for autosave delay
		const trigger = page.locator('.switcher-trigger');
		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();
		const fsmOption = popover.getByRole('option', { name: /^Mesin FSM/ });
		await fsmOption.click();
		await expect(page.locator('.editor[data-ready]')).toBeVisible();

		// Immediately switch back to PDA mode
		await switchToPda(page);

		// State q0 is still there
		await expect(page.getByRole('button', { name: /^State q0/ })).toBeVisible();
	});
});

test.describe('E7: Accessibility via Axe', () => {
	test('zero axe violations on empty PDA editor, with popover, and context menu', async ({
		page,
		isMobile
	}) => {
		await openSandbox(page, '?mode=pda');

		// 1. Empty PDA editor
		await expectNoAxeViolations(page);

		// Add state to open context menu and label form
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		if (isMobile) await addBtn.tap();
		else await addBtn.click();
		const stage = page.locator('.stage svg');
		if (isMobile) await stage.tap({ position: { x: 150, y: 150 } });
		else await stage.click({ position: { x: 200, y: 200 } });

		const q0 = page.getByRole('button', { name: /^State q0/ });
		if (isMobile) await q0.tap();
		else await q0.click({ button: 'right' });

		// 2. Context menu open (desktop)
		if (!isMobile) {
			await expect(page.locator('.menu[role="menu"]')).toBeVisible();
			await expectNoAxeViolations(page);
			await page.keyboard.press('Escape');
		}

		// Connect self loop to open form
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		if (isMobile) {
			await transBtn.tap();
			await q0.tap();
			await q0.tap();
		} else {
			await transBtn.click();
			await q0.click();
			await q0.click();
		}

		// 3. Form open (popover on desktop, sheet on phone)
		const form = page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();
		await expectNoAxeViolations(page);
	});
});

test.describe('E8: Phone sheet dimensions and labeled edge in view', () => {
	test('phone sheet styling, bounding box height, and edge visibility', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'phone project only');
		await openSandbox(page, '?mode=pda');

		// Add states q0 and q1
		const addBtn = page.getByRole('button', { name: /^Tambah state/ });
		await addBtn.tap();
		const stage = page.locator('.stage svg');
		await stage.tap({ position: { x: 120, y: 250 } });
		await stage.tap({ position: { x: 260, y: 250 } });

		// Pan canvas downward so camera differs from fitted, moving the states
		// low on the screen where the bottom sheet will cover them
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.tap();
		const stageBoxBefore = (await stage.boundingBox())!;
		await touchDragAt(
			page,
			{ x: stageBoxBefore.x + 50, y: stageBoxBefore.y + 100 },
			{ x: stageBoxBefore.x + 50, y: stageBoxBefore.y + 350 }
		);

		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.tap();
		const q0 = page.getByRole('button', { name: /^State q0/ });
		const q1 = page.getByRole('button', { name: /^State q1/ });
		await q0.tap();
		await q1.tap();

		const editorEl = page.locator('.editor');
		const sheet = page.locator('aside.pda-sheet');
		await expect(sheet).toBeVisible();
		await expect(page.locator('.pda-label-popover')).toHaveCount(0);

		// Height at most 60% of editor height
		const editorBox = (await editorEl.boundingBox())!;
		const sheetBox = (await sheet.boundingBox())!;
		expect(sheetBox.height).toBeLessThanOrEqual(editorBox.height * 0.6 + 2); // small rounding margin

		// Inputs at least 44px high and font size at least 16px
		const input = sheet.locator('input').first();
		const inputBox = (await input.boundingBox())!;
		expect(inputBox.height).toBeGreaterThanOrEqual(44);

		const fontSize = await input.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
		expect(fontSize).toBeGreaterThanOrEqual(16);

		// The point being edited (middle of the two state buttons) must be above the top of the sheet
		// and inside the visible stage rectangle. Asserted using bounding boxes of the two state buttons.
		const stageBox = (await stage.boundingBox())!;
		const q0Box = (await q0.boundingBox())!;
		const q1Box = (await q1.boundingBox())!;
		const midX = (q0Box.x + q0Box.width / 2 + (q1Box.x + q1Box.width / 2)) / 2;
		const midY = (q0Box.y + q0Box.height / 2 + (q1Box.y + q1Box.height / 2)) / 2;

		expect(midY).toBeLessThan(sheetBox.y);
		expect(midY).toBeGreaterThanOrEqual(stageBox.y);
		expect(midX).toBeGreaterThanOrEqual(stageBox.x);
		expect(midX).toBeLessThanOrEqual(stageBox.x + stageBox.width);

		// Close sheet gives focus back to canvas
		await sheet.getByRole('button', { name: /Batal/i }).tap();
		await expect(sheet).toHaveCount(0);
	});
});
