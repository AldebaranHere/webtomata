// The titles of machines that come from our content (the sample now, the examples later): the page
// shows the one of the language that is active, and a title that the user chooses is never
// translated. The record keeps both titles (docs/decisions/0023-saved-machines.md).
import { expect, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { records } from './db.ts';

const barTitle = (page: Page) => page.locator('.bar .title');
const dialog = (page: Page) => page.getByRole('dialog', { name: /Mesin saya|My machines/ });
const openButton = (page: Page) =>
	page.getByRole('button', { name: /^(Mesin saya|My machines) \(\d+\)$/ });
const language = (page: Page, code: 'ID, Bahasa Indonesia' | 'EN, English') =>
	page.getByRole('button', { name: code });

/** The language buttons are in the header; a phone has them behind the Menu button. */
async function choose(page: Page, code: 'ID, Bahasa Indonesia' | 'EN, English', isMobile: boolean) {
	if (isMobile) {
		const menu = page.getByRole('button', { name: /^Menu$/ });
		if ((await menu.getAttribute('aria-expanded')) === 'false') await menu.click();
	}
	await language(page, code).click();
}

test('the sample shows its title in the language of the page, in the bar and in the list', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await expect(barTitle(page)).toHaveText('Berakhiran 01');
	await choose(page, 'EN, English', isMobile);
	await expect(barTitle(page)).toHaveText('Ending in 01');
	await openButton(page).click();
	await expect(dialog(page).locator('li .name')).toHaveText(['Ending in 01']);
	await page.keyboard.press('Escape');
	await choose(page, 'ID, Bahasa Indonesia', isMobile);
	await expect(barTitle(page)).toHaveText('Berakhiran 01');

	// The record keeps both titles, and the document has the title of the language of the first visit.
	await expect.poll(async () => (await records(page)).length).toBe(1);
	const [record] = await records(page);
	expect(record!.titles).toEqual({ id: 'Berakhiran 01', en: 'Ending in 01' });
	expect(record!.title).toBe('Berakhiran 01');
});

test('a sample made while the page is in English has the English title, and shows the other one in Indonesian', async ({
	page,
	isMobile
}) => {
	// Only on the first load: later the user chooses.
	await page.addInitScript(() => {
		if (!localStorage.getItem('webtomata.lang')) localStorage.setItem('webtomata.lang', 'en');
	});
	await openSandbox(page);
	await expect(barTitle(page)).toHaveText('Ending in 01');
	await expect.poll(async () => (await records(page)).length).toBe(1);
	expect((await records(page))[0]!.title).toBe('Ending in 01');
	await choose(page, 'ID, Bahasa Indonesia', isMobile);
	await expect(barTitle(page)).toHaveText('Berakhiran 01');
	// A reload keeps the language, and so the title.
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(barTitle(page)).toHaveText('Berakhiran 01');
});

test('a title that the user chooses stays as it is in both languages, and an undo brings the titles back', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	const press = (target: ReturnType<Page['locator']>) => (isMobile ? target.tap() : target.click());
	await press(openButton(page));
	await press(dialog(page).getByRole('button', { name: 'Tindakan untuk Berakhiran 01' }));
	await press(dialog(page).getByRole('button', { name: 'Ubah nama' }));
	await page.keyboard.press('Control+a');
	await page.keyboard.type('Genap a');
	await page.keyboard.press('Enter');
	await expect(dialog(page).locator('li .name')).toHaveText(['Genap a']);
	await press(dialog(page).getByRole('button', { name: 'Tutup' }));

	await choose(page, 'EN, English', isMobile);
	await expect(barTitle(page)).toHaveText('Genap a');
	await expect
		.poll(async () => (await records(page))[0]?.titles, { timeout: 5000 })
		.toBeUndefined();

	// Undo: the title is the first one again, and so the titles of the content come back.
	await page.getByRole('application', { name: /Kanvas mesin|Machine canvas/ }).focus();
	await page.keyboard.press('Control+z');
	await expect(barTitle(page)).toHaveText('Ending in 01');
	await expect
		.poll(async () => (await records(page))[0]?.titles, { timeout: 5000 })
		.toEqual({ id: 'Berakhiran 01', en: 'Ending in 01' });
});
