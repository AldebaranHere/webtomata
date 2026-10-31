import { describe, expect, it } from 'vitest';
import { parseMathNodes } from './language-math.ts';

describe('parseMathNodes', () => {
	it('parses L1^3L2^2 - L7* into structured sub/sup nodes', () => {
		const nodes = parseMathNodes('L1^3L2^2 - L7*');
		expect(nodes).toEqual([
			{ kind: 'var', base: 'L', sub: '1', sup: '3' },
			{ kind: 'var', base: 'L', sub: '2', sup: '2' },
			{ kind: 'op', text: '−' },
			{ kind: 'var', base: 'L', sub: '7', sup: '*' }
		]);
	});

	it('parses parenthesized powers like (L6)^R L1*', () => {
		const nodes = parseMathNodes('(L6)^R L1*');
		expect(nodes).toEqual([
			{
				kind: 'group',
				inner: [{ kind: 'var', base: 'L', sub: '6', sup: undefined }],
				sup: 'R'
			},
			{ kind: 'var', base: 'L', sub: '1', sup: '*' }
		]);
	});

	it('parses group union stars like L7* - L8(L1 ∪ L2)*', () => {
		const nodes = parseMathNodes('L7* - L8(L1 ∪ L2)*');
		expect(nodes).toEqual([
			{ kind: 'var', base: 'L', sub: '7', sup: '*' },
			{ kind: 'op', text: '−' },
			{ kind: 'var', base: 'L', sub: '8', sup: undefined },
			{
				kind: 'group',
				inner: [
					{ kind: 'var', base: 'L', sub: '1', sup: undefined },
					{ kind: 'op', text: '∪' },
					{ kind: 'var', base: 'L', sub: '2', sup: undefined }
				],
				sup: '*'
			}
		]);
	});

	it('parses (L1)^3L2^2 - L7*', () => {
		const nodes = parseMathNodes('(L1)^3L2^2 - L7*');
		expect(nodes).toEqual([
			{
				kind: 'group',
				inner: [{ kind: 'var', base: 'L', sub: '1', sup: undefined }],
				sup: '3'
			},
			{ kind: 'var', base: 'L', sub: '2', sup: '2' },
			{ kind: 'op', text: '−' },
			{ kind: 'var', base: 'L', sub: '7', sup: '*' }
		]);
	});

	it('parses finite sets like {ab, aca, b, ccab}', () => {
		const nodes = parseMathNodes('{ab, aca, b, ccab}');
		expect(nodes).toEqual([{ kind: 'set', text: 'ab, aca, b, ccab', sup: undefined }]);
	});
});
