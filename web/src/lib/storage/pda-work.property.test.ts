import { describe, expect, it } from 'vitest';
import { LIMITS } from '../editor/document.ts';
import { applyPdaCommand } from '../editor/pda-commands.ts';
import {
	createPdaDocument,
	pdaDocumentsEqual,
	serializePdaDocument
} from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import { anbnSample, wcwrSample, wwrSample } from '../editor/pda-samples.ts';
import { checkPdaDocument, random, randomPdaCommand } from '../editor/testing.ts';
import { createAutosave } from './autosave.ts';
import { createMemoryStore } from './memory.ts';
import { createPdaMachine, openLatestPda, pdaDocumentCodec, readStoredPda } from './pda-work.ts';

const ADVERSARIAL_TITLES = [
	'',
	'eps',
	'"quoted title"',
	'back\\slash title',
	'Palindrom 😀',
	'e\u0301 (combining)',
	'T'.repeat(LIMITS.titleChars),
	'a,b and c',
	'Simple Title'
];

const ADVERSARIAL_NAMES = [
	'q0',
	'eps',
	'q_1',
	'😀',
	'e\u0301',
	'q'.repeat(LIMITS.nameChars),
	'state'
];

const ADVERSARIAL_SYMBOLS = ['a', 'b', '0', '1', 'Z0', '😀', 'e\u0301', 'alpha'];

const LONE_SURROGATES = ['\uD800', '\uD801', '\uD8FF', '\uDC00', '\uDC01', '\uDFFF'];
const CONTROL_CHARS = ['\u0000', '\u0001', '\u0008', '\u001F', '\u007F'];

function makeValidAdversarialDoc(seed: number): PdaDocument {
	const rng = random(seed);
	const bases = [
		anbnSample(),
		wcwrSample(),
		wwrSample(),
		createPdaDocument('dpda'),
		createPdaDocument('ndpda')
	];
	let doc = bases[seed % bases.length]!;

	// Set title from adversarial pool
	const title = ADVERSARIAL_TITLES[rng.int(ADVERSARIAL_TITLES.length)]!;
	const titleRes = applyPdaCommand(doc, { type: 'setTitle', title });
	if (titleRes.ok) doc = titleRes.doc;

	// Add an adversarial state or transition if possible
	const name = ADVERSARIAL_NAMES[rng.int(ADVERSARIAL_NAMES.length)]!;
	const addStateRes = applyPdaCommand(doc, {
		type: 'addState',
		name,
		x: rng.int(500),
		y: rng.int(500)
	});
	if (addStateRes.ok && checkPdaDocument(addStateRes.doc).length === 0) {
		doc = addStateRes.doc;
	}

	const sym = ADVERSARIAL_SYMBOLS[rng.int(ADVERSARIAL_SYMBOLS.length)]!;
	if (doc.states.length > 0) {
		const q = doc.states[0]!.id;
		const addTrRes = applyPdaCommand(doc, {
			type: 'addTransition',
			from: q,
			to: q,
			read: sym,
			pop: ['Z'],
			push: ['Z']
		});
		if (addTrRes.ok && checkPdaDocument(addTrRes.doc).length === 0) {
			doc = addTrRes.doc;
		}
	}

	// Apply a few random commands while keeping document valid
	for (let i = 0; i < 8; i++) {
		const cmd = randomPdaCommand(rng, doc);
		const res = applyPdaCommand(doc, cmd);
		if (res.ok && checkPdaDocument(res.doc).length === 0) {
			doc = res.doc;
		}
	}
	return doc;
}

function makeRandomAdversarialString(seed: number): string {
	const rng = random(seed);
	const roll = rng.next();

	if (roll < 0.2) {
		// Lone surrogate or control string
		const parts = [
			rng.pick(LONE_SURROGATES),
			rng.pick(CONTROL_CHARS),
			'{"schemaVersion":1',
			rng.pick(ADVERSARIAL_TITLES),
			'}'
		];
		return parts.join(rng.chance(0.5) ? '' : ' ');
	}
	if (roll < 0.4) {
		// Corrupted JSON variations
		const corruptions = [
			'{"schemaVersion":1.5}',
			'{"schemaVersion":0}',
			'{"schemaVersion":999}',
			'{"schemaVersion":-1}',
			'{"title":"unclosed',
			'{"states":[',
			'null',
			'undefined',
			'[]',
			'true',
			'12345'
		];
		return rng.pick(corruptions);
	}
	if (roll < 0.6) {
		// Truncated or mangled valid document
		const valid = serializePdaDocument(anbnSample());
		const cutPoint = rng.int(valid.length);
		return valid.slice(0, cutPoint);
	}
	// Random ASCII / Unicode string
	const len = rng.int(200);
	let str = '';
	for (let i = 0; i < len; i++) {
		str += String.fromCharCode(rng.int(65536));
	}
	return str;
}

const COUNT = process.env.TEST_CASES ? Number(process.env.TEST_CASES) : 1000;

describe('F7 — Property tests (round-trip, store integration, never throws)', () => {
	it(`(a) ${COUNT} random valid PdaDocuments round-trip through readStoredPda`, () => {
		for (let seed = 1; seed <= COUNT; seed++) {
			const doc = makeValidAdversarialDoc(seed);
			const serialized = serializePdaDocument(doc);
			const read = readStoredPda(serialized);
			expect(read.ok, `seed ${seed}`).toBe(true);
			if (read.ok) {
				expect(pdaDocumentsEqual(doc, read.doc), `seed ${seed}`).toBe(true);
			}
		}
	});

	it(`(b) ${COUNT} random valid PdaDocuments through memory store + autosave + openLatestPda`, async () => {
		for (let seed = 1; seed <= COUNT; seed++) {
			const doc = makeValidAdversarialDoc(seed);
			const store = createMemoryStore();
			const record = await createPdaMachine(store, doc, () => seed * 10);
			const save = createAutosave({
				store,
				base: record,
				codec: pdaDocumentCodec,
				delayMs: 10,
				now: () => seed * 10 + 5
			});
			save.schedule(doc);
			await save.flush();

			const opened = await openLatestPda(store, () => seed * 10 + 10);
			expect(pdaDocumentsEqual(doc, opened.doc), `seed ${seed}`).toBe(true);
			expect(opened.record.id, `seed ${seed}`).toBe(record.id);
		}
	});

	it(`(c) readStoredPda never throws on ${COUNT} random adversarial texts including 2 MB string`, () => {
		for (let seed = 1; seed <= COUNT; seed++) {
			const text = makeRandomAdversarialString(seed);
			expect(() => readStoredPda(text)).not.toThrow();
			const result = readStoredPda(text);
			expect(typeof result.ok).toBe('boolean');
		}

		// Explicit 2 MB string check
		const twoMbString = '{"data":"' + 'a'.repeat(2 * 1024 * 1024) + '"}';
		expect(() => readStoredPda(twoMbString)).not.toThrow();
		expect(readStoredPda(twoMbString)).toEqual({ ok: false, reason: 'corrupt' });

		// 2 MB of whitespace
		const twoMbSpaces = ' '.repeat(2 * 1024 * 1024);
		expect(() => readStoredPda(twoMbSpaces)).not.toThrow();
		expect(readStoredPda(twoMbSpaces)).toEqual({ ok: false, reason: 'corrupt' });
	});
});
