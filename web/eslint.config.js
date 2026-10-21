import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
	{ ignores: ['build/', '.svelte-kit/', 'node_modules/'] },
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
		ignores: ['src/lib/engine/worker.ts'],
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
	{ ignores: ['src/lib/engine/wasm/'] }
);
