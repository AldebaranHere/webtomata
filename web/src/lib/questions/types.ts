// A question, as it is written in content/questions/<id>.yaml (see schema.json, which is the
// contract that CI checks). The types are written by hand; question.test.ts checks that a file
// with every field passes the schema and has exactly these fields. Erasable syntax only (no enum,
// no parameter properties), so that Node can run these files directly (tools/check-questions.mjs).

/** Text in Indonesian, with an optional English version. */
export interface Text {
	id: string;
	en?: string;
}

export type QuestionType = 'build-dfsm' | 'build-ndfsm' | 'write-regex';

export interface Constraints {
	/** The most states that an answer may have. */
	maxStates?: number;
	/** build-dfsm: every state has a transition on every symbol. Default true. */
	complete?: boolean;
	/** build-dfsm: the answer has as many states as the minimal DFSM. Needs complete. */
	minimal?: boolean;
	/** build-ndfsm: ε-transitions are allowed. Default true. */
	allowEpsilon?: boolean;
}

/** A machine in the short form: transitions are written "from symbol to". */
export interface SolutionMachine {
	/** The names of the states. Without it, the states are those that the other fields mention. */
	states?: string[];
	start: string;
	accepting: string[];
	transitions: string[];
}

export interface Question {
	schemaVersion: 1;
	id: string;
	/** The title in both languages: the page shows the one of the language that is active. */
	title: { id: string; en: string };
	statement: Text;
	type: QuestionType;
	alphabet: string[];
	constraints?: Constraints;
	/** 1 mudah, 2 sedang, 3 sulit */
	difficulty: 1 | 2 | 3;
	/** The week of the syllabus, 1 to 14. */
	week: number;
	/** The name of the guide that teaches the pattern of this question. */
	pattern: string;
	references?: { rich?: string[]; sipser?: string[] };
	hints?: Text[];
	examples: { accept: string[]; reject: string[] };
	/** A regular expression for write-regex, a machine in the short form for the other types. */
	solution: string | SolutionMachine;
}

/** A problem in a question file. `path` names the field, for example `solution.transitions[2]`. */
export interface Problem {
	path: string;
	message: string;
	/** The line in the file, when the problem can be placed. */
	line?: number;
}
