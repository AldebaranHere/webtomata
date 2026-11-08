// Workstation mode definitions and query/storage reader.
// See docs/agent/PLAN.md (Task T-057).

export type WorkstationMode = 'fsm' | 'pda' | 'language' | 'grammar';

export const WORKSTATION_MODES: readonly WorkstationMode[] = ['fsm', 'pda', 'language', 'grammar'];

function isWorkstationMode(val: unknown): val is WorkstationMode {
	return typeof val === 'string' && (WORKSTATION_MODES as readonly string[]).includes(val);
}

/**
 * Reads the active workstation mode from the search query string or saved value.
 * Precedence: valid search query param `mode` > valid saved value > 'fsm'.
 * Case-sensitive (e.g. 'PDA' falls back). Never throws.
 */
export function readMode(search: string, saved: string | null): WorkstationMode {
	try {
		const param = new URLSearchParams(search).get('mode');
		if (isWorkstationMode(param)) return param;
	} catch {
		// Ignore any URLSearchParams parse error on malformed strings
	}

	if (isWorkstationMode(saved)) return saved;

	return 'fsm';
}
