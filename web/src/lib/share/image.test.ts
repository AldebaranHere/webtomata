import { describe, expect, it } from 'vitest';
import { documentFrom, endsWith01 } from '../editor/diagram/samples.ts';
import { edgeGeometry } from '../editor/diagram/geometry.ts';
import { createDocument } from '../editor/document.ts';
import { PNG_MAX_SIDE, diagramSvg, pngScale } from './image.ts';

const START = 'mulai';
const count = (text: string, part: string) => text.split(part).length - 1;

describe('diagramSvg', () => {
	it('is one self-contained SVG: a size, a viewBox, a white background, no script and no CSS variables', () => {
		const result = diagramSvg(endsWith01(), START);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const svg = result.value.svg;
		expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg ')).toBe(true);
		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(svg).toMatch(/viewBox="-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+"/);
		expect(svg).toContain('fill="#ffffff"');
		expect(svg).not.toMatch(/var\(--|<script|<style|foreignObject|href=/);
		expect(svg.endsWith('</svg>\n')).toBe(true);
	});

	it('draws one circle per state, an inner circle for each accepting state, and one path per edge and for the start', () => {
		const doc = endsWith01();
		const shapes = edgeGeometry(doc, { startLabel: START });
		const result = diagramSvg(doc, START);
		if (!result.ok) throw new Error('refused');
		const svg = result.value.svg;
		const accepting = doc.accepting.length;
		expect(count(svg, 'class="state"')).toBe(doc.states.length);
		expect(count(svg, 'class="inner"')).toBe(accepting);
		expect(count(svg, 'class="edge"')).toBe(shapes.edges.length);
		expect(count(svg, 'class="start"')).toBe(1);
		for (const edge of shapes.edges) expect(svg).toContain(`d="${edge.path}"`);
		for (const state of doc.states) expect(svg).toContain(`>${state.name}</text>`);
		expect(svg).toContain(`>${START}</text>`);
	});

	it('has the size of the drawing with room around it, and says it in the result', () => {
		const doc = endsWith01();
		const { bounds } = edgeGeometry(doc, { startLabel: START });
		const result = diagramSvg(doc, START);
		if (!result.ok) throw new Error('refused');
		expect(result.value.width).toBe(Math.ceil(bounds.width + 48));
		expect(result.value.height).toBe(Math.ceil(bounds.height + 48));
		expect(result.value.svg).toContain(`width="${result.value.width}"`);
		expect(result.value.svg).toContain(`height="${result.value.height}"`);
	});

	it('writes what XML would break as text: <, >, &, quotes and emoji in names and labels', () => {
		const doc = documentFrom({
			alphabet: ['<', '&', '"'],
			states: [
				[0, 0, `<&"'>`],
				[200, 0, '😀']
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, '<', 1],
				[0, '&', 1],
				[1, '"', 1]
			]
		});
		const result = diagramSvg(doc, START);
		if (!result.ok) throw new Error('refused');
		const svg = result.value.svg;
		expect(svg).toContain('&lt;&amp;&quot;&apos;&gt;');
		expect(svg).toContain('😀');
		// No raw ampersand or angle bracket is left inside any text.
		for (const [, text] of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
			expect(text).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
		}
	});

	it('is the same text for the same machine', () => {
		const a = diagramSvg(endsWith01(), START);
		const b = diagramSvg(endsWith01(), START);
		expect(a).toEqual(b);
	});

	it('refuses a machine with no states', () => {
		const result = diagramSvg(createDocument(), START);
		expect(!result.ok && result.error.key).toBe('image.empty');
	});

	it('draws a machine with a loop, an opposite pair and an ε label without a broken number', () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[0, 0],
				[200, 0]
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, 'a', 0],
				[0, 'a', 1],
				[1, null, 0]
			]
		});
		const result = diagramSvg(doc, START);
		if (!result.ok) throw new Error('refused');
		expect(result.value.svg).not.toMatch(/NaN|undefined|Infinity/);
		expect(result.value.svg).toContain('>ε</text>');
	});
});

describe('pngScale', () => {
	it('is 2 for a normal picture', () => {
		expect(pngScale(600, 300)).toBe(2);
	});

	it('goes down so that the longest side stays within the limit', () => {
		const scale = pngScale(3000, 500)!;
		expect(scale).toBeLessThan(2);
		expect(Math.ceil(3000 * scale)).toBeLessThanOrEqual(PNG_MAX_SIDE);
	});

	it('is null when even one pixel for each unit would be too big', () => {
		expect(pngScale(PNG_MAX_SIDE + 1, 100)).toBeNull();
		expect(pngScale(100, PNG_MAX_SIDE + 1)).toBeNull();
	});
});
