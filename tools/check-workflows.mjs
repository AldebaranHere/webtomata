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
// 7. CI fast path for documents: ci.yml has a scope job, every heavy job waits for scope and has
//    an if skipping when docs_only is true, and non-required workflows either have paths-ignore
//    matching the allowlist or positive paths containing no allowlisted entry (docs/decisions/0033).
// 8. `runs-on` is a pinned image (`ubuntu-24.04`), not a `-latest` label. GitHub moves `ubuntu-latest`
//    to a new Ubuntu on a date it chooses (to Ubuntu 26 from October 2026), and the system libraries
//    that Playwright installs for Firefox and WebKit may not exist there.
// 9. Write rights are narrow: only cleanup-caches.yml may have `actions: write` (it deletes the
//    caches of a closed pull request), and no workflow may have `contents: write`.
//
// The workflow files are read line by line, with no YAML library, so the files must keep the
// usual shape: `jobs:` at the left edge, and each job name indented by two spaces.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WORKFLOW_PATHS_IGNORE } from './docs-only.mjs';

const DEPLOY_FILE = 'deploy.yml';
const DEPLOY_JOB = 'deploy';
const FULL_COMMIT = /@[0-9a-f]{40}$/;
const MAX_TIMEOUT_MINUTES = 30;
const CLEANUP_FILE = 'cleanup-caches.yml';
const CI_FILE = 'ci.yml';
const GATE_JOB = 'web';
/** Required by the ruleset on its own, so the gate does not wait for it. */
const OWN_REQUIRED_JOB = 'rust';
const SCOPE_JOB = 'scope';
const HEAVY_JOBS = ['rust', 'checks', 'e2e', 'lighthouse', 'cross-browser'];
const DOCS_FILTERED_WORKFLOWS = ['codeql.yml', 'deploy.yml', 'audit.yml', 'fuzz.yml'];
/** Workflows that also scan on a push: that trigger must skip documents too (a merge of documents scans nothing new). */
const PUSH_FILTERED_WORKFLOWS = ['codeql.yml'];
const BUILD_CODE =
	/\b(pnpm\s+(--filter\s+\S+\s+)?(build|lint|test|check)\b|cargo\s|wasm-pack|vite\s)/;

/** `files` is a list of `{ name, text }`. Returns the list of problems; empty means all is well. */
export function checkWorkflows(files) {
	const problems = [];
	for (const { name, text } of files) {
		let inOn = false;
		let inPullRequest = false;
		let inPathsIgnore = false;
		let inPaths = false;
		const pathsIgnore = [];
		const positivePaths = [];
		let hasPullRequestTrigger = false;
		let inPush = false;
		let inPushIgnore = false;
		let hasPushTrigger = false;
		const pushPathsIgnore = [];

		let inJobs = false;
		let job = '';
		/** The jobs of this file, with the line of the header, timeout, needs, ifCondition, always. */
		const jobs = [];

		text.split(/\r?\n/).forEach((raw, index) => {
			if (/^\s*#/.test(raw)) return;
			const line = raw.replace(/\s+#.*$/, '');

			if (/^on:\s*$/.test(line)) {
				inOn = true;
				return;
			}
			if (/^jobs:\s*$/.test(line)) {
				inOn = false;
				inPullRequest = false;
				inPathsIgnore = false;
				inPaths = false;
				inPush = false;
				inPushIgnore = false;
				inJobs = true;
				return;
			}

			if (inOn) {
				if (/^ {2}pull_request:\s*$/.test(line)) {
					inPullRequest = true;
					hasPullRequestTrigger = true;
					inPathsIgnore = false;
					inPaths = false;
					inPush = false;
					inPushIgnore = false;
					return;
				}
				if (/^ {2}push:\s*$/.test(line)) {
					inPush = true;
					hasPushTrigger = true;
					inPushIgnore = false;
					inPullRequest = false;
					inPathsIgnore = false;
					inPaths = false;
					return;
				}
				if (inPush) {
					if (/^ {4}paths-ignore:\s*$/.test(line)) {
						inPushIgnore = true;
						return;
					}
					if (inPushIgnore) {
						const itemMatch = line.match(/^ {6}-\s*['"]?([^'"]+)['"]?\s*$/);
						if (itemMatch) {
							pushPathsIgnore.push(itemMatch[1]);
							return;
						}
						if (!/^\s*$/.test(line)) {
							inPushIgnore = false;
						}
					}
					if (/^ {2}[A-Za-z0-9_-]+:/.test(line) || /^\S/.test(line)) {
						inPush = false;
						inPushIgnore = false;
					}
				}
				if (inPullRequest) {
					if (/^ {4}paths-ignore:\s*$/.test(line)) {
						inPathsIgnore = true;
						inPaths = false;
						return;
					}
					if (/^ {4}paths:\s*$/.test(line)) {
						inPaths = true;
						inPathsIgnore = false;
						return;
					}
					if (inPathsIgnore) {
						const itemMatch = line.match(/^ {6}-\s*['"]?([^'"]+)['"]?\s*$/);
						if (itemMatch) {
							pathsIgnore.push(itemMatch[1]);
							return;
						}
						if (!/^\s*$/.test(line)) {
							inPathsIgnore = false;
						}
					}
					if (inPaths) {
						const itemMatch = line.match(/^ {6}-\s*['"]?([^'"]+)['"]?\s*$/);
						if (itemMatch) {
							positivePaths.push(itemMatch[1]);
							return;
						}
						if (!/^\s*$/.test(line)) {
							inPaths = false;
						}
					}
					if (/^ {2}[A-Za-z0-9_-]+:/.test(line) || /^\S/.test(line)) {
						inPullRequest = false;
						inPathsIgnore = false;
						inPaths = false;
					}
				}
			}

			if (inJobs) {
				const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
				if (header) {
					job = header[1];
					jobs.push({
						name: job,
						line: index + 1,
						timeout: null,
						needs: null,
						ifCondition: null,
						always: false,
						hasNoRenames: false,
					});
				} else if (/--no-renames/.test(line)) {
					jobs[jobs.length - 1].hasNoRenames = true;
				} else if (/^ {4}timeout-minutes:/.test(line)) {
					jobs[jobs.length - 1].timeout = line.replace(/^ {4}timeout-minutes:\s*/, '').trim();
				} else if (/^ {4}needs:\s*(.+)$/.test(line)) {
					const rawNeeds = line.replace(/^ {4}needs:\s*/, '').trim();
					if (rawNeeds.startsWith('[') && rawNeeds.endsWith(']')) {
						jobs[jobs.length - 1].needs = rawNeeds
							.slice(1, -1)
							.split(',')
							.map((n) => n.trim())
							.filter(Boolean);
					} else {
						jobs[jobs.length - 1].needs = [rawNeeds];
					}
				} else if (/^ {4}if:\s*(.+)$/.test(line)) {
					const cond = line.replace(/^ {4}if:\s*/, '').trim();
					jobs[jobs.length - 1].ifCondition = cond;
					if (cond === 'always()') {
						jobs[jobs.length - 1].always = true;
					}
				} else if (/^\S/.test(line)) {
					inJobs = false;
				}
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
			if (/^\s*runs-on:\s*\S*-latest\b/.test(line)) {
				problems.push(
					`${where}: runs-on must be a pinned image such as ubuntu-24.04, not ${line.trim().replace(/^runs-on:\s*/, '')}`
				);
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
			const scope = jobs.find((j) => j.name === SCOPE_JOB);
			if (!scope) {
				problems.push(`${CI_FILE}: the scope job "${SCOPE_JOB}" is missing`);
			} else if (!scope.hasNoRenames) {
				problems.push(
					`${CI_FILE} (job ${SCOPE_JOB}), line ${scope.line}: the scope diff command must include --no-renames`
				);
			}
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
			for (const heavyName of HEAVY_JOBS) {
				const heavyJob = jobs.find((j) => j.name === heavyName);
				if (heavyJob) {
					const where = `${CI_FILE} (job ${heavyName}), line ${heavyJob.line}`;
					if (!heavyJob.needs?.includes(SCOPE_JOB)) {
						problems.push(`${where}: heavy job must wait for ${SCOPE_JOB} (needs: ...)`);
					}
					if (heavyJob.ifCondition !== "needs.scope.outputs.docs_only != 'true'") {
						problems.push(
							`${where}: heavy job must have "if: needs.scope.outputs.docs_only != 'true'"`
						);
					}
				}
			}
		}

		if (DOCS_FILTERED_WORKFLOWS.includes(name) && hasPullRequestTrigger) {
			if (pathsIgnore.length > 0) {
				const match =
					pathsIgnore.length === WORKFLOW_PATHS_IGNORE.length &&
					pathsIgnore.every((p, idx) => p === WORKFLOW_PATHS_IGNORE[idx]);
				if (!match) {
					problems.push(
						`${name}: pull_request paths-ignore must match the docs-only allowlist exactly`
					);
				}
			} else if (positivePaths.length > 0) {
				for (const path of positivePaths) {
					if (
						WORKFLOW_PATHS_IGNORE.includes(path) ||
						path.startsWith('docs/') ||
						path.startsWith('design/') ||
						path.startsWith('.antigravity/')
					) {
						problems.push(
							`${name}: pull_request paths list must not include allowlisted docs path "${path}"`
						);
					}
				}
			} else {
				problems.push(
					`${name}: pull_request trigger must have paths-ignore equal to the allowlist or positive paths with no allowlisted entry`
				);
			}
		}

		if (PUSH_FILTERED_WORKFLOWS.includes(name) && hasPushTrigger) {
			const match =
				pushPathsIgnore.length === WORKFLOW_PATHS_IGNORE.length &&
				pushPathsIgnore.every((p, idx) => p === WORKFLOW_PATHS_IGNORE[idx]);
			if (!match) {
				problems.push(
					`${name}: push trigger must have paths-ignore equal to the docs-only allowlist (a merge of documents needs no scan)`
				);
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
