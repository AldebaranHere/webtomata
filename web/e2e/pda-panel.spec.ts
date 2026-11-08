// PDA panel e2e tests (E1 to E8 of Task T-051):
// Tabs (Tabel, Definisi), kind switch (DPDA | NDPDA), checks line, table view, definition view,
// + n lagi interaction, axe, and engine worker timing.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const stateBtn = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

async function openPdaSandbox(page: Page, query = '') {
	await page.goto(`/sandbox?mode=pda${query}`);
	await page.locator('.editor[data-ready]').waitFor();
}

async function addState(page: Page, x: number, y: number) {
	const addBtn = page.getByRole('button', { name: /^Tambah state/ });
	await addBtn.click();
	const stage = page.locator('.stage svg');
	await stage.click({ position: { x, y } });
}

async function makeEdge(
	page: Page,
	fromName: string,
	toName: string,
	transitions: Array<{ read: string; pop: string; push: string }>
) {
	const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
	await transBtn.click();
	await stateBtn(page, fromName).click();
	await stateBtn(page, toName).click();

	const form = page.locator('.pda-label-form[role="dialog"]');
	await expect(form).toBeVisible();

	for (let i = 0; i < transitions.length; i++) {
		if (i > 0) {
			await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		}
		const row = transitions[i]!;
		if (row.read) {
			await form
				.getByRole('textbox', { name: new RegExp(`Baris ${i + 1}.*Baca`, 'i') })
				.fill(row.read);
		}
		if (row.pop) {
			await form
				.getByRole('textbox', { name: new RegExp(`Baris ${i + 1}.*Pop`, 'i') })
				.fill(row.pop);
		}
		if (row.push) {
			await form
				.getByRole('textbox', { name: new RegExp(`Baris ${i + 1}.*Push`, 'i') })
				.fill(row.push);
		}
	}
	await form.getByRole('button', { name: /Simpan/i }).click();
	await expect(form).toHaveCount(0);
}

test.describe('E1: Panel tabs and layout', () => {
	test('desktop: exactly two tabs (Tabel, Definisi), Tabel open by default, remembers valid tab', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop layout');
		await openPdaSandbox(page);

		const side = panel(page);
		await expect(side).toBeVisible();

		// Only two tabs, neither is disabled
		const tabelTab = tab(page, 'Tabel');
		const defTab = tab(page, 'Definisi');
		await expect(tabelTab).toBeVisible();
		await expect(defTab).toBeVisible();
		await expect(panel(page).getByRole('tab', { name: 'Simulasi' })).toHaveCount(0);
		await expect(panel(page).getByRole('tab', { name: 'Konversi' })).toHaveCount(0);

		// Tabel is open first time
		await expect(tabelTab).toHaveAttribute('aria-selected', 'true');
		await expect(defTab).toHaveAttribute('aria-selected', 'false');

		// Arrow keys move between tabs
		await tabelTab.focus();
		await page.keyboard.press('ArrowRight');
		await expect(defTab).toHaveAttribute('aria-selected', 'true');
		await expect(tabelTab).toHaveAttribute('aria-selected', 'false');

		await page.keyboard.press('ArrowLeft');
		await expect(tabelTab).toHaveAttribute('aria-selected', 'true');

		// Switch to Definisi, reload, it is remembered
		await defTab.click();
		await expect(defTab).toHaveAttribute('aria-selected', 'true');
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		await expect(tab(page, 'Definisi')).toHaveAttribute('aria-selected', 'true');

		// If storage had an invalid tab (e.g. simulation from FSM), falls back to table
		await page.evaluate(() => localStorage.setItem('webtomata.panel.tab', 'simulation'));
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		await expect(tab(page, 'Tabel')).toHaveAttribute('aria-selected', 'true');
	});

	test('phone: panel is under canvas with drag bar, sheet replaces it during label editing', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'phone layout');
		await openPdaSandbox(page);

		const side = panel(page);
		await expect(side).toBeVisible();
		const hideBtn = side.getByRole('button', { name: 'Sembunyikan panel' });
		await expect(hideBtn).toBeVisible();

		// Add state and start making a transition
		await addState(page, 150, 200);
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.click();
		await stateBtn(page, 'q0').click();
		await stateBtn(page, 'q0').click();

		// Sheet replaces the side panel
		const form = page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();
		await expect(panel(page)).toHaveCount(0);

		// Cancelling restores the side panel
		await form.getByRole('button', { name: /Batal/i }).click();
		await expect(form).toHaveCount(0);
		await expect(panel(page)).toBeVisible();
		await expect(tab(page, 'Tabel')).toBeVisible();
	});
});

test.describe('E2: Kind switch DPDA | NDPDA', () => {
	test('default NDPDA, DPDA is one undo step, arrow keys work, G shows competing errors', async ({
		page
	}) => {
		await openPdaSandbox(page);

		const side = panel(page);
		const dpda = side.getByRole('radio', { name: 'DPDA', exact: true });
		const ndpda = side.getByRole('radio', { name: 'NDPDA', exact: true });

		// Default is NDPDA
		await expect(ndpda).toBeChecked();
		await expect(dpda).not.toBeChecked();

		// Choosing DPDA is one undo step
		await dpda.click();
		await expect(dpda).toBeChecked();
		await expect(ndpda).not.toBeChecked();

		// Undo restores NDPDA
		const undoBtn = page.getByRole('button', { name: /Urungkan/i });
		await undoBtn.click();
		await expect(ndpda).toBeChecked();

		// Arrow keys in radiogroup
		await ndpda.focus();
		await page.keyboard.press('ArrowLeft');
		await expect(dpda).toBeChecked();

		// Build Machine G:
		// q0 (start), q1 (accepting)
		// Transitions:
		// q0 a/ε/A q0
		// q0 b/A/ε q1
		// q1 b/A/ε q1
		// q0 ε/ε/ε q1 (competes with a and b on q0)
		await addState(page, 120, 200); // q0
		await addState(page, 280, 200); // q1

		// Set q0 start, q1 accepting
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();
		await stateBtn(page, 'q0').click();
		await page.keyboard.press('m');
		await stateBtn(page, 'q1').click();
		await page.keyboard.press('a');

		// Add transitions:
		// Loop q0: a/ε/A
		await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
		// q0 -> q1: b/A/ε and ε/ε/ε
		await makeEdge(page, 'q0', 'q1', [
			{ read: 'b', pop: 'A', push: '' },
			{ read: 'ε', pop: '', push: '' }
		]);
		// Loop q1: b/A/ε
		await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);

		// On NDPDA: no competing transitions checks
		await ndpda.click();
		await expect(side.getByText(/transisi baris.*bersaing/i)).toHaveCount(0);
		await expect(page.locator('svg.world g.flag')).toHaveCount(0);

		// On DPDA: 2 competing transitions errors and q0 marked with flag
		await dpda.click();
		const summaryBtn = side.getByRole('button', { name: /hal perlu dilihat/i });
		await expect(summaryBtn).toBeVisible();
		await summaryBtn.click();
		await expect(side.getByText(/transisi baris 1 dan 2 dari q0 bersaing/i)).toBeVisible();
		await expect(side.getByText(/transisi baris 1 dan 3 dari q0 bersaing/i)).toBeVisible();
		await expect(page.locator('svg.world g.flag')).toHaveCount(1);

		// Switch back to NDPDA clears competing errors and diagram mark
		await ndpda.click();
		await expect(side.getByText(/Mesin ini lengkap/i)).toBeVisible();
		await expect(page.locator('svg.world g.flag')).toHaveCount(0);
	});
});

test.describe('E3: Checks line', () => {
	test('empty PDA checks, building F says lengkap, click focuses state', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop project');
		await openPdaSandbox(page);

		const side = panel(page);

		// Empty PDA: shows 2 checks
		const summaryBtn = side.getByRole('button', { name: /hal perlu dilihat/i });
		await expect(summaryBtn).toContainText('2 hal perlu dilihat');
		await summaryBtn.click();
		await expect(side.getByText('Belum ada start state.')).toBeVisible();
		await expect(side.getByText('Belum ada accepting state.')).toBeVisible();

		// Build Machine F (as DPDA):
		// q0 start, q1 accepting
		await addState(page, 120, 200);
		await addState(page, 280, 200);
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();
		await stateBtn(page, 'q0').click();
		await page.keyboard.press('m');
		await stateBtn(page, 'q1').click();
		await page.keyboard.press('a');

		await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
		await makeEdge(page, 'q0', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
		await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);

		// Switch to DPDA
		await side.getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(side.getByText('Mesin ini lengkap.')).toBeVisible();

		// Add an unreachable state q2
		await addState(page, 450, 200);
		await expect(summaryBtn).toContainText('1 hal perlu dilihat');
		if ((await summaryBtn.getAttribute('aria-expanded')) !== 'true') {
			await summaryBtn.click();
		}
		const itemBtn = side.getByRole('button', { name: /State q2 tidak bisa dicapai/i });
		await expect(itemBtn).toBeVisible();
		await itemBtn.click();
		// Focuses state q2
		await expect(stateBtn(page, 'q2')).toBeFocused();
	});
});

test.describe('E3: Simulated engine failure (technique of editor-checks.spec.ts)', () => {
	test.use({ allowedProblem: /./ });

	test('calm notice with retry recovers, and editor still works', async ({ page, isMobile }) => {
		test.skip(isMobile, 'desktop project');
		let blocked = true;
		await page.route('**/*.wasm', (route) => (blocked ? route.abort() : route.continue()));
		await openPdaSandbox(page);

		const side = panel(page);
		await expect(side.getByText('Engine berhenti.')).toBeVisible();

		// Editor still works while engine failed
		await canvas(page).focus();
		await page.keyboard.press('n'); // adds state
		await expect(page.locator('svg.world g.node')).toHaveCount(1);

		// The change triggers a re-check which still fails
		await page.waitForTimeout(700);
		await expect(side.getByText('Engine berhenti.')).toBeVisible();

		// Retry recovers once unblocked
		blocked = false;
		await side.getByRole('button', { name: 'Coba lagi' }).click();
		await expect(side.getByText(/hal perlu dilihat/i).first()).toBeVisible();
	});
});

test.describe('E4: Table and diagram agreement', () => {
	test('Machine G shows 4 rows in engine order, updates on edit, mobile horizontal scroll', async ({
		page,
		isMobile
	}) => {
		await openPdaSandbox(page);

		// Build Machine G:
		await addState(page, 120, 200); // q0
		await addState(page, 280, 200); // q1
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();
		await stateBtn(page, 'q0').click();
		await page.keyboard.press('m');
		await stateBtn(page, 'q1').click();
		await page.keyboard.press('a');

		await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
		await makeEdge(page, 'q0', 'q1', [
			{ read: 'b', pop: 'A', push: '' },
			{ read: 'ε', pop: '', push: '' }
		]);
		await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);

		const side = panel(page);
		await tab(page, 'Tabel').click();

		// Caption has count
		await expect(side.locator('caption')).toHaveText('Transisi (4)');

		// 4 rows in engine order: ε row first
		const rows = side.locator('tbody tr');
		await expect(rows).toHaveCount(4);
		// Row 1: q0 ε ε ε q1
		await expect(rows.nth(0)).toContainText('q0');
		await expect(rows.nth(0)).toContainText('ε');
		await expect(rows.nth(0)).toContainText('q1');
		// Row 2: q0 a ε A q0
		await expect(rows.nth(1)).toContainText('q0');
		await expect(rows.nth(1)).toContainText('a');
		await expect(rows.nth(1)).toContainText('A');
		// Row 3: q0 b A ε q1
		await expect(rows.nth(2)).toContainText('q0');
		await expect(rows.nth(2)).toContainText('b');
		// Row 4: q1 b A ε q1
		await expect(rows.nth(3)).toContainText('q1');
		await expect(rows.nth(3)).toContainText('b');

		// On mobile: check horizontal scroll and sticky first column
		if (isMobile) {
			const scrollBox = side.locator('.wrap');
			const isScrollable = await scrollBox.evaluate((el) => el.scrollWidth > el.clientWidth);
			expect(isScrollable).toBe(true);

			const firstTh = rows.first().locator('th.from');
			const initialBox = (await firstTh.boundingBox())!;
			await scrollBox.evaluate((el) => (el.scrollLeft = 50));
			const scrolledBox = (await firstTh.boundingBox())!;
			expect(Math.abs(scrolledBox.x - initialBox.x)).toBeLessThanOrEqual(1);
		}
	});
});

test.describe('E5: + n lagi interaction', () => {
	test('Pilih tool opens table and marks edge rows; Hapus tool deletes without opening panel', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop project for edge overflow click');
		await openPdaSandbox(page);

		// Create q0 with self-loop of 4 transitions
		await addState(page, 200, 200);
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.click();
		await stateBtn(page, 'q0').click();
		await stateBtn(page, 'q0').click();

		const form = page.locator('.pda-label-form[role="dialog"]');
		await expect(form).toBeVisible();
		// Add 4 rows:
		await form.getByRole('textbox', { name: /Baris 1.*Baca/i }).fill('a');
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 2.*Baca/i }).fill('b');
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 3.*Baca/i }).fill('c');
		await form.getByRole('button', { name: /Transisi lain di antara/i }).click();
		await form.getByRole('textbox', { name: /Baris 4.*Baca/i }).fill('d');
		await form.getByRole('button', { name: /Simpan/i }).click();

		// In Definisi tab initially
		await tab(page, 'Definisi').click();
		await expect(tab(page, 'Definisi')).toHaveAttribute('aria-selected', 'true');

		// Switch to Pilih tool
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();

		// Press + 2 lagi
		const moreAction = page.locator('.hit-overflow').first();
		await expect(moreAction).toBeVisible();
		await moreAction.click();

		// Opens Tabel tab
		await expect(tab(page, 'Tabel')).toHaveAttribute('aria-selected', 'true');

		// Marks all 4 rows of the edge with aria-current="true"
		const markedRows = panel(page).locator('tbody tr[aria-current="true"]');
		await expect(markedRows).toHaveCount(4);

		// Selecting a state clears the marks
		await stateBtn(page, 'q0').click();
		await expect(panel(page).locator('tbody tr[aria-current="true"]')).toHaveCount(0);

		// Mark rows again
		await moreAction.click();
		await expect(markedRows).toHaveCount(4);

		// Changing document (e.g. kind switch) clears the marks even when edge remains selected
		await page.getByRole('radio', { name: 'DPDA', exact: true }).click();
		await expect(markedRows).toHaveCount(0);
		await page.getByRole('radio', { name: 'NDPDA', exact: true }).click();

		// Mark rows again for Hapus test
		await moreAction.click();
		await expect(markedRows).toHaveCount(4);

		// Switch tab to Definisi
		await tab(page, 'Definisi').click();
		await expect(tab(page, 'Definisi')).toHaveAttribute('aria-selected', 'true');

		// Switch to Hapus tool
		const deleteBtn = page.getByRole('button', { name: /^Hapus/ });
		await deleteBtn.click();

		// Click + 2 lagi deletes the edge (doc change) without opening panel / Tabel
		await moreAction.click();
		await expect(page.locator('.labels text.label')).toHaveCount(0);
		// Toast offers Urungkan
		await expect(page.getByRole('status')).toContainText('dihapus');
		await expect(tab(page, 'Tabel')).toHaveAttribute('aria-selected', 'false');

		// Edge deletion changed document, so marked rows must be cleared
		// Clicking Urungkan restores the edge; marks must remain cleared
		await page
			.getByRole('toolbar', { name: 'Alat editor' })
			.getByRole('button', { name: 'Urungkan' })
			.click();
		await expect(page.locator('.labels text.label')).toHaveCount(1);
		await expect(markedRows).toHaveCount(0);
	});
});

test.describe('E6: Definition view', () => {
	test('Definisi tab shows formal tuple and delta lines for Machine F, updates on edit', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop project');
		await openPdaSandbox(page);

		// Build Machine F:
		await addState(page, 120, 200); // q0
		await addState(page, 280, 200); // q1
		const selectBtn = page.getByRole('button', { name: /^Pilih/ });
		await selectBtn.click();
		await stateBtn(page, 'q0').click();
		await page.keyboard.press('m');
		await stateBtn(page, 'q1').click();
		await page.keyboard.press('a');

		await makeEdge(page, 'q0', 'q0', [{ read: 'a', pop: '', push: 'A' }]);
		await makeEdge(page, 'q0', 'q1', [{ read: 'b', pop: 'A', push: '' }]);
		await makeEdge(page, 'q1', 'q1', [{ read: 'b', pop: 'A', push: '' }]);

		const side = panel(page);
		await tab(page, 'Definisi').click();

		// F2 definition text:
		await expect(side.getByText('M = (K, Σ, Γ, Δ, s, A)')).toBeVisible();
		await expect(side.locator('dl')).toContainText('{q0, q1}');
		await expect(side.locator('dl')).toContainText('{a, b}');
		await expect(side.locator('dl')).toContainText('{A}');
		await expect(side.locator('dl')).toContainText('q0');
		await expect(side.locator('dl')).toContainText('{q1}');

		// 3 delta lines:
		await expect(side.getByText('((q0, a, ε), (q0, A))')).toBeVisible();
		await expect(side.getByText('((q0, b, A), (q1, ε))')).toBeVisible();
		await expect(side.getByText('((q1, b, A), (q1, ε))')).toBeVisible();

		// Hint is visible
		await expect(side.getByText(/Kiri = puncak stack/i)).toBeVisible();

		// Add state q2 updates definition
		await addState(page, 400, 200);
		await expect(side.locator('dl')).toContainText('{q0, q1, q2}');
	});
});

test.describe('E7: Axe accessibility', () => {
	test('zero violations on Tabel tab, Definisi tab, checks list open, and label sheet open', async ({
		page
	}) => {
		await openPdaSandbox(page);

		// Empty editor on Tabel tab
		await expectNoAxeViolations(page);

		// Definisi tab
		await tab(page, 'Definisi').click();
		await expectNoAxeViolations(page);

		// Open checks list
		await tab(page, 'Tabel').click();
		const summaryBtn = panel(page).getByRole('button', { name: /hal perlu dilihat/i });
		await summaryBtn.click();
		await expectNoAxeViolations(page);

		// Open label form
		await addState(page, 150, 200);
		const transBtn = page.getByRole('button', { name: /^Tambah transisi/ });
		await transBtn.click();
		await stateBtn(page, 'q0').click();
		await stateBtn(page, 'q0').click();
		await expect(page.locator('.pda-label-form[role="dialog"]')).toBeVisible();

		await expectNoAxeViolations(page);
	});
});

test.describe('E8: Timing of engine worker request', () => {
	test('the engine worker is requested after the first draw, not before', async ({ page }) => {
		let firstDrawn = false;
		let workerRequestedBeforeDraw = false;

		page.on('worker', () => {
			if (!firstDrawn) workerRequestedBeforeDraw = true;
		});

		page.on('request', (req) => {
			if (/worker|engine.*\.wasm/.test(req.url())) {
				if (!firstDrawn) workerRequestedBeforeDraw = true;
			}
		});

		await page.goto('/sandbox?mode=pda');
		await page.locator('.editor[data-ready]').waitFor();
		// At this point, the initial DOM and canvas have been drawn
		firstDrawn = true;

		expect(workerRequestedBeforeDraw).toBe(false);

		// A little later, after the debounce/effect, the engine worker is running
		await expect.poll(() => page.workers().length).toBeGreaterThan(0);
	});
});
