// Task T-075: PDA files. A `.jff` of type pda or a PDA JSON opens as a new PDA record in the PDA mode
// (F4), a hostile file writes nothing and says why in the list (F5), the PDA editor gives the open PDA
// back as `.jff` or JSON (F3), and all of it works on a phone (F8).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	blobTypes,
	engineSettled,
	expect,
	expectNoAxeViolations,
	openSandbox,
	test,
	watchBlobs
} from './fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow, records } from './cross/db.ts';
import { anbnSample, wcwrSample } from '../src/lib/editor/pda-samples.ts';
import { pdaDocumentFrom } from '../src/lib/editor/pda-samples.ts';
import { serializePdaDocument } from '../src/lib/editor/pda-document.ts';
import { FILE_BYTE_LIMIT } from '../src/lib/share/open-file.ts';

/** The `aⁿbⁿ` PDA as a `.jff`, written here: no fixture file for it (T-076 F3). */
const anbnJff = `<structure>
	<type>pda</type>
	<automaton>
		<state id="0" name="q0"><x>180.0</x><y>200.0</y><initial/></state>
		<state id="1" name="q1"><x>440.0</x><y>200.0</y><final/></state>
		<transition><from>0</from><to>0</to><read>a</read><pop/><push>A</push></transition>
		<transition><from>0</from><to>1</to><read>b</read><pop>A</pop><push/></transition>
		<transition><from>1</from><to>1</to><read>b</read><pop>A</pop><push/></transition>
	</automaton>
</structure>`;

const fixture = (name: string) =>
	readFileSync(fileURLToPath(new URL(`../src/lib/share/fixtures/${name}`, import.meta.url)));
const list = (page: Page) => page.getByRole('dialog', { name: 'Mesin saya' });
const note = (page: Page) => page.locator('.notice');
const card = (page: Page) => page.getByRole('region', { name: 'Coba contoh' });
const filesDialog = (page: Page) => page.getByRole('dialog', { name: 'Unduh PDA ini' });
const downloadButton = (page: Page) =>
	page.getByRole('button', { name: 'Unduh mesin ini sebagai file' });
const openButton = (page: Page) => page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ });
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

/** Opens a PDA with a machine in it, from the first-run card. */
async function openPdaExample(page: Page): Promise<void> {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	if ((await card(page).count()) > 0) {
		await card(page).getByRole('button', { name: /^wcwᴿ/ }).click();
		await expect(card(page)).toHaveCount(0);
	}
	await expect(state(page, 'q0')).toBeVisible();
}

/** Opens the list and gives it a file (the field is hidden: the button opens the chooser of the system). */
async function chooseFile(
	page: Page,
	file: { name: string; buffer: Buffer; mimeType?: string }
): Promise<void> {
	if (!(await list(page).isVisible())) {
		await openButton(page).click();
	}
	await expect(list(page)).toBeVisible();
	await list(page)
		.locator('input[type="file"]')
		.setInputFiles({ mimeType: 'application/octet-stream', ...file });
}

const ids = async (page: Page) => (await records(page)).map((row) => row.id).sort();

test('F4: a PDA file opens in the PDA mode as one new record, and an FSM file opens in the FSM mode', async ({
	page
}) => {
	await openSandbox(page);
	const before = await ids(page);
	expect(before).toHaveLength(1);

	// A PDA .jff chosen in the FSM mode: a new PDA record, the mode switches, the list closes.
	await chooseFile(page, { name: 'pda.jff', buffer: fixture('pda.jff') });
	await expect(list(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(state(page, 'q0')).toBeVisible();
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: pda.');
	const afterJff = await records(page);
	expect(afterJff).toHaveLength(2);
	const pdas = afterJff.filter((row) => row.type === 'pda');
	expect(pdas).toHaveLength(1);
	expect(pdas[0]!.kind).toBe('ndpda');
	// The FSM machine is untouched: the record is still there, with its own document.
	expect(afterJff.some((row) => row.type !== 'pda' && row.id === before[0])).toBe(true);

	// A PDA JSON chosen in the PDA mode: a second PDA record, the earlier one still in the list.
	const json = serializePdaDocument(wcwrSample('PDA dari file'));
	await chooseFile(page, { name: 'pda-dari-file.webtomata.json', buffer: Buffer.from(json) });
	await expect(list(page)).toBeHidden();
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: PDA dari file.');
	const afterJson = await records(page);
	expect(afterJson).toHaveLength(3);
	expect(afterJson.filter((row) => row.type === 'pda')).toHaveLength(2);

	// An FSM .jff chosen in the PDA mode: it opens, the page switches to the FSM mode, the PDAs stay.
	await chooseFile(page, { name: 'even-a.jff', buffer: fixture('even-a.jff') });
	await expect(list(page)).toBeHidden();
	await expect(page).not.toHaveURL(/mode=pda/);
	await expect(state(page, 'genap')).toBeVisible();
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: even-a.');
	const afterFsm = await records(page);
	expect(afterFsm).toHaveLength(4);
	expect(afterFsm.filter((row) => row.type === 'pda')).toHaveLength(2);
});

test('F5: a hostile PDA file writes nothing, keeps the list open and says why; a later success clears it', async ({
	page
}) => {
	await openSandbox(page);
	const before = await ids(page);

	const brokenPda = '<structure><type>pda</type><automaton';
	const twoCharRead = `<structure><type>pda</type><automaton>
		<state id="0" name="q0"><initial/></state>
		<transition><from>0</from><to>0</to><read>ab</read><pop/><push/></transition>
	</automaton></structure>`;
	const goodJson = JSON.parse(serializePdaDocument(wcwrSample()));
	const badState = JSON.stringify({ ...goodJson, states: [42] });
	const tooManyStates = JSON.stringify({
		...goodJson,
		states: Array.from({ length: 2001 }, () => ({ id: 0, name: 'q', x: 0, y: 0 }))
	});

	const cases: { file: { name: string; buffer: Buffer }; alert: string }[] = [
		{
			file: { name: 'besar.json', buffer: Buffer.alloc(FILE_BYTE_LIMIT + 1, 32) },
			alert: 'lebih besar dari 1 MB'
		},
		{ file: { name: 'catatan.txt', buffer: Buffer.from('halo') }, alert: 'bukan keduanya' },
		{ file: { name: 'rusak.jff', buffer: Buffer.from(brokenPda) }, alert: 'File .jff ini rusak' },
		{ file: { name: 'dua.jff', buffer: Buffer.from(twoCharRead) }, alert: 'membaca label "ab"' },
		{ file: { name: 'pda.json', buffer: Buffer.from(badState) }, alert: 'bagian: states[0]' },
		{
			file: { name: 'besar-pda.json', buffer: Buffer.from(tooManyStates) },
			alert: 'Batas tercapai: states, paling banyak 2000.'
		}
	];

	for (const { file, alert } of cases) {
		await chooseFile(page, file);
		await expect(list(page)).toBeVisible();
		await expect(list(page).getByRole('alert')).toContainText(alert);
		expect(await ids(page)).toEqual(before);
	}

	// A success: the list closes and the older failure is gone when it is opened again.
	await chooseFile(page, { name: 'pda.jff', buffer: fixture('pda.jff') });
	await expect(list(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await openButton(page).click();
	await expect(list(page)).toBeVisible();
	await expect(list(page).getByRole('alert')).toHaveCount(0);
});

test('F3: a PDA with a Z0 stack symbol refuses the .jff calmly and still gives the JSON', async ({
	page
}) => {
	await openPdaExample(page);
	const doc = pdaDocumentFrom({
		title: 'PDA Z0',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['Z0'],
		states: [[180, 200, 'q0']],
		start: 0,
		accepting: [0],
		transitions: [[0, 'a', [], ['Z0'], 0]]
	});
	const now = Date.now();
	await putRow(page, {
		id: 'pda-z0-test',
		recordVersion: 1,
		type: 'pda',
		title: 'PDA Z0',
		kind: 'dpda',
		createdAt: now,
		updatedAt: now,
		openedAt: now + 1000,
		doc: serializePdaDocument(doc)
	});
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(state(page, 'q0')).toBeVisible();

	await downloadButton(page).click();
	await expect(filesDialog(page)).toBeVisible();
	const nothing = page.waitForEvent('download', { timeout: 800 }).catch(() => null);
	await filesDialog(page).getByRole('button', { name: 'Unduh .jff (JFLAP)' }).click();
	await expect(
		filesDialog(page).getByText(/JFLAP hanya mendukung simbol satu karakter/)
	).toBeVisible();
	await expect(filesDialog(page).getByText(/Z0/)).toBeVisible();
	expect(await nothing).toBeNull();
	await expectNoAxeViolations(page);

	const download = page.waitForEvent('download');
	await filesDialog(page).getByRole('button', { name: 'Unduh JSON' }).click();
	expect((await download).suggestedFilename()).toBe('PDA Z0.webtomata.json');
});

test('F8: on a phone the button and the dialog are large enough, the dialog is a sheet, and a file opens', async ({
	page,
	isMobile
}) => {
	await openPdaExample(page);
	const button = downloadButton(page);
	const buttonBox = await button.boundingBox();
	expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
	expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
	await button.click();
	await expect(filesDialog(page)).toBeVisible();
	for (const name of ['Unduh .jff (JFLAP)', 'Unduh JSON']) {
		const box = await filesDialog(page).getByRole('button', { name }).boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	}
	const closeBox = await filesDialog(page).getByRole('button', { name: 'Tutup' }).boundingBox();
	expect(closeBox!.height).toBeGreaterThanOrEqual(44);
	if (isMobile) {
		const box = await filesDialog(page).boundingBox();
		const viewport = page.viewportSize()!;
		// A sheet from the bottom of the screen, not a box in the middle.
		expect(Math.abs(box!.y + box!.height - viewport.height)).toBeLessThanOrEqual(1);
	}
	const sideways = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth
	);
	expect(sideways).toBe(false);
	await expectNoAxeViolations(page);
	await filesDialog(page).getByRole('button', { name: 'Tutup' }).click();
	await expect(filesDialog(page)).toHaveCount(0);

	// A file chosen in "Mesin saya" opens as in F4, on a phone too.
	await chooseFile(page, { name: 'pda.jff', buffer: fixture('pda.jff') });
	await expect(list(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(state(page, 'q0')).toBeVisible();
	await engineSettled(page);
});

test('F3: a file named .jff.xml or .txt opens by its content, in the FSM mode and in the PDA mode', async ({
	page
}) => {
	await openSandbox(page);
	expect(await ids(page)).toHaveLength(1);

	// The FSM mode: the aⁿbⁿ .jff that a phone saved as .jff.xml is a PDA, so the page switches to the PDA mode.
	await chooseFile(page, { name: 'anbn.jff.xml', buffer: Buffer.from(anbnJff) });
	await expect(list(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(state(page, 'q0')).toBeVisible();
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: anbn.');
	expect((await records(page)).filter((row) => row.type === 'pda')).toHaveLength(1);

	// The PDA mode: the same file again is a second PDA, and the mode stays.
	await chooseFile(page, { name: 'anbn.jff.xml', buffer: Buffer.from(anbnJff) });
	await expect(list(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: anbn.');
	expect((await records(page)).filter((row) => row.type === 'pda')).toHaveLength(2);

	// A PDA JSON named .txt opens as a PDA too, with the title of the document.
	const json = serializePdaDocument(anbnSample());
	await chooseFile(page, { name: 'anbn.txt', buffer: Buffer.from(json) });
	await expect(list(page)).toBeHidden();
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: aⁿbⁿ (n ≥ 1).');
	expect((await records(page)).filter((row) => row.type === 'pda')).toHaveLength(3);
	await expectNoAxeViolations(page);
});

test('F5: the .jff and the JSON of the PDA dialog are the octet-stream type', async ({ page }) => {
	await watchBlobs(page);
	await openPdaExample(page);
	await downloadButton(page).click();
	await expect(filesDialog(page)).toBeVisible();
	for (const name of ['Unduh .jff (JFLAP)', 'Unduh JSON']) {
		const waiting = page.waitForEvent('download');
		await filesDialog(page).getByRole('button', { name }).click();
		await waiting;
	}
	// The essence is octet-stream; `download()` adds the charset to a text blob.
	expect(await blobTypes(page)).toEqual([
		'application/octet-stream;charset=utf-8',
		'application/octet-stream;charset=utf-8'
	]);
});
