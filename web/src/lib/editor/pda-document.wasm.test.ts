// The PDA document against the real WASM engine (`pnpm build:wasm`).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type {
	Competition,
	EngineResult,
	Issue,
	Pda,
	PdaSimulationReport
} from '../engine/types.ts';
import { createPdaDocument, toEnginePda } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import { anbnSample, wcwrSample, wwrSample } from './pda-samples.ts';
import { checkPdaDocument, random, randomPdaCommand } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const loadPda = (pda: unknown) =>
	JSON.parse(wasm.loadPda(JSON.stringify(pda))) as EngineResult<Pda>;
const validatePda = (pda: unknown) =>
	JSON.parse(wasm.validatePda(JSON.stringify(pda))) as EngineResult<Issue[]>;
const pdaDeterminism = (pda: unknown) =>
	JSON.parse(wasm.pdaDeterminism(JSON.stringify(pda))) as EngineResult<Competition[]>;
const simulatePda = (doc: PdaDocument, input: string) =>
	JSON.parse(
		wasm.simulatePda(JSON.stringify(toEnginePda(doc)), input, undefined)
	) as EngineResult<PdaSimulationReport>;

function stringsUpTo(alphabet: readonly string[], maxLen: number): string[] {
	const out: string[] = [''];
	let current: string[] = [''];
	for (let len = 1; len <= maxLen; len++) {
		const next: string[] = [];
		for (const prefix of current) {
			for (const sym of alphabet) {
				const s = prefix + sym;
				next.push(s);
				out.push(s);
			}
		}
		current = next;
	}
	return out;
}

function isWcWr(s: string): boolean {
	const idx = s.indexOf('c');
	if (idx < 0) return false;
	const w = s.slice(0, idx);
	const rest = s.slice(idx + 1);
	if (w.includes('c') || rest.includes('c')) return false;
	if (w.length !== rest.length) return false;
	for (let i = 0; i < w.length; i++) {
		if (w[i] !== rest[w.length - 1 - i]) return false;
	}
	return true;
}

function isEvenPalindrome(s: string): boolean {
	if (s.length % 2 !== 0) return false;
	for (let i = 0; i < s.length / 2; i++) {
		if (s[i] !== s[s.length - 1 - i]) return false;
	}
	return true;
}

describe('AC1: F1, F2, F3 against the real WASM engine', () => {
	it('F1 (a^n b^n, n >= 1, DPDA): accepts ab, aabb, aaabbb; rejects ε, a, b, aab, abb, abab, ba; 0 competing pairs; 0 issues', () => {
		const f1 = anbnSample();
		const engineF1 = toEnginePda(f1);

		expect(loadPda(engineF1)).toEqual({ ok: true, value: engineF1 });
		expect(validatePda(engineF1)).toEqual({ ok: true, value: [] });
		expect(pdaDeterminism(engineF1)).toEqual({ ok: true, value: [] });

		for (const accepted of ['ab', 'aabb', 'aaabbb']) {
			const sim = simulatePda(f1, accepted);
			expect(sim.ok, accepted).toBe(true);
			if (sim.ok) {
				expect(sim.value.simulation.result, accepted).toBe('finished');
				if (sim.value.simulation.result === 'finished') {
					expect(sim.value.simulation.accepted, accepted).toBe(true);
				}
			}
		}

		for (const rejected of ['', 'a', 'b', 'aab', 'abb', 'abab', 'ba']) {
			const sim = simulatePda(f1, rejected);
			expect(sim.ok, JSON.stringify(rejected)).toBe(true);
			if (sim.ok) {
				expect(sim.value.simulation.result, JSON.stringify(rejected)).toBe('finished');
				if (sim.value.simulation.result === 'finished') {
					expect(sim.value.simulation.accepted, JSON.stringify(rejected)).toBe(false);
				}
			}
		}

		// Verify hand trace of "aabb": (q0,0,[]) -> (q0,1,[A]) -> (q0,2,[A,A]) -> (q1,3,[A]) -> (q1,4,[])
		// Symbol A is at index 0 in stackAlphabet ["A"].
		const traceAabb = simulatePda(f1, 'aabb');
		expect(traceAabb.ok).toBe(true);
		if (traceAabb.ok && traceAabb.value.simulation.result === 'finished') {
			expect(
				traceAabb.value.simulation.trace.map((step) => [
					step.state,
					step.position,
					step.stack.map((id) => f1.stackAlphabet[id])
				])
			).toEqual([
				[0, 0, []],
				[0, 1, ['A']],
				[0, 2, ['A', 'A']],
				[1, 3, ['A']],
				[1, 4, []]
			]);
		}

		// Verify hand trace of "aab": ends in (q1,3,[A]), stack not empty -> rejected
		const traceAab = simulatePda(f1, 'aab');
		expect(traceAab.ok).toBe(true);
		if (traceAab.ok && traceAab.value.simulation.result === 'finished') {
			expect(
				traceAab.value.simulation.trace.map((step) => [
					step.state,
					step.position,
					step.stack.map((id) => f1.stackAlphabet[id])
				])
			).toEqual([
				[0, 0, []],
				[0, 1, ['A']],
				[0, 2, ['A', 'A']],
				[1, 3, ['A']]
			]);
			expect(traceAab.value.simulation.accepted).toBe(false);
		}
	});

	it('F2 (wcw^R, DPDA): matches the wcw^R predicate for every string over {a,b,c} up to length 7 (3,280 strings) and has 0 competing pairs', () => {
		const f2 = wcwrSample();
		const engineF2 = toEnginePda(f2);

		expect(loadPda(engineF2)).toEqual({ ok: true, value: engineF2 });
		expect(validatePda(engineF2)).toEqual({ ok: true, value: [] });
		expect(pdaDeterminism(engineF2)).toEqual({ ok: true, value: [] });

		const allStrings = stringsUpTo(['a', 'b', 'c'], 7);
		expect(allStrings.length).toBe(3280);

		for (const word of allStrings) {
			const sim = simulatePda(f2, word);
			expect(sim.ok, word).toBe(true);
			if (sim.ok) {
				expect(sim.value.simulation.result, word).toBe('finished');
				if (sim.value.simulation.result === 'finished') {
					expect(sim.value.simulation.accepted, `F2 on "${word}"`).toBe(isWcWr(word));
				}
			}
		}
	});

	it('F3 (ww^R, even palindromes, NDPDA): matches the even palindrome predicate (ε included) for every string over {a,b} up to length 8 (511 strings) and has exactly 2 competing pairs', () => {
		const f3 = wwrSample();
		const engineF3 = toEnginePda(f3);

		expect(loadPda(engineF3)).toEqual({ ok: true, value: engineF3 });
		expect(validatePda(engineF3)).toEqual({ ok: true, value: [] });
		expect(pdaDeterminism(engineF3)).toEqual({
			ok: true,
			value: [
				{ from: 0, first: 0, second: 1 },
				{ from: 0, first: 0, second: 2 }
			]
		});

		const allStrings = stringsUpTo(['a', 'b'], 8);
		expect(allStrings.length).toBe(511);

		for (const word of allStrings) {
			const sim = simulatePda(f3, word);
			expect(sim.ok, word).toBe(true);
			if (sim.ok) {
				expect(sim.value.simulation.result, word).toBe('finished');
				if (sim.value.simulation.result === 'finished') {
					expect(sim.value.simulation.accepted, `F3 on "${word}"`).toBe(isEvenPalindrome(word));
				}
			}
		}
	});
});

describe('AC2 (F4) and AC4: transition sort order and engine acceptance on random documents', () => {
	it('F4: for 200 random documents, doc.transitions order matches loadPda(toEnginePda(doc)).value.transitions', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const rng = random(seed * 503);
			let doc = createPdaDocument();
			for (let step = 0; step < 35; step++) {
				const res = applyPdaCommand(doc, randomPdaCommand(rng, doc));
				if (res.ok) doc = res.doc;
			}
			expect(checkPdaDocument(doc), `seed ${seed}`).toEqual([]);
			const enginePda = toEnginePda(doc);
			const loaded = loadPda(enginePda);
			expect(loaded.ok, `seed ${seed} loadPda`).toBe(true);
			if (loaded.ok) {
				expect(loaded.value.transitions, `seed ${seed} transition order`).toEqual(
					enginePda.transitions
				);
			}
		}
	});

	it('AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged', () => {
		for (let seed = 1; seed <= 500; seed++) {
			const rng = random(seed * 131);
			let doc = createPdaDocument();
			for (let step = 0; step < 25; step++) {
				const res = applyPdaCommand(doc, randomPdaCommand(rng, doc));
				if (res.ok) doc = res.doc;
			}
			const enginePda = toEnginePda(doc);
			const loaded = loadPda(enginePda);
			expect(loaded, `seed ${seed}`).toEqual({ ok: true, value: enginePda });
			expect(checkPdaDocument(doc), `seed ${seed}`).toEqual([]);
		}
	});
});
