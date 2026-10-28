// Reads a guide file in content/guides/<id>.md: splits YAML frontmatter and Markdown body,
// validates the frontmatter against content/guides/schema.json, and parses the body into typed
// blocks. A file that breaks a rule fails the build with its name and line.
import { LineCounter, parseDocument, visit } from 'yaml';
import { FILE, MAX_FILE_BYTES } from '#lib/questions/load.ts';
import type { SchemaValidator } from '#lib/questions/load.ts';
import { parseGuideMarkdown } from './markdown.ts';
import type { Guide, GuideFrontmatter, GuideProblem } from './types.ts';

export interface GuideParseResult {
	guide?: Guide;
	problems: GuideProblem[];
}

function splitFrontmatter(
	text: string
): { yamlText: string; bodyText: string; bodyStartLine: number } | null {
	const normalized = text.replace(/\r\n?/g, '\n');
	if (!normalized.startsWith('---\n')) return null;
	const endIdx = normalized.indexOf('\n---\n', 4);
	if (endIdx < 0) return null;
	const yamlText = normalized.slice(4, endIdx);
	const bodyText = normalized.slice(endIdx + 5);
	const yamlLines = yamlText === '' ? 0 : yamlText.split('\n').length;
	// Line 1 is `---`, lines 2..(yamlLines+1) are yamlText, line (yamlLines+2) is `---`, body starts at yamlLines+3.
	return { yamlText, bodyText, bodyStartLine: yamlLines + 3 };
}

export function parseGuideFile(text: string, validate: SchemaValidator): GuideParseResult {
	if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) {
		return {
			problems: [{ path: FILE, message: `the file is bigger than ${MAX_FILE_BYTES / 1024} KB` }]
		};
	}

	const split = splitFrontmatter(text);
	if (!split) {
		return {
			problems: [
				{
					path: FILE,
					message: 'a guide must start with YAML frontmatter between --- lines',
					line: 1
				}
			]
		};
	}

	const counter = new LineCounter();
	const doc = parseDocument(split.yamlText, {
		schema: 'failsafe',
		uniqueKeys: true,
		lineCounter: counter
	});
	const problems: GuideProblem[] = [];
	for (const error of [...doc.errors, ...doc.warnings]) {
		problems.push({
			path: FILE,
			message: error.message.split('\n')[0]!.replace(/ at line \d+, column \d+:?$/, ''),
			line: error.linePos?.[0].line !== undefined ? error.linePos[0].line + 1 : undefined
		});
	}
	if (problems.length > 0) return { problems };

	let aliased = false;
	visit(doc, {
		Alias: () => {
			aliased = true;
			return visit.BREAK;
		},
		Node: (_key, node) => {
			if ((node as { anchor?: string }).anchor) {
				aliased = true;
				return visit.BREAK;
			}
		}
	});
	if (aliased) {
		return {
			problems: [
				{
					path: FILE,
					message: 'anchors and aliases (&name, *name) are not allowed in a guide file'
				}
			]
		};
	}

	let data: unknown;
	try {
		data = doc.toJS();
	} catch {
		return {
			problems: [
				{
					path: FILE,
					message: 'anchors and aliases (&name, *name) are not allowed in a guide file'
				}
			]
		};
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return {
			problems: [{ path: FILE, message: 'frontmatter must be a set of fields (key: value)' }]
		};
	}

	for (const err of validate(data)) {
		const path = err.instancePath.split('/').filter(Boolean).join('.') || FILE;
		const params = err.params as Record<string, unknown>;
		const missing = params.missingProperty ? String(params.missingProperty) : undefined;
		const extra = params.additionalProperty ? String(params.additionalProperty) : undefined;
		const fullPath = missing
			? path === FILE
				? missing
				: `${path}.${missing}`
			: extra
				? path === FILE
					? extra
					: `${path}.${extra}`
				: path;
		problems.push({
			path: fullPath,
			message: missing
				? 'is required'
				: extra
					? 'is not a known field'
					: (err.message ?? 'is not valid')
		});
	}
	if (problems.length > 0) return { problems };

	const md = parseGuideMarkdown(split.bodyText, split.bodyStartLine);
	if (md.problems.length > 0) return { problems: md.problems };

	const frontmatter = data as GuideFrontmatter;
	return {
		guide: {
			...frontmatter,
			intro: md.intro,
			sections: md.sections
		},
		problems: []
	};
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/**
 * Loads and validates all guide files (`{ path: rawMarkdown }`). Files starting with `_` are
 * skipped as templates. Throws one Error listing every problem if any file is invalid.
 */
export function loadGuides(
	files: Readonly<Record<string, string>>,
	validate: SchemaValidator
): Guide[] {
	const names = Object.keys(files)
		.filter((path) => !baseName(path).startsWith('_'))
		.sort((a, b) => (baseName(a) < baseName(b) ? -1 : baseName(a) > baseName(b) ? 1 : 0));
	const found: string[] = [];
	const guides: Guide[] = [];
	const owners = new Map<string, string>();
	for (const path of names) {
		const name = baseName(path);
		const { guide, problems } = parseGuideFile(files[path]!, validate);
		for (const p of problems) {
			const where = p.line === undefined ? name : `${name}:${p.line}`;
			found.push(`${where}: ${p.path === FILE ? '' : `${p.path}: `}${p.message}`);
		}
		if (!guide) continue;
		const expected = name.replace(/\.md$/, '');
		if (guide.id !== expected) {
			found.push(`${name}: id: the id "${guide.id}" must be the name of the file (${expected})`);
			continue;
		}
		const other = owners.get(guide.id);
		if (other !== undefined) {
			found.push(`${name}: id: the id "${guide.id}" is also used by ${other}`);
			continue;
		}
		owners.set(guide.id, name);
		guides.push(guide);
	}
	if (found.length > 0) {
		throw new Error(
			`The guide files have problems:\n${found.map((line) => `  ${line}`).join('\n')}`
		);
	}
	return guides.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
