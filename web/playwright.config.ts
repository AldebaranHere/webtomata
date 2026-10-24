// Browser tests (see docs/decisions/0018-playwright.md). They run on the production build, so
// build first: `pnpm --filter web build`. Chrome is the Chrome that is installed on the machine
// (set CHROME_PATH to use another one). Firefox and WebKit run only the small set in e2e/cross
// (docs/decisions/0022-cross-browser-tests.md); they are downloaded by Playwright with
// `pnpm exec playwright install firefox webkit`.
import { defineConfig, devices } from '@playwright/test';
import { PORT } from './e2e/global-setup.ts';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.spec.ts',
	globalSetup: './e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// One retry on CI, for Chrome that fails to start on a busy runner. More would hide flakes.
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		launchOptions: { executablePath: process.env.CHROME_PATH || undefined }
	},
	projects: [
		{
			name: 'desktop',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chrome',
				viewport: { width: 1440, height: 900 }
			}
		},
		{ name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
		// The other engines: the cross-browser set only. They never use the Chrome of CHROME_PATH.
		{
			name: 'firefox',
			testMatch: 'cross/**/*.spec.ts',
			use: {
				...devices['Desktop Firefox'],
				viewport: { width: 1440, height: 900 },
				launchOptions: { executablePath: undefined }
			}
		},
		{
			name: 'webkit-phone',
			testMatch: 'cross/**/*.spec.ts',
			use: { ...devices['iPhone 13'], launchOptions: { executablePath: undefined } }
		}
	]
});
