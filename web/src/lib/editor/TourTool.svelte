<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import ToolIcon from './ToolIcon.svelte';
	import { TOOLS } from './tools.ts';
	import type { TourItem } from './tour.ts';

	// One control of a step of the tour, drawn as a picture of itself: the same icon, name and key as
	// the real button (the tools come from the same list as the rail). It is not a button: it only
	// shows a beginner what to look for. The text of the step says the same in words, so the picture
	// is hidden from screen readers.
	let { item }: { item: TourItem } = $props();

	const real = $derived(item.kind === 'tool' ? TOOLS.find((x) => x.tool === item.tool) : undefined);
</script>

<div class="item">
	{#if item.kind === 'tool' && real}
		<span class="tile tool"><ToolIcon name={real.icon} /></span>
		<span class="text">
			<span class="name">{t(real.label)}</span>
			<kbd>{real.keys}</kbd>
		</span>
	{:else if item.kind === 'key'}
		<span class="tile"><kbd class="big">{item.key}</kbd></span>
		<span class="text">{t(item.caption)}</span>
	{:else if item.kind === 'gesture'}
		<span class="tile gesture">{t(item.label)}</span>
		<span class="text">{t(item.caption)}</span>
	{:else if item.kind === 'run'}
		<span class="pill go">{t(item.label)}</span>
	{:else if item.kind === 'step'}
		<span class="tile">
			<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M8 5l9 7-9 7z" />
			</svg>
		</span>
		<span class="text">{t(item.label)}</span>
	{:else if item.kind === 'field'}
		<span class="field">{t(item.label)}</span>
		<span class="pill">{t(item.button)}</span>
	{/if}
</div>

<style>
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.tile {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: var(--target-min);
		min-height: var(--target-min);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
	}
	/* The tool as it looks when it is chosen. */
	.tool {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
	.gesture {
		padding: 0 var(--space-3);
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
		white-space: nowrap;
	}
	.text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		font-size: var(--text-sm);
	}
	.name {
		font-weight: var(--weight-strong);
	}
	kbd {
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.big {
		border: 0;
		font-size: var(--text-md);
		font-weight: var(--weight-strong);
	}
	svg {
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.pill {
		display: flex;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		font-weight: var(--weight-strong);
	}
	.go {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
	}
	.field {
		display: flex;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
</style>
