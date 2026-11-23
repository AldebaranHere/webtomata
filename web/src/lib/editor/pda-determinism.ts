// The determinism badge of the PDA editor: the engine's competing pairs, asked again a moment after
// each change, and the sentence that says why two transitions compete (Task T-062).
//
// The query is `createQuery` (query.ts), the same one the checks of both editors use (T-071). A
// badge never shows the answer for an older document: the pairs are emptied when a new document is
// scheduled.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Competition, EngineResult } from '../engine/types.ts';
import { formatStackSeq, stackSeparator } from './diagram/pda-diagram.ts';
import type { PdaDocument, PdaKind } from './pda-document.ts';
import { createQuery } from './query.ts';
import type { QueryStatus } from './query.ts';

/** idle: nothing was asked yet. checking: a change is waiting or the engine is working. ready: `pairs` are for the newest document. failed: the engine did not answer. */
export type DeterminismStatus = QueryStatus;

export interface Determinism {
	status(): DeterminismStatus;
	/** The competing pairs of the newest document; empty while its answer is on its way. */
	pairs(): Competition[];
	subscribe(listener: () => void): () => void;
	schedule(doc: PdaDocument): void;
	dispose(): void;
}

export function createDeterminism(options: {
	query: (doc: PdaDocument) => Promise<EngineResult<Competition[]>>;
	delayMs?: number;
}): Determinism {
	const { query: ask, delayMs } = options;
	const scheduled = createQuery<PdaDocument, Competition[], Competition[]>({
		ask,
		toValue: (pairs) => pairs,
		empty: () => [],
		emptyAtSchedule: true,
		keepsProblem: false,
		delayMs
	});
	return {
		status: () => scheduled.status(),
		pairs: () => scheduled.value(),
		subscribe: (listener) => scheduled.subscribe(listener),
		schedule: (doc) => scheduled.schedule(doc),
		dispose: () => scheduled.dispose()
	};
}

const isPrefix = (a: readonly string[], b: readonly string[]) =>
	a.length <= b.length && a.every((symbol, i) => b[i] === symbol);

/**
 * Why the two transitions of `pair` compete, as a message key and its parameters (design section 5):
 * two transitions of one state compete when one of them reads ε or both read the same symbol, and
 * one pop is a prefix of the other (an empty pop is a prefix of every pop). `pop1` is the prefix.
 * Returns null when the pair does not name two transitions of this document.
 */
export function competitionReason(
	doc: PdaDocument,
	pair: Competition
): { key: MessageKey; params: Params } | null {
	const first = doc.transitions[pair.first];
	const second = doc.transitions[pair.second];
	if (first === undefined || second === undefined) return null;

	// When only the pop of the second transition is a prefix, the two are swapped; when the pops are
	// equal the first one stays `pop1`.
	const swapped = isPrefix(second.pop, first.pop) && !isPrefix(first.pop, second.pop);
	const pop1 = swapped ? second.pop : first.pop;
	const pop2 = swapped ? first.pop : second.pop;
	const separator = stackSeparator(doc.stackAlphabet);
	const params: Params = {
		pop1: formatStackSeq(pop1, separator),
		pop2: formatStackSeq(pop2, separator)
	};

	// Both transitions reading ε is not "the same symbol": an ε row reads no symbol at all.
	if (first.read !== null && first.read === second.read) {
		return { key: 'pda_editor.compete_same_read', params: { read: first.read, ...params } };
	}
	return { key: 'pda_editor.compete_epsilon_read', params };
}

export type BadgeTone = 'success' | 'neutral' | 'warning';

/** What the badge says, and whether it opens the list of pairs. */
export interface BadgeModel {
	tone: BadgeTone;
	/** The full text, which is also the accessible name of a disclosure button. */
	key: MessageKey;
	params: Params;
	/** The visible text of a phone, when it is not the full text. */
	shortKey?: MessageKey;
	/** true: a disclosure button (there is a list to open); false: plain text. */
	opens: boolean;
}

/**
 * The badge of the kind switch, from the design's table: nothing before the first transition, the
 * success tone when there is no pair, and a disclosure with a neutral tone for an NDPDA and a
 * warning tone for a DPDA, because a pair is only an error in a DPDA.
 */
export function badgeModel(kind: PdaKind, transitions: number, pairs: number): BadgeModel | null {
	if (transitions === 0) return null;
	if (pairs === 0) {
		return { tone: 'success', key: 'pda_editor.badge_deterministic', params: {}, opens: false };
	}
	if (kind === 'dpda') {
		return {
			tone: 'warning',
			key: 'pda_editor.badge_not_dpda',
			params: { count: pairs },
			shortKey: 'pda_editor.badge_not_dpda_short',
			opens: true
		};
	}
	return {
		tone: 'neutral',
		key: 'pda_editor.badge_nondeterministic',
		params: { count: pairs },
		shortKey: 'pda_editor.badge_nondeterministic_short',
		opens: true
	};
}
