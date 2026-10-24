// Reads a question file: the YAML, then the schema (content/questions/schema.json). It tells what
// is wrong in words that an author can use, with the line of the field when it can.
//
// A question file is read as text: every value is a string, so that an unquoted `0110` (an
// example) or `yes` (a symbol) stays what the author wrote. The schema then reads the numbers
// and the true or false that it asks for (`coerceTypes`). Anchors, aliases and tags are refused.
// Erasable TypeScript only, because tools/check-questions.mjs imports this file.
import { Ajv } from 'ajv';
import type { ErrorObject } from 'ajv';
import { LineCounter, parseDocument, visit } from 'yaml';
import type { Document } from 'yaml';
import type { Problem, Question } from './types.ts';

export const MAX_FILE_BYTES = 64 * 1024;
/** The path of a problem that belongs to the whole file. */
export const FILE = '(file)';

/** Checks a value against the schema. It changes the value: text becomes number or boolean. */
export type SchemaValidator = (data: unknown) => ErrorObject[];

export function createSchemaValidator(schema: object): SchemaValidator {
	const ajv = new Ajv({ allErrors: true, coerceTypes: true, strict: true, strictTypes: false });
	const validate = ajv.compile(schema);
	return (data) => {
		validate(data);
		return validate.errors ?? [];
	};
}

// ---- turning the errors of the schema into sentences ----

const KINDS: Record<string, string> = {
	string: 'text',
	integer: 'a whole number',
	number: 'a number',
	boolean: 'true or false',
	array: 'a list',
	object: 'a set of fields (key: value)'
};

/** What to say about a pattern that does not match. The key is the pattern of the schema. */
const FORMATS: Record<string, string> = {
	'^[a-z0-9]+(-[a-z0-9]+)*$':
		'use lowercase letters, digits and single hyphens, for example "berakhiran-10"',
	'^[^\\s,ε\\p{Cc}]{1,32}$': 'a symbol has 1 to 32 characters, and no space, comma or ε',
	'^[^\\s,]{1,32}$': 'a state name has 1 to 32 characters, and no space or comma',
	'^[0-9]+(\\.[0-9]+)*$': 'write a section number, for example "5.2"'
};

/** `/solution/transitions/3` becomes `solution.transitions[3]`. */
function dotted(pointer: string): string {
	return pointer
		.split('/')
		.filter((part) => part !== '')
		.map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
		.reduce(
			(path, part) =>
				/^\d+$/.test(part) ? `${path}[${part}]` : path === '' ? part : `${path}.${part}`,
			''
		);
}

interface Located {
	/** The field as a list of keys and numbers, for finding its line. */
	segments: (string | number)[];
	problem: Problem;
}

function explain(error: ErrorObject): Located | undefined {
	const base = error.instancePath
		.split('/')
		.filter((part) => part !== '')
		.map((part) =>
			/^\d+$/.test(part) ? Number(part) : part.replaceAll('~1', '/').replaceAll('~0', '~')
		);
	const at = (extra?: string): Located['segments'] =>
		extra === undefined ? base : [...base, extra];
	const make = (segments: Located['segments'], message: string): Located => ({
		segments,
		problem: {
			path: dotted(
				segments.map((s) => `/${String(s).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('')
			),
			message
		}
	});
	const params = error.params as Record<string, unknown>;

	switch (error.keyword) {
		case 'if':
			return undefined; // "must match then schema": the real reason is in another error
		case 'required':
			return make(at(String(params.missingProperty)), 'is required');
		case 'additionalProperties':
			return make(at(String(params.additionalProperty)), 'is not a known field');
		case 'type':
			return make(at(), `must be ${KINDS[String(params.type)] ?? String(params.type)}`);
		case 'enum':
			return make(at(), `must be one of ${(params.allowedValues as unknown[]).join(', ')}`);
		case 'const':
			if (error.schemaPath.includes('/allOf/3/')) return make(at(), 'minimal needs complete: true');
			if (error.instancePath === '/schemaVersion') {
				return make(at(), 'must be 1 (this is the only version of the format that exists)');
			}
			return make(at(), `must be ${JSON.stringify(params.allowedValue)}`);
		case 'pattern':
			return make(at(), FORMATS[String(params.pattern)] ?? 'has a wrong format');
		case 'not':
			return make(at(), 'the word "eps" is reserved for ε');
		case 'false schema':
			return make(at(), 'does not apply to this type of question');
		case 'minItems':
			return make(at(), `needs at least ${String(params.limit)} items`);
		case 'maxItems':
			return make(at(), `has at most ${String(params.limit)} items`);
		case 'uniqueItems':
			return make(at(), 'has the same item twice');
		case 'minLength':
			return make(
				at(),
				params.limit === 1
					? 'must not be empty'
					: `is too short (at least ${String(params.limit)} characters)`
			);
		case 'maxLength':
			return make(at(), `is too long (at most ${String(params.limit)} characters)`);
		case 'minimum':
			return make(at(), `must be at least ${String(params.limit)}`);
		case 'maximum':
			return make(at(), `must be at most ${String(params.limit)}`);
		default:
			return make(at(), error.message ?? 'is not right');
	}
}

// ---- finding lines ----

/** The line (from 1) of the field in the file, or of the group that holds it. */
function lineOf(
	doc: Document,
	counter: LineCounter,
	segments: (string | number)[]
): number | undefined {
	for (let length = segments.length; length >= 0; length--) {
		const parent = segments.slice(0, length);
		// For a key, the line of the key itself; for a value, the line of the value.
		const node = doc.getIn(parent, true) as { range?: [number, number, number] } | undefined;
		if (node?.range) return counter.linePos(node.range[0]).line;
		if (length === 0) return 1;
	}
	return undefined;
}

/** The line of an unknown or missing field: the line of its key if it is there, else of its group. */
function placed(
	doc: Document,
	counter: LineCounter,
	located: Located,
	keyed: boolean
): number | undefined {
	if (keyed && located.segments.length > 0) {
		const parent = doc.getIn(located.segments.slice(0, -1), true) as
			{ items?: { key?: { value?: unknown; range?: [number, number, number] } }[] } | undefined;
		const name = located.segments[located.segments.length - 1];
		const pair = parent?.items?.find((item) => item.key?.value === name);
		if (pair?.key?.range) return counter.linePos(pair.key.range[0]).line;
	}
	return lineOf(doc, counter, located.segments);
}

// ---- the file ----

export interface ParseResult {
	/** The question, when the file has no problem. */
	question?: Question;
	problems: Problem[];
}

const WHOLE_FILE_MUST = 'the file must be a set of fields (key: value)';

export function parseQuestionFile(text: string, validate: SchemaValidator): ParseResult {
	if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) {
		return {
			problems: [{ path: FILE, message: `the file is bigger than ${MAX_FILE_BYTES / 1024} KB` }]
		};
	}

	const counter = new LineCounter();
	// Everything is text (failsafe schema); each key once. Aliases are refused below.
	const doc = parseDocument(text, {
		schema: 'failsafe',
		uniqueKeys: true,
		lineCounter: counter
	});
	const problems: Problem[] = [];
	for (const error of [...doc.errors, ...doc.warnings]) {
		problems.push({
			path: FILE,
			message: error.message.split('\n')[0]!.replace(/ at line \d+, column \d+:?$/, ''),
			line: error.linePos?.[0].line
		});
	}
	if (problems.length > 0) return { problems };

	// Aliases can multiply a small file into a huge one, and nobody needs them in a question.
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
					message: 'anchors and aliases (&name, *name) are not allowed in a question file'
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
					message: 'anchors and aliases (&name, *name) are not allowed in a question file'
				}
			]
		};
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return { problems: [{ path: FILE, message: WHOLE_FILE_MUST }] };
	}

	for (const error of validate(data)) {
		const located = explain(error);
		if (!located) continue;
		const keyed = error.keyword === 'additionalProperties';
		const line = placed(doc, counter, located, keyed);
		problems.push({ ...located.problem, ...(line === undefined ? {} : { line }) });
	}
	// The same field can be reported by two rules of the schema (a type and then a format).
	const unique = problems.filter(
		(p, i) => problems.findIndex((q) => q.path === p.path && q.message === p.message) === i
	);
	return unique.length > 0 ? { problems: unique } : { question: data as Question, problems: [] };
}
