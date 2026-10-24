// Serves the production build (web/build) for the browser tests, with the same server as the
// smoke test and the Lighthouse check. The port is fixed, so that the config can name it.
import { fileURLToPath } from 'node:url';
import { serveBuild } from '../../tools/serve-build.mjs';

export const PORT = 4599;

export default async function globalSetup() {
	const server = await serveBuild(fileURLToPath(new URL('../build', import.meta.url)), PORT);
	return () => server.close();
}
