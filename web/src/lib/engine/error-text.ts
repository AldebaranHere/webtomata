// Pure helper that turns an engine `Message` into user-facing text for the grammar and the language
// workstations. Never returns a raw message key, a `detail` parameter, or an exception message.
import type { Message } from './types.ts';
import { id as sharedMessages, type MessageKey } from '../i18n/id.ts';
import type { Params } from '../i18n/translate.ts';

function isSharedMessageKey(key: string): key is MessageKey {
	return Object.hasOwn(sharedMessages, key);
}

/**
 * Formats an engine error `Message` for display. A key that the shared dictionary knows is
 * translated with its parameters; any other key falls back to the caller's `genericKey` and ignores
 * `params.detail`.
 */
export function formatEngineError(
	error: Message,
	translateFn: (key: MessageKey, params?: Params) => string,
	genericKey: MessageKey
): string {
	if (isSharedMessageKey(error.key)) {
		// Safe: `isSharedMessageKey` just confirmed that `error.key` is a registered message key.
		return translateFn(error.key, error.params);
	}
	return translateFn(genericKey);
}
