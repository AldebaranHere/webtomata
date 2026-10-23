// The engine puts text from the user into its messages (symbol names, labels of a JFLAP file,
// the text of a regular expression). The UI must show that text as text. `{@html}` would let
// it run as markup, so the lint must refuse it.
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('../..', import.meta.url)) });

async function rules(code: string): Promise<string[]> {
	const [result] = await eslint.lintText(code, { filePath: 'src/lib/example.svelte' });
	return result!.messages.map((m) => m.ruleId ?? '');
}

describe('the lint rule for {@html}', () => {
	it('refuses a component that shows text as markup', async () => {
		const found = await rules(
			'<script lang="ts">let text = $state("");</script>\n<div>{@html text}</div>\n'
		);
		expect(found).toContain('svelte/no-at-html-tags');
	});

	it('accepts a component that shows text as text', async () => {
		const found = await rules(
			'<script lang="ts">let text = $state("");</script>\n<div>{text}</div>\n'
		);
		expect(found).not.toContain('svelte/no-at-html-tags');
	});
});
