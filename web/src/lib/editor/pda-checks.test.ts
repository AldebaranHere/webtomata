import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en.ts';
import { id } from '../i18n/id.ts';
import type { Issue } from '../engine/types.ts';
import { createPdaDocument } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import { PDA_CHECK_KEYS, pdaCheckItems } from './pda-checks.ts';

const issue = (
	severity: Issue['severity'],
	key: string,
	params: Issue['message']['params'] = {}
): Issue => ({
	severity,
	message: { key, params }
});

function apply(doc: PdaDocument, cmd: Parameters<typeof applyPdaCommand>[1]): PdaDocument {
	const res = applyPdaCommand(doc, cmd);
	if (!res.ok) throw new Error(res.error.key);
	return res.doc;
}

function samplePdaDoc(): PdaDocument {
	let doc = createPdaDocument('dpda');
	doc = apply(doc, { type: 'addState', x: 100, y: 100, name: 'q0' });
	doc = apply(doc, { type: 'addState', x: 200, y: 100, name: 'q1' });
	doc = apply(doc, { type: 'setStart', id: 0 });
	doc = apply(doc, { type: 'setAccepting', id: 1, accepting: true });
	return doc;
}

describe('pdaCheckItems', () => {
	it('maps engine issues to message keys, translates from/state to state name, and converts 0-based indices to 1-based table rows', () => {
		const doc = samplePdaDoc();
		const items = pdaCheckItems(
			[
				issue('error', 'pda.no_start_state'),
				issue('warning', 'pda.no_accepting_state'),
				issue('warning', 'pda.unreachable_state', { state: 1 }),
				issue('warning', 'pda.duplicate_transition', { from: 0 }),
				issue('warning', 'pda.pop_never_pushed', { from: 0, symbol: 'Z' }),
				issue('error', 'pda.competing_transitions', { from: 0, first: 0, second: 1 }),
				issue('error', 'pda.accepting_state_free_move', { state: 1 })
			],
			doc
		);

		expect(items).toEqual([
			{ severity: 'error', key: 'check.no_start_state', params: {}, states: [] },
			{ severity: 'warning', key: 'pda_check.no_accepting_state', params: {}, states: [] },
			{
				severity: 'warning',
				key: 'check.unreachable_state',
				params: { state: 'q1' },
				states: [1]
			},
			{
				severity: 'warning',
				key: 'pda_check.duplicate_transition',
				params: { state: 'q0' },
				states: [0]
			},
			{
				severity: 'warning',
				key: 'pda_check.pop_never_pushed',
				params: { state: 'q0', symbol: 'Z' },
				states: [0]
			},
			{
				severity: 'error',
				key: 'pda_check.competing_transitions',
				params: { state: 'q0', first: 1, second: 2 },
				states: [0]
			},
			{
				severity: 'error',
				key: 'pda_check.accepting_state_free_move',
				params: { state: 'q1' },
				states: [1]
			}
		]);
	});

	it('F4: G as DPDA produces 2 competing_transitions error items with 1-based row numbers 1, 2 and 1, 3', () => {
		const doc = samplePdaDoc();
		const items = pdaCheckItems(
			[
				issue('error', 'pda.competing_transitions', { from: 0, first: 0, second: 1 }),
				issue('error', 'pda.competing_transitions', { from: 0, first: 0, second: 2 })
			],
			doc
		);

		expect(items).toEqual([
			{
				severity: 'error',
				key: 'pda_check.competing_transitions',
				params: { state: 'q0', first: 1, second: 2 },
				states: [0]
			},
			{
				severity: 'error',
				key: 'pda_check.competing_transitions',
				params: { state: 'q0', first: 1, second: 3 },
				states: [0]
			}
		]);
	});

	it('an issue with an unknown key is mapped to check.other with its code', () => {
		const doc = samplePdaDoc();
		const items = pdaCheckItems([issue('error', 'pda.unknown_issue', { x: 1 })], doc);
		expect(items).toEqual([
			{
				severity: 'error',
				key: 'check.other',
				params: { code: 'pda.unknown_issue' },
				states: []
			}
		]);
	});

	it('an issue about a state that does not exist in doc uses string id and has empty states', () => {
		const doc = samplePdaDoc();
		const items = pdaCheckItems([issue('warning', 'pda.duplicate_transition', { from: 99 })], doc);
		expect(items).toEqual([
			{
				severity: 'warning',
				key: 'pda_check.duplicate_transition',
				params: { state: '99' },
				states: []
			}
		]);
	});

	it('every key in crates/engine-core/src/pda.rs has a text in id and en', () => {
		const source = readFileSync(
			new URL('../../../../crates/engine-core/src/pda.rs', import.meta.url),
			'utf8'
		);
		const keys = [...new Set([...source.matchAll(/"(pda\.[a-z_]+)"/g)].map((m) => m[1]!))];
		expect(keys.length).toBeGreaterThanOrEqual(7);
		for (const key of keys) {
			const textKey = PDA_CHECK_KEYS[key];
			expect(textKey, `mapping for ${key}`).toBeDefined();
			expect(Object.hasOwn(id, textKey!), `id has key ${textKey}`).toBe(true);
			expect(Object.hasOwn(en, textKey!), `en has key ${textKey}`).toBe(true);
		}
	});
});
