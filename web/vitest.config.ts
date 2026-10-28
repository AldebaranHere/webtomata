import { defineConfig } from 'vitest/config';

// Unit tests of plain TypeScript. They do not need SvelteKit.
export default defineConfig({
	test: { include: ['src/**/*.test.ts'], environment: 'node', isolate: false }
});
