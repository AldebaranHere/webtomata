<script lang="ts">
	import { mathParts } from './regex-math.ts';

	// A regular expression drawn as a book writes it: * and + raised, space around ∪, ε and ∅ in a serif
	// face. The text is real text (a copy of it is the expression, and a screen reader reads it), so this
	// is only a matter of looks.
	let { text }: { text: string } = $props();

	const parts = $derived(mathParts(text));
</script>

<!-- prettier-ignore -->
<span class="math">{#each parts as part, i (i)}{#if part.kind === 'sup'}<sup>{part.text}</sup>{:else if part.kind === 'union'}<span class="union">{part.text}</span>{:else if part.kind === 'symbol'}<span class="sym">{part.text}</span>{:else}{part.text}{/if}{/each}</span>

<style>
	.math {
		font-family: var(--font-math);
		font-size: 1.15em;
		overflow-wrap: anywhere;
	}
	/* Raised, and without a change of the height of the line. */
	sup {
		margin-left: 0.04em;
		font-size: 0.7em;
		line-height: 0;
		vertical-align: super;
	}
	.union {
		margin: 0 0.22em;
	}
</style>
