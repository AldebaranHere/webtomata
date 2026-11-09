<script lang="ts">
	import PdaAlphabetBlock from './PdaAlphabetBlock.svelte';
	import PdaStatesBlock from './PdaStatesBlock.svelte';
	import PdaTransitionsBlock from './PdaTransitionsBlock.svelte';
	import type { PdaTableProps } from './pda-table-props.ts';

	// The Tabel tab of the PDA editor: the Alfabet, State and Transisi blocks. It is the accessible
	// alternative to the diagram, so it can do everything the canvas can; every edit is a command of
	// the document, so undo, the diagram, the checks and the autosave follow (T-061, ADR 0051).
	let { doc, marked, onapply }: PdaTableProps = $props();
</script>

<div class="pda-table">
	<PdaAlphabetBlock {doc} {onapply} />
	<PdaStatesBlock {doc} {onapply} />
	<PdaTransitionsBlock {doc} {marked} {onapply} />
</div>

<style>
	.pda-table {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
