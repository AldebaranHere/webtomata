// Decides whether what Chrome reported while the page loaded is a pass. Pure code, so it can be
// tested without a browser (tools/smoke-judge.test.mjs).

/** The engine version that the home page shows once the worker and the WASM module have loaded. */
const VERSION = /^\d+\.\d+\.\d+/;

/**
 * Returns the list of problems; an empty list means the page works.
 * `canceled` on a failed request means that the page itself stopped it (for example when it
 * navigates), which is not a failure.
 */
export function judge({ version, consoleErrors, exceptions, failedRequests, badResponses }) {
	const problems = [];
	if (typeof version !== 'string' || !VERSION.test(version)) {
		problems.push(`the engine version did not appear on the page (found: ${JSON.stringify(version)})`);
	}
	for (const message of consoleErrors) problems.push(`console error: ${message}`);
	for (const message of exceptions) problems.push(`uncaught exception: ${message}`);
	for (const { url, reason, canceled } of failedRequests) {
		if (!canceled) problems.push(`request failed: ${url} (${reason})`);
	}
	for (const { url, status } of badResponses) problems.push(`bad response: ${url} (status ${status})`);
	return problems;
}
