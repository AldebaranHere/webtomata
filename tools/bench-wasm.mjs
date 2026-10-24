// Times determinize, minimize and equivalent through the built WASM module, on the same
// families of machines as crates/engine-core/benches/engine.rs. Each call goes through the API as
// the worker does it: the machine as JSON text in, the answer as JSON text out, parsed. So these
// numbers are higher than the native ones, which time the engine alone.
//
// Needs the WASM package: `pnpm build:wasm`. Run: `node tools/bench-wasm.mjs`.
// It warms up each case, then takes the median of at least 21 runs (and at least one second).
// Node and Chrome use the same engine (V8) for WASM, but a phone is slower than a laptop.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import init, * as wasm from '../web/src/lib/engine/wasm/engine_wasm.js';

await init({
	module_or_path: readFileSync(
		new URL('../web/src/lib/engine/wasm/engine_wasm_bg.wasm', import.meta.url)
	)
});

const SIZES = [10, 100, 500];
const EXPONENTIAL = [6, 8, 10];

// ---- the machines (the same as in the Rust benchmark) ----

const machine = (kind, alphabet, n, start, accepting, transitions) => ({
	schemaVersion: 1,
	kind,
	alphabet,
	states: Array.from({ length: n }, (_, i) => i),
	start,
	accepting,
	transitions: transitions.map(([from, symbol, to]) => ({ from, on: alphabet[symbol], to }))
});

function endsWithA(n) {
	const ts = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];
	for (let i = 1; i < n - 1; i++) ts.push([i, 0, i + 1]);
	return machine('ndfsm', ['a', 'b'], n, 0, [n - 1], ts);
}

function kthFromEnd(k) {
	const ts = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];
	for (let i = 1; i < k; i++) ts.push([i, 0, i + 1], [i, 1, i + 1]);
	return machine('ndfsm', ['a', 'b'], k + 1, 0, [k], ts);
}

function randomDfsm(n) {
	let x = 12345n;
	const next = () => {
		x = (x * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
		return Number(x >> 33n);
	};
	const ts = [];
	for (let s = 0; s < n; s++) for (let c = 0; c < 3; c++) ts.push([s, c, next() % n]);
	const accepting = [];
	for (let s = 0; s < n; s++) if (next() % 2 === 0) accepting.push(s);
	return machine('dfsm', ['a', 'b', 'c'], n, 0, accepting, ts);
}

function chain(n) {
	const ts = Array.from({ length: n }, (_, i) => [i, 0, Math.min(i + 1, n - 1)]);
	return machine('dfsm', ['a'], n, 0, [n - 1], ts);
}

function counter(n, renumber) {
	const id = (i) => (renumber ? n - 1 - i : i);
	const ts = [];
	for (let i = 0; i < n; i++) ts.push([id(i), 0, id((i + 1) % n)], [id(i), 1, id((i + 2) % n)]);
	return machine('dfsm', ['a', 'b'], n, id(0), [id(0)], ts);
}

// ---- timing ----

function median(xs) {
	const sorted = [...xs].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

/** Runs `call` (which returns the parsed answer), checks it with `check`, and times it. */
function measure(name, call, check) {
	check(call());
	for (let i = 0; i < 3; i++) call(); // warm-up: the first runs use slower code
	const times = [];
	const started = performance.now();
	while ((times.length < 21 || performance.now() - started < 1000) && times.length < 500) {
		const t0 = performance.now();
		call();
		times.push(performance.now() - t0);
	}
	// The middle half of the runs: it is not moved by a single pause of the garbage collector.
	const sorted = [...times].sort((a, b) => a - b);
	const quarter = (q) => sorted[Math.floor((sorted.length - 1) * q)];
	const spread = (quarter(0.75) - quarter(0.25)) / median(times);
	console.log(
		`| ${name} | ${median(times).toFixed(2)} | ${quarter(0.25).toFixed(2)} – ${quarter(0.75).toFixed(2)} | ${times.length} | ${(spread * 100).toFixed(0)}% |`
	);
}

const answer = (text) => {
	const envelope = JSON.parse(text);
	if (!envelope.ok) throw new Error(`the engine answered with an error: ${envelope.error.key}`);
	return envelope.value;
};
const expect = (ok, what) => {
	if (!ok) throw new Error(`wrong answer: ${what}`);
};

console.log('| case | median (ms) | middle half of the runs (ms) | runs | spread (middle half / median) |');
console.log('| --- | --- | --- | --- | --- |');

for (const n of SIZES) {
	const m = JSON.stringify(endsWithA(n));
	measure(
		`determinize ends_with_a ${n}`,
		() => answer(wasm.determinize(m)),
		(v) => expect(v.result === 'finished' && v.dfsm.states.length === n, `determinize ${n}`)
	);
}
for (const k of EXPONENTIAL) {
	const m = JSON.stringify(kthFromEnd(k));
	measure(
		`determinize kth_from_end ${k} (2^${k} states out)`,
		() => answer(wasm.determinize(m)),
		(v) => expect(v.result === 'finished' && v.dfsm.states.length === 2 ** k, `kth ${k}`)
	);
}
for (const n of SIZES) {
	const m = JSON.stringify(randomDfsm(n));
	measure(
		`minimize random ${n}`,
		() => answer(wasm.minimize(m)),
		(v) => expect(v.result === 'finished' && v.dfsm.states.length <= n, `minimize random ${n}`)
	);
}
for (const n of SIZES) {
	const m = JSON.stringify(chain(n));
	measure(
		`minimize chain ${n}`,
		() => answer(wasm.minimize(m)),
		(v) => expect(v.result === 'finished' && v.dfsm.states.length === n, `minimize chain ${n}`)
	);
}
for (const n of SIZES) {
	const [a, b] = [JSON.stringify(counter(n, false)), JSON.stringify(counter(n, true))];
	measure(
		`equivalent same_language ${n}`,
		() => answer(wasm.equivalent(a, b)),
		(v) => expect(v.equivalence.result === 'equivalent', `equivalent same ${n}`)
	);
}
for (const n of SIZES) {
	const [a, b] = [JSON.stringify(counter(n, false)), JSON.stringify(counter(n + 2, false))];
	measure(
		`equivalent different ${n} vs ${n + 2}`,
		() => answer(wasm.equivalent(a, b)),
		(v) => expect(v.equivalence.result === 'different', `equivalent different ${n}`)
	);
}
