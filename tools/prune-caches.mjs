// Pure cache-pruning selector and CLI for `.github/workflows/cleanup-caches.yml`.
// Removes superseded caches per (ref, key family) while leaving pull-request caches
// and unknown key prefixes untouched. See docs/decisions/0068-prune-superseded-caches.md.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const KNOWN_PREFIXES = [
	'v0-rust-',
	'node-cache-',
	'playwright-',
	'codeql-overlay-base-database-',
];
const CODEQL_PREFIX = 'codeql-overlay-base-database-';
const DEFAULT_MAX_DELETIONS = 50;
const MB = 1_000_000;

/**
 * Derives a cache's family name.
 * For CodeQL overlay keys, removes everything from the first `-` followed by exactly 40 hex digits.
 * For all other keys, strips trailing hash segments (`-` followed by 8 or more hex digits) repeatedly.
 */
export function cacheFamily(key) {
	if (key.startsWith(CODEQL_PREFIX)) {
		return key.replace(/-[0-9a-fA-F]{40}(?:-.*)?$/, '');
	}
	return key.replace(/(?:-[0-9a-fA-F]{8,})+$/, '');
}

function isKnownPrefix(key) {
	return KNOWN_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isPullRequestRef(ref) {
	return typeof ref === 'string' && ref.startsWith('refs/pull/');
}

function compareNewestFirst(a, b) {
	const ta = Date.parse(a.createdAt);
	const tb = Date.parse(b.createdAt);
	if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
		return tb - ta;
	}
	if (a.createdAt !== b.createdAt) {
		return a.createdAt < b.createdAt ? 1 : -1;
	}
	return Number(b.id) - Number(a.id);
}

/**
 * Selects superseded caches to delete per (ref, family).
 * Keeps the newest 1 per family (newest 2 for CodeQL overlay), ignores `refs/pull/*`
 * and unknown key prefixes, and caps deletions at `maxDeletions` (oldest first).
 */
export function pickCachesToDelete(caches, options = {}) {
	const maxDeletions = options.maxDeletions ?? DEFAULT_MAX_DELETIONS;
	const leftAlone = [];
	const groups = new Map();
	let totalBeforeBytes = 0;

	for (const cache of caches) {
		totalBeforeBytes += Number(cache.sizeInBytes) || 0;
		if (isPullRequestRef(cache.ref) || !isKnownPrefix(cache.key)) {
			leftAlone.push(cache);
			continue;
		}
		const family = cacheFamily(cache.key);
		const groupKey = `${cache.ref}\0${family}`;
		let list = groups.get(groupKey);
		if (!list) {
			list = { ref: cache.ref, family, items: [] };
			groups.set(groupKey, list);
		}
		list.items.push(cache);
	}

	const kept = [];
	const candidates = [];

	for (const group of groups.values()) {
		const sorted = [...group.items].sort(compareNewestFirst);
		const keepCount = group.family.startsWith(CODEQL_PREFIX) ? 2 : 1;
		kept.push(...sorted.slice(0, keepCount));
		candidates.push(...sorted.slice(keepCount));
	}

	// Oldest first when applying the per-run deletion cap.
	candidates.sort((a, b) => compareNewestFirst(b, a));
	const totalDeletable = candidates.length;
	const capped = totalDeletable > maxDeletions;
	const toDelete = capped ? candidates.slice(0, maxDeletions) : candidates;
	const deferred = capped ? candidates.slice(maxDeletions) : [];
	const allKept = [...kept, ...deferred];

	const toDeleteIds = new Set(toDelete.map((c) => c.id));
	const families = [];
	for (const group of groups.values()) {
		let groupKept = 0;
		let groupDeleted = 0;
		let groupFreedBytes = 0;
		for (const item of group.items) {
			if (toDeleteIds.has(item.id)) {
				groupDeleted++;
				groupFreedBytes += Number(item.sizeInBytes) || 0;
			} else {
				groupKept++;
			}
		}
		families.push({
			ref: group.ref,
			family: group.family,
			kept: groupKept,
			deleted: groupDeleted,
			freedBytes: groupFreedBytes,
		});
	}
	families.sort((a, b) => a.ref.localeCompare(b.ref) || a.family.localeCompare(b.family));

	const freedBytes = toDelete.reduce((sum, c) => sum + (Number(c.sizeInBytes) || 0), 0);
	const totalAfterBytes = totalBeforeBytes - freedBytes;

	return {
		toDelete,
		kept: allKept,
		leftAlone,
		families,
		capped,
		totalDeletable,
		freedBytes,
		totalBeforeBytes,
		totalAfterBytes,
	};
}

function formatMb(bytes) {
	return (bytes / MB).toFixed(1);
}

function formatSummary(plan, { dryRun }) {
	const actionCol = dryRun ? 'Would delete' : 'Deleted';
	const lines = [
		dryRun ? '## Cache pruning (dry run)' : '## Cache pruning',
		'',
		`| Ref | Family | Kept | ${actionCol} | Freed (MB) |`,
		'| --- | --- | ---: | ---: | ---: |',
	];

	for (const row of plan.families) {
		lines.push(
			`| \`${row.ref}\` | \`${row.family}\` | ${row.kept} | ${row.deleted} | ${formatMb(row.freedBytes)} |`
		);
	}

	const leftAloneBytes = plan.leftAlone.reduce((sum, c) => sum + (Number(c.sizeInBytes) || 0), 0);
	lines.push('');
	lines.push(`- Left alone: ${plan.leftAlone.length} caches (${formatMb(leftAloneBytes)} MB)`);
	if (plan.capped) {
		lines.push(
			`- Capped: deleting oldest ${plan.toDelete.length} of ${plan.totalDeletable} deletable caches (limit ${DEFAULT_MAX_DELETIONS} per run)`
		);
	}
	lines.push(`- Total before: ${formatMb(plan.totalBeforeBytes)} MB`);
	lines.push(
		`- ${dryRun ? 'Would free' : 'Freed'}: ${formatMb(plan.freedBytes)} MB (${plan.toDelete.length} caches)`
	);
	lines.push(`- Total after: ${formatMb(plan.totalAfterBytes)} MB`);
	lines.push('');

	return lines.join('\n');
}

function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';

	const raw = execFileSync(
		'gh',
		[
			'cache',
			'list',
			'--limit',
			'1000',
			'--json',
			'id,key,ref,sizeInBytes,createdAt,lastAccessedAt',
		],
		{ encoding: 'utf8' }
	);
	const caches = JSON.parse(raw || '[]');
	const plan = pickCachesToDelete(caches);
	const summary = formatSummary(plan, { dryRun });

	process.stdout.write(summary);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
	}

	if (dryRun) {
		return;
	}

	const failures = [];
	for (const cache of plan.toDelete) {
		try {
			execFileSync('gh', ['cache', 'delete', String(cache.id)], { encoding: 'utf8' });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			failures.push({ id: cache.id, key: cache.key, message });
			process.stderr.write(`Failed to delete cache ${cache.id} (${cache.key}): ${message}\n`);
		}
	}

	if (failures.length > 0) {
		process.stderr.write(`${failures.length} cache deletion(s) failed.\n`);
		process.exit(1);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main();
}
