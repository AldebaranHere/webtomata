<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { SaveStatus } from '#lib/storage/index.ts';

	// "Tersimpan di perangkat ini" next to the title, and what to do when it is not. A phone shows
	// only the mark for the good states (the bar is full); a screen reader always has the words. The
	// problems also have a strip under the bar (Editor.svelte), which is an alert.
	let { status, persistent }: { status: SaveStatus; persistent: boolean } = $props();

	const mode = $derived(
		!persistent
			? 'unavailable'
			: status === 'failed'
				? 'failed'
				: status === 'saved'
					? 'saved'
					: 'saving'
	);
</script>

<span class="save {mode}">
	<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		{#if mode === 'saved'}
			<path d="M3 8.5l3.2 3L13 4.5" stroke-linecap="round" stroke-linejoin="round" />
		{:else if mode === 'saving'}
			<circle cx="8" cy="8" r="3" />
		{:else}
			<path d="M8 2.5l6 10.5H2z" stroke-linejoin="round" />
			<path d="M8 6.5v3M8 11.2v.1" stroke-linecap="round" />
		{/if}
	</svg>
	<span class="text">{t(`storage.${mode}`)}</span>
</span>

<style>
	.save {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1-5);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	svg {
		stroke: currentColor;
		stroke-width: 1.8;
		flex: none;
	}
	.saved {
		color: var(--color-success);
	}
	.saving {
		color: var(--color-muted);
	}
	.failed,
	.unavailable {
		color: var(--color-warning-ink);
		font-weight: var(--weight-strong);
	}

	/* On a phone the good states are a mark, and the words are for a screen reader. */
	@media (max-width: 39.99rem) {
		.saved .text,
		.saving .text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		.failed .text,
		.unavailable .text {
			display: none;
		}
	}
</style>
