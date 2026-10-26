// Guard rails for the GitHub workflows (run by `pnpm check:workflows`, tested in
// check-workflows.test.mjs). They keep the Cloudflare key away from code that could be tampered
// with, and stop a later change from undoing that without anyone noticing:
//
// 1. `secrets.` appears only in the job `deploy` of deploy.yml. That job runs on its own computer
//    and runs no build code. The jobs that build and check the site never see the key.
// 2. In the deploy job, `pnpm install` uses `--ignore-scripts` (the install scripts of the
//    project would run code before the key is used), and no build, lint, test or compile
//    command runs.
// 3. Every `uses:` is pinned to a full commit, so a moved tag cannot change what runs.
// 4. `pull_request_target` is not used. It runs code of a pull request with the key of the
//    repository.
// 5. Every job has `timeout-minutes`, a number of at most 30. Without it a stalled step (a slow
//    package mirror, a hung browser download) runs for up to six hours; with it the job fails
//    fast and can be run again.
// 6. In ci.yml the job `web` is a gate. The ruleset requires the checks `rust` and `web`, and the
//    work of `web` is split over other jobs, so `web` must wait for every job of the file except
//    `rust` (`needs: [a, b]`), and must run also when one of them failed (`if: always()`). A skipped
//    required check counts as passed, so without `if: always()` a failed job would let a pull
//    request merge.
// 7. Write rights are narrow: only cleanup-caches.yml may have `actions: write` (it deletes the
//    caches of a closed pull request), and no workflow may have `contents: write`.
//
// The workflow files are read line by line, with no YAML library, so the files must keep the
// usual shape: `jobs:` at the left edge, and each job name indented by two spaces.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEPLOY_FILE = 'deploy.yml';
const DEPLOY_JOB = 'deploy';
const FULL_COMMIT = /@[0-9a-f]{40}$/;
const MAX_TIMEOUT_MINUTES = 30;
const CLEANUP_FILE = 'cleanup-caches.yml';
const CI_FILE = 'ci.yml';
const GATE_JOB = 'web';
/** Required by the ruleset on its own, so the gate does not wait for it. */
const OWN_REQUIRED_JOB = 'rust';
const BUILD_CODE =
	/\b(pnpm\s+(--filter\s+\S+\s+)?(build|lint|test|check)\b|cargo\s|wasm-pack|vite\s)/;

/** `files` is a list of `{ name, text }`. Returns the list of problems; empty means all is well. */
export function checkWorkflows(files) {
	const problems = [];
	for (const { name, text } of files) {
		let inJobs = false;
		let job = '';
		/** The jobs of this file, with the line of the header and the timeout that was read. */
		const jobs = [];
		text.split(/\r?\n/).forEach((raw, index) => {
			if (/^\s*#/.test(raw)) return;
			const line = raw.replace(/\s+#.*$/, '');
			if (/^jobs:\s*$/.test(line)) {
				inJobs = true;
				return;
			}
			if (inJobs) {
				const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
				if (header) {
					job = header[1];
					jobs.push({ name: job, line: index + 1, timeout: null, needs: null, always: false });
				} else if (/^ {4}timeout-minutes:/.test(line)) {
					jobs[jobs.length - 1].timeout = line.replace(/^ {4}timeout-minutes:\s*/, '').trim();
				} else if (/^ {4}needs:\s*\[.*\]\s*$/.test(line)) {
					jobs[jobs.length - 1].needs = line
						.replace(/^ {4}needs:\s*\[/, '')
						.replace(/\]\s*$/, '')
						.split(',')
						.map((n) => n.trim())
						.filter(Boolean);
				} else if (/^ {4}if:\s*always\(\)\s*$/.test(line)) {
					jobs[jobs.length - 1].always = true;
				} else if (/^\S/.test(line)) inJobs = false;
			}
			const where = `${name}${inJobs && job ? ` (job ${job})` : ''}, line ${index + 1}`;
			const inDeploy = name === DEPLOY_FILE && inJobs && job === DEPLOY_JOB;

			if (/secrets\./.test(line) && !inDeploy) {
				problems.push(
					`${where}: secrets may only be used in the job "${DEPLOY_JOB}" of ${DEPLOY_FILE}`
				);
			}
			const uses = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)/);
			if (uses && !uses[1].startsWith('./') && !FULL_COMMIT.test(uses[1])) {
				problems.push(`${where}: the action is not pinned to a full commit: ${uses[1]}`);
			}
			if (/^\s*actions:\s*write\b/.test(line) && name !== CLEANUP_FILE) {
				problems.push(`${where}: actions: write is only allowed in ${CLEANUP_FILE}`);
			}
			if (/^\s*contents:\s*write\b/.test(line)) {
				problems.push(`${where}: contents: write is not allowed`);
			}
			if (/pull_request_target/.test(line)) {
				problems.push(`${where}: pull_request_target is not allowed`);
			}
			if (inDeploy) {
				if (/pnpm\s+install/.test(line) && !/--ignore-scripts/.test(line)) {
					problems.push(`${where}: the deploy job must install with --ignore-scripts`);
				}
				if (BUILD_CODE.test(line)) {
					problems.push(`${where}: the deploy job must not run build code: ${line.trim()}`);
				}
			}
		});
		if (name === CI_FILE) {
			const gate = jobs.find((j) => j.name === GATE_JOB);
			if (!gate) {
				problems.push(
					`${CI_FILE}: the gate job "${GATE_JOB}" is missing (the ruleset requires it)`
				);
			} else {
				const where = `${CI_FILE} (job ${GATE_JOB}), line ${gate.line}`;
				const left = jobs
					.map((j) => j.name)
					.filter((n) => n !== GATE_JOB && n !== OWN_REQUIRED_JOB && !gate.needs?.includes(n));
				if (left.length > 0) {
					problems.push(
						`${where}: the gate must wait for every job (needs: [...]); it does not wait for ${left.join(', ')}`
					);
				}
				if (!gate.always) {
					problems.push(
						`${where}: the gate needs "if: always()": a skipped required check counts as passed`
					);
				}
			}
		}
		for (const { name: job, line, timeout } of jobs) {
			const where = `${name} (job ${job}), line ${line}`;
			if (timeout === null) {
				problems.push(
					`${where}: the job has no timeout-minutes (a stalled step would run for up to six hours)`
				);
			} else if (!/^\d+$/.test(timeout)) {
				problems.push(`${where}: timeout-minutes must be a number, not "${timeout}"`);
			} else if (Number(timeout) > MAX_TIMEOUT_MINUTES) {
				problems.push(
					`${where}: timeout-minutes is ${timeout}; it must be at most ${MAX_TIMEOUT_MINUTES}`
				);
			}
		}
	}
	return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const dir = new URL('../.github/workflows/', import.meta.url);
	const files = readdirSync(dir)
		.filter((name) => name.endsWith('.yml'))
		.map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
	const problems = checkWorkflows(files);
	for (const problem of problems) console.log(`FAIL ${problem}`);
	if (problems.length === 0) console.log(`ok   ${files.length} workflows follow the guard rails`);
	process.exit(problems.length === 0 ? 0 : 1);
}
