// Focus-ring clipping guard (T-091): verifies that keyboard-focused controls do not have their
// outline clipped by any ancestor with non-visible overflow, on desktop (1440x900) and phone
// (360x780).
import { expect, openPda, openSandbox, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const PHONE_360 = { width: 360, height: 780 };
const TOLERANCE_PX = 0.5;

interface ClipCheckResult {
	tag: string;
	id: string;
	cls: string;
	matchesFocusVisible: boolean;
	outlineStyle: string;
	outlineWidth: number;
	outlineOffset: number;
	rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
	ring: { left: number; top: number; right: number; bottom: number };
	violations: string[];
}

/**
 * Measures the focused element's focus-ring box (border box expanded by max(0, outlineWidth +
 * outlineOffset)) against the padding box of every ancestor whose computed overflow-x or
 * overflow-y is not `visible` (including `clip`). Accounts for axis-aligned CSS transforms and
 * flags non-axis-aligned transforms.
 */
async function measureRingClipping(locator: Locator): Promise<ClipCheckResult> {
	return locator.evaluate((el, tol) => {
		const cs = getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		const outlineStyle = cs.outlineStyle;
		const outlineWidth = outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) || 0;
		const outlineOffset = outlineStyle === 'none' ? 0 : parseFloat(cs.outlineOffset) || 0;
		const expand = outlineWidth > 0 ? Math.max(0, outlineWidth + outlineOffset) : 0;
		const ring = {
			left: rect.left - expand,
			top: rect.top - expand,
			right: rect.right + expand,
			bottom: rect.bottom + expand
		};
		const violations: string[] = [];

		if (!el.matches(':focus-visible')) {
			violations.push('element does not match :focus-visible');
		}
		if (outlineStyle === 'none' || outlineWidth <= 0) {
			violations.push(`no visible outline (style=${outlineStyle}, width=${outlineWidth}px)`);
		}

		let cur = el.parentElement;
		while (cur && cur !== document.documentElement) {
			const acs = getComputedStyle(cur);
			const clipsX = acs.overflowX !== 'visible';
			const clipsY = acs.overflowY !== 'visible';
			if (clipsX || clipsY) {
				const ar = cur.getBoundingClientRect();
				let scaleX = 1;
				let scaleY = 1;
				if (acs.transform && acs.transform !== 'none') {
					const m = new DOMMatrix(acs.transform);
					if (Math.abs(m.b) > 1e-4 || Math.abs(m.c) > 1e-4) {
						violations.push(
							`ancestor <${cur.tagName.toLowerCase()}.${cur.className}> has non-axis-aligned transform (${acs.transform})`
						);
						cur = cur.parentElement;
						continue;
					}
					scaleX = cur.offsetWidth > 0 ? ar.width / cur.offsetWidth : 1;
					scaleY = cur.offsetHeight > 0 ? ar.height / cur.offsetHeight : 1;
				}
				const padLeft = ar.left + cur.clientLeft * scaleX;
				const padTop = ar.top + cur.clientTop * scaleY;
				const padRight = padLeft + cur.clientWidth * scaleX;
				const padBottom = padTop + cur.clientHeight * scaleY;

				const clipL = clipsX ? padLeft - ring.left : 0;
				const clipR = clipsX ? ring.right - padRight : 0;
				const clipT = clipsY ? padTop - ring.top : 0;
				const clipB = clipsY ? ring.bottom - padBottom : 0;

				const sides: string[] = [];
				if (clipL > tol) sides.push(`left=${clipL.toFixed(1)}px`);
				if (clipR > tol) sides.push(`right=${clipR.toFixed(1)}px`);
				if (clipT > tol) sides.push(`top=${clipT.toFixed(1)}px`);
				if (clipB > tol) sides.push(`bottom=${clipB.toFixed(1)}px`);

				if (sides.length > 0) {
					const who = `${cur.tagName.toLowerCase()}${cur.className ? '.' + String(cur.className).trim().split(/\s+/).join('.') : ''}`;
					violations.push(
						`clipped by <${who}> (overflow: ${acs.overflowX}/${acs.overflowY}) on ${sides.join(', ')}: ` +
							`ring=[${ring.left.toFixed(1)}, ${ring.top.toFixed(1)}, ${ring.right.toFixed(1)}, ${ring.bottom.toFixed(1)}] ` +
							`vs padBox=[${padLeft.toFixed(1)}, ${padTop.toFixed(1)}, ${padRight.toFixed(1)}, ${padBottom.toFixed(1)}]`
					);
				}
			}
			cur = cur.parentElement;
		}

		return {
			tag: el.tagName.toLowerCase(),
			id: el.id,
			cls: typeof el.className === 'string' ? el.className : '',
			matchesFocusVisible: el.matches(':focus-visible'),
			outlineStyle,
			outlineWidth,
			outlineOffset,
			rect: {
				left: rect.left,
				top: rect.top,
				right: rect.right,
				bottom: rect.bottom,
				width: rect.width,
				height: rect.height
			},
			ring,
			violations
		};
	}, TOLERANCE_PX);
}

/**
 * Focuses `locator` with keyboard focus-visible modality active and asserts its focus ring is not
 * clipped by any ancestor with non-visible overflow.
 */
async function expectRingNotClipped(page: Page, locator: Locator, label: string): Promise<void> {
	await locator.waitFor({ state: 'visible' });
	await locator.scrollIntoViewIfNeeded();
	// Shift activates keyboard modality without moving focus or dismissing popovers/sheets.
	await page.keyboard.press('Shift');
	await locator.focus();
	const result = await measureRingClipping(locator);
	expect(result.violations, `${label} focus ring clipped`).toEqual([]);
}

test.beforeEach(async ({ page, isMobile }) => {
	if (isMobile) {
		await page.setViewportSize(PHONE_360);
	}
});

test('guard B4: helper catches a clipped ring in a synthetic overflow-y: auto fixture and scaled ancestor', async ({
	page
}) => {
	await page.setContent(`
		<style>
			.clip-box { width: 200px; overflow-y: auto; padding: 0; margin: 20px; }
			.clip-box input { width: 100%; box-sizing: border-box; height: 44px; outline: 2px solid #2f5bd3; outline-offset: 2px; }
			.scaled { transform: scale(0.8); transform-origin: top left; width: 200px; overflow-y: auto; padding: 0; margin: 20px; }
			.scaled button { width: 100%; height: 44px; outline: 2px solid #2f5bd3; outline-offset: 2px; }
		</style>
		<div class="clip-box"><input id="clipped-input" type="text" /></div>
		<div class="scaled"><button id="scaled-btn" type="button">Test</button></div>
	`);

	const input = page.locator('#clipped-input');
	await page.keyboard.press('Shift');
	await input.focus();
	const inputRes = await measureRingClipping(input);
	expect(inputRes.violations.length).toBeGreaterThan(0);
	expect(inputRes.violations[0]).toContain('left=4.0px');
	expect(inputRes.violations[0]).toContain('right=4.0px');

	const btn = page.locator('#scaled-btn');
	await page.keyboard.press('Shift');
	await btn.focus();
	const btnRes = await measureRingClipping(btn);
	expect(btnRes.violations.length).toBeGreaterThan(0);
	expect(btnRes.violations[0]).toContain('left=');
	expect(btnRes.violations[0]).toContain('right=');
});

test('PDA Simulasi tab: String masukan, run buttons, and Tambah string controls are not clipped', async ({
	page
}) => {
	await openPda(page);
	await expectRingNotClipped(page, page.locator('#pda-run-input'), 'PDA String masukan');
	await expectRingNotClipped(page, page.locator('.controls button.go'), 'PDA Jalankan');
	await expectRingNotClipped(page, page.locator('.controls button').last(), 'PDA Langkah maju');
	await expectRingNotClipped(page, page.locator('.tests input[type="text"]'), 'PDA Tambah input');
	await expectRingNotClipped(page, page.locator('.tests button.add'), 'PDA Tambah button');
});

test('PDA Tabel tab: first and last controls are not clipped', async ({ page }) => {
	await openPda(page);
	await page.getByRole('tab', { name: 'Tabel' }).click();
	const pane = page.locator('#panel-pane-table');
	await pane.getByRole('button', { name: '+ State' }).waitFor();

	await expectRingNotClipped(
		page,
		pane.locator('.kind button[role="radio"][tabindex="0"]'),
		'PDA Tabel KindSwitch'
	);
	await expectRingNotClipped(
		page,
		pane.getByRole('button', { name: '+ State' }),
		'PDA Tabel + State'
	);
	await expectRingNotClipped(page, pane.locator('button.add-transition'), 'PDA Tabel + Transisi');
});

test('FSM Simulasi tab: String masukan, first and last run buttons, and Tambah controls are not clipped', async ({
	page
}) => {
	await openSandbox(page);
	await expectRingNotClipped(page, page.locator('#run-input'), 'FSM String masukan');

	// Start a short run so the first button (Ke awal) is enabled and focusable.
	await page.locator('#run-input').fill('01');
	await page.locator('.controls button').last().click();
	await expect(page.locator('.controls button').first()).toBeEnabled();

	await expectRingNotClipped(page, page.locator('.controls button').first(), 'FSM Ke awal');
	await expectRingNotClipped(page, page.locator('.controls button').last(), 'FSM Langkah maju');
	await expectRingNotClipped(page, page.locator('.tests input[type="text"]'), 'FSM Tambah input');
	await expectRingNotClipped(page, page.locator('.tests button.add'), 'FSM Tambah button');
});

test('FSM Tabel tab: first and last controls are not clipped', async ({ page }) => {
	await openSandbox(page);
	await page.getByRole('tab', { name: 'Tabel' }).click();
	const pane = page.locator('#panel-pane-table');
	await pane.getByRole('button', { name: '+ State' }).waitFor();

	await expectRingNotClipped(
		page,
		pane.locator('.kind button[role="radio"][tabindex="0"]'),
		'FSM Tabel KindSwitch'
	);
	await expectRingNotClipped(
		page,
		pane.getByRole('button', { name: '+ State' }),
		'FSM Tabel + State'
	);
	await expectRingNotClipped(
		page,
		pane.locator('.tools form button[type="submit"]'),
		'FSM Tabel Tambah simbol'
	);
});

test('PDA label form (phone sheet and desktop popover): inputs and buttons are not clipped', async ({
	page,
	isMobile
}) => {
	await openPda(page);
	const stage = page.locator('.stage svg');

	const addStateBtn = page.getByRole('button', { name: /^Tambah state/ });
	if (isMobile) {
		await addStateBtn.tap();
		await stage.tap({ position: { x: 120, y: 100 } });
		await stage.tap({ position: { x: 260, y: 100 } });
	} else {
		await addStateBtn.click();
		await stage.click({ position: { x: 200, y: 200 } });
		await stage.click({ position: { x: 380, y: 200 } });
	}

	const addTransBtn = page.getByRole('button', { name: /^Tambah transisi/ });
	const q0 = page.getByRole('button', { name: /^State q0(,|$)/ });
	const q1 = page.getByRole('button', { name: /^State q1(,|$)/ });
	if (isMobile) {
		await addTransBtn.tap();
		await q0.tap();
		await q1.tap();
	} else {
		await addTransBtn.click();
		await q0.click();
		await q1.click();
	}

	const form = page.locator('.pda-label-form[role="dialog"]');
	await form.waitFor({ state: 'visible' });
	await expectRingNotClipped(page, form.locator('input').first(), 'PdaLabelForm Baca');
	await expectRingNotClipped(page, form.locator('input').nth(2), 'PdaLabelForm Push');
	await expectRingNotClipped(page, form.locator('.delete-btn').first(), 'PdaLabelForm Hapus baris');
	await expectRingNotClipped(page, form.locator('.btn-primary'), 'PdaLabelForm Simpan');
});

test('LanguageSwitch and ConversionPanel .seg are not clipped', async ({ page }) => {
	// 1. LanguageSwitch in global header
	await openSandbox(page);
	await expectRingNotClipped(
		page,
		page.locator('.switch button[aria-pressed="true"]'),
		'LanguageSwitch active button'
	);

	// 2. ConversionPanel .seg (open Konversi tab and run Minimalkan DFSM)
	await page.getByRole('tab', { name: 'Konversi' }).click();
	const pane = page.locator('#panel-pane-conversion');
	await pane.locator('li', { hasText: 'Minimalkan DFSM' }).getByRole('button').click();
	await pane.locator('.seg button').first().waitFor({ state: 'visible' });
	await expectRingNotClipped(
		page,
		pane.locator('.seg button').first(),
		'ConversionPanel .seg first button'
	);
	await expectRingNotClipped(
		page,
		pane.locator('.seg button').last(),
		'ConversionPanel .seg last button'
	);
});

test('desktop workstations: GrammarCykTester .cyk-container and LanguageWorkstation .splitter are not clipped', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'desktop-only scroll container and splitter');

	await page.goto('/sandbox?mode=grammar');
	await page.locator('.workstation').waitFor();
	await page.locator('.tabs-header button', { hasText: /CYK/ }).click();
	await page.locator('.cyk-container .test-btn').waitFor({ state: 'visible' });
	await expectRingNotClipped(
		page,
		page.locator('.cyk-container .test-btn'),
		'GrammarCykTester test button'
	);
	await expectRingNotClipped(
		page,
		page.locator('.cyk-container .sample-pill').first(),
		'GrammarCykTester sample pill'
	);

	await page.goto('/sandbox?mode=language');
	await page.locator('.workstation').waitFor();
	await expectRingNotClipped(
		page,
		page.locator('.workstation .splitter').first(),
		'LanguageWorkstation .splitter'
	);
});

test('Tab sweep (up to 60 stops) on FSM sandbox and PDA sandbox finds no clipped ring', async ({
	page
}) => {
	async function sweep(modeLabel: string) {
		const seen = new Set<string>();
		const failures: string[] = [];
		for (let i = 0; i < 60; i++) {
			await page.keyboard.press('Tab');
			const info = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el || el === document.body || el === document.documentElement) return null;
				const r = el.getBoundingClientRect();
				if (r.width === 0 || r.height === 0) return null;
				const cs = getComputedStyle(el);
				// Skip SVG diagram nodes (they draw their own focus rings inside the SVG)
				if (el instanceof SVGElement) return null;
				return {
					key: `${el.tagName}:${el.id}:${el.className}:${el.textContent?.trim().slice(0, 20)}:${Math.round(r.left)},${Math.round(r.top)}`,
					outlineStyle: cs.outlineStyle
				};
			});
			if (!info) continue;
			if (seen.has(info.key)) break;
			seen.add(info.key);
			const active = page.locator(':focus');
			const res = await measureRingClipping(active);
			if (res.violations.length > 0) {
				failures.push(`[${modeLabel} stop ${i + 1} ${info.key}] ${res.violations.join('; ')}`);
			}
		}
		expect(seen.size, `${modeLabel} tab sweep visited controls`).toBeGreaterThan(5);
		expect(failures, `${modeLabel} tab sweep clipped rings`).toEqual([]);
	}

	await openSandbox(page);
	await sweep('FSM');

	await openPda(page);
	await sweep('PDA');
});
