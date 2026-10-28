// Bandingkan dengan mesin ini (S8), the part that has no DOM in it: the open machine against a regular
// expression. The expression is built as a machine over the alphabet of the open machine, and the engine
// compares the two (Rich's chapter 9): the same strings, or the shortest string that tells them apart and the
// two lists of strings that the machine gets wrong. The machine is the candidate and the expression is the
// reference, so "accepted but should reject" is the machine accepting what the expression does not.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type {
	EngineResult,
	EquivalenceBudget,
	EquivalenceReport,
	Machine
} from '../engine/types.ts';
import { stopKey } from './conversion.ts';
import { toMachine } from './document.ts';
import type { MachineDocument } from './document.ts';
import { alphabetOf, engineRefusal, textRefusal } from './regex-compile.ts';
import type { CompileEngine } from './regex-compile.ts';
import { regexRefusalOf } from './regex-conversion.ts';

/** What the page needs from the engine for this comparison. */
export interface CompareEngine extends CompileEngine {
	equivalent(
		candidate: Machine,
		reference: Machine,
		budget?: Partial<EquivalenceBudget>
	): Promise<EngineResult<EquivalenceReport>>;
}

/** A string of one list: as it is shown, and as it is typed to run it on the machine. */
export interface Wrong {
	text: string;
	input: string;
}

/**
 * A string of symbol names. The engine reads one character at a time when every symbol has one character and
 * separates symbols by spaces otherwise, so the text is written the same way; the empty string is shown as ε
 * and run as nothing.
 */
export function wrongString(alphabet: readonly string[], names: readonly string[]): Wrong {
	const single = alphabet.every((s) => Array.from(s).length === 1);
	const input = names.join(single ? '' : ' ');
	return { text: names.length === 0 ? 'ε' : input, input };
}

/** A finished comparison. */
export interface CompareRun {
	text: string;
	/** The machine that was compared: the result is old when it changes. */
	source: MachineDocument;
	verdict: 'equivalent' | 'different';
	/** The shortest string that the two tell apart; null when they are equivalent. */
	witness: Wrong | null;
	/** The machine accepts, the expression does not. Shortest first. */
	accepted: Wrong[];
	/** The machine rejects, the expression accepts. Shortest first. */
	rejected: Wrong[];
	/** The engine cut the lists (they are not all the strings). */
	truncated: boolean;
}

export type CompareOutcome =
	| { kind: 'finished'; run: CompareRun }
	| { kind: 'stopped'; key: MessageKey }
	| { kind: 'refused'; key: MessageKey; params: Params };

/**
 * Compares the machine with the expression: two calls to the engine. The symbols of the expression must be
 * symbols of the machine (the engine compares machines of the same alphabet), so a symbol that is not there is
 * named and nothing runs. A mistake in the expression comes back with the position counted from 1. A call that
 * fails (a crash, a timeout) throws.
 */
export async function runCompare(
	engine: CompareEngine,
	doc: MachineDocument,
	text: string
): Promise<CompareOutcome> {
	const noMachine = regexRefusalOf(doc);
	if (noMachine) return { kind: 'refused', ...noMachine };
	const refusal = textRefusal(text);
	if (refusal) return { kind: 'refused', ...refusal };
	const machine = toMachine(doc);
	const missing = alphabetOf(text).filter((symbol) => !machine.alphabet.includes(symbol));
	if (missing.length > 0) {
		return {
			kind: 'refused',
			key: 'compare.symbol_missing' as MessageKey,
			params: { symbols: missing.join(', ') }
		};
	}
	const compiled = await engine.regexToFsm(text, machine.alphabet);
	if (!compiled.ok) return { kind: 'refused', ...engineRefusal(compiled.error) };
	if (compiled.value.result === 'stopped') {
		return { kind: 'stopped', key: stopKey(compiled.value.reason) };
	}
	const answer = await engine.equivalent(machine, compiled.value.fsm);
	if (!answer.ok) return { kind: 'refused', ...engineRefusal(answer.error) };
	const { equivalence, witness, acceptedButShouldReject, rejectedButShouldAccept } = answer.value;
	if (equivalence.result === 'stopped')
		return { kind: 'stopped', key: stopKey(equivalence.reason) };
	const write = (names: string[]) => wrongString(machine.alphabet, names);
	return {
		kind: 'finished',
		run: {
			text,
			source: doc,
			verdict: equivalence.result,
			witness: witness ? write(witness) : null,
			accepted: acceptedButShouldReject.map(write),
			rejected: rejectedButShouldAccept.map(write),
			truncated: equivalence.result === 'different' && equivalence.listsTruncated
		}
	};
}
