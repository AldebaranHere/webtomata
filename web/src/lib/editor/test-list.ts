// The list of test strings of a machine: the rules for what can be in it. No DOM. The list is saved
// with the machine (in its record, not in the document) and is read again from a record that
// anything may have written, so `readTests` never trusts it.

export const TEST_LIMITS = { count: 50, chars: 200 } as const;

export type AddResult =
	| { ok: true; list: string[] }
	| {
			ok: false;
			error: {
				key: 'test.too_many' | 'test.too_long' | 'test.duplicate';
				params: Record<string, number>;
			};
	  };

/** The number of characters (code points), counting at most `limit + 1`. */
function characters(text: string): number {
	if (text.length > TEST_LIMITS.chars * 2) return TEST_LIMITS.chars + 1;
	return [...text].length;
}

/** Adds a string at the end. The ends are trimmed (a phone keyboard likes to add a space). */
export function addTest(list: readonly string[], text: string): AddResult {
	const value = text.trim();
	if (characters(value) > TEST_LIMITS.chars) {
		return { ok: false, error: { key: 'test.too_long', params: { limit: TEST_LIMITS.chars } } };
	}
	if (list.includes(value)) return { ok: false, error: { key: 'test.duplicate', params: {} } };
	if (list.length >= TEST_LIMITS.count) {
		return { ok: false, error: { key: 'test.too_many', params: { limit: TEST_LIMITS.count } } };
	}
	return { ok: true, list: [...list, value] };
}

export function removeTest(list: readonly string[], text: string): string[] {
	return list.filter((item) => item !== text);
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * The list of a saved record, made safe: anything that is not a list gives an empty one, what is
 * not a string is dropped, a string that is too long is cut, a repeat is removed, and only the
 * first 50 are kept. It never throws, and it changes nothing in the store.
 */
export function readTests(value: unknown): string[] {
	try {
		if (!Array.isArray(value)) return [];
		const seen = new Set<string>();
		// A list with a huge length (a sparse array) must not keep this busy.
		const end = Math.min(value.length, 10 * TEST_LIMITS.count);
		for (let i = 0; i < end && seen.size < TEST_LIMITS.count; i++) {
			const item: unknown = value[i];
			if (typeof item !== 'string') continue;
			seen.add(
				Array.from(item.slice(0, TEST_LIMITS.chars * 2))
					.slice(0, TEST_LIMITS.chars)
					.join('')
			);
		}
		return [...seen];
	} catch {
		return [];
	}
}
