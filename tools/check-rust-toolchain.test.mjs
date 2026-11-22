// A guard for the pinned Rust toolchain (T-080, docs/decisions/0060-pinned-rust-toolchain.md).
// `rust-toolchain.toml` must name an exact version: it is what every clone and every CI job read,
// so `stable`, `nightly` or `1.100` would change the compiler without a change of ours. The value
// is read as TOML would read it: `#` comments are stripped, white space around `=` and either quote
// style are allowed, and exactly one `channel` must be found (none fails, not passes). It guards the
// channel only; a dropped `targets` or `components` entry is F1's one-time check. Run with
// `pnpm test:tools`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const CHANNEL_LINE = /^\s*channel\s*=\s*["']([^"']*)["']\s*$/;
const TOOLCHAIN_FILE = 'rust-toolchain.toml';

/** The `channel` values of a rust-toolchain.toml text; a commented-out channel is not one. */
const channelsOf = (text) =>
	text
		.split(/\r?\n/)
		.map((line) => line.replace(/#.*$/, ''))
		.map((line) => line.match(CHANNEL_LINE))
		.filter(Boolean)
		.map((match) => match[1]);

/** The problem with a toolchain text, or null when it blocks nothing. */
const problemWith = (text) => {
	const channels = channelsOf(text);
	if (channels.length !== 1) {
		return `it must hold exactly one channel, and it holds ${channels.length}`;
	}
	if (!EXACT_VERSION.test(channels[0])) {
		return `channel "${channels[0]}" is not an exact x.y.z version`;
	}
	return null;
};

/** What a contributor sees when the guard fails: the file, and where the bump procedure is. */
const check = (text, name = TOOLCHAIN_FILE) => {
	const problem = problemWith(text);
	return problem === null
		? null
		: `${name}: ${problem}. The bump procedure is "Bumping the Rust version" in CONTRIBUTING.md.`;
};

const realFile = readFileSync(new URL('../rust-toolchain.toml', import.meta.url), 'utf8');

test('the toolchain file pins an exact version', () => {
	assert.equal(check(realFile), null);
});

test('the guard accepts white space around = and a trailing comment', () => {
	assert.equal(check('[toolchain]\n   channel   =  "1.100.0"   # pinned\n'), null);
});

test('the guard accepts single quotes, as TOML does', () => {
	assert.equal(check("[toolchain]\nchannel = '1.100.0'\n"), null);
});

test('a commented-out channel is ignored, not read', () => {
	assert.equal(check('# channel = "stable"\n[toolchain]\nchannel = "1.100.0"\n'), null);
});

for (const channel of ['stable', '1.100', 'nightly']) {
	test(`the guard fails on channel = "${channel}"`, () => {
		const problem = check(`[toolchain]\nchannel = "${channel}"\n`);
		assert.ok(problem);
		assert.match(problem, new RegExp(`channel "${channel}" is not an exact x\\.y\\.z version`));
		assert.match(problem, /rust-toolchain\.toml/);
		assert.match(problem, /CONTRIBUTING\.md/);
	});
}

test('the guard fails closed when the file has no channel', () => {
	const problem = check('[toolchain]\ntargets = ["wasm32-unknown-unknown"]\n');
	assert.ok(problem);
	assert.match(problem, /exactly one channel, and it holds 0/);
});

test('the guard fails when the channel is written twice', () => {
	const problem = check('[toolchain]\nchannel = "1.100.0"\nchannel = "1.100.0"\n');
	assert.ok(problem);
	assert.match(problem, /exactly one channel, and it holds 2/);
});
