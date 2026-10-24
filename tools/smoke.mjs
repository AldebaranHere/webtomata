// Smoke test: opens the page in headless Chrome and checks that the app runs. The home page shows
// the engine version once the worker has loaded the WASM module, so a broken script, worker,
// WASM file or CSP shows up as a missing version, an error in the console, a failed request or a
// bad response. Chrome is controlled with the DevTools protocol (tools/cdp.mjs).
//
// Usage: node tools/smoke.mjs <url>          (a deployed site)
//        node tools/smoke.mjs --build <dir>  (a build folder, served locally)
import { launchChrome } from './chrome.mjs';
import { connect } from './cdp.mjs';
import { judge } from './smoke-judge.mjs';
import { serveBuild } from './serve-build.mjs';

const TIMEOUT_MS = 30_000;
const VERSION_ON_PAGE = "document.querySelector('.version code')?.textContent ?? ''";

async function smoke(url) {
	const chrome = await launchChrome();
	try {
		const targets = await (await fetch(`http://127.0.0.1:${chrome.port}/json/list`)).json();
		const page = targets.find((t) => t.type === 'page');
		const cdp = await connect(page.webSocketDebuggerUrl);

		const seen = { consoleErrors: [], exceptions: [], failedRequests: [], badResponses: [] };
		const requests = new Map();
		cdp.on('Runtime.consoleAPICalled', (e) => {
			if (e.type === 'error') seen.consoleErrors.push(e.args.map((a) => a.value ?? a.description).join(' '));
		});
		cdp.on('Runtime.exceptionThrown', (e) => {
			const d = e.exceptionDetails;
			seen.exceptions.push(d.exception?.description ?? d.text);
		});
		// Errors of the browser itself (for example a CSP violation). Failed loads are also
		// reported below, so they are not counted twice.
		cdp.on('Log.entryAdded', ({ entry }) => {
			if (entry.level === 'error' && entry.source !== 'network') seen.consoleErrors.push(entry.text);
		});
		cdp.on('Network.requestWillBeSent', (e) => requests.set(e.requestId, e.request.url));
		cdp.on('Network.loadingFailed', (e) =>
			seen.failedRequests.push({
				url: requests.get(e.requestId) ?? e.requestId,
				reason: e.blockedReason ? `${e.errorText}, blocked: ${e.blockedReason}` : e.errorText,
				canceled: e.canceled === true
			})
		);
		cdp.on('Network.responseReceived', ({ response }) => {
			if (response.status >= 400) seen.badResponses.push({ url: response.url, status: response.status });
		});
		for (const domain of ['Network', 'Runtime', 'Log', 'Page']) await cdp.send(`${domain}.enable`);

		await cdp.send('Page.navigate', { url });
		let version = '';
		const deadline = Date.now() + TIMEOUT_MS;
		while (Date.now() < deadline) {
			const { result } = await cdp.send('Runtime.evaluate', {
				expression: VERSION_ON_PAGE,
				returnByValue: true
			});
			version = result.value;
			if (/^\d+\.\d+\.\d+/.test(version)) break;
			await new Promise((ok) => setTimeout(ok, 250));
		}
		// Give late errors a moment to arrive.
		await new Promise((ok) => setTimeout(ok, 500));
		cdp.close();
		return { version, ...seen };
	} finally {
		await chrome.kill();
	}
}

const args = process.argv.slice(2);
let url = args[0];
let local;
if (args[0] === '--build') {
	local = await serveBuild(args[1] ?? 'web/build');
	url = `${local.origin}/`;
}
if (!url) {
	console.error('usage: node tools/smoke.mjs <url> | --build <dir>');
	process.exit(2);
}

let problems;
try {
	const result = await smoke(url);
	problems = judge(result);
	if (problems.length === 0) console.log(`ok   ${url} shows engine version ${result.version}`);
} finally {
	local?.close();
}
for (const problem of problems) console.log(`FAIL ${problem}`);
process.exit(problems.length === 0 ? 0 : 1);
