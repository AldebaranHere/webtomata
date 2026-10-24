// The scan itself must be able to fail. Without this test, a scan that checks nothing would look
// the same as a page that is accessible.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const page = (body: string) =>
	`<!doctype html><html lang="id"><head><title>Uji</title></head><body><main>${body}</main></body></html>`;

test('the axe helper reports an image without alt text', async ({ page: p }) => {
	await p.setContent(page(`<h1>Halo</h1><img src="${PIXEL}">`));
	await expect(expectNoAxeViolations(p)).rejects.toThrow(/image-alt/);
});

test('the axe helper reports text that is too faint', async ({ page: p }) => {
	await p.setContent(page('<h1 style="color:#ccc;background:#fff">Halo</h1>'));
	await expect(expectNoAxeViolations(p)).rejects.toThrow(/color-contrast/);
});

test('the axe helper passes a page that is fine', async ({ page: p }) => {
	await p.setContent(page(`<h1>Halo</h1><img src="${PIXEL}" alt="Satu piksel">`));
	await expectNoAxeViolations(p);
});
