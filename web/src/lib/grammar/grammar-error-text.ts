// Pure helper that turns an engine `Message` into user-facing text for the grammar workstation.
// Never returns a raw message key, a `detail` parameter, or an exception message.
import type { Message } from '../engine/types.ts';
import { id as sharedMessages, type MessageKey } from '../i18n/id.ts';
import type { Params } from '../i18n/translate.ts';

function isSharedMessageKey(key: string): key is MessageKey {
	return Object.hasOwn(sharedMessages, key);
}

/**
 * Formats an engine error `Message` for display. Known keys (in `id.ts`, or via an injected
 * `hasKey` predicate for lazy dictionaries) are translated with their parameters; any unknown key
 * falls back to `grammar.error.generic` and ignores `params.detail`.
 */
export function formatGrammarError(
	error: Message,
	translateFn: (key: MessageKey, params?: Params) => string,
	hasKey: (key: string) => boolean = isSharedMessageKey
): string {
	if (hasKey(error.key)) {
		// Safe: `hasKey(error.key)` just confirmed that `error.key` is registered in the dictionary.
		return translateFn(error.key as MessageKey, error.params);
	}
	return translateFn('grammar.error.generic');
}
