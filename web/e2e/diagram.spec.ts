// The diagram of a machine, as the browser draws it: the sample on the Sandbox page. The
// geometry has its own unit tests; this checks what only a real browser can: that the text is
// there, that the fonts fit the boxes, and that nothing overlaps on the screen.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test('the Sandbox draws the sample machine', async ({ page }) => {
	await page.goto('/sandbox');
	const diagram = page.getByRole('img', { name: 'DFSM dengan 3 state' });
	await expect(diagram).toBeVisible();

	// The three states, one of them accepting (a second circle), and the start label.
	for (const name of ['q0', 'q1', 'q2']) {
		await expect(diagram.locator('text.name', { hasText: new RegExp(`^${name}$`) })).toHaveCount(1);
	}
	await expect(diagram.locator('circle.state')).toHaveCount(3);
	await expect(diagram.locator('circle.inner')).toHaveCount(1);
	await expect(diagram.locator('text.start-label')).toHaveText('mulai');

	// Six edges in the order of (from, to), each with its label.
	await expect(diagram.locator('path.line')).toHaveCount(7); // six edges and the start arrow
	await expect(diagram.locator('text.label')).toHaveText(['1', '0', '0', '1', '1', '0']);
	await expectNoAxeViolations(page);
});

test('the labels do not overlap each other or a state, as drawn by the browser', async ({
	page
}) => {
	await page.goto('/sandbox');
	await page.locator('svg.diagram text.label').first().waitFor();
	// The fonts must have loaded, or the widths are those of a fallback font.
	await page.evaluate(() => document.fonts.ready);

	const problems = await page.evaluate(() => {
		const svg = document.querySelector('svg.diagram')!;
		const labels = [...svg.querySelectorAll<SVGGraphicsElement>('text.label, text.start-label')];
		const circles = [...svg.querySelectorAll<SVGCircleElement>('circle.state')];
		const box = (el: Element) => el.getBoundingClientRect();
		const found: string[] = [];
		labels.forEach((a, i) => {
			const r = box(a);
			labels.slice(i + 1).forEach((b) => {
				const s = box(b);
				if (r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom) {
					found.push(`labels "${a.textContent}" and "${b.textContent}" overlap`);
				}
			});
			circles.forEach((c) => {
				const k = box(c);
				const cx = (k.left + k.right) / 2;
				const cy = (k.top + k.bottom) / 2;
				const nx = Math.max(r.left, Math.min(cx, r.right));
				const ny = Math.max(r.top, Math.min(cy, r.bottom));
				if (Math.hypot(cx - nx, cy - ny) < (k.right - k.left) / 2) {
					found.push(`label "${a.textContent}" covers a state`);
				}
			});
		});
		return found;
	});
	expect(problems).toEqual([]);
});

test('the diagram follows the language: the description and the start label', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('webtomata.lang', 'en'));
	await page.goto('/sandbox');
	await expect(page.getByRole('img', { name: 'DFSM with 3 state(s)' })).toBeVisible();
	await expect(page.locator('svg.diagram text.start-label')).toHaveText('start');
});

test('the diagram fits a phone screen without a sideways scroll of the page', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await page.goto('/sandbox');
	await page.locator('svg.diagram').waitFor();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
