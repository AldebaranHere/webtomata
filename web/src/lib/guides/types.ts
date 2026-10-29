// Types for Panduan guides (G1). A guide file in content/guides/<id>.md has YAML frontmatter
// validated against content/guides/schema.json and a small Markdown body parsed into typed blocks
// at build time (never rendered with {@html}).

export type GuideTopic = 'dfsm' | 'ndfsm' | 'regex' | 'operasi';

export interface GuideText {
	id: string;
	en?: string;
}

export interface GuideFrontmatter {
	schemaVersion: 1;
	id: string;
	order: number;
	topic: GuideTopic;
	readingMinutes: number;
	cardTitle: GuideText;
	title: GuideText;
	summary: GuideText;
	references?: {
		rich?: string[];
		sipser?: string[];
	};
}

export interface InlinePiece {
	kind: 'text' | 'code';
	text: string;
}

export type GuideBlock =
	| { kind: 'paragraph'; pieces: InlinePiece[] }
	| { kind: 'ordered-list'; items: InlinePiece[][] }
	| { kind: 'unordered-list'; items: InlinePiece[][] };

export interface GuideSection {
	id: string;
	heading: string;
	blocks: GuideBlock[];
}

export interface Guide extends GuideFrontmatter {
	intro: InlinePiece[][];
	sections: GuideSection[];
}

export interface GuideProblem {
	path: string;
	message: string;
	line?: number;
}
