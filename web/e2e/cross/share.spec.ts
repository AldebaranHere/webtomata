// Sharing a machine as a link in every engine (S10b-1). The link uses what browsers do not all do the
// same way: compression streams, a native <dialog>, and a change of the fragment that does not load the
// page again. The details are tested in Chrome (e2e/share-link.spec.ts); this runs in Chrome, Firefox and
// WebKit.
import { openSandbox, expect, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { records } from './db.ts';

const shareButton = (page: Page) => page.getByRole('button', { name: 'Bagikan', exact: true });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Bagikan mesin' });
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

/** Opens the dialog: with the button of the bar, or (a phone has no room for it there) from the list. */
async function openShare(page: Page): Promise<void> {
	if ((await shareButton(page).count()) > 0) {
		await shareButton(page).click();
	} else {
		await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
		const list = page.getByRole('dialog', { name: 'Mesin saya' });
		await list
			.getByRole('button', { name: /^Tindakan untuk/ })
			.first()
			.tap();
		await list.getByRole('button', { name: 'Bagikan', exact: true }).tap();
	}
	await expect(dialog(page)).toBeVisible();
}

test('a link holds the machine, and opens as a new machine for another person', async ({
	page,
	browser,
	baseURL
}) => {
	await openSandbox(page);
	await openShare(page);
	const link = await dialog(page).getByRole('textbox', { name: 'Tautan' }).inputValue();
	expect(link).toMatch(/\/sandbox#m1=[A-Za-z0-9_-]+$/);
	const other = await browser.newContext({ baseURL });
	try {
		const friend = await other.newPage();
		await friend.goto(link);
		await friend.locator('.editor[data-ready]').waitFor();
		await expect(friend.locator('.notice')).toContainText('dibuka sebagai mesin baru');
		await expect(state(friend, 'q0')).toBeVisible();
		await expect(state(friend, 'q2')).toBeVisible();
		expect(friend.url()).not.toContain('#');
	} finally {
		await other.close();
	}
});

test('a link pasted in a tab that already shows the Sandbox opens too, and does not touch the other machine', async ({
	page
}) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	const [before] = await records(page);
	await openShare(page);
	const link = await dialog(page).getByRole('textbox', { name: 'Tautan' }).inputValue();
	await page.keyboard.press('Escape');
	// Only the fragment changes, so the page is not loaded again: the change must open the link.
	await page.goto(link);
	await expect(page.locator('.notice')).toContainText('dibuka sebagai mesin baru');
	const all = await records(page);
	expect(all).toHaveLength(2);
	expect(all.find((r) => r.id === before!.id)!.doc).toBe(before!.doc);
});

test('a link that is cut says so, and changes nothing', async ({ page }) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	await page.goto('/sandbox#m1=abcde');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.locator('.notice')).toContainText('bukan mesin WebTomata yang utuh');
	expect(await records(page)).toHaveLength(1);
});

test('the machine is downloaded as a JSON file and as a .jff file', async ({ page }) => {
	await openSandbox(page);
	await openShare(page);
	const json = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'Unduh JSON' }).click();
	const jsonFile = await json;
	// WebKit on Linux writes a space of the name as an underscore in the name that it suggests; the page gives the name with the space.
	expect(jsonFile.suggestedFilename()).toMatch(/^Berakhiran[ _]01\.webtomata\.json$/);
	const text = (await import('node:fs')).readFileSync((await jsonFile.path())!, 'utf8');
	expect(JSON.parse(text).states).toHaveLength(3);
	const jff = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }).click();
	const jffFile = await jff;
	expect(jffFile.suggestedFilename()).toMatch(/^Berakhiran[ _]01\.jff$/);
	const xml = (await import('node:fs')).readFileSync((await jffFile.path())!, 'utf8');
	expect(xml).toContain('<type>fa</type>');
});
