// Parses the Markdown body of a guide (content/guides/<id>.md) into typed blocks so the page
// renders plain text, <code>, <p>, <ol>, <ul>, <h2> and <MachineEmbed> without {@html}. Raw HTML
// tags (<script>, <div>, etc.) and unknown constructs are refused with their line number in the file.
import { parseDocument } from 'yaml';
import { applyCommand } from '#lib/editor/commands.ts';
import type { Command } from '#lib/editor/commands.ts';
import { createDocument } from '#lib/editor/document.ts';
import { EXAMPLES, buildExample } from '#lib/examples/examples.ts';
import { FILE } from '#lib/questions/load.ts';
import { encodePlainLink } from '#lib/share/link.ts';
import type { GuideBlock, GuideProblem, GuideSection, InlinePiece } from './types.ts';

/** Turns a line or paragraph into plain text and `code` pieces. */
export function inlinePiecesOf(text: string): InlinePiece[] {
	const pieces: InlinePiece[] = [];
	let current = '';
	let i = 0;
	while (i < text.length) {
		if (text[i] === '`') {
			const end = text.indexOf('`', i + 1);
			if (end > i + 1) {
				if (current) pieces.push({ kind: 'text', text: current });
				current = '';
				pieces.push({ kind: 'code', text: text.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}
		current += text[i];
		i += 1;
	}
	if (current) pieces.push({ kind: 'text', text: current });
	return pieces;
}

/** Turns a heading into a slug when no `{#id}` is given. */
function slugOf(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** True when text outside backticks contains an HTML tag like `<script>` or `<div>`. */
function hasRawHtmlTag(line: string): boolean {
	for (const piece of inlinePiecesOf(line)) {
		if (piece.kind === 'text' && /<\/?[A-Za-z!][^>]*>/.test(piece.text)) return true;
	}
	return false;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function parseMachineBlock(
	yamlText: string,
	lineNo: number
): { block?: Extract<GuideBlock, { kind: 'machine' }>; problem?: GuideProblem } {
	const fail = (message: string): { problem: GuideProblem } => ({
		problem: { path: FILE, message, line: lineNo }
	});
	const doc = parseDocument(yamlText, { uniqueKeys: true });
	if (doc.errors.length > 0 || doc.warnings.length > 0) {
		const err = doc.errors[0] ?? doc.warnings[0]!;
		return fail(err.message.split('\n')[0]!);
	}
	let raw: unknown;
	try {
		raw = doc.toJS();
	} catch {
		return fail('machine block must be valid YAML without aliases');
	}
	if (!isRecord(raw)) return fail('machine block must be a YAML object');

	let caption: InlinePiece[] | undefined;
	if (raw.caption !== undefined) {
		if (!nonEmptyText(raw.caption)) return fail('machine block caption must be a non-empty string');
		if (hasRawHtmlTag(raw.caption)) return fail('raw HTML tags are not allowed in a guide');
		caption = inlinePiecesOf(raw.caption.trim());
	}

	if (raw.example !== undefined) {
		const keys = Object.keys(raw);
		if (!keys.every((k) => k === 'example' || k === 'caption')) {
			return fail('machine block with "example" may only have "example" and "caption"');
		}
		if (!nonEmptyText(raw.example)) return fail('machine block "example" must be a string id');
		const found = EXAMPLES.find((e) => e.id === raw.example);
		if (!found) return fail(`unknown example "${raw.example}"`);
		const built = buildExample(found, 'id');
		return {
			block: {
				kind: 'machine',
				doc: built.doc,
				openHref: `/sandbox?example=${found.id}`,
				...(caption ? { caption } : {})
			}
		};
	}

	const allowed = new Set([
		'title',
		'kind',
		'alphabet',
		'states',
		'start',
		'accepting',
		'transitions',
		'caption'
	]);
	for (const key of Object.keys(raw)) {
		if (!allowed.has(key)) return fail(`machine block has unknown field "${key}"`);
	}
	if (!nonEmptyText(raw.title)) return fail('machine block title must be a non-empty string');
	if (raw.kind !== 'dfsm' && raw.kind !== 'ndfsm') {
		return fail('machine block kind must be dfsm or ndfsm');
	}
	if (
		!Array.isArray(raw.alphabet) ||
		raw.alphabet.length === 0 ||
		!raw.alphabet.every(nonEmptyText)
	) {
		return fail('machine block alphabet must be a non-empty list of symbols');
	}
	if (!Array.isArray(raw.states) || raw.states.length === 0) {
		return fail('machine block states must be a non-empty list');
	}
	const names = new Set<string>();
	const index = new Map<string, number>();
	const states: { name: string; x: number; y: number }[] = [];
	for (const [idx, s] of raw.states.entries()) {
		if (
			!isRecord(s) ||
			!nonEmptyText(s.name) ||
			typeof s.x !== 'number' ||
			typeof s.y !== 'number'
		) {
			return fail(`machine block states[${idx}] must be { name, x, y }`);
		}
		if (names.has(s.name)) return fail(`machine block has duplicate state "${s.name}"`);
		names.add(s.name);
		index.set(s.name, idx);
		states.push({ name: s.name, x: s.x, y: s.y });
	}
	if (!nonEmptyText(raw.start) || !names.has(raw.start)) {
		return fail('machine block start must name a state');
	}
	if (
		!Array.isArray(raw.accepting) ||
		!raw.accepting.every((n): n is string => typeof n === 'string' && names.has(n))
	) {
		return fail('machine block accepting must be a list of state names');
	}
	if (!Array.isArray(raw.transitions)) return fail('machine block transitions must be a list');
	const commands: Command[] = [{ type: 'setTitle', title: raw.title }];
	if (raw.kind === 'ndfsm') commands.push({ type: 'setKind', kind: 'ndfsm' });
	for (const sym of raw.alphabet) commands.push({ type: 'addSymbol', symbol: sym });
	for (const { name, x, y } of states) commands.push({ type: 'addState', x, y, name });
	commands.push({ type: 'setStart', id: index.get(raw.start)! });
	for (const name of raw.accepting) {
		commands.push({ type: 'setAccepting', id: index.get(name)!, accepting: true });
	}
	for (const [idx, tr] of raw.transitions.entries()) {
		if (
			!isRecord(tr) ||
			typeof tr.from !== 'string' ||
			typeof tr.to !== 'string' ||
			!names.has(tr.from) ||
			!names.has(tr.to) ||
			(tr.on !== null && (typeof tr.on !== 'string' || !raw.alphabet.includes(tr.on)))
		) {
			return fail(
				`machine block transitions[${idx}] must be { from, on, to } with known states/symbols`
			);
		}
		commands.push({
			type: 'addTransition',
			from: index.get(tr.from)!,
			on: tr.on,
			to: index.get(tr.to)!
		});
	}
	const built = applyCommand(createDocument(), { type: 'batch', commands });
	if (!built.ok) return fail(`machine block is refused: ${built.error.key}`);
	return {
		block: {
			kind: 'machine',
			doc: built.doc,
			openHref: `/sandbox#${encodePlainLink(built.doc)}`,
			...(caption ? { caption } : {})
		}
	};
}

export interface MarkdownResult {
	intro: InlinePiece[][];
	sections: GuideSection[];
	problems: GuideProblem[];
}

/**
 * Parses the Markdown body of a guide. `startLine` is the 1-based line number in the file where
 * `body` starts (after the closing `---` of the frontmatter).
 */
export function parseGuideMarkdown(body: string, startLine = 1): MarkdownResult {
	const lines = body.replace(/\r\n?/g, '\n').split('\n');
	const intro: InlinePiece[][] = [];
	const sections: GuideSection[] = [];
	const problems: GuideProblem[] = [];
	const seenIds = new Set<string>();

	let currentSection: GuideSection | null = null;
	let paragraphLines: string[] = [];

	const flushParagraph = () => {
		if (paragraphLines.length === 0) return;
		const joined = paragraphLines.join(' ').trim();
		paragraphLines = [];
		if (!joined) return;
		const pieces = inlinePiecesOf(joined);
		if (currentSection) {
			currentSection.blocks.push({ kind: 'paragraph', pieces });
		} else {
			intro.push(pieces);
		}
	};

	let i = 0;
	while (i < lines.length) {
		const raw = lines[i]!;
		const trimmed = raw.trim();
		const lineNo = startLine + i;

		if (trimmed === '') {
			flushParagraph();
			i += 1;
			continue;
		}

		// Fenced machine embed: ```machine ... ``` inside a section.
		if (trimmed === '```machine') {
			flushParagraph();
			const fenceLine = lineNo;
			i += 1;
			const blockLines: string[] = [];
			let closed = false;
			while (i < lines.length) {
				if (lines[i]!.trim() === '```') {
					closed = true;
					i += 1;
					break;
				}
				blockLines.push(lines[i]!);
				i += 1;
			}
			if (!closed) {
				problems.push({
					path: FILE,
					message: 'unclosed ```machine block',
					line: fenceLine
				});
				continue;
			}
			if (!currentSection) {
				problems.push({
					path: FILE,
					message: 'machine blocks must appear inside a ## section',
					line: fenceLine
				});
				continue;
			}
			const parsed = parseMachineBlock(blockLines.join('\n'), fenceLine + 1);
			if (parsed.problem) {
				problems.push(parsed.problem);
			} else if (parsed.block) {
				currentSection.blocks.push(parsed.block);
			}
			continue;
		}

		if (hasRawHtmlTag(trimmed)) {
			problems.push({
				path: FILE,
				message: 'raw HTML tags are not allowed in a guide',
				line: lineNo
			});
			i += 1;
			continue;
		}

		if (/^#(?!#)\s+/.test(trimmed)) {
			problems.push({
				path: FILE,
				message: 'use ## for section headings (the page title comes from frontmatter)',
				line: lineNo
			});
			i += 1;
			continue;
		}

		const h2Match = trimmed.match(/^##\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?$/);
		if (h2Match) {
			flushParagraph();
			const heading = h2Match[1]!.trim();
			const id = h2Match[2] ?? slugOf(heading);
			if (!id) {
				problems.push({
					path: FILE,
					message: 'section heading must have a valid id',
					line: lineNo
				});
			} else if (seenIds.has(id)) {
				problems.push({
					path: FILE,
					message: `duplicate section id "${id}"`,
					line: lineNo
				});
			} else {
				seenIds.add(id);
			}
			currentSection = { id: id || `section-${sections.length + 1}`, heading, blocks: [] };
			sections.push(currentSection);
			i += 1;
			continue;
		}

		if (/^#{3,}\s+/.test(trimmed)) {
			problems.push({
				path: FILE,
				message: 'only ## section headings are supported in a guide',
				line: lineNo
			});
			i += 1;
			continue;
		}

		// Unordered list: consecutive `- item` lines inside a section.
		if (/^-\s+\S/.test(trimmed)) {
			flushParagraph();
			if (!currentSection) {
				problems.push({
					path: FILE,
					message: 'lists must appear inside a ## section',
					line: lineNo
				});
				i += 1;
				continue;
			}
			const items: InlinePiece[][] = [];
			while (i < lines.length) {
				const itemTrimmed = lines[i]!.trim();
				const m = itemTrimmed.match(/^-\s+(.+)$/);
				if (!m) break;
				if (hasRawHtmlTag(m[1]!)) {
					problems.push({
						path: FILE,
						message: 'raw HTML tags are not allowed in a guide',
						line: startLine + i
					});
				}
				items.push(inlinePiecesOf(m[1]!.trim()));
				i += 1;
			}
			const block: GuideBlock = { kind: 'unordered-list', items };
			currentSection.blocks.push(block);
			continue;
		}

		// Ordered list: consecutive `1. item` lines inside a section.
		if (/^\d+\.\s+\S/.test(trimmed)) {
			flushParagraph();
			if (!currentSection) {
				problems.push({
					path: FILE,
					message: 'lists must appear inside a ## section',
					line: lineNo
				});
				i += 1;
				continue;
			}
			const items: InlinePiece[][] = [];
			while (i < lines.length) {
				const itemTrimmed = lines[i]!.trim();
				const m = itemTrimmed.match(/^\d+\.\s+(.+)$/);
				if (!m) break;
				if (hasRawHtmlTag(m[1]!)) {
					problems.push({
						path: FILE,
						message: 'raw HTML tags are not allowed in a guide',
						line: startLine + i
					});
				}
				items.push(inlinePiecesOf(m[1]!.trim()));
				i += 1;
			}
			const block: GuideBlock = { kind: 'ordered-list', items };
			currentSection.blocks.push(block);
			continue;
		}

		paragraphLines.push(trimmed);
		i += 1;
	}

	flushParagraph();

	if (sections.length === 0) {
		problems.push({
			path: FILE,
			message: 'a guide must have at least one ## section',
			line: startLine
		});
	}
	for (const section of sections) {
		if (section.blocks.length === 0) {
			problems.push({
				path: FILE,
				message: `section "${section.heading}" must not be empty`
			});
		}
	}

	return { intro, sections, problems };
}
