// S5-2 in every engine: the editable transition table. It is also the accessible way to build a
// machine, so the keyboard has its own tests. Every edit goes through the one history.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });
const grid = (page: Page) => panel(page).getByRole('grid', { name: 'Tabel transisi' });
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const nodes = (page: Page) => page.locator('svg.world g.node');
const edge = (page: Page, key: string) => page.locator(`svg.world g.edge[data-edge="${key}"]`);
const pick = (page: Page, from: string, symbol: string) =>
	grid(page).getByRole('combobox', {
		name: new RegExp(`^Transisi dari ${from} dengan ${symbol}( |,|$)`)
	});
const undo = (page: Page) =>
	page.getByRole('button', { name: 'Urungkan' }).locator('visible=true').first();

async function openTable(page: Page) {
	await openSandbox(page);
	await tab(page, 'Tabel').click();
	await expect(grid(page)).toBeVisible();
}

test('the table has a row for each state and a column for each symbol', async ({ page }) => {
	await openTable(page);
	await expect(grid(page).getByRole('columnheader')).toHaveText([
		'State',
		'Start',
		'Terima',
		/^0/,
		/^1/
	]);
	await expect(grid(page).getByRole('rowheader')).toHaveText(['q0', 'q1', 'q2']);
	await expect(pick(page, 'q0', '0')).toHaveValue('1');
	await expect(pick(page, 'q1', '1')).toHaveValue('2');
	await expect(grid(page).getByRole('checkbox', { name: 'q0: start state' })).toBeChecked();
	await expect(grid(page).getByRole('checkbox', { name: 'q2: accepting state' })).toBeChecked();
	await expect(grid(page).getByRole('checkbox', { name: 'q1: accepting state' })).not.toBeChecked();
	await expectNoAxeViolations(page);
});

test('a cell changes the machine: the diagram and the definition follow, and undo brings it back', async ({
	page
}) => {
	await openTable(page);
	await expect(edge(page, '0>1')).toHaveCount(1);
	await pick(page, 'q0', '0').selectOption({ label: 'q2' });
	await expect(edge(page, '0>1')).toHaveCount(0);
	await expect(edge(page, '0>2')).toHaveCount(1);
	await tab(page, 'Definisi').click();
	await expect(panel(page).getByText('δ(q0, 0) = q2')).toBeVisible();
	await tab(page, 'Tabel').click();
	await undo(page).click();
	await expect(edge(page, '0>1')).toHaveCount(1);
	await expect(pick(page, 'q0', '0')).toHaveValue('1');
});

test('an empty cell of a DFSM says so calmly, and a full one has no mark', async ({ page }) => {
	await openTable(page);
	await expect(grid(page).locator('td.missing')).toHaveCount(0);
	await pick(page, 'q2', '1').selectOption({ value: '' });
	await expect(grid(page).locator('td.missing')).toHaveCount(1);
	await expect(pick(page, 'q2', '1')).toContainText('belum ada');
	await expect(pick(page, 'q2', '1')).toHaveAccessibleName(/belum ada/);
	await expect(edge(page, '2>0')).toHaveCount(0);
});

test('Start and Terima are toggles, and the definition follows', async ({ page }) => {
	await openTable(page);
	await grid(page).getByRole('checkbox', { name: 'q1: start state' }).click();
	await expect(grid(page).getByRole('checkbox', { name: 'q1: start state' })).toBeChecked();
	await expect(grid(page).getByRole('checkbox', { name: 'q0: start state' })).not.toBeChecked();
	await grid(page).getByRole('checkbox', { name: 'q0: accepting state' }).click();
	await tab(page, 'Definisi').click();
	await expect(panel(page).getByText('= q1', { exact: true })).toBeVisible();
	await expect(panel(page).getByText('= {q0, q2}')).toBeVisible();
	// Start can be taken away by pressing it again.
	await tab(page, 'Tabel').click();
	await grid(page).getByRole('checkbox', { name: 'q1: start state' }).click();
	await expect(grid(page).getByRole('checkbox', { name: 'q1: start state' })).not.toBeChecked();
});

test('a state is renamed in the table; a name that is taken is refused and stays in the field', async ({
	page
}) => {
	await openTable(page);
	await grid(page).getByRole('button', { name: 'q1', exact: true }).click();
	const field = grid(page).getByRole('textbox', { name: 'Nama state' });
	await field.fill('q0');
	await field.press('Enter');
	await expect(panel(page).getByText('Nama q0 sudah dipakai state lain.')).toBeVisible();
	await expect(field).toBeVisible();
	await field.fill('Genap');
	await field.press('Enter');
	await expect(grid(page).getByRole('rowheader')).toHaveText(['q0', 'Genap', 'q2']);
	await expect(page.getByRole('button', { name: /^State Genap(,|$)/ })).toBeVisible();
});

test('+ State adds a state to the table and to the diagram, and undo takes it away', async ({
	page
}) => {
	await openTable(page);
	await expect(nodes(page)).toHaveCount(3);
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await expect(grid(page).getByRole('rowheader')).toHaveText(['q0', 'q1', 'q2', 'q3']);
	await expect(nodes(page)).toHaveCount(4);
	await expect(pick(page, 'q3', '0')).toContainText('belum ada');
	await undo(page).click();
	await expect(nodes(page)).toHaveCount(3);
});

test('a state added on the diagram is a row of the table at once', async ({ page }) => {
	await openTable(page);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('n');
		expect(await nodes(page).count()).toBe(4);
	}).toPass();
	await expect(grid(page).getByRole('rowheader')).toHaveText(['q0', 'q1', 'q2', 'q3']);
});

test('a symbol is added, a bad one is refused, and removing one takes its transitions with a toast to undo', async ({
	page
}) => {
	await openTable(page);
	const symbol = panel(page).getByRole('textbox', { name: 'Simbol baru' });
	await symbol.fill('ε');
	await symbol.press('Enter');
	await expect(grid(page).getByRole('columnheader')).toHaveCount(5);
	await symbol.fill('c');
	await symbol.press('Enter');
	await expect(grid(page).getByRole('columnheader')).toHaveCount(6);
	await expect(pick(page, 'q0', 'c')).toContainText('belum ada');
	await expect(symbol).toHaveValue('');

	await grid(page).getByRole('button', { name: 'Hapus simbol 0' }).click();
	await expect(grid(page).getByRole('columnheader')).toHaveCount(5);
	await expect(edge(page, '0>1')).toHaveCount(0);
	const toast = page.getByRole('group', { name: 'Pesan' });
	await expect(toast).toContainText('Simbol 0 dihapus, beserta 3 transisi.');
	await toast.getByRole('button', { name: 'Urungkan' }).click();
	await expect(grid(page).getByRole('columnheader')).toHaveCount(6);
	await expect(edge(page, '0>1')).toHaveCount(1);
	await expect(pick(page, 'q0', '0')).toHaveValue('1');
});

test('the keyboard: arrows move between cells, Enter picks, Escape comes back, Delete empties', async ({
	page
}) => {
	await openTable(page);
	// The first Tab into the table lands on one cell only.
	await grid(page).getByRole('rowheader', { name: 'q0' }).focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	// Row q0, the column of 0.
	const cell = grid(page).locator('td[data-row="1"][data-col="3"]');
	await expect(cell).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(pick(page, 'q0', '0')).toBeFocused();
	// Escape closes the picker if the browser opened one, and then gives the focus back to the cell.
	await expect(async () => {
		await page.keyboard.press('Escape');
		await expect(cell).toBeFocused({ timeout: 500 });
	}).toPass();
	await expect(pick(page, 'q0', '0')).toHaveValue('1');
	// Delete empties the cell.
	await page.keyboard.press('Delete');
	await expect(cell).toHaveClass(/missing/);
	await expect(edge(page, '0>1')).toHaveCount(0);
	// Going down is the next state, which is selected on the diagram.
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('button', { name: /^State q1(,|$)/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.keyboard.press('Home');
	await expect(grid(page).locator('th[data-row="2"][data-col="0"]')).toBeFocused();
	await page.keyboard.press('Control+End');
	await expect(grid(page).locator('td[data-row="3"][data-col="4"]')).toBeFocused();
	await page.keyboard.press('Control+Home');
	await expect(grid(page).locator('th[data-row="0"][data-col="0"]')).toBeFocused();
});

test('the keyboard: Delete on a symbol header removes the symbol, with its toast', async ({
	page
}) => {
	await openTable(page);
	await grid(page).locator('th[data-row="0"][data-col="4"]').focus();
	await page.keyboard.press('Delete');
	await expect(grid(page).getByRole('columnheader')).toHaveCount(4);
	await expect(page.getByRole('group', { name: 'Pesan' })).toContainText('Simbol 1 dihapus');
});

test('only one cell of the table is a Tab stop', async ({ page }) => {
	await openTable(page);
	const stops = await grid(page).evaluate(
		(g) => [...g.querySelectorAll<HTMLElement>('[tabindex]')].filter((e) => e.tabIndex === 0).length
	);
	// The cell, and the controls inside that same cell.
	expect(stops).toBeLessThanOrEqual(2);
});

test('an NDFSM has an ε column and cells of several states, with a chip for each', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await page
		.getByRole('region', { name: 'Coba contoh' })
		.getByRole('button', { name: /^Pilihan dengan transisi ε/ })
		.click();
	await tab(page, 'Tabel').click();
	await expect(grid(page).getByRole('columnheader')).toHaveText([
		'State',
		'Start',
		'Terima',
		/^a/,
		/^b/,
		'ε'
	]);
	const row = grid(page)
		.getByRole('row')
		.filter({ has: page.getByRole('rowheader', { name: 'q0' }) });
	await expect(row.locator('.chip')).toHaveText(['q1', 'q2']);
	// A chip goes away with its button, and comes back with undo.
	await row.getByRole('button', { name: /^Hapus q1 dari sel q0/ }).click();
	await expect(row.locator('.chip')).toHaveText(['q2']);
	await undo(page).click();
	await expect(row.locator('.chip')).toHaveText(['q1', 'q2']);
	// A state is added to a cell with the picker "Tambah…".
	const q1b = grid(page)
		.getByRole('row')
		.filter({ has: page.getByRole('rowheader', { name: 'q1' }) })
		.getByRole('combobox', { name: /dengan b: Tambah/ });
	await q1b.selectOption({ label: 'q2' });
	await expect(
		grid(page)
			.getByRole('row')
			.filter({ has: page.getByRole('rowheader', { name: 'q1' }) })
			.locator('.chip')
	).toContainText(['q1', 'q2']);
});

test('switching a DFSM to NDFSM gives it an ε column, and undo takes it away', async ({ page }) => {
	await openTable(page);
	await expect(grid(page).getByRole('columnheader')).toHaveCount(5);
	await panel(page).getByRole('radio', { name: 'NDFSM', exact: true }).click();
	await expect(grid(page).getByRole('columnheader')).toHaveCount(6);
	await expect(grid(page).getByRole('columnheader').last()).toHaveText('ε');
	await undo(page).click();
	await expect(grid(page).getByRole('columnheader')).toHaveCount(5);
});

test('a state that is selected on the diagram is the row that is marked', async ({ page }) => {
	await openTable(page);
	await page.getByRole('button', { name: /^State q1(,|$)/ }).click();
	await expect(
		grid(page)
			.getByRole('row')
			.filter({ has: page.getByRole('rowheader', { name: 'q1' }) })
	).toHaveAttribute('aria-selected', 'true');
});

test('a machine without states says so, and + State starts it', async ({ page }) => {
	await openSandbox(page, { example: false });
	await page
		.getByRole('region', { name: 'Coba contoh' })
		.getByRole('button', { name: 'Mulai dari kanvas kosong' })
		.click();
	await tab(page, 'Tabel').click();
	await expect(panel(page).getByText('Belum ada state.')).toBeVisible();
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await expect(grid(page).getByRole('rowheader')).toHaveText(['q0']);
	await expect(nodes(page)).toHaveCount(1);
});
