import { describe, expect, it } from 'vitest';
import { build } from '../diagram/testing.ts';
import { menuItems } from './menu.ts';

const doc = () =>
	build({
		alphabet: ['a'],
		states: [
			[200, 200, 'q0'],
			[400, 200, 'q1']
		],
		start: 0,
		accepting: [1]
	});

describe('the menu', () => {
	it('on empty canvas has one item: add a state here', () => {
		expect(menuItems({ kind: 'canvas' }, doc(), [])).toEqual([{ action: 'add' }]);
	});

	it('on a single state: rename, start, accepting and delete, with the marks', () => {
		expect(menuItems({ kind: 'state', id: 0 }, doc(), [0])).toEqual([
			{ action: 'rename' },
			{ action: 'start', checked: true },
			{ action: 'accepting', checked: false },
			{ action: 'delete' }
		]);
		expect(menuItems({ kind: 'state', id: 1 }, doc(), [1])).toEqual([
			{ action: 'rename' },
			{ action: 'start', checked: false },
			{ action: 'accepting', checked: true },
			{ action: 'delete' }
		]);
	});

	it('on several states: no rename and no start; accepting is on only when all are', () => {
		expect(menuItems({ kind: 'state', id: 0 }, doc(), [0, 1])).toEqual([
			{ action: 'accepting', checked: false },
			{ action: 'delete' }
		]);
	});
});
