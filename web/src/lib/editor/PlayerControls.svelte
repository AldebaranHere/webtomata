<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	// The five buttons of a player of the Konversi tab: first, back, play or pause, next, last.
	let {
		index,
		total,
		playing,
		playLabel,
		ongo,
		ontoggle
	}: {
		index: number;
		total: number;
		playing: boolean;
		/** The words of the play button (it names the operation). */
		playLabel: string;
		ongo: (to: number) => void;
		ontoggle: () => void;
	} = $props();

	const atEnd = $derived(index >= total - 1);
</script>

<div class="controls" role="group" aria-label={t('convert.controls')}>
	<button
		type="button"
		class="icon"
		aria-label={t('convert.first')}
		disabled={index === 0}
		onclick={() => ongo(0)}>⏮</button
	>
	<button
		type="button"
		class="icon"
		aria-label={t('convert.back')}
		disabled={index === 0}
		onclick={() => ongo(index - 1)}>◀</button
	>
	<button type="button" class="play" onclick={ontoggle}>
		{playing ? t('convert.pause') : playLabel}
	</button>
	<button
		type="button"
		class="icon"
		aria-label={t('convert.next')}
		disabled={atEnd}
		onclick={() => ongo(index + 1)}>▶</button
	>
	<button
		type="button"
		class="icon"
		aria-label={t('convert.last')}
		disabled={atEnd}
		onclick={() => ongo(total - 1)}>⏭</button
	>
</div>

<style>
	.controls {
		display: grid;
		grid-template-columns: auto auto 1fr auto auto;
		gap: var(--space-2);
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.icon {
		min-width: var(--target-min);
		padding: 0;
	}
	.play {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
</style>
