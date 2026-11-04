import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Extracts the content of the top-level <type>...</type> tag from a JFLAP XML string,
 * or null if no such tag is present.
 */
export function jffType(text: string): string | null {
	const match = text.match(/<type>\s*([^<\s]+)\s*<\/type>/i);
	return match?.[1] ?? null;
}

function resolveFolderPath(folder: string | URL): string {
	if (folder instanceof URL) {
		return fileURLToPath(folder);
	}
	if (typeof folder === 'string' && folder.startsWith('file:')) {
		return fileURLToPath(folder);
	}
	return folder;
}

/**
 * Lists the `.jff` files directly in the given folder, partitioned into:
 * - `fa`: files whose `<type>` is `fa`
 * - `other`: files whose `<type>` is recognized but not `fa`
 *
 * Files that are not `.jff`, sub-directories, unreadable files, or files with no `<type>` tag
 * are silently ignored. Returns empty lists if the folder does not exist or is not a directory.
 */
export function localJffFiles(folder: string | URL): { fa: string[]; other: string[] } {
	const folderPath = resolveFolderPath(folder);
	if (!existsSync(folderPath)) {
		return { fa: [], other: [] };
	}

	try {
		const stat = statSync(folderPath);
		if (!stat.isDirectory()) {
			return { fa: [], other: [] };
		}
	} catch {
		return { fa: [], other: [] };
	}

	const fa: string[] = [];
	const other: string[] = [];

	let entries;
	try {
		entries = readdirSync(folderPath, { withFileTypes: true });
	} catch {
		return { fa: [], other: [] };
	}

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith('.jff')) {
			continue;
		}
		try {
			const fullPath = path.join(folderPath, entry.name);
			const content = readFileSync(fullPath, 'utf8');
			const type = jffType(content);
			if (type === 'fa') {
				fa.push(entry.name);
			} else if (type !== null) {
				other.push(entry.name);
			}
		} catch {
			// Damaged or unreadable files are ignored without throwing.
		}
	}

	fa.sort();
	other.sort();

	return { fa, other };
}

/**
 * Lists `.jff` files in the top level of the folder whose `<type>` is `fa`.
 * Returns an empty list if the folder is missing or has no finite automata.
 */
export function localFaFiles(folder: string | URL): string[] {
	return localJffFiles(folder).fa;
}

/**
 * Lists `.jff` files in the top level of the folder whose `<type>` is present and not `fa`.
 * Returns an empty list if the folder is missing or has no other .jff files.
 */
export function localOtherJffFiles(folder: string | URL): string[] {
	return localJffFiles(folder).other;
}
