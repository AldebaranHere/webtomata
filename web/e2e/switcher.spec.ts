import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

async function openSandbox(page: Page, query = '') {
	await page.goto(`/sandbox${query}`);
	const trigger = page.locator('.switcher-trigger');
	await trigger.waitFor();
	return trigger;
}

test.describe('workstation mode switcher - keyboard, mouse, and state', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project for full keyboard and state flows');
	});

	test('trigger accessibility attributes and open/close via click', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		// Trigger initial state
		await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('.switcher-popover[role="listbox"]')).toHaveCount(0);

		// Click to open
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		// Click to close
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(popover).toHaveCount(0);
	});

	test('Enter and Space open popover and move focus to selected item', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		// 1. Open with Enter
		await trigger.focus();
		await page.keyboard.press('Enter');
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		// Active mode on /sandbox is FSM by default
		const fsmOption = popover.locator('button.switcher-item[role="option"][aria-selected="true"]');
		await expect(fsmOption).toBeVisible();
		await expect(fsmOption).toBeFocused();

		// Close with Escape
		await page.keyboard.press('Escape');
		await expect(popover).toHaveCount(0);
		await expect(trigger).toBeFocused();

		// 2. Open with Space
		await page.keyboard.press('Space');
		await expect(popover).toBeVisible();
		await expect(fsmOption).toBeFocused();
	});

	test('ArrowDown and ArrowUp navigate enabled items and wrap around', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		// Open popover
		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		const enabledOptions = popover.locator('button.switcher-item[role="option"]');
		await expect(enabledOptions).toHaveCount(4);

		const optFsm = enabledOptions.nth(0); // Mesin FSM
		const optPda = enabledOptions.nth(1); // Otomata Pushdown (PDA)
		const optLanguage = enabledOptions.nth(2); // Bahasa & Enumerasi
		const optGrammar = enabledOptions.nth(3); // Tata Bahasa (CFG & CNF)

		await expect(optFsm).toBeFocused();

		// ArrowDown moves to PDA
		await page.keyboard.press('ArrowDown');
		await expect(optPda).toBeFocused();

		// ArrowDown moves to Language
		await page.keyboard.press('ArrowDown');
		await expect(optLanguage).toBeFocused();

		// ArrowDown moves to Grammar
		await page.keyboard.press('ArrowDown');
		await expect(optGrammar).toBeFocused();

		// ArrowDown wraps to FSM
		await page.keyboard.press('ArrowDown');
		await expect(optFsm).toBeFocused();

		// ArrowUp wraps backwards to Grammar
		await page.keyboard.press('ArrowUp');
		await expect(optGrammar).toBeFocused();

		// ArrowUp moves to Language
		await page.keyboard.press('ArrowUp');
		await expect(optLanguage).toBeFocused();

		// ArrowUp moves to PDA
		await page.keyboard.press('ArrowUp');
		await expect(optPda).toBeFocused();

		// ArrowUp moves to FSM
		await page.keyboard.press('ArrowUp');
		await expect(optFsm).toBeFocused();
	});

	test('disabled item (TM) is never focused and clicking it does nothing', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		const disabledItems = popover.locator('.switcher-item.disabled');
		await expect(disabledItems).toHaveCount(1);

		// Disabled item has aria-disabled="true"
		await expect(disabledItems.nth(0)).toHaveAttribute('aria-disabled', 'true');

		// ArrowDown moves through enabled items only, skipping disabled item
		const optFsm = popover.locator('button.switcher-item[role="option"]').nth(0);
		const optPda = popover.locator('button.switcher-item[role="option"]').nth(1);
		await expect(optFsm).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(optPda).toBeFocused();

		// Disabled item should not be focused
		await expect(disabledItems.nth(0)).not.toBeFocused();

		// Clicking disabled item does nothing: popover remains open and mode does not change
		await disabledItems.nth(0).click({ force: true });
		await expect(popover).toBeVisible();
		await expect(page.locator('.editor[data-ready]')).toBeVisible();
	});

	test('Escape closes popover and returns focus to trigger', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(popover).toHaveCount(0);
		await expect(trigger).toBeFocused();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	test('pointer press outside closes popover', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		// Click outside on main site header or body
		await page.locator('header').click({ position: { x: 10, y: 10 } });
		await expect(popover).toHaveCount(0);
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	test('selecting an item loads workstation, updates URL query param and localStorage', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);

		// Switch to Language workstation
		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		const langOption = popover.getByRole('option', { name: /^Bahasa & Enumerasi/ });
		await langOption.click();

		await expect(popover).toHaveCount(0);
		await expect(trigger).toBeFocused();
		await expect(page).toHaveURL(/mode=language/);
		await expect(page.locator('.workstation')).toBeVisible();

		const storedLang = await page.evaluate(() => localStorage.getItem('webtomata_sandbox_mode'));
		expect(storedLang).toBe('language');

		// Switch to Grammar workstation
		await trigger.click();
		const grammarOption = page
			.locator('.switcher-popover[role="listbox"]')
			.getByRole('option', { name: /^Tata Bahasa \(CFG & CNF\)/ });
		await grammarOption.click();

		await expect(page).toHaveURL(/mode=grammar/);
		await expect(page.locator('#grammar-pane-editor')).toBeVisible();

		const storedGrammar = await page.evaluate(() => localStorage.getItem('webtomata_sandbox_mode'));
		expect(storedGrammar).toBe('grammar');

		// Switch back to FSM workstation
		await trigger.click();
		const fsmOption = page
			.locator('.switcher-popover[role="listbox"]')
			.getByRole('option', { name: /^Mesin FSM/ });
		await fsmOption.click();

		await expect(page).not.toHaveURL(/mode=/);
		await expect(page.locator('.editor[data-ready]')).toBeVisible();

		const storedFsm = await page.evaluate(() => localStorage.getItem('webtomata_sandbox_mode'));
		expect(storedFsm).toBe('fsm');
	});

	test('mode persistence across reload and precedence ranking between address and localStorage', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });

		// 1. Persistence on reload: navigate to ?mode=language, reload, verify mode stays language
		await openSandbox(page, '?mode=language');
		await expect(page.locator('.workstation')).toBeVisible();
		await page.reload();
		await expect(page.locator('.workstation')).toBeVisible();

		// 2. Precedence: valid ?mode= in URL takes precedence over localStorage
		// Set localStorage to grammar, but open with ?mode=language -> language must win
		await page.evaluate(() => localStorage.setItem('webtomata_sandbox_mode', 'grammar'));
		await page.goto('/sandbox?mode=language');
		await expect(page.locator('.workstation')).toBeVisible();
		await expect(page.locator('#language-pane-editor')).toBeVisible();

		// 3. Fallback: invalid ?mode= in URL falls back to localStorage
		// Set localStorage to language, open with ?mode=unknown_invalid -> language must win
		await page.evaluate(() => localStorage.setItem('webtomata_sandbox_mode', 'language'));
		await page.goto('/sandbox?mode=unknown_invalid');
		await expect(page.locator('.workstation')).toBeVisible();
		await expect(page.locator('#language-pane-editor')).toBeVisible();

		// 4. Default: invalid ?mode= in URL and empty localStorage falls back to fsm
		await page.evaluate(() => localStorage.removeItem('webtomata_sandbox_mode'));
		await page.goto('/sandbox?mode=unknown_invalid');
		await expect(page.locator('.editor[data-ready]')).toBeVisible();
	});

	test('accessibility check with popover open on desktop (1280x800)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const trigger = await openSandbox(page);
		await trigger.click();
		await expect(page.locator('.switcher-popover[role="listbox"]')).toBeVisible();
		await expectNoAxeViolations(page);
	});
});

test.describe('workstation mode switcher - phone targets and responsive layout', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, 'phone project only');
	});

	test('items are at least 44px tall and trigger fits in one row at 360px', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });
		const trigger = await openSandbox(page);

		// Check trigger dimensions: min-height 44px and fits in one row
		const triggerBox = (await trigger.boundingBox())!;
		expect(triggerBox.height).toBeGreaterThanOrEqual(44);
		expect(triggerBox.width).toBeLessThanOrEqual(360);

		const triggerLabel = trigger.locator('.trigger-label');
		const triggerCurrent = trigger.locator('.trigger-current');
		const triggerChevron = trigger.locator('.trigger-chevron');

		const labelBox = (await triggerLabel.boundingBox())!;
		const currentBox = (await triggerCurrent.boundingBox())!;
		const chevronBox = (await triggerChevron.boundingBox())!;

		// All three elements share the same vertical line (within 4px)
		expect(Math.abs(labelBox.y - currentBox.y)).toBeLessThanOrEqual(4);
		expect(Math.abs(currentBox.y - chevronBox.y)).toBeLessThanOrEqual(4);
		// Chevron fits inside trigger box
		expect(chevronBox.x + chevronBox.width).toBeLessThanOrEqual(triggerBox.x + triggerBox.width);

		// Open popover and measure items
		await trigger.click();
		const popover = page.locator('.switcher-popover[role="listbox"]');
		await expect(popover).toBeVisible();

		const allItems = popover.locator('.switcher-item');
		const itemCount = await allItems.count();
		expect(itemCount).toBe(5); // 4 enabled + 1 disabled

		for (let i = 0; i < itemCount; i++) {
			const itemBox = (await allItems.nth(i).boundingBox())!;
			expect(
				itemBox.height,
				`Item ${i} height must be at least 44px, got ${itemBox.height}`
			).toBeGreaterThanOrEqual(44);
		}

		// Accessibility scan on phone with popover open
		await expectNoAxeViolations(page);
	});
});
