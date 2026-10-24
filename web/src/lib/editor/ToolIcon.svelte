<script lang="ts">
	// The icons of the tools (from the wireframes). They are decoration: the button has the name.
	let { name }: { name: 'select' | 'state' | 'delete' | 'undo' | 'redo' } = $props();
</script>

<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
	{#if name === 'select'}
		<path d="M5 3l14 8-6 2-2 6z" stroke-linejoin="round" />
	{:else if name === 'state'}
		<circle cx="12" cy="12" r="8" />
	{:else if name === 'delete'}
		<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" stroke-linecap="round" />
	{:else if name === 'undo'}
		<path d="M9 7L4 12l5 5" stroke-linecap="round" />
		<path d="M4 12h10a6 6 0 010 12" stroke-linecap="round" />
	{:else}
		<path d="M15 7l5 5-5 5" stroke-linecap="round" />
		<path d="M20 12H10a6 6 0 000 12" stroke-linecap="round" />
	{/if}
</svg>

<style>
	svg {
		stroke: currentColor;
		stroke-width: 1.8;
	}
</style>
