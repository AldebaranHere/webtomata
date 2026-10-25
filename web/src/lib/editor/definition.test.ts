import { describe, expect, it } from 'vitest';
import { documentFrom, endsWith01 } from './diagram/samples.ts';
import { definitionOf, definitionText } from './definition.ts';

describe('the formal definition of a DFSM, in the notation of Rich', () => {
	const def = definitionOf(endsWith01());

	it('is the tuple M = (K, Σ, δ, s, A)', () => {
		expect(def.heading).toBe('M = (K, Σ, δ, s, A)');
		expect(def.kind).toBe('dfsm');
	});

	it('names the sets and the start state', () => {
		expect(def.states).toBe('{q0, q1, q2}');
		expect(def.alphabet).toBe('{0, 1}');
		expect(def.start).toBe('q0');
		expect(def.accepting).toBe('{q2}');
	});

	it('writes each transition as δ(q, a) = p, in the order of the engine', () => {
		expect(def.transitions).toEqual([
			'δ(q0, 0) = q1',
			'δ(q0, 1) = q0',
			'δ(q1, 0) = q1',
			'δ(q1, 1) = q2',
			'δ(q2, 0) = q1',
			'δ(q2, 1) = q0'
		]);
	});

	it('is also a text that can be copied', () => {
		expect(definitionText(endsWith01())).toBe(
			[
				'M = (K, Σ, δ, s, A)',
				'K = {q0, q1, q2}',
				'Σ = {0, 1}',
				's = q0',
				'A = {q2}',
				'δ(q0, 0) = q1',
				'δ(q0, 1) = q0',
				'δ(q1, 0) = q1',
				'δ(q1, 1) = q2',
				'δ(q2, 0) = q1',
				'δ(q2, 1) = q0'
			].join('\n')
		);
	});
});

describe('the formal definition of an NDFSM', () => {
	const doc = documentFrom({
		alphabet: ['a', 'b'],
		states: [
			[100, 100, 'q0'],
			[300, 50, 'q1'],
			[300, 150, 'q2']
		],
		start: 0,
		accepting: [1, 2],
		transitions: [
			[0, null, 1],
			[0, null, 2],
			[1, 'a', 1],
			[2, 'b', 2]
		]
	});
	const ndfsm = { ...doc, kind: 'ndfsm' as const };

	it('is the tuple with Δ, and writes ε for the empty string', () => {
		const def = definitionOf(ndfsm);
		expect(def.heading).toBe('M = (K, Σ, Δ, s, A)');
		expect(def.accepting).toBe('{q1, q2}');
		expect(def.transitions).toEqual([
			'(q0, ε, q1) ∈ Δ',
			'(q0, ε, q2) ∈ Δ',
			'(q1, a, q1) ∈ Δ',
			'(q2, b, q2) ∈ Δ'
		]);
	});

	it('an NDFSM without a transition has an empty list', () => {
		expect(definitionOf({ ...ndfsm, transitions: [] }).transitions).toEqual([]);
	});
});

describe('a machine that is not finished', () => {
	it('without a start state, s is not set; without states, the sets are empty', () => {
		const nothing = documentFrom({ states: [] });
		const def = definitionOf(nothing);
		expect(def.states).toBe('{}');
		expect(def.alphabet).toBe('{}');
		expect(def.accepting).toBe('{}');
		expect(def.start).toBeNull();
		expect(definitionText(nothing)).toContain('s = —');
	});

	it('writes a symbol of several characters as it is, and keeps the order of the alphabet', () => {
		const doc = documentFrom({
			alphabet: ['num', 'plus'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			transitions: [[0, 'num', 1]]
		});
		const def = definitionOf(doc);
		expect(def.alphabet).toBe('{num, plus}');
		expect(def.transitions).toEqual(['δ(q0, num) = q1']);
	});

	it('a DFSM with two targets for one symbol shows both, so that the picture is true', () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1'],
				[500, 100, 'q2']
			],
			start: 0,
			transitions: [
				[0, 'a', 1],
				[0, 'a', 2]
			]
		});
		expect(definitionOf(doc).transitions).toEqual(['δ(q0, a) = q1', 'δ(q0, a) = q2']);
	});

	it('state names are plain text: nothing is read as markup', () => {
		const doc = documentFrom({ states: [[100, 100, '<b>q0</b>']], start: 0 });
		expect(definitionOf(doc).start).toBe('<b>q0</b>');
	});
});
