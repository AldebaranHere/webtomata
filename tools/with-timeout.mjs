// Small helpers for the checks that drive a browser (check-lighthouse.mjs). A call that waits for
// Chrome can hang when Chrome stops answering, with nothing to say so; in CI that held a job for 14
// minutes (the Lighthouse step of run 40344527053). A hard time limit and one try more, with a fresh
// Chrome, turn that into a delay of one minute. Tested in with-timeout.test.mjs.

export class TimeoutError extends Error {
	constructor(label, ms) {
		super(`${label} took more than ${ms} ms`);
		this.name = 'TimeoutError';
	}
}

/**
 * The value of `promise`, or a TimeoutError after `ms`. The promise is not stopped (nothing can
 * stop it from here), so whoever gives up on it must close what it waits for, and a later failure
 * of it is ignored: it must not crash the process that has already moved on.
 */
export function withTimeout(promise, ms, label) {
	let timer;
	const limit = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
	});
	promise.catch(() => {});
	return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Runs `run(attempt)` (attempts count from 1) until it works, at most `tries` times. After a
 * failure that is not the last, `onFail(error, attempt)` is awaited (to close and restart what
 * the failed try used). The last error is thrown.
 */
export async function retrying(run, { tries = 2, onFail = async () => {} } = {}) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await run(attempt);
		} catch (error) {
			if (attempt >= tries) throw error;
			await onFail(error, attempt);
		}
	}
}
