// The schema (content/questions/schema.json) and the types (types.ts) are two descriptions of the
// same file. This test keeps them from drifting: a file with every field must pass the schema and
// be a `Question`, and the fields of the types must be exactly the fields of the schema.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSchemaValidator, parseQuestionFile } from './load.ts';
import { KITCHEN_SINK_DFSM, KITCHEN_SINK_NDFSM } from './testing.ts';

const schema = JSON.parse(
	readFileSync(new URL('../../../../content/questions/schema.json', import.meta.url), 'utf8')
);
const validate = createSchemaValidator(schema);

// JSON is YAML, so a question can be written to a file as JSON.
const asFile = (question: object) => JSON.stringify(question, null, 2);

describe('the template for authors', () => {
	it('is itself a question that passes the schema, so that it never goes out of date', () => {
		const text = readFileSync(
			new URL('../../../../content/questions/_template.yaml', import.meta.url),
			'utf8'
		);
		const { question, problems } = parseQuestionFile(text, validate);
		expect(problems).toEqual([]);
		expect(question?.id).toBe('nama-soal');
	});
});

describe('the schema and the types', () => {
	it('accept a file that has every field', () => {
		for (const question of [KITCHEN_SINK_DFSM, KITCHEN_SINK_NDFSM]) {
			const { question: read, problems } = parseQuestionFile(asFile(question), validate);
			expect(problems).toEqual([]);
			expect(read).toEqual(question);
		}
	});

	it('have the same fields at the top, and in the groups', () => {
		const keys = (o: object) => Object.keys(o).sort();
		expect(keys(KITCHEN_SINK_DFSM)).toEqual(keys(schema.properties));
		const constraints = new Set([
			...Object.keys(KITCHEN_SINK_DFSM.constraints),
			...Object.keys(KITCHEN_SINK_NDFSM.constraints)
		]);
		expect([...constraints].sort()).toEqual(keys(schema.properties.constraints.properties));
		expect(keys(KITCHEN_SINK_DFSM.references)).toEqual(
			keys(schema.properties.references.properties)
		);
		expect(keys(KITCHEN_SINK_DFSM.title)).toEqual(keys(schema.definitions.text.properties));
		expect(keys(KITCHEN_SINK_DFSM.solution)).toEqual(keys(schema.definitions.machine.properties));
		expect(keys(KITCHEN_SINK_DFSM.examples)).toEqual(keys(schema.properties.examples.properties));
	});

	it('refuse a field that the types do not have', () => {
		const { problems } = parseQuestionFile(
			asFile({ ...KITCHEN_SINK_DFSM, author: 'Budi' }),
			validate
		);
		expect(problems.map((p) => p.path)).toEqual(['author']);
	});
});
