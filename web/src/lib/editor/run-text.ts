// The words for a run: the engine sends message keys and parameters (and a stop reason), and this
// picks the text key for each. No DOM. The engine's own keys are listed here, and a test reads the
// Rust source to be sure that none is missing.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Message } from '../engine/types.ts';
import type { RunView } from './run.ts';

export interface Text {
	key: MessageKey;
	params: Params;
}

/** Why a string cannot be run at all, as a text: a symbol that is not in the alphabet, no start state. */
export function refusalText(refusal: Message | undefined): Text {
	if (refusal?.key === 'input.unknown_symbol') {
		const { symbol, position } = refusal.params;
		return {
			key: 'input.unknown_symbol',
			// The engine counts the symbols before this one; people count from 1.
			params: { symbol: String(symbol), position: typeof position === 'number' ? position + 1 : 1 }
		};
	}
	if (refusal?.key === 'sim.no_start_state') return { key: 'sim.no_start_state', params: {} };
	if (refusal?.key === 'sim.stopped') return stoppedText(String(refusal.params.reason));
	return { key: 'sim.refused_other', params: {} };
}

export function stoppedText(reason: string): Text {
	const key =
		reason === 'max_steps'
			? 'sim.stopped_max_steps'
			: reason === 'max_configurations'
				? 'sim.stopped_max_configurations'
				: 'sim.stopped_other';
	return { key, params: {} };
}

/**
 * The verdict at the last step, and the reason for a rejection; `undefined` before the last step.
 * A run that the budget stopped has no verdict, only the sentence that says so.
 */
export function verdictText(view: RunView): { title?: Text; detail?: Text } | undefined {
	const { verdict } = view;
	if (!verdict) return undefined;
	if (verdict.kind === 'accepted') return { title: { key: 'run.accepted', params: {} } };
	if (verdict.kind === 'stopped') return { detail: stoppedText(verdict.reason) };
	return {
		title: { key: 'run.rejected', params: {} },
		detail: { key: view.active.length === 0 ? 'run.rejected_dead' : 'run.rejected_end', params: {} }
	};
}

/** The text that a step of the run gets in the live region: the key of the engine's step message. */
export function stepText(message: Message): Text {
	const key: MessageKey =
		message.key === 'sim.start'
			? 'sim.start'
			: message.key === 'sim.no_states'
				? 'sim.no_states'
				: 'sim.read';
	const params: Params = {};
	for (const [name, value] of Object.entries(message.params)) {
		if (typeof value === 'string' || typeof value === 'number') params[name] = value;
	}
	return { key, params };
}
