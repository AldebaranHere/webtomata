// Parses the Markdown body of a guide (content/guides/<id>.md) into typed blocks so the page
// renders plain text, <code>, <p>, <ol>, <ul> and <h2> without {@html}. Raw HTML tags (<script>,
// <div>, etc.) and unknown constructs are refused with their line number in the file.
import { FILE } from '#lib/questions/load.ts';
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
