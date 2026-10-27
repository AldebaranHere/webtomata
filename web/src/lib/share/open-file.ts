// Opening a file of a machine: a JFLAP file (`.jff`) or the document file as JSON (S10b-3). The file is untrusted:
// its size is checked before it is read, a `.jff` goes through the engine (which checks its structure and limits),
// and JSON goes through `parseDocumentText` (which checks its size and every rule of a document). Nothing here
// throws, and there is no DOM: the page gives a `File`, which has this shape.
import {
	LIMITS,
	checkTitle,
	documentFromJff,
	freezeDocument,
	message,
	parseDocumentText
} from '../editor/document.ts';
import type { MachineDocument, Result } from '../editor/document.ts';
import type { EngineResult, Jff, Message } from '../engine/types.ts';
import { JFF_EXTENSION } from './files.ts';

/** The biggest file that is read: the biggest document (1 MB). A `.jff` of a machine within the limits is far smaller. */
export const FILE_BYTE_LIMIT = LIMITS.documentBytes;

/** What the page needs from a `File`. */
export interface ImportFile {
	readonly name: string;
	readonly size: number;
	text(): Promise<string>;
}

/** What the page needs from the engine (the client of engine/client.ts has it). */
export interface ImportEngine {
	importJff(xml: string): Promise<EngineResult<Jff>>;
}

export type ImportKind = 'jff' | 'json';

/** The kind of a file, told by its extension, or null for a file that is neither. */
export function importKind(name: string): ImportKind | null {
	const lower = name.toLowerCase();
	if (lower.endsWith(JFF_EXTENSION)) return 'jff';
	if (lower.endsWith('.json')) return 'json';
	return null;
}

/** The title that a `.jff` gets from its file name: without the extension, 100 characters at most. */
export function titleOfFileName(name: string): string {
	const bare = name.toLowerCase().endsWith(JFF_EXTENSION)
		? name.slice(0, -JFF_EXTENSION.length)
		: name;
	const clean = bare
		.replace(/\p{Cc}/gu, '')
		.replace(/\s+/gu, ' ')
		.trim();
	const title = Array.from(clean).slice(0, LIMITS.titleChars).join('');
	return checkTitle(title).ok ? title : '';
}

/**
 * The machine of a file, with the notes of what was changed on the way (a label of several characters that
 * became a chain of states, a name that was repaired). It is always a machine of its own: the caller opens it
 * as a new one. The failures are messages: `import.too_big`, `import.unknown_type`, `import.unreadable`, the
 * messages of the engine for a `.jff` (`jff.unsupported_type` for a grammar or a PDA...) and of the document
 * for JSON (`document.invalid_file`, `document.unsupported_version`...).
 */
export async function openFile(
	file: ImportFile,
	engine: ImportEngine
): Promise<Result<{ doc: MachineDocument; notes: Message[] }>> {
	const fail = (key: string, params: Message['params'] = {}) => ({
		ok: false as const,
		error: message(key, params)
	});
	const kind = importKind(file.name);
	if (kind === null) return fail('import.unknown_type');
	if (!(file.size <= FILE_BYTE_LIMIT)) return fail('import.too_big', { limit: FILE_BYTE_LIMIT });
	try {
		const text = await file.text();
		if (kind === 'json') {
			const parsed = parseDocumentText(text);
			return parsed.ok ? { ok: true, value: { doc: parsed.value, notes: [] } } : parsed;
		}
		const answer = await engine.importJff(text);
		if (!answer.ok) return answer;
		const { doc, notes } = documentFromJff(answer.value);
		const titled = freezeDocument({ ...doc, title: titleOfFileName(file.name) });
		return { ok: true, value: { doc: titled, notes } };
	} catch {
		return fail('import.unreadable');
	}
}
