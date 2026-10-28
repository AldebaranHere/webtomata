// Checking an answer in every engine (Q4b). The grading runs in the engine worker and the solution is fetched
// when the student asks; the details are in e2e/soal-feedback.spec.ts (Chrome).
import { engineSettled, expect, test } from '../fixtures.ts';
import { putRow } from './db.ts';

/** Strings that end with 1, as a document file: wrong on very many strings. */
const doc = JSON.stringify({
	schemaVersion: 1,
	title: '',
	kind: 'dfsm',
	alphabet: ['0', '1'],
	states: [
		{ id: 0, name: 'q0', x: 100, y: 120 },
		{ id: 1, name: 'q1', x: 250, y: 120 },
		{ id: 2, name: 'q2', x: 400, y: 120 }
	],
	start: 0,
	accepting: [1],
	transitions: [
		{ from: 0, on: '0', to: 0 },
		{ from: 0, on: '1', to: 1 },
		{ from: 1, on: '0', to: 2 },
		{ from: 1, on: '1', to: 1 },
		{ from: 2, on: '0', to: 0 },
		{ from: 2, on: '1', to: 1 }
	],
	nextStateId: 3
});

test('checks an answer: a verdict, the wrong strings, and a string that runs in Simulasi', async ({
	page
}) => {
	await page.goto('/soal/berakhiran-10');
	await page.locator('.editor[data-ready]').waitFor();
	// The checks of the first page start the engine: a reload while it loads would cancel the request.
	await engineSettled(page);
	await putRow(page, { id: 'soal:berakhiran-10', doc });
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	const panel = page.getByRole('complementary', { name: 'Panel' });
	const feedback = panel.locator('#panel-pane-feedback');
	await feedback.getByRole('button', { name: 'Periksa jawaban' }).click();
	const result = feedback.getByRole('status');
	await expect(result).toContainText('Belum tepat.');
	await expect(result).toContainText('Diterima mesinmu, padahal seharusnya ditolak');
	await result.getByRole('button', { name: 'Coba di Simulasi' }).click();
	await expect(panel.getByRole('tab', { name: 'Simulasi' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	// The run of the string is still under way: the test must not end while the engine is loading.
	await engineSettled(page);
});
