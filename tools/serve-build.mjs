// A static server for a build folder, gzipping like the real host does. Used by the Lighthouse
// check and the smoke test.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain'
};

/** Starts the server on a free port. Returns `{ origin, close }`. */
export async function serveBuild(dir) {
	const buildDir = resolve(dir);
	const server = createServer((req, res) => {
		let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
		let file = join(buildDir, path);
		if (!file.startsWith(buildDir)) return res.writeHead(403).end();
		if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
		if (!existsSync(file)) return res.writeHead(404).end();
		const type = TYPES[extname(file)] ?? 'application/octet-stream';
		res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip' });
		createReadStream(file).pipe(createGzip()).pipe(res);
	});
	await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
	return {
		origin: `http://127.0.0.1:${server.address().port}`,
		close: () => server.close()
	};
}
