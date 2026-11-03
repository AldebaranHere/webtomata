// Pure helper and CLI that determines if a list of changed paths (separated by NUL bytes)
// contains exclusively documentation and non-code root files (docs-only fast path).
// See docs/decisions/0033-docs-only-fast-path-in-ci.md.
import { pathToFileURL } from 'node:url';

export const ALLOWLIST_DIRS = ['docs/', 'design/', '.antigravity/'];

export const ALLOWLIST_ROOT_FILES = [
	'README.md',
	'CONTRIBUTING.md',
	'SECURITY.md',
	'AGENTS.md',
	'CLAUDE.md',
	'LICENSE',
];

export const WORKFLOW_PATHS_IGNORE = [
	'docs/**',
	'design/**',
	'.antigravity/**',
	...ALLOWLIST_ROOT_FILES,
];

/**
 * Checks if a single path is strictly within the allowed documentation scope.
 * Denies by default: whitespace, traversal, prefixes, backslashes, and anything outside the allowlist.
 */
export function isAllowedPath(path) {
	if (typeof path !== 'string' || path.length === 0) {
		return false;
	}
	// Untrusted input: disallow whitespace, newlines, carriage returns, or backslashes.
	if (/[\s\r\n\\]/.test(path)) {
		return false;
	}
	// Disallow directory traversal, root paths, or explicit current-directory prefixes.
	if (path.startsWith('/') || path.startsWith('./') || /(^|\/)\.\.(\/|$)/.test(path)) {
		return false;
	}
	// Disallow consecutive duplicate slashes.
	if (path.includes('//')) {
		return false;
	}

	if (ALLOWLIST_ROOT_FILES.includes(path)) {
		return true;
	}

	for (const dir of ALLOWLIST_DIRS) {
		if (path.startsWith(dir) && path.length > dir.length) {
			return true;
		}
	}

	return false;
}

/**
 * Splits a NUL-separated string from git diff -z into individual paths.
 */
export function parseNullSeparatedPaths(raw) {
	if (typeof raw !== 'string' || raw.length === 0) return [];
	const trimmed = raw.endsWith('\0') ? raw.slice(0, -1) : raw;
	if (trimmed.length === 0) return [];
	return trimmed.split('\0');
}

/**
 * Returns true if paths is non-empty and every path is in the allowlist.
 */
export function isDocsOnly(paths) {
	if (!Array.isArray(paths) || paths.length === 0) {
		return false;
	}
	return paths.every(isAllowedPath);
}

/**
 * CLI runner reading stdin to EOF.
 */
async function main() {
	try {
		let data = '';
		for await (const chunk of process.stdin) {
			data += chunk;
		}
		const paths = parseNullSeparatedPaths(data);
		const result = isDocsOnly(paths);
		process.stdout.write(result ? 'true\n' : 'false\n');
	} catch {
		process.stdout.write('false\n');
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await main();
}
