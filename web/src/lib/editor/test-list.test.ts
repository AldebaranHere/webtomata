import { describe, expect, it } from 'vitest';
import { TEST_LIMITS, addTest, readTests, removeTest, sameList } from './test-list.ts';

describe('adding a string to the list', () => {
	it('adds it at the end, and keeps the empty string', () => {
		expect(addTest(['01'], '110')).toEqual({ ok: true, list: ['01', '110'] });
		expect(addTest([], '')).toEqual({ ok: true, list: [''] });
	});

	it('trims the ends: a phone keyboard likes to add a space', () => {
		expect(addTest([], ' 01 ')).toEqual({ ok: true, list: ['01'] });
		expect(addTest([], '   ')).toEqual({ ok: true, list: [''] });
	});

	it('keeps the spaces inside, for symbols of more than one character', () => {
		expect(addTest([], 'num plus num')).toEqual({ ok: true, list: ['num plus num'] });
	});

	it('says calmly when the string is there already, and does not change the list', () => {
		const list = ['01'];
		expect(addTest(list, '01 ')).toEqual({
			ok: false,
			error: { key: 'test.duplicate', params: {} }
		});
	});

	it('refuses a string that is too long, and a list that is too full', () => {
		const long = 'a'.repeat(TEST_LIMITS.chars + 1);
		expect(addTest([], long)).toMatchObject({ ok: false, error: { key: 'test.too_long' } });
		expect(addTest([], 'a'.repeat(TEST_LIMITS.chars))).toMatchObject({ ok: true });
		const full = Array.from({ length: TEST_LIMITS.count }, (_, i) => String(i));
		expect(addTest(full, 'x')).toMatchObject({
			ok: false,
			error: { key: 'test.too_many', params: { limit: TEST_LIMITS.count } }
		});
	});

	it('counts characters, not UTF-16 units', () => {
		expect(addTest([], '😀'.repeat(TEST_LIMITS.chars))).toMatchObject({ ok: true });
	});
});

describe('removing a string', () => {
	it('removes that string only', () => {
		expect(removeTest(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
		expect(removeTest(['a'], 'z')).toEqual(['a']);
	});
});

describe('reading a list from a saved record', () => {
	it('gives an empty list for anything that is not a list', () => {
		for (const bad of [undefined, null, 'x', 5, {}, { length: 2 }])
			expect(readTests(bad)).toEqual([]);
	});

	it('keeps the strings, and drops what is not a string', () => {
		expect(readTests(['01', 3, null, '', {}, '10'])).toEqual(['01', '', '10']);
	});

	it('cuts a list that is too long, and a string that is too long', () => {
		const many = Array.from({ length: 500 }, (_, i) => String(i));
		expect(readTests(many)).toHaveLength(TEST_LIMITS.count);
		expect(readTests(['a'.repeat(100_000)])[0]).toHaveLength(TEST_LIMITS.chars);
	});

	it('removes a string that is there twice', () => {
		expect(readTests(['a', 'b', 'a'])).toEqual(['a', 'b']);
	});

	it('never throws, also for a list with a hole or a getter that throws', () => {
		const sparse = new Array(3);
		sparse[1] = 'a';
		expect(readTests(sparse)).toEqual(['a']);
		expect(readTests(new Array(4_000_000_000))).toEqual([]);
		const hostile = new Proxy([], {
			get() {
				throw new Error('no');
			}
		});
		expect(readTests(hostile)).toEqual([]);
	});
});

describe('comparing lists', () => {
	it('is the same list when the strings and the order are the same', () => {
		expect(sameList(['a', 'b'], ['a', 'b'])).toBe(true);
		expect(sameList(['a', 'b'], ['b', 'a'])).toBe(false);
		expect(sameList([], [])).toBe(true);
		expect(sameList(['a'], ['a', 'b'])).toBe(false);
	});
});
