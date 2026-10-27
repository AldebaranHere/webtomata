import { describe, expect, it } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { documentFrom, endsWith01 } from '../editor/diagram/samples.ts';
import { createDocument, documentsEqual, serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { random, randomCommand } from '../editor/testing.ts';
import {
	LINK_CHAR_LIMIT,
	LINK_CHAT_LIMIT,
	decodeLink,
	encodeLink,
	isLongForChat,
	linkFragment,
	shareUrl
} from './link.ts';

/** A document made of many random commands (the ones that are refused change nothing). */
function randomDocument(seed: number, steps = 60): MachineDocument {
	const rng = random(seed);
	let doc = createDocument();
	for (let i = 0; i < steps; i++) {
		const result = applyCommand(doc, randomCommand(rng, doc));
		if (result.ok) doc = result.doc;
	}
	return doc;
}

const bytes = (text: string) => new TextEncoder().encode(text);

function base64url(data: Uint8Array): string {
	let text = '';
	for (const byte of data) text += String.fromCharCode(byte);
	return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** The compressed bytes of a text, the way the link holds them. */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('a link holds a machine', () => {
	it('gives the same document back, for the sample and for many random documents', async () => {
		const docs = [
			endsWith01(),
			createDocument(),
			...[1, 2, 3, 4, 5, 6, 7, 8].map((s) => randomDocument(s))
		];
		for (const doc of docs) {
			const link = await encodeLink(doc);
			const result = await decodeLink(link);
			expect(result.ok, link).toBe(true);
			if (result.ok) expect(documentsEqual(result.value, doc)).toBe(true);
		}
	});

	it('uses only the characters that a URL fragment keeps as they are', async () => {
		const link = await encodeLink(endsWith01());
		expect(link).toMatch(/^m1=[A-Za-z0-9_-]+$/);
		expect(shareUrl('https://webtomata.example', link)).toBe(
			`https://webtomata.example/sandbox#${link}`
		);
	});

	it('is short for a small machine, and shorter than the plain text for a big one', async () => {
		const small = await encodeLink(endsWith01());
		expect(small.length).toBeLessThan(700);
		const big = randomDocument(3, 400);
		const text = serializeDocument(big);
		const link = await encodeLink(big);
		expect(link.length).toBeLessThan((text.length * 4) / 3);
	});

	it('keeps names and the title in any script, and emoji', async () => {
		const doc = documentFrom({
			title: 'Mesin 😀 Ünïcode ε',
			alphabet: ['a', '😀', 'α'],
			states: [
				[0, 0, 'q😀'],
				[100, 0, 'ünï']
			],
			start: 0,
			accepting: [1],
			transitions: [[0, '😀', 1]]
		});
		const result = await decodeLink(await encodeLink(doc));
		expect(result.ok && documentsEqual(result.value, doc)).toBe(true);
	});

	it('says that a link is too long for a chat only above the limit', async () => {
		expect(isLongForChat('x'.repeat(LINK_CHAT_LIMIT))).toBe(false);
		expect(isLongForChat('x'.repeat(LINK_CHAT_LIMIT + 1))).toBe(true);
		expect(isLongForChat(await encodeLink(endsWith01()))).toBe(false);
	});

	it('takes the link from the fragment of a page, with or without the #', () => {
		expect(linkFragment('#m1=abc')).toBe('m1=abc');
		expect(linkFragment('m1=abc')).toBe('m1=abc');
		expect(linkFragment('')).toBeNull();
		expect(linkFragment('#')).toBeNull();
		expect(linkFragment('#section')).toBeNull();
		expect(linkFragment('#m1u=abc')).toBe('m1u=abc');
	});
});

describe('a link that is not a machine fails calmly, and never throws', () => {
	it('refuses a wrong prefix, an empty payload and characters that are not in the alphabet', async () => {
		for (const text of [
			'',
			'm1=',
			'm2=abc',
			'abc',
			'm1=ab cd',
			'm1=ab+cd',
			'm1=ab/cd',
			'm1=a=',
			'm1=é'
		]) {
			const result = await decodeLink(text);
			expect(result.ok, text).toBe(false);
			if (!result.ok) expect(result.error.key, text).toBe('share.invalid_link');
		}
	});

	it('refuses a payload of an impossible length, and data that is not compressed data', async () => {
		// A base64 text of 5 characters (4n + 1) is never right.
		expect((await decodeLink('m1=abcde')).ok).toBe(false);
		// Plain bytes in the place of compressed bytes.
		expect((await decodeLink(`m1=${base64url(bytes('this is not deflate data at all'))}`)).ok).toBe(
			false
		);
	});

	it('refuses a link that was cut or changed, and a random text', async () => {
		const link = await encodeLink(endsWith01());
		const rng = random(5);
		for (let cut = 3; cut < link.length; cut += 7) {
			const result = await decodeLink(link.slice(0, cut));
			// A cut link is no machine; (a cut may by luck be valid data that is not a document).
			expect(result.ok, `cut at ${cut}`).toBe(false);
		}
		for (let round = 0; round < 60; round++) {
			const at = 3 + rng.int(link.length - 3);
			const flipped = link.slice(0, at) + (link[at] === 'A' ? 'B' : 'A') + link.slice(at + 1);
			const result = await decodeLink(flipped);
			// Either the data is damaged, or by luck it is still a machine: never an exception.
			expect(typeof result.ok).toBe('boolean');
		}
		for (let round = 0; round < 100; round++) {
			let garbage = 'm1=';
			for (let i = 0; i < 1 + rng.int(300); i++) {
				garbage += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[rng.int(64)];
			}
			expect((await decodeLink(garbage)).ok, garbage).toBe(false);
		}
	});

	it('refuses valid data that is not a document, and a document of another version', async () => {
		const make = async (value: unknown) =>
			`m1=${base64url(await deflate(bytes(JSON.stringify(value))))}`;
		const notDocument = await decodeLink(await make({ hello: 'world' }));
		expect(notDocument.ok).toBe(false);
		if (!notDocument.ok) expect(notDocument.error.key).toBe('document.invalid_file');
		const doc = JSON.parse(serializeDocument(endsWith01()));
		const future = await decodeLink(await make({ ...doc, schemaVersion: 2 }));
		expect(future.ok).toBe(false);
		if (!future.ok) expect(future.error.key).toBe('document.unsupported_version');
		const notJson = await decodeLink(`m1=${base64url(await deflate(bytes('{"broken')))}`);
		expect(notJson.ok).toBe(false);
		const rubbish = await decodeLink(
			`m1=${base64url(await deflate(new Uint8Array([0xff, 0xfe, 0xfd])))}`
		);
		expect(rubbish.ok).toBe(false);
	});

	it('refuses a prototype key and keeps no trace of it', async () => {
		const doc = JSON.parse(serializeDocument(endsWith01()));
		// The key goes in as the first of the object, in the text itself (an object literal would set the prototype).
		const text = '{"__proto__":{"polluted":true},' + JSON.stringify(doc).slice(1);
		const link = `m1=${base64url(await deflate(bytes(text)))}`;
		const result = await decodeLink(link);
		expect(result.ok).toBe(false);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});
});

describe('a link that would expand to something huge is stopped while it is read', () => {
	it('refuses a small link that inflates to far more than a document may hold', async () => {
		const bomb = await deflate(new Uint8Array(30 * 1024 * 1024)); // 30 MB of zeros
		expect(bomb.length).toBeLessThan(100_000);
		const result = await decodeLink(`m1=${base64url(bomb)}`);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.key).toBe('share.too_big');
	});

	it('refuses a text that is longer than any link could be, before it reads it', async () => {
		const result = await decodeLink(`m1=${'A'.repeat(LINK_CHAR_LIMIT + 1)}`);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.key).toBe('share.too_big');
	});
});

describe('a browser without compression', () => {
	it('writes the plain form, and reads both forms', async () => {
		const real = globalThis.CompressionStream;
		try {
			// @ts-expect-error the test takes the stream away
			delete globalThis.CompressionStream;
			const link = await encodeLink(endsWith01());
			expect(link).toMatch(/^m1u=[A-Za-z0-9_-]+$/);
			globalThis.CompressionStream = real;
			const result = await decodeLink(link);
			expect(result.ok && documentsEqual(result.value, endsWith01())).toBe(true);
		} finally {
			globalThis.CompressionStream = real;
		}
	});

	it('says so when it must read a compressed link and cannot', async () => {
		const link = await encodeLink(endsWith01());
		const real = globalThis.DecompressionStream;
		try {
			// @ts-expect-error the test takes the stream away
			delete globalThis.DecompressionStream;
			const result = await decodeLink(link);
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error.key).toBe('share.unsupported_browser');
		} finally {
			globalThis.DecompressionStream = real;
		}
	});
});
