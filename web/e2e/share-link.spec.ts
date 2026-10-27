// S10b-1, sharing a machine as a link: the dialog, the link that holds the whole machine in its fragment,
// opening a link as a machine of its own (never over the student's), and a link that is damaged, huge or
// too long. The link comes from outside, so these tests also try what a person could make on purpose.
import { deflateRawSync } from 'node:zlib';
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { records } from './cross/db.ts';
import { touchTap } from './touch.ts';

const shareButton = (page: Page) => page.getByRole('button', { name: 'Bagikan', exact: true });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Bagikan mesin' });
const linkField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Tautan' });
const note = (page: Page) => page.locator('.notice');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

const base64url = (data: Uint8Array) =>
	Buffer.from(data).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/** Opens the dialog: with the button of the bar, or (the bar of a phone is full) from the row of the machine. */
async function openShare(page: Page): Promise<void> {
	if ((await shareButton(page).count()) > 0) {
		await shareButton(page).click();
		return;
	}
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await list
		.getByRole('button', { name: /^Tindakan untuk/ })
		.first()
		.click();
	await list.getByRole('button', { name: 'Bagikan', exact: true }).click();
}

/** The link that the dialog shows. */
async function linkOf(page: Page): Promise<string> {
	await openShare(page);
	await expect(dialog(page)).toBeVisible();
	await expect(linkField(page)).toHaveValue(/#m1=/);
	return linkField(page).inputValue();
}

/** A document file of many states with names and places that do not compress well, as a link. */
function bigLink(states: number): string {
	let seed = 7;
	const next = (n: number) => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed % n;
	};
	const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const word = () => Array.from({ length: 8 }, () => letters[next(62)]).join('');
	const doc = {
		schemaVersion: 1,
		title: 'Besar',
		kind: 'dfsm',
		alphabet: ['a'],
		states: Array.from({ length: states }, (_, id) => ({
			id,
			name: word(),
			x: next(900_000),
			y: next(900_000)
		})),
		start: 0,
		accepting: [1],
		transitions: Array.from({ length: states }, (_, id) => ({
			from: id,
			on: 'a',
			to: (id + 1) % states
		})),
		nextStateId: states
	};
	return `m1=${base64url(deflateRawSync(Buffer.from(JSON.stringify(doc))))}`;
}

test('a machine that has states can be shared, and the dialog says who can see it', async ({
	page
}) => {
	await openSandbox(page);
	await openShare(page);
	await expect(dialog(page)).toBeVisible();
	await expect(dialog(page)).toContainText('Siapa pun yang punya tautannya bisa melihat mesin ini');
	await expect(dialog(page)).toContainText('tidak disimpan di server');
	await expect(linkField(page)).toHaveValue(/\/sandbox#m1=[A-Za-z0-9_-]+$/);
	// A small machine has a short link: the three states of the example.
	expect((await linkField(page).inputValue()).length).toBeLessThan(900);
	await expect(dialog(page).locator('.warning')).toHaveCount(0);
	await expectNoAxeViolations(page);
});

test('an empty canvas has nothing to share, so the button is not there', async ({ page }) => {
	await openSandbox(page, { example: false });
	await expect(shareButton(page)).toHaveCount(0);
});

test('Esc closes the dialog and the focus goes back to the button', async ({ page, isMobile }) => {
	test.skip(isMobile, 'a laptop only (a keyboard)');
	await openSandbox(page);
	await shareButton(page).focus();
	await page.keyboard.press('Enter');
	await expect(dialog(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog(page)).toHaveCount(0);
	await expect(shareButton(page)).toBeFocused();
});

test('the buttons and the field of the dialog are at least 44 px', async ({ page }) => {
	await openSandbox(page);
	await openShare(page);
	for (const target of [
		linkField(page),
		dialog(page).getByRole('button', { name: 'Salin tautan' }),
		dialog(page).getByRole('button', { name: 'Tutup' })
	]) {
		const box = (await target.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.width).toBeGreaterThanOrEqual(44);
	}
});

test('a link opens the machine as a new one, and the student keeps the machine that was open', async ({
	page,
	browser,
	baseURL
}) => {
	await openSandbox(page);
	const link = await linkOf(page);
	// Another person, with nothing saved: the empty machine of a first visit is the place of the machine.
	const other = await browser.newContext({ baseURL });
	try {
		const friend = await other.newPage();
		await friend.goto(link);
		await friend.locator('.editor[data-ready]').waitFor();
		await expect(friend.locator('.notice')).toContainText(
			'Mesin dari tautan dibuka sebagai mesin baru'
		);
		await expect(state(friend, 'q0')).toBeVisible();
		await expect(state(friend, 'q2')).toBeVisible();
		// The address is clean, so a reload does not open the link again.
		expect(friend.url()).not.toContain('#');
		await friend.reload();
		await friend.locator('.editor[data-ready]').waitFor();
		expect(await records(friend)).toHaveLength(1);
	} finally {
		await other.close();
	}
});

test('a link that is opened where a machine already exists adds one, and changes nothing else', async ({
	page
}) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	const [before] = await records(page);
	const link = await linkOf(page);
	await page.goto(link);
	await page.locator('.editor[data-ready]').waitFor();
	await expect(note(page)).toContainText('dibuka sebagai mesin baru');
	const all = await records(page);
	expect(all).toHaveLength(2);
	// The machine that was there is as it was.
	expect(all.find((r) => r.id === before!.id)!.doc).toBe(before!.doc);
	expect(page.url()).not.toContain('#');
});

test('a link that is cut says so, and the machine of the student is not touched', async ({
	page
}) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	const [before] = await records(page);
	const link = await linkOf(page);
	await page.goto(link.slice(0, link.length - 40));
	await page.locator('.editor[data-ready]').waitFor();
	await expect(note(page)).toContainText('Tautan ini bukan mesin WebTomata yang utuh');
	await expect(state(page, 'q0')).toBeVisible();
	const all = await records(page);
	expect(all).toHaveLength(1);
	expect(all[0]!.doc).toBe(before!.doc);
	expect(page.url()).not.toContain('#');
	await expectNoAxeViolations(page);
});

test('links of nonsense and of another kind are refused calmly', async ({ page }) => {
	for (const fragment of [
		'm1=',
		'm1=@@@@',
		'm1=abcde',
		'm1=' + 'A'.repeat(200),
		'm1u=eyJhIjoxfQ'
	]) {
		await page.goto(`/sandbox#${fragment}`);
		await page.locator('.editor[data-ready]').waitFor();
		await expect(note(page), fragment).toContainText(/bukan mesin WebTomata|tidak valid/);
	}
});

test('a small link that would expand to far too much is stopped, not opened', async ({ page }) => {
	const bomb = `m1=${base64url(deflateRawSync(Buffer.alloc(40 * 1024 * 1024)))}`;
	expect(bomb.length).toBeLessThan(200_000);
	await page.goto(`/sandbox#${bomb}`);
	await page.locator('.editor[data-ready]').waitFor();
	await expect(note(page)).toContainText('terlalu besar');
	expect(await records(page)).toHaveLength(1);
});

test('a link of a newer version is refused with the words for it', async ({ page }) => {
	const doc = { schemaVersion: 2, title: 'Nanti' };
	await page.goto(`/sandbox#m1=${base64url(deflateRawSync(Buffer.from(JSON.stringify(doc))))}`);
	await page.locator('.editor[data-ready]').waitFor();
	await expect(note(page)).toContainText('WebTomata versi yang lebih baru');
});

test('a link of a big machine warns that a chat may cut it, and still opens', async ({
	page,
	browser,
	baseURL
}) => {
	// A machine of 900 states takes a while to draw: the default 30 s is short on a busy runner.
	test.setTimeout(90_000);
	const other = await browser.newContext({ baseURL });
	try {
		const friend = await other.newPage();
		await friend.goto(`/sandbox#${bigLink(900)}`);
		await friend.locator('.editor[data-ready]').waitFor();
		await expect(friend.locator('.notice')).toContainText('dibuka sebagai mesin baru: Besar');
		await openShare(friend);
		await expect(
			friend.getByRole('dialog', { name: 'Bagikan mesin' }).locator('.warning')
		).toContainText('sebagian aplikasi chat bisa memotongnya');
	} finally {
		await other.close();
	}
	// The page of this test was not used: nothing to clean.
	void page;
});

test('the link is copied, in Chrome', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'only Chrome lets a test grant the clipboard');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openSandbox(page);
	const link = await linkOf(page);
	await dialog(page).getByRole('button', { name: 'Salin tautan' }).click();
	await expect(dialog(page).getByText('Tautan tersalin.')).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
});

test('a finger opens the dialog from the list, and closes it', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await touchTap(page, page.getByRole('button', { name: /^Mesin saya \(/ }));
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await touchTap(page, list.getByRole('button', { name: /^Tindakan untuk/ }).first());
	await touchTap(page, list.getByRole('button', { name: 'Bagikan', exact: true }));
	await expect(dialog(page)).toBeVisible();
	// A sheet from the bottom of the screen, as the list of machines.
	const box = (await dialog(page).boundingBox())!;
	const view = page.viewportSize()!;
	expect(box.y + box.height).toBeGreaterThan(view.height - 4);
	await touchTap(page, dialog(page).getByRole('button', { name: 'Tutup' }));
	await expect(dialog(page)).toHaveCount(0);
});

test('a laptop has the share button in the bar, and a phone has it in the row of the machine', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	// The bar of a phone is full (it has no room for a sixth button of 44 px), so the action is in the list.
	await expect(shareButton(page)).toHaveCount(isMobile ? 0 : 1);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		page.viewportSize()!.width
	);
});

test('the row of a machine in the list has "Bagikan", for any saved machine', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await page.getByRole('button', { name: /^Mesin saya \(1\)/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await list
		.getByRole('button', { name: /^Tindakan untuk/ })
		.first()
		.click();
	await list.getByRole('button', { name: 'Bagikan', exact: true }).click();
	await expect(dialog(page)).toBeVisible();
	await expect(linkField(page)).toHaveValue(/#m1=/);
	await expect(page.getByRole('dialog', { name: 'Mesin saya' })).toHaveCount(0);
	void isMobile;
});

// ---- S10b-2, the machine as a file ----

/** A small document of two states as a link: the title, the symbols and the transitions can be chosen. */
function smallLink(
	title: string,
	alphabet: string[],
	transitions: [number, string, number][]
): string {
	const doc = {
		schemaVersion: 1,
		title,
		kind: 'dfsm',
		alphabet,
		states: [
			{ id: 0, name: 'q0', x: 100, y: 100 },
			{ id: 1, name: 'q1', x: 300, y: 100 }
		],
		start: 0,
		accepting: [1],
		transitions: transitions.map(([from, on, to]) => ({ from, on, to })),
		nextStateId: 2
	};
	return `m1=${base64url(deflateRawSync(Buffer.from(JSON.stringify(doc))))}`;
}

/** Opens a link in a fresh page of another context (nothing saved there) and its share dialog. */
async function shareOf(
	browser: import('@playwright/test').Browser,
	baseURL: string | undefined,
	link: string
) {
	const context = await browser.newContext({ baseURL, acceptDownloads: true });
	const page = await context.newPage();
	await page.goto(`/sandbox#${link}`);
	await page.locator('.editor[data-ready]').waitFor();
	await openShare(page);
	return { page, context };
}

const readDownload = async (download: import('@playwright/test').Download) => {
	const path = await download.path();
	return (await import('node:fs')).readFileSync(path, 'utf8');
};

test('the machine is downloaded as a JSON file, named by its title, that holds the whole document', async ({
	page
}) => {
	await openSandbox(page);
	await openShare(page);
	const waiting = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'Unduh JSON' }).click();
	const download = await waiting;
	expect(download.suggestedFilename()).toBe('Berakhiran 01.webtomata.json');
	const doc = JSON.parse(await readDownload(download));
	expect(doc).toMatchObject({ schemaVersion: 1, title: 'Berakhiran 01', kind: 'dfsm' });
	expect(doc.states).toHaveLength(3);
	await expect(dialog(page).getByText('File Berakhiran 01.webtomata.json diunduh.')).toBeVisible();
});

test('the machine is downloaded as a .jff file of JFLAP, with the states and the transitions', async ({
	page
}) => {
	await openSandbox(page);
	await openShare(page);
	const waiting = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }).click();
	const download = await waiting;
	expect(download.suggestedFilename()).toBe('Berakhiran 01.jff');
	const xml = await readDownload(download);
	expect(xml).toContain('<type>fa</type>');
	expect(xml.match(/<state /g)).toHaveLength(3);
	expect(xml.match(/<transition>/g)).toHaveLength(6);
	expect(xml.match(/<initial\/>/g)).toHaveLength(1);
	expect(xml.match(/<final\/>/g)).toHaveLength(1);
});

test('the name of a file is the title with what a file name cannot have taken out', async ({
	browser,
	baseURL
}) => {
	const { page, context } = await shareOf(
		browser,
		baseURL,
		smallLink('a/b:c*? "d"', ['a'], [[0, 'a', 1]])
	);
	try {
		const waiting = page.waitForEvent('download');
		await dialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }).click();
		expect((await waiting).suggestedFilename()).toBe('a-b-c-- -d.jff');
	} finally {
		await context.close();
	}
});

test('a symbol of several characters cannot go in a .jff: the page says why, and JSON still works', async ({
	browser,
	baseURL
}) => {
	const { page, context } = await shareOf(
		browser,
		baseURL,
		smallLink('Panjang', ['num'], [[0, 'num', 1]])
	);
	try {
		await dialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }).click();
		await expect(dialog(page)).toContainText('JFLAP hanya mendukung simbol satu karakter');
		await expect(dialog(page)).toContainText('"num"');
		await expectNoAxeViolations(page);
		const waiting = page.waitForEvent('download');
		await dialog(page).getByRole('button', { name: 'Unduh JSON' }).click();
		expect((await waiting).suggestedFilename()).toBe('Panjang.webtomata.json');
		// The message of the failure goes when a file is given.
		await expect(dialog(page)).not.toContainText('JFLAP hanya mendukung');
	} finally {
		await context.close();
	}
});

test('a symbol that no transition reads is said to be lost in the .jff', async ({
	browser,
	baseURL
}) => {
	const { page, context } = await shareOf(
		browser,
		baseURL,
		smallLink('Sisa', ['a', 'b', 'c'], [[0, 'a', 1]])
	);
	try {
		await expect(dialog(page)).toContainText('simbol b, c tidak dipakai transisi mana pun');
	} finally {
		await context.close();
	}
});

test('the buttons of the files are at least 44 px, and a finger gives the file too', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openShare(page);
	for (const name of ['Unduh .jff (JFLAP)', 'Unduh JSON']) {
		const box = (await dialog(page).getByRole('button', { name }).boundingBox())!;
		expect(box.height, name).toBeGreaterThanOrEqual(44);
	}
	await expectNoAxeViolations(page);
	if (!isMobile) return;
	const waiting = page.waitForEvent('download');
	await touchTap(page, dialog(page).getByRole('button', { name: 'Unduh JSON' }));
	expect((await waiting).suggestedFilename()).toBe('Berakhiran 01.webtomata.json');
});
