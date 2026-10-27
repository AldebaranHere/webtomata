// A machine as a file to keep or to send: the JFLAP file (`.jff`) and the document file as JSON. The names of
// the files, the text of the JSON file, the symbols that a `.jff` cannot hold, and the call to the engine
// for the `.jff` are here, with no DOM; `download` is the one function that touches the page.
import { jffLayout, serializeDocument, toMachine } from '../editor/document.ts';
import type { MachineDocument, Result } from '../editor/document.ts';
import type { EngineResult, JffState, Machine } from '../engine/types.ts';

export const JFF_EXTENSION = '.jff';
export const JSON_EXTENSION = '.webtomata.json';

const NAME_CHARS = 80;
// The characters that a name of a file cannot have on Windows (the strictest), and the control characters.
const FORBIDDEN = /[\\/:*?"<>|\p{Cc}]/gu;
// The names of the devices of Windows, with or without an extension.
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * The name of the file for a title: the title with the characters that a file name cannot have replaced by a
 * hyphen, the spaces that stack made one, no dot, hyphen or space at the ends, 80 characters at most, and never
 * the name of a device of Windows. A title with nothing left gets `fallback`.
 */
export function fileName(title: string, extension: string, fallback = 'mesin'): string {
	let name = title.replace(/\s+/gu, ' ').replace(FORBIDDEN, '-').trim();
	name = Array.from(name).slice(0, NAME_CHARS).join('');
	name = name.replace(/^[.\- ]+|[.\- ]+$/gu, '');
	if (name === '') name = fallback;
	if (DEVICE.test(name)) name = `_${name}`;
	return name + extension;
}

/** The document file, written so that a person can read it. It is read back by `parseDocumentText`. */
export function jsonFile(doc: MachineDocument): string {
	return JSON.stringify(JSON.parse(serializeDocument(doc)), null, 2) + '\n';
}

/** The symbols of the alphabet that no transition reads: a `.jff` has no alphabet, so they are not kept. */
export function unusedSymbols(doc: MachineDocument): string[] {
	const used = new Set(doc.transitions.map((t) => t.on));
	return doc.alphabet.filter((symbol) => !used.has(symbol));
}

/** What the page needs from the engine for the `.jff` (the client of engine/client.ts has it). */
export interface JffEngine {
	exportJff(machine: Machine, layout: JffState[]): Promise<EngineResult<string>>;
}

/** The text of the `.jff` file of a document, or the message of the engine (a symbol of several characters). */
export async function jffFile(engine: JffEngine, doc: MachineDocument): Promise<Result<string>> {
	const answer = await engine.exportJff(toMachine(doc), jffLayout(doc));
	return answer.ok ? { ok: true, value: answer.value } : { ok: false, error: answer.error };
}

/** Gives the text to the person as a file, as a click on a link to it. Nothing leaves the device. */
export function download(name: string, text: string, type: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	link.rel = 'noopener';
	document.body.append(link);
	link.click();
	link.remove();
	// The browser has the file by now; a link that is kept would only use memory.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
