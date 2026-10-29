// The guides of content/guides, read when the site is built (G1). Only server code imports this
// (the pages are prerendered), so the YAML reader, the schema validator and the Markdown parser
// are not in the code that the browser loads. A file that breaks a rule fails the build with its
// name and line.
import { loadGuides } from '#lib/guides/load.ts';
import type { Guide } from '#lib/guides/types.ts';
import { createSchemaValidator } from '#lib/questions/load.ts';
import schema from '../../../../content/guides/schema.json';

const files = import.meta.glob('../../../../content/guides/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Every guide, sorted by order then id. */
export const allGuides = (): Guide[] => loadGuides(files, createSchemaValidator(schema));
