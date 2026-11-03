// Evaluates the result of the CI gate (the `web` job) in `.github/workflows/ci.yml`.
// Takes the `needs` object and the value of `docs_only`.
// Exits with 0 (pass) or 1 (fail).
// See docs/decisions/0033-docs-only-fast-path-in-ci.md.
import { pathToFileURL } from 'node:url';

/**
 * Pure function evaluating the gate decision.
 * Returns { ok: boolean, reason: string }.
 */
export function evaluateCiGate(input) {
	if (!input || typeof input !== 'object') {
		return { ok: false, reason: 'Invalid or missing input' };
	}

	const { docsOnly, needs } = input;
	const isDocsOnly = docsOnly === true || docsOnly === 'true';

	if (!needs || typeof needs !== 'object' || Array.isArray(needs)) {
		return { ok: false, reason: 'Invalid or missing needs context' };
	}

	const entries = Object.entries(needs);
	if (entries.length === 0) {
		return { ok: false, reason: 'Empty needs context' };
	}

	const getResult = (jobObj) => {
		if (typeof jobObj === 'string') return jobObj;
		if (jobObj && typeof jobObj === 'object' && typeof jobObj.result === 'string') {
			return jobObj.result;
		}
		return null;
	};

	const scopeResult = getResult(needs.scope);
	if (!scopeResult) {
		return { ok: false, reason: 'Missing scope job in needs' };
	}
	if (scopeResult !== 'success') {
		return { ok: false, reason: `Scope job did not succeed (${scopeResult})` };
	}

	const heavyEntries = entries.filter(([name]) => name !== 'scope');
	if (heavyEntries.length === 0) {
		return { ok: false, reason: 'No heavy jobs found in needs context' };
	}

	for (const [name, jobObj] of heavyEntries) {
		const result = getResult(jobObj);
		if (!result) {
			return { ok: false, reason: `Job "${name}" has missing or invalid result` };
		}
		if (result === 'failure' || result === 'cancelled') {
			return { ok: false, reason: `Job "${name}" did not succeed (${result})` };
		}
		if (result !== 'success' && result !== 'skipped') {
			return { ok: false, reason: `Job "${name}" has unexpected result (${result})` };
		}
		if (!isDocsOnly && result === 'skipped') {
			return { ok: false, reason: `Job "${name}" was skipped, but docs_only is false` };
		}
	}

	return { ok: true, reason: 'All required jobs succeeded or were legitimately skipped' };
}

async function main() {
	let docsOnly = process.env.DOCS_ONLY;
	let needsJson = process.env.NEEDS_JSON;

	for (let i = 2; i < process.argv.length; i++) {
		if (process.argv[i] === '--docs-only' && i + 1 < process.argv.length) {
			docsOnly = process.argv[++i];
		} else if (process.argv[i] === '--needs-json' && i + 1 < process.argv.length) {
			needsJson = process.argv[++i];
		}
	}

	let needs = null;
	try {
		if (needsJson) {
			needs = JSON.parse(needsJson);
		}
	} catch (err) {
		console.error(`ci-gate: failed to parse NEEDS_JSON: ${err.message}`);
		process.exit(1);
	}

	const evaluation = evaluateCiGate({ docsOnly, needs });
	if (!evaluation.ok) {
		console.error(`ci-gate: FAIL - ${evaluation.reason}`);
		process.exit(1);
	}
	console.log(`ci-gate: OK - ${evaluation.reason}`);
	process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await main();
}
