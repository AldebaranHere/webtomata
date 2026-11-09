// The first load of the sandbox must not reach the PDA document, commands or history by a value
// import. `history.ts` used to hold `createPdaHistory` too, which put `pda-document.ts` and
// `pda-commands.ts` in the first JS of every route that mounts the editor (T-068).
//
// Known blind spot, accepted by the planner on 2026-11-10: the soal route has a static source chain
// (`routes/soal/[id]/+page.svelte` → `storage/index.ts` → `pda-work.ts` → the PDA modules) that
// Rollup tree-shakes out of the build. This guard is seeded from the layout and the sandbox only,
// so that chain is not walked; a pass here is not a proof for the soal route.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

const ENTRIES = [
	'routes/+layout.svelte',
	'routes/+layout.ts',
	'routes/sandbox/+page.svelte',
	'lib/editor/Editor.svelte',
	'lib/storage/library.svelte.ts',
	'lib/editor/interaction/editor.ts'
].map((path) => resolve(SRC, path));

// The walk must really reach the editor core, or a renamed file would make it pass with nothing.
const CANARIES = ['lib/editor/history.ts', 'lib/editor/interaction/editor.ts'].map((path) =>
	resolve(SRC, path)
);

const FORBIDDEN = new Set(['pda-document.ts', 'pda-commands.ts', 'pda-history.ts']);

const IMPORT = /\bimport\s+(type\s+)?([\s\S]*?)\bfrom\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT = /\bimport\s*['"]([^'"]+)['"]/g;
const EXPORT_FROM =
	/\bexport\s+(type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[\s\S]*?\})\s+from\s*['"]([^'"]+)['"]/g;
const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

/** True when every name in the braces is an inline `type`, so the import is erased. */
function allInlineTypes(clause: string): boolean {
	const open = clause.indexOf('{');
	if (open < 0) return false;
	// `import Foo, { type A }` and `import * as foo` are value imports.
	if (clause.slice(0, open).trim() !== '') return false;
	const inner = clause.slice(open + 1, clause.lastIndexOf('}'));
	const names = inner
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);
	return names.length > 0 && names.every((name) => name.startsWith('type '));
}

/** The static value imports and re-exports of a `.ts` or `.svelte` file, in source order. */
function valueImportsOf(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	const text = file.endsWith('.svelte')
		? [...source.matchAll(SCRIPT)].map((match) => match[1]!).join('\n')
		: source;
	const specifiers: string[] = [];
	for (const match of text.matchAll(IMPORT)) {
		if (match[1] !== undefined) continue; // import type …
		if (allInlineTypes(match[2]!)) continue; // import { type A } …
		specifiers.push(match[3]!);
	}
	for (const match of text.matchAll(SIDE_EFFECT)) specifiers.push(match[1]!);
	for (const match of text.matchAll(EXPORT_FROM)) {
		if (match[1] !== undefined) continue; // export type … from
		if (allInlineTypes(match[0])) continue; // export { type A } from …
		specifiers.push(match[2]!);
	}
	return specifiers;
}

/** The file a specifier names, `null` when a relative or `#lib/` path does not exist, or 'external'. */
function resolveSpecifier(from: string, specifier: string): string | null | 'external' {
	let base: string;
	if (specifier.startsWith('#lib/') || specifier.startsWith('$lib/')) {
		base = resolve(SRC, 'lib', specifier.slice(5));
	} else if (specifier.startsWith('.')) {
		base = resolve(dirname(from), specifier);
	} else {
		return 'external'; // a package, or `$app/…`: fetched by the framework, not part of this graph
	}
	for (const candidate of [base, `${base}.ts`, `${base}.svelte`, `${base}.js`]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

interface Walk {
	readonly visited: Set<string>;
	/** One chain per way the walk reached a forbidden module. */
	readonly chains: string[][];
	/** Relative or `#lib/` imports that name no file: the walk cannot vouch for them. */
	readonly unresolved: string[];
}

function walk(): Walk {
	const visited = new Set<string>();
	const chains: string[][] = [];
	const unresolved: string[] = [];
	const queue = ENTRIES.map((file) => ({ file, chain: [relative(SRC, file)] }));
	while (queue.length > 0) {
		const { file, chain } = queue.shift()!;
		if (visited.has(file) || !existsSync(file)) continue; // a missing entry is the canary's failure
		visited.add(file);
		if (FORBIDDEN.has(file.slice(file.lastIndexOf('/') + 1))) {
			chains.push(chain);
			continue;
		}
		for (const specifier of valueImportsOf(file)) {
			const target = resolveSpecifier(file, specifier);
			if (target === 'external') continue;
			if (target === null) {
				unresolved.push(`${relative(SRC, file)}: ${specifier}`);
				continue;
			}
			if (!target.endsWith('.ts') && !target.endsWith('.svelte')) continue;
			queue.push({ file: target, chain: [...chain, `${relative(SRC, file)} -> ${specifier}`] });
		}
	}
	return { visited, chains, unresolved };
}

describe('the first load', () => {
	it('starts from every entry and reaches the editor core', () => {
		expect(ENTRIES.filter((file) => !existsSync(file))).toEqual([]);
		const { visited } = walk();
		expect([...visited]).toEqual(expect.arrayContaining(CANARIES));
	});

	it('takes no value import to the PDA document, commands or history', () => {
		const { chains, unresolved } = walk();
		expect(unresolved).toEqual([]);
		expect(chains.map((chain) => chain.join('\n  '))).toEqual([]);
	});
});
