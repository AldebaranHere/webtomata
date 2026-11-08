// The checks of a pushdown automaton (the answer of the engine's `validate_pda`) as the page shows
// them. Parallels `checks.ts` for the FSM: maps engine issue keys to message keys, replaces state
// numbers with user-visible state names, and translates 0-based competition indices into 1-based table row numbers.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Issue } from '../engine/types.ts';
import type { CheckItem } from './checks.ts';
import type { PdaDocument } from './pda-document.ts';

export const PDA_CHECK_KEYS: Record<string, MessageKey> = {
	'pda.no_start_state': 'check.no_start_state',
	'pda.no_accepting_state': 'pda_check.no_accepting_state',
	'pda.unreachable_state': 'check.unreachable_state',
	'pda.duplicate_transition': 'pda_check.duplicate_transition',
	'pda.pop_never_pushed': 'pda_check.pop_never_pushed',
	'pda.competing_transitions': 'pda_check.competing_transitions',
	'pda.accepting_state_free_move': 'pda_check.accepting_state_free_move',
	'fsm.too_many_issues': 'check.too_many_issues'
};

export function pdaCheckItems(issues: readonly Issue[], doc: PdaDocument): CheckItem[] {
	const nameOf = (id: number) => doc.states.find((s) => s.id === id)?.name;
	return issues.map((issue): CheckItem => {
		const key = PDA_CHECK_KEYS[issue.message.key];
		const params: Params = {};
		const states: number[] = [];

		for (const [name, value] of Object.entries(issue.message.params)) {
			if ((name === 'from' || name === 'state') && typeof value === 'number') {
				const known = nameOf(value);
				params.state = known ?? String(value);
				if (known !== undefined) states.push(value);
			} else if ((name === 'first' || name === 'second') && typeof value === 'number') {
				params[name] = value + 1;
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
