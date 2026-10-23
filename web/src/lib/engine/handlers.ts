// Turns the typed calls of `EngineApi` into calls of the WASM functions, which take text.
// It gets the WASM module as a parameter, so tests can use the real module and `worker.ts` is
// the only file that imports it.
import type { EngineApi, EngineMethod } from './protocol.ts';
import type { EngineResult } from './types.ts';

/** The functions of the WASM package (see `crates/engine-wasm`). */
export interface Wasm {
	version(): string;
	loadMachine(json: string): string;
	validate(machine: string): string;
	nondeterministicStates(machine: string): string;
	addTrapState(machine: string): string;
	simulate(machine: string, input: string, budget?: string): string;
	determinize(machine: string, budget?: string): string;
	minimize(machine: string, budget?: string): string;
	equivalent(candidate: string, reference: string, budget?: string): string;
	regexToFsm(text: string, alphabet: string, budget?: string): string;
	fsmToRegex(machine: string, budget?: string): string;
	simplify(text: string, alphabet: string, budget?: string): string;
	complement(machine: string): string;
	union(first: string, second: string): string;
	intersection(first: string, second: string, budget?: string): string;
	importJff(xml: string): string;
	exportJff(machine: string, layout: string): string;
}

export type Handlers = {
	[K in EngineMethod]: (...args: Parameters<EngineApi[K]>) => string;
};

const text = (value: unknown): string => JSON.stringify(value);
const optional = (value: unknown): string | undefined =>
	value === undefined ? undefined : text(value);

/** Every handler answers with the text of the envelope, as the WASM functions do. */
export function createHandlers(wasm: Wasm): Handlers {
	return {
		version: () => text({ ok: true, value: wasm.version() }),
		loadMachine: (json) => wasm.loadMachine(json),
		validate: (machine) => wasm.validate(text(machine)),
		nondeterministicStates: (machine) => wasm.nondeterministicStates(text(machine)),
		addTrapState: (machine) => wasm.addTrapState(text(machine)),
		simulate: (machine, input, budget) => wasm.simulate(text(machine), input, optional(budget)),
		determinize: (machine, budget) => wasm.determinize(text(machine), optional(budget)),
		minimize: (machine, budget) => wasm.minimize(text(machine), optional(budget)),
		equivalent: (candidate, reference, budget) =>
			wasm.equivalent(text(candidate), text(reference), optional(budget)),
		regexToFsm: (expression, alphabet, budget) =>
			wasm.regexToFsm(expression, text(alphabet), optional(budget)),
		fsmToRegex: (machine, budget) => wasm.fsmToRegex(text(machine), optional(budget)),
		simplify: (expression, alphabet, budget) =>
			wasm.simplify(expression, text(alphabet), optional(budget)),
		complement: (machine) => wasm.complement(text(machine)),
		union: (first, second) => wasm.union(text(first), text(second)),
		intersection: (first, second, budget) =>
			wasm.intersection(text(first), text(second), optional(budget)),
		importJff: (xml) => wasm.importJff(xml),
		exportJff: (machine, layout) => wasm.exportJff(text(machine), text(layout))
	};
}

/**
 * Runs one call. Any exception means that the engine crashed (a trap, or a call that no
 * handler answers), and the caller must stop using this engine instance.
 */
export function run(handlers: Handlers, method: string, args: unknown[]): EngineResult<unknown> {
	const handler = Object.hasOwn(handlers, method)
		? (handlers[method as EngineMethod] as (...a: unknown[]) => string)
		: undefined;
	if (handler === undefined) throw new TypeError(`unknown engine method: ${method}`);
	return JSON.parse(handler(...args)) as EngineResult<unknown>;
}
