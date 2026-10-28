// Run with `node --test "tools/*.test.mjs"`. Tests for the local static server (tools/serve-build.mjs),
// which serves the prerendered site for Lighthouse, the smoke test and Playwright.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveBuild } from './serve-build.mjs';

function rawStatus(origin, path) {
	const { hostname, port } = new URL(origin);
	return new Promise((resolve, reject) => {
		const req = httpRequest({ hostname, port, path, method: 'GET' }, (res) => {
			res.resume();
			resolve(res.statusCode);
		});
		req.on('error', reject);
		req.end();
	});
}

function makeTempBuild() {
	const root = mkdtempSync(join(tmpdir(), 'webtomata-serve-'));
	const dir = join(root, 'build');
	const sibling = join(root, 'build-secret');
	mkdirSync(dir);
	mkdirSync(sibling);
	mkdirSync(join(dir, 'soal'));
	mkdirSync(join(dir, 'folder'));
	writeFileSync(join(dir, 'index.html'), '<h1>Home</h1>');
	writeFileSync(join(dir, 'soal.html'), '<h1>Soal list</h1>');
	writeFileSync(join(dir, 'soal', '__data.json'), '{"ok":true}');
	writeFileSync(join(dir, 'folder', 'index.html'), '<h1>Folder index</h1>');
	writeFileSync(join(sibling, 'secret.txt'), 'do not read');
	return {
		dir,
		cleanup: () => rmSync(root, { recursive: true, force: true })
	};
}

test('serves index.html at /, soal.html at /soal even when soal/ exists, and 404 for a missing route', async () => {
	const { dir, cleanup } = makeTempBuild();
	const { origin, close } = await serveBuild(dir);
	try {
		const home = await fetch(`${origin}/`);
		assert.equal(home.status, 200);
		assert.match(home.headers.get('content-type') ?? '', /text\/html/);
		assert.equal(await home.text(), '<h1>Home</h1>');

		const soal = await fetch(`${origin}/soal`);
		assert.equal(soal.status, 200);
		assert.equal(await soal.text(), '<h1>Soal list</h1>');

		const folder = await fetch(`${origin}/folder`);
		assert.equal(folder.status, 200);
		assert.equal(await folder.text(), '<h1>Folder index</h1>');

		const data = await fetch(`${origin}/soal/__data.json`);
		assert.equal(data.status, 200);
		assert.match(data.headers.get('content-type') ?? '', /application\/json/);
		assert.equal(await data.text(), '{"ok":true}');

		const missing = await fetch(`${origin}/nope`);
		assert.equal(missing.status, 404);
	} finally {
		close();
		cleanup();
	}
});

test('refuses path traversal and sibling folders whose name starts with the build folder name', async () => {
	const { dir, cleanup } = makeTempBuild();
	const { origin, close } = await serveBuild(dir);
	try {
		for (const escaped of [
			'/../build-secret/secret.txt',
			'/..%2fbuild-secret/secret.txt',
			'/%2e%2e%5cbuild-secret%5csecret.txt'
		]) {
			assert.equal(await rawStatus(origin, escaped), 403, escaped);
		}
		assert.equal(await rawStatus(origin, '/%E0%A4%A'), 400);
	} finally {
		close();
		cleanup();
	}
});
