// The files of a PDA: telling a PDA file from the files of a machine, reading it, and writing the two
// kinds of file that the PDA editor gives back. The file is untrusted: its size is checked before it is
// read, and a `.jff` result passes through the PDA document, so every limit and rule holds for it too.
// Nothing here throws, and there is no DOM; the dialog gives the names and calls `download`.
import { jffLayout, message } from '../editor/document.ts';
import type { Result } from '../editor/document.ts';
import {
	fromEnginePda,
	parsePdaDocumentText,
	serializePdaDocument,
	toEnginePda
} from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import type { EngineResult, JffState, Pda, PdaJff } from '../engine/types.ts';
import { FILE_BYTE_LIMIT, importKind, titleOfFileName } from './open-file.ts';
import type { ImportFile } from './open-file.ts';

/** A `.jff` is a PDA when its type is `pda`; the engine trims the type, so `<type> pda </type>` counts. */
const PDA_JFF = /<type>\s*pda\s*<\/type>/u;
/** A JSON file is a PDA when its kind is one of the two. This is a sniff, not a parse: the parser checks the rest. */
const PDA_JSON = /"kind"\s*:\s*"(dpda|ndpda)"/u;

/** What the page needs from the engine to read and write a PDA (the client of engine/client.ts has it). */
export interface ImportPdaEngine {
	importPdaJff(xml: string): Promise<EngineResult<PdaJff>>;
}

export interface PdaJffEngine {
	exportPdaJff(pda: Pda, layout: JffState[]): Promise<EngineResult<string>>;
}

const fail = (key: string, params: Record<string, string | number> = {}): Result<never> => ({
	ok: false,
	error: message(key, params)
});

/**
 * Is this file a PDA? The size is checked first, so a file over the limit is not read and the FSM
 * reader answers `import.too_big` as it does today. A file that cannot be read is not a PDA file
 * (the FSM reader says so with `import.unreadable`). It never throws.
 */
export async function isPdaFile(file: ImportFile): Promise<boolean> {
	const kind = importKind(file.name);
	if (kind === null) return false;
	if (!(file.size <= FILE_BYTE_LIMIT)) return false;
	let text: string;
	try {
		text = await file.text();
	} catch {
		return false;
	}
	return (kind === 'jff' ? PDA_JFF : PDA_JSON).test(text);
}

/**
 * The PDA document of a file, with the notes of what was changed on the way (nothing for a `.jff`: the
 * names are repaired by `fromEnginePda` without a list). The failures are messages: `import.too_big`,
 * `import.unknown_type`, `import.unreadable`, the messages of the engine for a `.jff`, and the rules of
 * a PDA document. It never throws.
 */
export async function openPdaFile(
	file: ImportFile,
	engine: ImportPdaEngine
): Promise<Result<PdaDocument>> {
	const kind = importKind(file.name);
	if (kind === null) return fail('import.unknown_type');
	if (!(file.size <= FILE_BYTE_LIMIT)) return fail('import.too_big', { limit: FILE_BYTE_LIMIT });
	try {
		const text = await file.text();
		if (kind === 'json') return parsePdaDocumentText(text);
		const answer = await engine.importPdaJff(text);
		if (!answer.ok) return answer;
		const { pda, states } = answer.value;
		const doc = fromEnginePda(pda, states);
		const titled = { ...doc, title: titleOfFileName(file.name) };
		// The document must obey the same rules as one that came from JSON too.
		const checked = parsePdaDocumentText(serializePdaDocument(titled));
		return checked;
	} catch {
		return fail('import.unreadable');
	}
}

/** The text of the `.jff` of a document, or the message of the engine (a symbol of several characters). */
export async function pdaJffFile(engine: PdaJffEngine, doc: PdaDocument): Promise<Result<string>> {
	const answer = await engine.exportPdaJff(toEnginePda(doc), jffLayout(doc));
	return answer.ok ? { ok: true, value: answer.value } : { ok: false, error: answer.error };
}

/** The document file of a PDA, written so that a person can read it. It is read back by `parsePdaDocumentText`. */
export function pdaJsonFile(doc: PdaDocument): string {
	return JSON.stringify(JSON.parse(serializePdaDocument(doc)), null, 2) + '\n';
}
