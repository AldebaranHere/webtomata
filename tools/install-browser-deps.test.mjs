// Run with `node --test "tools/*.test.mjs"`. These tests run tools/install-browser-deps.sh with fake
// `pnpm`, `sudo`, `dpkg`, `pkill` and `apt-get` programs (a slow or stuck mirror cannot be made to order), and check
// that it installs what Playwright says is missing, repairs dpkg on retries, gives up on a slow
// try to use the main Ubuntu archive, and stops an apt that ignores a polite stop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = new URL('./install-browser-deps.sh', import.meta.url).pathname.replace(
	/^\/([A-Za-z]:)/,
	'$1'
);

/** A folder with the fake programs. Each `apt-get install` is slow while the try number is below `fastFrom`. */
function setup({ missing = ['libfoo', 'libbar'], fastFrom = 1, stubborn = false } = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'deps-'));
	const bin = join(dir, 'bin');
	const sources = join(dir, 'ubuntu.sources');
	const log = join(dir, 'log');
	const count = join(dir, 'count');
	const write = (name, text) => {
		writeFileSync(join(bin, name), `#!/bin/bash\n${text}\n`);
		chmodSync(join(bin, name), 0o755);
	};
	// mkdtemp made `dir`; the shims go in a sub folder.
	spawnSync('mkdir', ['-p', bin]);
	writeFileSync(sources, 'Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble\n');
	writeFileSync(count, '0');
	write('sudo', 'exec "$@"');
	write('pkill', `echo "pkill $*" >> '${log}'`);
	write('dpkg', `echo "dpkg $*" >> '${log}'`);
	write('fuser', 'exit 1');
	write(
		'pnpm',
		missing.length
			? `printf 'Missing system dependencies (${missing.length}):\\n'; printf '  %s\\n' ${missing.join(' ')}; exit 1`
			: `echo 'All system dependencies are installed.'`
	);
	write(
		'apt-get',
		`echo "apt-get $*" >> '${log}'
if [ "$1" = "-o" ] && [ "$3" = "install" ] || [ "$1" = "install" ]; then
  n=$(( $(cat '${count}') + 1 )); echo $n > '${count}'
  if [ "$n" -lt ${fastFrom} ]; then
    ${stubborn ? "trap '' TERM" : ''}
    ${stubborn ? 'exec sleep 20' : 'sleep 20'}
  fi
fi
exit 0`
	);
	return { dir, bin, sources, log, count };
}

function run(env, browser = 'firefox') {
	const started = Date.now();
	const result = spawnSync('bash', [SCRIPT, browser], {
		encoding: 'utf8',
		// `sed -i` on Windows makes its temporary file in the current folder, which must be on the drive
		// of the file that it edits.
		cwd: env.dir,
		env: {
			...process.env,
			PATH: `${env.bin}${delimiter}${process.env.PATH}`,
			APT_SOURCES: env.sources,
			TRY_SECONDS: '1',
			KILL_SECONDS: '1',
			TRIES: '3'
		},
		timeout: 60_000
	});
	return { ...result, seconds: (Date.now() - started) / 1000 };
}

const calls = (env) =>
	existsSync(env.log) ? readFileSync(env.log, 'utf8').trim().split('\n') : [];
const installs = (env) =>
	calls(env).filter((c) => c.includes('install -y --no-install-recommends'));

// The bash script targets apt-get on Ubuntu CI runners; skip on non-Linux developer machines.
const it = (name, fn) => test(name, { skip: process.platform !== 'linux' }, fn);

it('nothing is installed when Playwright says that nothing is missing', () => {
	const env = setup({ missing: [] });
	const result = run(env);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.equal(installs(env).length, 0);
});

it('what is missing is installed, once, without the recommended packages', () => {
	const env = setup({ fastFrom: 1 });
	const result = run(env);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.deepEqual(installs(env), [
		'apt-get -o DPkg::Lock::Timeout=120 install -y --no-install-recommends libfoo libbar'
	]);
	// The mirror of the runner is kept when the first try works.
	assert.match(readFileSync(env.sources, 'utf8'), /mirror\+file:/);
});

it('a slow try is given up, and the next one uses the main Ubuntu archive', () => {
	const env = setup({ fastFrom: 2 });
	const result = run(env);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.equal(installs(env).length, 2);
	assert.match(result.stdout, /Try 2/);
	const sources = readFileSync(env.sources, 'utf8');
	assert.match(sources, /URIs: http:\/\/archive\.ubuntu\.com\/ubuntu\//);
	assert.doesNotMatch(sources, /mirror\+file:/);
});

it('the index of the packages is updated before each try', () => {
	const env = setup({ fastFrom: 2 });
	run(env);
	assert.equal(calls(env).filter((c) => c.includes('update -qq')).length >= 2, true);
});

it('when every try is slow it fails, after three tries, and does not hang', () => {
	const env = setup({ fastFrom: 99 });
	const result = run(env);
	assert.equal(result.status, 1, result.stdout + result.stderr);
	assert.equal(installs(env).length, 3);
	assert.match(result.stdout + result.stderr, /could not be installed/);
	assert.ok(result.seconds < 30, `it took ${result.seconds} seconds`);
});

it('an apt that ignores the polite stop is killed after a short wait', () => {
	const env = setup({ fastFrom: 2, stubborn: true });
	const result = run(env);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	// The stubborn apt sleeps for 20 seconds: only a kill ends the try sooner.
	assert.ok(result.seconds < 12, `it took ${result.seconds} seconds`);
});

it('repairs dpkg before retrying when a try fails', () => {
	const env = setup({ fastFrom: 2 });
	const result = run(env);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	const dpkgCalls = calls(env).filter((c) => c.startsWith('dpkg '));
	assert.deepEqual(dpkgCalls, ['dpkg --configure -a']);
	const pkillCalls = calls(env).filter((c) => c.startsWith('pkill '));
	assert.deepEqual(pkillCalls, ['pkill -9 apt-get', 'pkill -9 dpkg']);
});
