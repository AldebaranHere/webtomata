<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	// The zoom control of a laptop: −, the zoom, +, and "Pas" (fit the machine). A phone zooms by
	// pinching and has only the "Pas" button, in the title bar (Editor.svelte). The percentage is
	// said by a polite live region, so a screen-reader user hears the zoom after a key.
	let {
		percent,
		onin,
		onout,
		onreset,
		onfit
	}: {
		percent: number;
		onin: () => void;
		onout: () => void;
		onreset: () => void;
		onfit: () => void;
	} = $props();

	// The keys of the canvas (Enter, Space) must not act on a button of the control.
	const keep = (event: KeyboardEvent) => event.stopPropagation();
</script>

<div class="zoom" role="group" aria-label={t('editor.zoom')}>
	<button type="button" onkeydown={keep} aria-label={t('editor.zoom_out')} onclick={onout}>−</button
	>
	<button
		type="button"
		onkeydown={keep}
		class="level"
		aria-label={t('editor.zoom_reset')}
		onclick={onreset}
	>
		{percent}%
	</button>
	<button type="button" onkeydown={keep} aria-label={t('editor.zoom_in')} onclick={onin}>+</button>
	<button type="button" onkeydown={keep} class="fit" onclick={onfit}>{t('editor.fit')}</button>
	<span class="sr-only" aria-live="polite">{t('editor.zoom_is', { percent })}</span>
</div>

<style>
	.zoom {
		position: absolute;
		right: var(--space-4);
		bottom: var(--space-4);
		display: flex;
		align-items: center;
		padding: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-popover);
	}
	button {
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--color-neutral-tint);
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
	.level {
		min-width: 4.5rem;
		font-variant-numeric: tabular-nums;
	}
	.fit {
		font-weight: var(--weight-strong);
	}

	/* A phone zooms by pinching; its "Pas" button is in the title bar. */
	@media (max-width: 39.99rem) {
		.zoom {
			display: none;
		}
	}
</style>
