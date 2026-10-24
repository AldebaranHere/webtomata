// What to tell the user when a call to the engine fails. The client throws `EngineCrashed` or
// `EngineTimeout` (or `EngineCancelled` when the app itself canceled); this turns them into
// message keys for the notice. The text lives in src/lib/i18n.
import { EngineCancelled, EngineTimeout } from './client.ts';
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';

export interface EngineProblem {
	title: MessageKey;
	body: MessageKey;
	params: Params;
}

/**
 * The problem to show for a failed call, or `undefined` when there is nothing to show (the app
 * canceled the call itself). Any failure that is not a timeout counts as a crash, so that the
 * user always has a way to try again.
 */
export function engineProblem(error: unknown): EngineProblem | undefined {
	if (error instanceof EngineCancelled) return undefined;
	if (error instanceof EngineTimeout) {
		return {
			title: 'engine.timeout.title',
			body: 'engine.timeout.body',
			params: { seconds: Math.ceil(error.timeoutMs / 1000) }
		};
	}
	return { title: 'engine.crashed.title', body: 'engine.crashed.body', params: {} };
}
