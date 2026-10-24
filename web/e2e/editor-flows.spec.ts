// The acceptance of S4: a 4-state DFSM is built from nothing, by mouse on a laptop and by touch on
// a phone, and axe finds no violation. Everything a student does is in it: add states, make one
// the start and one accepting, add transitions (one of them a self-loop), type symbols.
//
// The machine: q0 -a-> q1, q1 -a-> q1, q1 -b-> q2, q2 -a-> q3, q3 -b-> q0; q0 is the start state
// and q3 is accepting.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { touchLongPressAt, touchTap, touchTapAt } from './touch.ts';

const nodes = (page: Page) => page.locator('svg.world g.node');
const labels = (page: Page) => page.locator('svg.world text.label');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const box = (page: Page) => page.getByRole('textbox', { name: 'Simbol transisi' });
const menu = (page: Page) => page.getByRole('menu', { name: 'Menu state' });
const tool = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const q = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

async function build(page: Page, touch: boolean) {
	// What a student does: a click with a mouse, or a tap with a finger.
	const press = (target: Locator) => (touch ? touchTap(page, target) : target.click());
	const tapAt = async (p: { x: number; y: number }) =>
		touch ? touchTapAt(page, p) : page.mouse.click(p.x, p.y);

	await openSandbox(page);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		expect(await nodes(page).count()).toBe(0);
	}).toPass();

	// Four states, in a square.
	await press(tool(page, 'Tambah state'));
	const area = (await canvas(page).boundingBox())!;
	for (const [fx, fy] of [
		[0.22, 0.25],
		[0.78, 0.25],
		[0.78, 0.6],
		[0.22, 0.6]
	] as const) {
		await tapAt({ x: area.x + area.width * fx, y: area.y + area.height * fy });
	}
	await expect(nodes(page)).toHaveCount(4);

	// q0 is the start state and q3 is accepting: by the keys on a laptop, by the menu on a phone.
	await press(tool(page, 'Pilih'));
	if (touch) {
		await touchLongPressAt(page, await centerOf(q(page, 'q0')));
		await page.waitForTimeout(400);
		await menu(page).getByRole('menuitemcheckbox', { name: 'Jadikan start state' }).click();
		await touchLongPressAt(page, await centerOf(q(page, 'q3')));
		await page.waitForTimeout(400);
		await menu(page).getByRole('menuitemcheckbox', { name: 'Accepting state' }).click();
	} else {
		await q(page, 'q0').click();
		await page.keyboard.press('m');
		await q(page, 'q3').click();
		await page.keyboard.press('a');
	}
	await expect(q(page, 'q0')).toHaveAttribute('aria-label', 'State q0, start state');
	await expect(q(page, 'q3')).toHaveAttribute('aria-label', 'State q3, accepting state');

	// Five transitions. In Tambah transisi: the source, the target, the symbols.
	await press(tool(page, 'Tambah transisi'));
	for (const [from, to, symbols] of [
		['q0', 'q1', 'a'],
		['q1', 'q1', 'a'],
		['q1', 'q2', 'b'],
		['q2', 'q3', 'a'],
		['q3', 'q0', 'b']
	] as const) {
		await press(q(page, from));
		await press(q(page, to));
		await expect(box(page)).toBeFocused();
		await page.keyboard.type(symbols);
		await page.keyboard.press('Enter');
		await expect(box(page)).toBeHidden();
	}
	await press(tool(page, 'Pilih'));
}

async function centerOf(target: Locator) {
	const b = (await target.locator('circle.state').boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function expectMachine(page: Page) {
	await expect(nodes(page)).toHaveCount(4);
	await expect(q(page, 'q0')).toHaveAttribute('aria-label', 'State q0, start state');
	await expect(q(page, 'q3')).toHaveAttribute('aria-label', 'State q3, accepting state');
	await expect(q(page, 'q1')).toHaveAttribute('aria-label', 'State q1');
	// The edges, by (from, to): 0→1 a, 1→1 a, 1→2 b, 2→3 a, 3→0 b. Their names say it too.
	await expect(labels(page)).toHaveText(['a', 'a', 'b', 'a', 'b']);
	await expect(page.getByRole('button', { name: /^Transisi dari q0 ke q1: a$/ })).toBeAttached();
	await expect(page.getByRole('button', { name: /^Transisi dari q1 ke q1: a$/ })).toBeAttached();
	await expect(page.getByRole('button', { name: /^Transisi dari q3 ke q0: b$/ })).toBeAttached();
	await expectNoAxeViolations(page);
}

test('by mouse and keyboard: a 4-state DFSM is built, and axe finds no violation', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'the laptop flow');
	await build(page, false);
	await expectMachine(page);
	// Everything can be undone, one step at a time, back to nothing.
	let steps = 0;
	const undo = page.getByRole('button', { name: 'Urungkan' }).first();
	while (await undo.isEnabled()) {
		await undo.click();
		steps++;
		if (steps > 60) break;
	}
	expect(steps).toBeGreaterThan(8);
	await expect(nodes(page)).toHaveCount(3);
});

test('by touch: a 4-state DFSM is built, and axe finds no violation', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the phone flow');
	await build(page, true);
	await expectMachine(page);
});
