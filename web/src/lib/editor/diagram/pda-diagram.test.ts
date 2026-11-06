import { describe, expect, it } from 'vitest';
import type { MessageKey } from '#lib/i18n/id.ts';
import { translate } from '#lib/i18n/translate.ts';
import { applyPdaCommand } from '../pda-commands.ts';
import type { PdaCommand } from '../pda-commands.ts';
import { createPdaDocument } from '../pda-document.ts';
import { anbnSample, pdaDocumentFrom, wcwrSample, wwrSample } from '../pda-samples.ts';
import { random } from '../testing.ts';
import { RADIUS, diagramGeometry } from './geometry.ts';
import type { Box, Point } from './geometry.ts';
import { pdaDiagram, transitionLabel } from './pda-diagram.ts';

const more = (n: number) => `+ ${n} lagi`;

const overlap = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function circleTouches(center: Point, box: Box): boolean {
	const nx = Math.max(box.x, Math.min(center.x, box.x + box.width));
	const ny = Math.max(box.y, Math.min(center.y, box.y + box.height));
	return Math.hypot(center.x - nx, center.y - ny) < RADIUS;
}

const inside = (bounds: Box, box: Box) =>
	box.x >= bounds.x - 1e-6 &&
	box.y >= bounds.y - 1e-6 &&
	box.x + box.width <= bounds.x + bounds.width + 1e-6 &&
	box.y + box.height <= bounds.y + bounds.height + 1e-6;

describe('PDA diagram adapter (T-039)', () => {
	it('F3: produces exact edges and lines in order for wwᴿ, wcwᴿ and aⁿbⁿ', () => {
		const wwr = pdaDiagram(wwrSample(), more);
		expect(wwr.edges).toEqual([
			{
				from: 0,
				to: 0,
				lines: ['a / ε / A', 'b / ε / B'],
				text: 'a / ε / A; b / ε / B'
			},
			{
				from: 0,
				to: 1,
				lines: ['ε / ε / ε'],
				text: 'ε / ε / ε'
			},
			{
				from: 1,
				to: 1,
				lines: ['a / A / ε', 'b / B / ε'],
				text: 'a / A / ε; b / B / ε'
			}
		]);

		const wcwr = pdaDiagram(wcwrSample(), more);
		expect(wcwr.edges).toEqual([
			{
				from: 0,
				to: 0,
				lines: ['a / ε / A', 'b / ε / B'],
				text: 'a / ε / A; b / ε / B'
			},
			{
				from: 0,
				to: 1,
				lines: ['c / ε / ε'],
				text: 'c / ε / ε'
			},
			{
				from: 1,
				to: 1,
				lines: ['a / A / ε', 'b / B / ε'],
				text: 'a / A / ε; b / B / ε'
			}
		]);

		const anbn = pdaDiagram(anbnSample(), more);
		expect(anbn.edges).toEqual([
			{
				from: 0,
				to: 0,
				lines: ['a / ε / A'],
				text: 'a / ε / A'
			},
			{
				from: 0,
				to: 1,
				lines: ['b / A / ε'],
				text: 'b / A / ε'
			},
			{
				from: 1,
				to: 1,
				lines: ['b / A / ε'],
				text: 'b / A / ε'
			}
		]);

		// Also verify edge order (from then to) and line order (doc.transitions order)
		const customOrder = pdaDocumentFrom({
			inputAlphabet: ['b', 'a'],
			stackAlphabet: ['A'],
			states: [
				[0, 0],
				[200, 0]
			],
			transitions: [
				[1, 'a', [], ['A'], 0],
				[0, 'a', [], ['A'], 1],
				[0, 'b', [], ['A'], 1]
			]
		});
		const customDiagram = pdaDiagram(customOrder, more);
		expect(customDiagram.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['0>1', '1>0']);
		expect(customDiagram.edges[0]?.lines).toEqual(['b / ε / A', 'a / ε / A']);
	});

	it('F4: truncates to 2 transitions + "+ n lagi" when an edge has > 3 transitions while keeping full text', () => {
		const buildWithCount = (count: number) => {
			const commands: PdaCommand[] = [
				{ type: 'addInputSymbol', symbol: 'a' },
				{ type: 'addStackSymbol', symbol: 'A' },
				{ type: 'addState', x: 0, y: 0 },
				{ type: 'addState', x: 300, y: 0 }
			];
			for (let i = 0; i < count; i++) {
				// Distinct push lengths 0..64 and/or pop lengths 0..64 to make up to 70 distinct transitions
				const pop = i < 60 ? [] : ['A'];
				const pushLen = i < 60 ? i : i - 60;
				const push = Array.from({ length: pushLen }, () => 'A');
				commands.push({ type: 'addTransition', from: 0, read: 'a', pop, push, to: 1 });
			}
			const res = applyPdaCommand(createPdaDocument(), { type: 'batch', commands });
			if (!res.ok) throw new Error(res.error.key);
			return res.doc;
		};

		const doc3 = buildWithCount(3);
		const edge3 = pdaDiagram(doc3, more).edges[0]!;
		expect(edge3.lines).toEqual(['a / ε / ε', 'a / ε / A', 'a / ε / AA']);
		expect(edge3.text).toBe('a / ε / ε; a / ε / A; a / ε / AA');

		const doc4 = buildWithCount(4);
		const edge4 = pdaDiagram(doc4, more).edges[0]!;
		expect(edge4.lines).toEqual(['a / ε / ε', 'a / ε / A', '+ 2 lagi']);
		expect(edge4.text).toBe('a / ε / ε; a / ε / A; a / ε / AA; a / ε / AAA');

		const doc5 = buildWithCount(5);
		const edge5 = pdaDiagram(doc5, more).edges[0]!;
		expect(edge5.lines).toEqual(['a / ε / ε', 'a / ε / A', '+ 3 lagi']);
		expect(edge5.text?.split('; ')).toHaveLength(5);

		const doc70 = buildWithCount(70);
		const edge70 = pdaDiagram(doc70, (count) =>
			translate('id', 'pda_editor.edge_more' as MessageKey, { count })
		).edges[0]!;
		expect(edge70.lines).toEqual(['a / ε / ε', 'a / ε / A', '+ 68 lagi']);
		expect(translate('en', 'pda_editor.edge_more' as MessageKey, { count: 68 })).toBe('+ 68 more');
		const allExpected = doc70.transitions.map((tr) => transitionLabel(doc70, tr)).join('; ');
		expect(edge70.text).toBe(allExpected);
		expect(edge70.text?.split('; ')).toHaveLength(70);
	});

	it('F5: formats stack strings according to the whole document stackAlphabet (code points)', () => {
		// Case 1: single-char stack alphabet ["A", "B"]
		const singleCharDoc = pdaDocumentFrom({
			inputAlphabet: ['a'],
			stackAlphabet: ['A', 'B'],
			states: [
				[0, 0],
				[200, 0]
			],
			transitions: [
				[0, 'a', ['A'], ['B', 'A'], 1],
				[0, null, [], [], 1]
			]
		});
		expect(transitionLabel(singleCharDoc, singleCharDoc.transitions[0]!)).toBe('ε / ε / ε');
		expect(transitionLabel(singleCharDoc, singleCharDoc.transitions[1]!)).toBe('a / A / BA');

		// Case 2: multi-char stack alphabet ["Z0", "A"] affects every transition in the document
		const multiCharDoc = pdaDocumentFrom({
			inputAlphabet: ['a'],
			stackAlphabet: ['Z0', 'A'],
			states: [
				[0, 0],
				[200, 0]
			],
			transitions: [
				[0, 'a', ['Z0'], ['A', 'Z0'], 1],
				[0, 'a', ['A'], ['A', 'A'], 1]
			]
		});
		expect(transitionLabel(multiCharDoc, multiCharDoc.transitions[0]!)).toBe('a / Z0 / A Z0');
		expect(transitionLabel(multiCharDoc, multiCharDoc.transitions[1]!)).toBe('a / A / A A');

		// Case 3: surrogate pair (1 code point, 2 UTF-16 code units) counts as 1 character
		const emojiDoc = pdaDocumentFrom({
			inputAlphabet: ['a'],
			stackAlphabet: ['😀', 'A'],
			states: [
				[0, 0],
				[200, 0]
			],
			transitions: [[0, 'a', ['😀'], ['A', '😀'], 1]]
		});
		expect(transitionLabel(emojiDoc, emojiDoc.transitions[0]!)).toBe('a / 😀 / A😀');
	});

	it('F6: 1000 random PDA documents on a grid have no overlapping labels, no label on a state, all labels inside bounds, and deterministic output', () => {
		// A three-line loop label that turns to a diagonal angle reaches about 146 px sideways from
		// its state, and the label of a neighbor's curved edge is up to 113.6 px wide at the midpoint:
		// in the worst case the states must be about 410 apart (405 is the lowest integer that passes
		// seeds 1 to 3000, 404 fails on seed 2615). 420 is the smallest round value tested that
		// holds for 3000 seeds (REPORT.md records the lower values that fail).
		const SPACING = 420;
		for (let seed = 1; seed <= 1000; seed++) {
			const rng = random(seed);
			const cells: [number, number][] = [];
			for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push([x, y]);
			const count = 2 + rng.int(5);
			const chosen: [number, number][] = [];
			while (chosen.length < count) {
				const cell = rng.pick(cells);
				if (!chosen.includes(cell)) chosen.push(cell);
			}
			const inputAlphabet = ['a', 'b', 'c'].slice(0, 1 + rng.int(3));
			const stackAlphabet = ['A', 'B'].slice(0, 1 + rng.int(2));

			// Neighbor pairs and self-loops; about half get 1 to 5 transitions
			const candidatePairs: [number, number][] = [];
			for (let from = 0; from < count; from++) {
				candidatePairs.push([from, from]);
				for (let to = 0; to < count; to++) {
					if (
						from !== to &&
						Math.abs(chosen[from]![0] - chosen[to]![0]) +
							Math.abs(chosen[from]![1] - chosen[to]![1]) ===
							1
					) {
						candidatePairs.push([from, to]);
					}
				}
			}

			const rawTransitions: [number, string | null, string[], string[], number][] = [];
			const seen = new Set<string>();
			for (const [from, to] of candidatePairs) {
				const chance = from === to ? 0.25 : 0.5;
				if (!rng.chance(chance)) continue;
				const tCount = 1 + rng.int(5);
				for (let k = 0; k < tCount; k++) {
					const read = rng.chance(0.2) ? null : rng.pick(inputAlphabet);
					const popLen = rng.int(3);
					const pushLen = rng.int(3);
					const pop = Array.from({ length: popLen }, () => rng.pick(stackAlphabet));
					const push = Array.from({ length: pushLen }, () => rng.pick(stackAlphabet));
					const key = `${from}|${read ?? ''}|${pop.join(',')}|${push.join(',')}|${to}`;
					if (seen.has(key)) continue;
					seen.add(key);
					rawTransitions.push([from, read, pop, push, to]);
				}
			}

			const states = chosen.map(
				([x, y]) => [100 + SPACING * x, 100 + SPACING * y] as [number, number]
			);
			const start = rng.chance(0.8) ? rng.int(count) : undefined;
			const accepting = rng.chance(0.5) ? [rng.int(count)] : [];

			const doc = pdaDocumentFrom({
				inputAlphabet,
				stackAlphabet,
				states,
				start,
				accepting,
				transitions: rawTransitions
			});
			const shapes = diagramGeometry(pdaDiagram(doc, more));
			const labels = [...shapes.edges.map((e) => e.label.box)];
			if (shapes.start) labels.push(shapes.start.label.box);
			const where = `seed ${seed}`;

			for (let i = 0; i < labels.length; i++) {
				expect(inside(shapes.bounds, labels[i]!), `${where}: label ${i} inside bounds`).toBe(true);
				for (let j = i + 1; j < labels.length; j++) {
					expect(overlap(labels[i]!, labels[j]!), `${where}: labels ${i} and ${j}`).toBe(false);
				}
				for (const s of shapes.states) {
					expect(
						circleTouches({ x: s.x, y: s.y }, labels[i]!),
						`${where}: label ${i} on state ${s.id}`
					).toBe(false);
				}
			}

			// Determinism when transitions are added in reversed order
			const reversedDoc = pdaDocumentFrom({
				inputAlphabet,
				stackAlphabet,
				states,
				start,
				accepting,
				transitions: [...rawTransitions].reverse()
			});
			const reversedShapes = diagramGeometry(pdaDiagram(reversedDoc, more));
			expect(JSON.stringify(reversedShapes), `${where}: reversed order`).toBe(
				JSON.stringify(shapes)
			);
		}
	});
});
