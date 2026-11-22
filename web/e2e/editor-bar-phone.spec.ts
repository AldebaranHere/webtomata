// Task T-081 (P-006): one editor bar on a phone for the FSM and the PDA mode.
// F1: same four buttons in DOM and tab order (Mesin, Bantuan, Urungkan, Ulangi), >= 44 px, no horizontal scroll.
// F2: title >= 120 px at 360 px in both modes.
// F3: "Pas" floats inside the canvas box, >= 44 px, does not intersect dock, panel handle, or toast.
// F4: "?" in PDA mode opens the tour dialog; Esc closes and returns focus to "?".
// F5: "Unduh" in PDA library row works in FSM and PDA modes (with Indonesian title and autosave flush).
// F6: mode selector is full width and 44 px high at 360 px, no blue frame after tap, focus ring on Tab.
// F7: laptop (1280x800) FSM bar unchanged; PDA bar has "?" before download.
// F8: zero axe violations on /sandbox in FSM and PDA modes on phone.
import { readFileSync } from 'node:fs';
import {
	blobTypes,
	expect,
	expectNoAxeViolations,
	openSandbox,
	test,
	watchBlobs
} from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { putRow } from './cross/db.ts';
import { anbnSample } from '../src/lib/editor/pda-samples.ts';
import { serializePdaDocument } from '../src/lib/editor/pda-document.ts';

const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());
const list = (page: Page) => page.getByRole('dialog', { name: 'Mesin saya' });
const openListBtn = (page: Page) => page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ });
const pdaFileDialog = (page: Page) => page.getByRole('dialog', { name: 'Unduh PDA ini' });

async function openPdaWithExample(page: Page, isMobile: boolean) {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	const card = page.getByRole('region', { name: 'Coba contoh' });
	await expect(card).toBeVisible();
	await press(card.getByRole('button', { name: /^aⁿbⁿ/ }), isMobile);
	await expect(card).toHaveCount(0);
	await expect(page.locator('svg.world g.node').first()).toBeVisible();
}

function rectsIntersect(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number }
): boolean {
	return !(
		a.x + a.width <= b.x + 0.5 ||
		b.x + b.width <= a.x + 0.5 ||
		a.y + a.height <= b.y + 0.5 ||
		b.y + b.height <= a.y + 0.5
	);
}

test.describe('phone bar, floating Pas, mode selector, and axe (F1, F2, F3, F6, F8)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, 'a phone only');
	});

	for (const width of [320, 360, 412]) {
		test(`F1 (FSM): at ${width} px the bar has exactly Mesin, Bantuan, Urungkan, Ulangi (>= 44 px, no overflow)`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 740 });
			await openSandbox(page);
			const bar = page.locator('.editor .work > .bar');
			const buttons = await bar.getByRole('button').all();
			const boxes: { name: string; x: number; width: number; height: number }[] = [];
			for (const button of buttons) {
				const box = (await button.boundingBox())!;
				const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
				boxes.push({ name, x: box.x, width: box.width, height: box.height });
			}
			expect(boxes.map((b) => b.name)).toEqual([
				expect.stringMatching(/^Mesin saya \(\d+\)$/),
				'Bantuan: tur 1 menit',
				'Urungkan',
				'Ulangi'
			]);
			for (const b of boxes) {
				expect(b.width, `${b.name} wide`).toBeGreaterThanOrEqual(43.5);
				expect(b.height, `${b.name} high`).toBeGreaterThanOrEqual(43.5);
				expect(b.x, `${b.name} left`).toBeGreaterThanOrEqual(0);
				expect(b.x + b.width, `${b.name} right`).toBeLessThanOrEqual(width + 0.5);
			}
			for (let i = 1; i < boxes.length; i++) {
				const before = boxes[i - 1]!;
				expect(boxes[i]!.x, `${boxes[i]!.name} against ${before.name}`).toBeGreaterThanOrEqual(
					before.x + before.width - 0.5
				);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
				width
			);
		});
	}

	test('F1, F2, F8 (FSM + PDA at 360x740): identical 4-button bar in DOM/tab order, title >= 120 px, axe clean', async ({
		page,
		isMobile
	}) => {
		await page.setViewportSize({ width: 360, height: 740 });

		// FSM mode
		await openSandbox(page);
		const bar = page.locator('.editor .work > .bar');
		const fsmTitle = (await bar.locator('.title').boundingBox())!;
		expect(fsmTitle.width).toBeGreaterThanOrEqual(120);
		expect(await bar.locator('.title').evaluate((el) => getComputedStyle(el).textOverflow)).toBe(
			'ellipsis'
		);
		await expectNoAxeViolations(page);

		// PDA mode
		await openPdaWithExample(page, isMobile);
		const pdaButtons = await bar.getByRole('button').all();
		const pdaBoxes: { name: string; x: number; width: number; height: number }[] = [];
		for (const button of pdaButtons) {
			const box = (await button.boundingBox())!;
			const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
			pdaBoxes.push({ name, x: box.x, width: box.width, height: box.height });
		}
		expect(pdaBoxes.map((b) => b.name)).toEqual([
			expect.stringMatching(/^Mesin saya \(\d+\)$/),
			'Bantuan: tur 1 menit',
			'Urungkan',
			'Ulangi'
		]);
		for (const b of pdaBoxes) {
			expect(b.width, `${b.name} wide`).toBeGreaterThanOrEqual(43.5);
			expect(b.height, `${b.name} high`).toBeGreaterThanOrEqual(43.5);
			expect(b.x, `${b.name} left`).toBeGreaterThanOrEqual(0);
			expect(b.x + b.width, `${b.name} right`).toBeLessThanOrEqual(360.5);
		}
		// Tab order across the enabled buttons of the bar (Mesin -> Bantuan)
		await bar.getByRole('button', { name: /^Mesin saya/ }).focus();
		await page.keyboard.press('Tab');
		await expect(bar.getByRole('button', { name: 'Bantuan: tur 1 menit' })).toBeFocused();

		const pdaTitle = (await bar.locator('.title').boundingBox())!;
		expect(pdaTitle.width).toBeGreaterThanOrEqual(120);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			360
		);
		await expectNoAxeViolations(page);
	});

	test('F3: "Pas" floats inside the canvas box in both modes, >= 44 px, never intersects dock, handle, or toast', async ({
		page,
		isMobile
	}) => {
		await page.setViewportSize({ width: 360, height: 740 });

		for (const mode of ['fsm', 'pda'] as const) {
			if (mode === 'fsm') {
				await openSandbox(page);
			} else {
				await openPdaWithExample(page, isMobile);
			}

			const fit = page.getByRole('button', { name: 'Pas', exact: true });
			await expect(fit).toBeVisible();
			await expect(fit).toHaveText('Pas');
			// Must NOT be inside .bar
			await expect(
				page.locator('.editor .work > .bar').getByRole('button', { name: 'Pas', exact: true })
			).toHaveCount(0);

			const fitBox = (await fit.boundingBox())!;
			const stageBox = (await page.locator('.editor .stage').boundingBox())!;
			const dockBox = (await page.locator('.editor .rail').boundingBox())!;
			const handleBox = (await page.locator('aside.panel .handle').boundingBox())!;

			expect(fitBox.width, `${mode} fit width`).toBeGreaterThanOrEqual(43.5);
			expect(fitBox.height, `${mode} fit height`).toBeGreaterThanOrEqual(43.5);
			// Inside canvas box (.stage)
			expect(fitBox.x).toBeGreaterThanOrEqual(stageBox.x - 0.5);
			expect(fitBox.y).toBeGreaterThanOrEqual(stageBox.y - 0.5);
			expect(fitBox.x + fitBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 0.5);
			expect(fitBox.y + fitBox.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 0.5);
			// Does not intersect dock or panel drag bar
			expect(rectsIntersect(fitBox, dockBox), `${mode} fit vs dock`).toBe(false);
			expect(rectsIntersect(fitBox, handleBox), `${mode} fit vs handle`).toBe(false);

			// Trigger a toast by deleting a state and verify fit does not intersect the toast
			await page.getByRole('button', { name: 'Hapus', exact: true }).tap();
			await page.locator('svg.world g.node').first().tap();
			const toast = page.locator('.editor .work > .toast');
			await expect(toast).toBeVisible();
			const toastBox = (await toast.boundingBox())!;
			expect(rectsIntersect(fitBox, toastBox), `${mode} fit vs toast`).toBe(false);
		}
	});

	test('F6: mode selector is full width and 44 px high at 360 px, normal border after tap, focus ring on Tab', async ({
		page
	}) => {
		await page.setViewportSize({ width: 360, height: 740 });
		await openSandbox(page);

		const modeBar = page.locator('.mode-bar');
		const trigger = page.locator('.switcher-trigger');

		const checkFullWidth = async (label: string) => {
			const barMetrics = await modeBar.evaluate((el) => {
				const r = el.getBoundingClientRect();
				const cs = getComputedStyle(el);
				return {
					contentWidth: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
				};
			});
			const box = (await trigger.boundingBox())!;
			expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
			expect(
				Math.abs(box.width - barMetrics.contentWidth),
				`${label} full width`
			).toBeLessThanOrEqual(2);
		};

		await checkFullWidth('FSM');

		// Tap to switch to PDA
		await trigger.tap();
		await page.getByRole('option', { name: /^Otomata Pushdown/ }).tap();
		await page.locator('.editor[data-ready]').waitFor();
		await checkFullWidth('PDA');

		// Wait for any transition to finish and check normal border (not accent) and no outline
		await page.waitForTimeout(200);
		const afterTap = await trigger.evaluate((el) => {
			const cs = getComputedStyle(el);
			const root = getComputedStyle(document.documentElement);
			return {
				borderColor: cs.borderColor,
				outlineStyle: cs.outlineStyle,
				accent: root.getPropertyValue('--color-accent').trim()
			};
		});
		expect(afterTap.outlineStyle).toBe('none');
		expect(afterTap.borderColor).not.toBe('rgb(47, 91, 211)');

		// Verify the stylesheet guards .switcher-trigger:hover inside @media (hover: hover)
		const hoverGuarded = await page.evaluate(() => {
			const hoverRe = /\.switcher-trigger[^,]*:hover/;
			for (const sheet of document.styleSheets) {
				let rules: CSSRuleList;
				try {
					rules = sheet.cssRules;
				} catch {
					continue;
				}
				for (const rule of rules) {
					if (rule instanceof CSSStyleRule && hoverRe.test(rule.selectorText)) {
						return false; // unguarded top-level :hover rule!
					}
					if (rule instanceof CSSMediaRule && rule.conditionText.includes('hover: hover')) {
						for (const inner of rule.cssRules) {
							if (inner instanceof CSSStyleRule && hoverRe.test(inner.selectorText)) {
								return true;
							}
						}
					}
				}
			}
			return false;
		});
		expect(hoverGuarded).toBe(true);

		// Keyboard Tab onto trigger shows :focus-visible ring
		await trigger.evaluate((el) => el.blur());
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press('Tab');
			if (await trigger.evaluate((el) => el === document.activeElement)) break;
		}
		await expect(trigger).toBeFocused();
		const kb = await trigger.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { matchesFocusVisible: el.matches(':focus-visible'), outlineStyle: cs.outlineStyle };
		});
		expect(kb.matchesFocusVisible).toBe(true);
		expect(kb.outlineStyle).toBe('solid');
	});
});

test.describe('PDA help tour and library row Unduh (F4, F5)', () => {
	test('F4: "?" in PDA mode opens the tour dialog; Esc closes it and returns focus to "?"', async ({
		page,
		isMobile
	}) => {
		await openPdaWithExample(page, isMobile);
		const helpBtn = page.getByRole('button', { name: 'Bantuan: tur 1 menit' });
		await expect(helpBtn).toBeVisible();
		await press(helpBtn, isMobile);

		const tour = page.getByRole('dialog', { name: 'Tur 1 menit' });
		await expect(tour).toBeVisible();

		// Steps 4 and 5 mention "(pada mode FSM)"
		for (let i = 0; i < 3; i++)
			await press(tour.getByRole('button', { name: 'Berikutnya' }), isMobile);
		await expect(tour).toContainText('(pada mode FSM)');
		await press(tour.getByRole('button', { name: 'Berikutnya' }), isMobile);
		await expect(tour).toContainText('(pada mode FSM)');

		await page.keyboard.press('Escape');
		await expect(tour).toHaveCount(0);
		await expect(helpBtn).toBeFocused();
	});

	test('F5: "Unduh" in a PDA row works in FSM mode (Indonesian title, no raw key), flushes open PDA edits, and hides on FSM/unreadable rows', async ({
		page,
		isMobile
	}) => {
		await watchBlobs(page);
		await openSandbox(page);

		// Seed a readable PDA and an unreadable PDA into IndexedDB while in FSM mode (PdaWorkstation never mounted!)
		const now = Date.now();
		await putRow(page, {
			id: 'pda-saved-f5',
			recordVersion: 1,
			type: 'pda',
			title: 'PDA Uji Unduh',
			kind: 'dpda',
			createdAt: now,
			updatedAt: now,
			openedAt: now + 500,
			doc: serializePdaDocument(anbnSample('PDA Uji Unduh'))
		});
		await putRow(page, {
			id: 'pda-corrupt-f5',
			recordVersion: 1,
			type: 'pda',
			title: 'PDA Rusak F5',
			kind: 'ndpda',
			createdAt: now,
			updatedAt: now,
			openedAt: now + 400,
			doc: '{"schemaVersion":1,"broken'
		});
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();

		// In FSM mode: open "Mesin saya"
		await press(openListBtn(page), isMobile);
		await expect(list(page)).toBeVisible();

		// FSM row has "Bagikan" and NO "Unduh"
		await press(list(page).getByRole('button', { name: 'Tindakan untuk Berakhiran 01' }), isMobile);
		await expect(list(page).getByRole('button', { name: 'Bagikan', exact: true })).toHaveCount(1);
		await expect(list(page).getByRole('button', { name: 'Unduh', exact: true })).toHaveCount(0);

		// Unreadable PDA row has NEITHER "Bagikan" NOR "Unduh"
		await press(list(page).getByRole('button', { name: 'Tindakan untuk PDA Rusak F5' }), isMobile);
		await expect(list(page).getByRole('button', { name: 'Bagikan', exact: true })).toHaveCount(0);
		await expect(list(page).getByRole('button', { name: 'Unduh', exact: true })).toHaveCount(0);

		// Readable PDA row has "Unduh" and NO "Bagikan"
		await press(list(page).getByRole('button', { name: 'Tindakan untuk PDA Uji Unduh' }), isMobile);
		await expect(list(page).getByRole('button', { name: 'Bagikan', exact: true })).toHaveCount(0);
		const dlBtn = list(page).getByRole('button', { name: 'Unduh', exact: true });
		await expect(dlBtn).toBeVisible();
		await press(dlBtn, isMobile);

		// Dialog opens with real Indonesian title (NOT raw key pda_files.dialog_title)
		await expect(pdaFileDialog(page)).toBeVisible();
		await expect(pdaFileDialog(page).getByRole('heading', { name: 'Unduh PDA ini' })).toBeVisible();
		await expect(pdaFileDialog(page)).not.toContainText('pda_files.');

		const dlPromise1 = page.waitForEvent('download');
		await press(pdaFileDialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }), isMobile);
		const dl1 = await dlPromise1;
		expect(dl1.suggestedFilename()).toBe('PDA Uji Unduh.jff');
		expect(await blobTypes(page)).toEqual(['application/octet-stream;charset=utf-8']);
		await press(pdaFileDialog(page).getByRole('button', { name: 'Tutup' }), isMobile);
		await expect(pdaFileDialog(page)).toHaveCount(0);

		// Now switch to PDA mode, open PDA Uji Unduh, edit it (add a state), and immediately download from its row
		await page.goto('/sandbox?mode=pda');
		await page.locator('.editor[data-ready]').waitFor();
		await expect(page.locator('.editor .work > .bar .title')).toHaveText('PDA Uji Unduh');

		// Add a new state (q2) and immediately open "Mesin saya" before autosave debounce fires
		await press(page.getByRole('button', { name: 'Tambah state' }), isMobile);
		const canvasBox = (await page
			.getByRole('application', { name: 'Kanvas mesin' })
			.boundingBox())!;
		if (isMobile) {
			await page.touchscreen.tap(canvasBox.x + 60, canvasBox.y + 60);
		} else {
			await page.mouse.click(canvasBox.x + 60, canvasBox.y + 60);
		}
		await expect(page.locator('svg.world g.node')).toHaveCount(3);

		await press(openListBtn(page), isMobile);
		await expect(list(page)).toBeVisible();
		await press(list(page).getByRole('button', { name: 'Tindakan untuk PDA Uji Unduh' }), isMobile);
		await press(list(page).getByRole('button', { name: 'Unduh', exact: true }), isMobile);
		await expect(pdaFileDialog(page)).toBeVisible();

		const dlPromise2 = page.waitForEvent('download');
		await press(pdaFileDialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }), isMobile);
		const dl2 = await dlPromise2;
		const jffText = readFileSync((await dl2.path())!, 'utf8');
		expect(jffText).toContain('name="q2"');
	});
});

test.describe('laptop bar (F7)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop only');
	});

	test('F7: at 1280x800 FSM bar is unchanged and PDA bar has "?" before download', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const visibleBarButtons = () =>
			page.locator('.editor .work > .bar button').evaluateAll((els) =>
				els
					.filter((el) => {
						const r = el.getBoundingClientRect();
						return r.width > 0 && r.height > 0;
					})
					.map((el) => el.getAttribute('aria-label') || el.textContent?.trim())
			);

		await openSandbox(page);
		expect(await visibleBarButtons()).toEqual([
			'Tata letak otomatis',
			'Bantuan: tur 1 menit',
			'Bagikan'
		]);

		await openPdaWithExample(page, false);
		expect(await visibleBarButtons()).toEqual([
			'Bantuan: tur 1 menit',
			'Unduh mesin ini sebagai file'
		]);
	});
});
