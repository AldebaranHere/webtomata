// Starts headless Chrome for the Lighthouse check and the smoke test.
import { launch } from 'chrome-launcher';

// Chrome sometimes does not open its debugging port on a busy CI runner (it timed out once on
// a green commit). --disable-dev-shm-usage avoids the small /dev/shm of runners. Try a few
// times, and fail with the last error.
export async function launchChrome() {
	const flags = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];
	for (let attempt = 1; ; attempt++) {
		try {
			return await launch({ chromeFlags: flags });
		} catch (error) {
			if (attempt === 3) throw error;
			console.log(`Chrome did not start (attempt ${attempt} of 3): ${error.message}`);
		}
	}
}
