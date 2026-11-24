import { describe, expect, it } from 'vitest';
import { LIMITS } from '../editor/document.ts';
import type { CfgToPda, Grammar, StateName } from '../engine/types.ts';
import {
	CFG_PDA_SPACING,
	CFG_PDA_STEP_WINDOW,
	buildConvertedPdaDocument,
	buildConvertedPdaTitle,
	cfgPdaLayout,
	formatStepTransition,
	hasEpsilonRule,
	showBottomUpEpsilonNote,
	windowEarlierRows
} from './grammar-to-pda.ts';

describe('grammar-to-pda', () => {
	describe('cfgPdaLayout (B4)', () => {
		it('places p and q at (200, 220) and (620, 220) — 420 units apart (>= 410)', () => {
			const states: StateName[] = [
				{ id: 1, name: 'q' },
				{ id: 0, name: 'p' }
			];
			const placed = cfgPdaLayout(states);
			expect(placed).toEqual([
				{ id: 0, name: 'p', x: 200, y: 220 },
				{ id: 1, name: 'q', x: 620, y: 220 }
			]);
			expect(placed[1]!.x - placed[0]!.x).toBe(CFG_PDA_SPACING);
			expect(placed[1]!.x - placed[0]!.x).toBeGreaterThanOrEqual(410);
		});

		it('places arbitrary states in id order on one row with no overlap', () => {
			const states: StateName[] = [
				{ id: 2, name: 'r' },
				{ id: 0, name: 'p' },
				{ id: 1, name: 'q' }
			];
			const placed = cfgPdaLayout(states);
			expect(placed.map((s) => s.id)).toEqual([0, 1, 2]);
			const coords = new Set(placed.map((s) => `${s.x},${s.y}`));
			expect(coords.size).toBe(placed.length);
			for (let i = 1; i < placed.length; i++) {
				expect(placed[i]!.x - placed[i - 1]!.x).toBeGreaterThanOrEqual(410);
			}
		});
	});

	describe('buildConvertedPdaTitle (title clamping)', () => {
		it('uses fallback name when grammar title is blank', () => {
			expect(buildConvertedPdaTitle('   ', '(PDA atas-bawah)', 'Tanpa judul')).toBe(
				'Tanpa judul (PDA atas-bawah)'
			);
		});

		it('keeps titles at or below LIMITS.titleChars unchanged', () => {
			const suffix = '(PDA atas-bawah)';
			const maxBase = LIMITS.titleChars - suffix.length - 1;
			const baseExact = 'A'.repeat(maxBase);
			const baseBelow = 'A'.repeat(maxBase - 1);
			expect([...buildConvertedPdaTitle(baseBelow, suffix, 'x')].length).toBe(
				LIMITS.titleChars - 1
			);
			expect([...buildConvertedPdaTitle(baseExact, suffix, 'x')].length).toBe(LIMITS.titleChars);
		});

		it('clamps titles one above LIMITS.titleChars to fit exactly', () => {
			const suffix = '(PDA atas-bawah)';
			const maxBase = LIMITS.titleChars - suffix.length - 1;
			const baseAbove = 'A'.repeat(maxBase + 1);
			const result = buildConvertedPdaTitle(baseAbove, suffix, 'x');
			expect([...result].length).toBe(LIMITS.titleChars);
			expect(result.endsWith(` ${suffix}`)).toBe(true);
		});
	});

	describe('windowEarlierRows (boundary 49 / 50 / 51)', () => {
		it('hides nothing at 49 (one below limit) and 50 (at limit)', () => {
			const r49 = Array.from({ length: CFG_PDA_STEP_WINDOW - 1 }, (_, i) => i);
			expect(windowEarlierRows(r49)).toEqual({ shown: r49, hidden: 0 });

			const r50 = Array.from({ length: CFG_PDA_STEP_WINDOW }, (_, i) => i);
			expect(windowEarlierRows(r50)).toEqual({ shown: r50, hidden: 0 });
		});

		it('hides 1 row at 51 (one above limit) and keeps the last 50', () => {
			const r51 = Array.from({ length: CFG_PDA_STEP_WINDOW + 1 }, (_, i) => i);
			const res = windowEarlierRows(r51);
			expect(res.hidden).toBe(1);
			expect(res.shown).toHaveLength(CFG_PDA_STEP_WINDOW);
			expect(res.shown[0]).toBe(1);
			expect(res.shown[res.shown.length - 1]).toBe(50);
		});
	});

	describe('bottom-up ε-rule note (B6)', () => {
		const withEpsilon: Grammar = {
			start: 'S',
			rules: [
				{
					head: 'S',
					body: [
						{ type: 'terminal', value: 'a' },
						{ type: 'nonTerminal', value: 'S' },
						{ type: 'terminal', value: 'b' }
					]
				},
				{ head: 'S', body: [] }
			]
		};
		const withoutEpsilon: Grammar = {
			start: 'S',
			rules: [
				{
					head: 'S',
					body: [
						{ type: 'terminal', value: 'a' },
						{ type: 'terminal', value: 'b' }
					]
				}
			]
		};

		it('detects ε-rules accurately', () => {
			expect(hasEpsilonRule(withEpsilon)).toBe(true);
			expect(hasEpsilonRule(withoutEpsilon)).toBe(false);
			expect(hasEpsilonRule(null)).toBe(false);
		});

		it('shows the note only for bottom-up with an ε-rule', () => {
			expect(showBottomUpEpsilonNote('bottomup', withEpsilon)).toBe(true);
			expect(showBottomUpEpsilonNote('topdown', withEpsilon)).toBe(false);
			expect(showBottomUpEpsilonNote('bottomup', withoutEpsilon)).toBe(false);
			expect(showBottomUpEpsilonNote('topdown', withoutEpsilon)).toBe(false);
			expect(showBottomUpEpsilonNote('bottomup', null)).toBe(false);
		});
	});

	describe('buildConvertedPdaDocument and formatStepTransition', () => {
		const sampleResult: CfgToPda = {
			pda: {
				schemaVersion: 1,
				kind: 'ndpda' as const,
				inputAlphabet: ['a', 'b'],
				stackAlphabet: ['S', 'a', 'b'],
				states: [0, 1],
				start: 0,
				accepting: [1],
				transitions: [
					{ from: 0, read: null, pop: [], push: ['S'], to: 1 },
					{ from: 1, read: null, pop: ['S'], push: ['a', 'S', 'b'], to: 1 }
				]
			},
			states: [
				{ id: 0, name: 'p' },
				{ id: 1, name: 'q' }
			],
			steps: [
				{
					transition: { from: 0, read: null, pop: [], push: ['S'], to: 1 },
					message: { key: 'cfg_pda.top_down.start', params: {} }
				},
				{
					transition: { from: 1, read: null, pop: ['S'], push: ['a', 'S', 'b'], to: 1 },
					message: { key: 'cfg_pda.top_down.rule', params: { rule: 'S → a S b' } }
				}
			]
		};

		it('builds a valid PdaDocument with title, state names, coordinates, and all transitions', () => {
			const doc = buildConvertedPdaDocument(sampleResult, 'Test (PDA atas-bawah)');
			expect(doc.title).toBe('Test (PDA atas-bawah)');
			expect(doc.kind).toBe('ndpda');
			expect(doc.states).toEqual([
				{ id: 0, name: 'p', x: 200, y: 220 },
				{ id: 1, name: 'q', x: 620, y: 220 }
			]);
			expect(doc.transitions).toHaveLength(2);
		});

		it('formats step transition labels using PDA diagram slash notation', () => {
			const doc = buildConvertedPdaDocument(sampleResult, 'Test');
			const row0 = formatStepTransition(
				doc,
				sampleResult.states,
				sampleResult.steps[0]!.transition,
				0
			);
			const row1 = formatStepTransition(
				doc,
				sampleResult.states,
				sampleResult.steps[1]!.transition,
				1
			);
			expect(row0).toEqual({ index: 0, fromName: 'p', toName: 'q', label: 'ε / ε / S' });
			expect(row1).toEqual({ index: 1, fromName: 'q', toName: 'q', label: 'ε / S / aSb' });
		});
	});
});
