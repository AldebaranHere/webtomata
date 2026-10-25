// The examples that we ship, against the real engine: the strings that an example says it accepts
// are accepted, the others are rejected, and the engine has nothing to point out in the machine (a
// student must not open an example and find a warning in it). It needs the WASM package
// (`pnpm build:wasm`).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import { createSyncEngine } from '../engine/handlers.ts';
import type { EngineApi } from '../engine/protocol.ts';
import { toMachine } from '../editor/document.ts';
import { EXAMPLES, buildExample } from './examples.ts';

let engine: EngineApi;

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
	engine = createSyncEngine(wasm);
});

describe('the examples against the engine', () => {
	for (const example of EXAMPLES) {
		it(`${example.id}: the accepted strings are accepted and the rejected ones are rejected`, () => {
			const machine = toMachine(buildExample(example, 'id').doc);
			const answer = engine.simulateMany(machine, [...example.accept, ...example.reject]);
			if (!answer.ok) throw new Error(answer.error.key);
			expect(answer.value.map((o) => o.result)).toEqual([
				...example.accept.map(() => 'accepted'),
				...example.reject.map(() => 'rejected')
			]);
		});

		it(`${example.id}: the engine has nothing to point out`, () => {
			const answer = engine.validate(toMachine(buildExample(example, 'id').doc));
			expect(answer).toEqual({ ok: true, value: [] });
		});
	}
});
