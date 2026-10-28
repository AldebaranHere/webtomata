import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'.wrangler/',
			'node_modules/',
			'test-results/',
			'playwright-report/'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		files: ['src/**/*.{ts,svelte}'],
		// The worker, and the tests that run the real module (the handlers, the document).
		ignores: [
			'src/lib/engine/worker.ts',
			'src/lib/engine/handlers.test.ts',
			'src/lib/editor/conversion.wasm.test.ts',
			'src/lib/editor/regex-conversion.wasm.test.ts',
			'src/lib/editor/regex-compile.wasm.test.ts',
			'src/lib/editor/regex-simplify.wasm.test.ts',
			'src/lib/share/files.wasm.test.ts',
			'src/lib/editor/compare.wasm.test.ts',
			'src/lib/share/open-file.wasm.test.ts',
			'src/lib/editor/document.wasm.test.ts',
			'src/lib/editor/run.wasm.test.ts',
			'src/lib/examples/examples.wasm.test.ts',
			'src/lib/questions/check.wasm.test.ts'
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['**/engine/wasm/*', '**/engine/wasm'],
							message: 'Only src/lib/engine/worker.ts may import the WASM package.'
						}
					]
				}
			]
		}
	},
	{ ignores: ['src/lib/engine/wasm/', 'src/lib/engine/types.ts'] }
);
