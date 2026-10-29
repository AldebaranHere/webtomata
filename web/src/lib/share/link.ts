// A machine in a link. The link is `/sandbox#m1=<text>`: the machine as the document file (the same JSON that is
// saved on the device), compressed with deflate and written in base64url, so that it holds only the
// characters that a URL fragment keeps as they are. The fragment is never sent to a server, so a
// shared machine is not stored anywhere, and only a person who has the link can see it.
//
// A link comes from outside, so it is not trusted: the length is checked before anything is read, the
// compressed data is stopped while it is read if it grows past what a document may hold (a small link
// can inflate to a huge text), and what comes out must be a valid document (`parseDocumentText`).
// Reading never throws. No library: the browser has compression streams. A browser that has none writes
// the plain form (`m1u=`), which is longer, and reads both forms when it can.
import { LIMITS, message, parseDocumentText, serializeDocument } from '../editor/document.ts';
import type { MachineDocument, Result } from '../editor/document.ts';

const COMPRESSED = 'm1=';
const PLAIN = 'm1u=';

/** The longest link that is read, in characters: the biggest document, compressed and written in base64. */
export const LINK_CHAR_LIMIT = Math.ceil((LIMITS.documentBytes * 4) / 3) + 16;
/** A link longer than this is cut or refused by many chat and mail programs; the page offers a file. */
export const LINK_CHAT_LIMIT = 8000;

const refuse = (key: string): { ok: false; error: ReturnType<typeof message> } => ({
	ok: false,
	error: message(key)
});

// ---- base64url ----

function toBase64Url(data: Uint8Array): string {
	let text = '';
	for (let i = 0; i < data.length; i += 0x8000) {
		text += String.fromCharCode(...data.subarray(i, i + 0x8000));
	}
	return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Bytes from base64url, or null if the text is not base64url (also a length that no data can have). */
function fromBase64Url(text: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
	const padded =
		text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4);
	try {
		const binary = atob(padded);
		const out = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
		return out;
	} catch {
		return null;
	}
}

// ---- deflate, with a limit on what comes out ----

const compression = () => typeof CompressionStream === 'function';
const decompression = () => typeof DecompressionStream === 'function';

async function deflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The inflated bytes, 'big' if they pass `limit` (the data is not read any further), or 'corrupt'. */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array | 'big' | 'corrupt'> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.length;
			if (total > limit) {
				await reader.cancel().catch(() => undefined);
				return 'big';
			}
			chunks.push(value);
		}
	} catch {
		return 'corrupt';
	}
	const out = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.length;
	}
	return out;
}

// ---- the link ----

/** The uncompressed fragment (`m1u=...`) that holds `doc`, computed synchronously at build time. */
export function encodePlainLink(doc: MachineDocument): string {
	return PLAIN + toBase64Url(new TextEncoder().encode(serializeDocument(doc)));
}

/** The fragment (without the `#`) that holds the machine: `m1=...`, or `m1u=...` without compression. */
export async function encodeLink(doc: MachineDocument): Promise<string> {
	if (!compression()) return encodePlainLink(doc);
	const bytes = new TextEncoder().encode(serializeDocument(doc));
	return COMPRESSED + toBase64Url(await deflate(bytes));
}

/** The machine in a fragment (`m1=...`). Never throws; a message says why a link is not a machine. */
export async function decodeLink(fragment: string): Promise<Result<MachineDocument>> {
	const plain = fragment.startsWith(PLAIN);
	if (!plain && !fragment.startsWith(COMPRESSED)) return refuse('share.invalid_link');
	const payload = fragment.slice(plain ? PLAIN.length : COMPRESSED.length);
	if (payload.length > LINK_CHAR_LIMIT) return refuse('share.too_big');
	const data = fromBase64Url(payload);
	if (data === null || data.length === 0) return refuse('share.invalid_link');
	let text: Uint8Array;
	if (plain) {
		if (data.length > LIMITS.documentBytes) return refuse('share.too_big');
		text = data;
	} else {
		if (!decompression()) return refuse('share.unsupported_browser');
		const inflated = await inflate(data, LIMITS.documentBytes);
		if (inflated === 'big') return refuse('share.too_big');
		if (inflated === 'corrupt') return refuse('share.invalid_link');
		text = inflated;
	}
	let json: string;
	try {
		json = new TextDecoder('utf-8', { fatal: true }).decode(text);
	} catch {
		return refuse('share.invalid_link');
	}
	return parseDocumentText(json);
}

/** The full address of a link, for the page at `origin`. */
export const shareUrl = (origin: string, fragment: string) => `${origin}/sandbox#${fragment}`;

/** Is the link too long to be sure that a chat program keeps it whole? */
export const isLongForChat = (fragment: string) => fragment.length > LINK_CHAT_LIMIT;

/** The link in the fragment of a page (`location.hash`), or null if the fragment is not a link of ours. */
export function linkFragment(hash: string): string | null {
	const text = hash.startsWith('#') ? hash.slice(1) : hash;
	return text.startsWith(COMPRESSED) || text.startsWith(PLAIN) ? text : null;
}
