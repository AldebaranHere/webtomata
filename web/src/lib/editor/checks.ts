// The checks of a machine (the answer of the engine's `validate`) as the page shows them: a text key
// with the names of the states, and the states that each check is about. No DOM. The engine returns
// state numbers and symbol names; the page turns the numbers into the names the user sees.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Issue } from '../engine/types.ts';
import type { MachineDocument } from './document.ts';

export type CheckSeverity = 'error' | 'warning';

export interface CheckItem {
	severity: CheckSeverity;
	key: MessageKey;
	params: Params;
	/** The states that this check is about (they get a mark on the diagram). */
	states: number[];
}

/** The text of each check that the engine can send (a test reads the keys from the Rust source). */
export const CHECK_KEYS: Record<string, MessageKey> = {
	'fsm.no_start_state': 'check.no_start_state',
	'dfsm.missing_transition': 'check.missing_transition',
	'dfsm.duplicate_transition': 'check.duplicate_transition',
	'dfsm.epsilon_transition': 'check.epsilon_transition',
	'fsm.unreachable_state': 'check.unreachable_state',
	'fsm.too_many_issues': 'check.too_many_issues'
};

/** The parameters that name a state by its number, and the ones that do not. */
const STATE_PARAMS = ['state', 'from', 'to'] as const;

export function checkItems(issues: readonly Issue[], doc: MachineDocument): CheckItem[] {
	const nameOf = (id: number) => doc.states.find((s) => s.id === id)?.name;
	return issues.map((issue): CheckItem => {
		const key = CHECK_KEYS[issue.message.key];
		const params: Params = {};
		const states: number[] = [];
		for (const [name, value] of Object.entries(issue.message.params)) {
			if ((STATE_PARAMS as readonly string[]).includes(name) && typeof value === 'number') {
				const known = nameOf(value);
				params[name] = known ?? String(value);
				if (known !== undefined) states.push(value);
			} else {
				params[name] = value;
			}
		}
		if (!key) {
			return {
				severity: issue.severity,
				key: 'check.other',
				params: { code: issue.message.key },
				states: []
			};
		}
		return { severity: issue.severity, key, params, states };
	});
}

/** The mark for each state that has a check, an error winning over a warning. */
export function flagsOf(items: readonly CheckItem[]): Map<number, CheckSeverity> {
	const flags = new Map<number, CheckSeverity>();
	for (const item of items) {
		for (const state of item.states) {
			if (item.severity === 'error' || !flags.has(state)) flags.set(state, item.severity);
		}
	}
	return flags;
}

export function summaryOf(items: readonly CheckItem[]): {
	errors: number;
	warnings: number;
	total: number;
} {
	const errors = items.filter((i) => i.severity === 'error').length;
	return { errors, warnings: items.length - errors, total: items.length };
}
