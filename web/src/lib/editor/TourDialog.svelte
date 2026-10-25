<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import TourTool from './TourTool.svelte';
	import { TOUR, TOUR_STEPS } from './tour.ts';

	// "Tur 1 menit": five short steps in a dialog (a sheet from the bottom on a phone). It is plain
	// on purpose: a spotlight over the interface is fragile on a small screen. A native <dialog>
	// gives the focus trap, Esc, and the return of the focus to the button that opened it. Closing it
	// in any way (finish, skip, Esc, the backdrop) calls `onclose`, and the page remembers that the
	// tour was seen.
	let { onclose }: { onclose: () => void } = $props();

	let dialog: HTMLDialogElement;
	let step = $state(1);
	const last = $derived(step === TOUR_STEPS);

	onMount(() => dialog.showModal());

	const current = $derived(TOUR[step - 1]!);

	function onBackdrop(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<dialog
	bind:this={dialog}
	class="tour"
	aria-labelledby="tour-title"
	aria-describedby="tour-body"
	{onclose}
	onclick={onBackdrop}
>
	<div class="sheet">
		<header>
			<p class="kicker" id="tour-title">{t('tour.title')}</p>
			<button
				type="button"
				class="close"
				aria-label={t('tour.close')}
				onclick={() => dialog.close()}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
				</svg>
			</button>
		</header>

		<div class="body">
			<p class="progress">{t('tour.progress', { current: step, total: TOUR_STEPS })}</p>
			<h2>{t(current.title)}</h2>
			<p id="tour-body">{t(current.body)}</p>
			<!-- The controls of this step, drawn as they look: the text above says the same in words. -->
			<div class="shows" aria-hidden="true">
				{#each current.items as item, i (i)}
					<TourTool {item} />
				{/each}
			</div>
			<p class="where">
				<span class="wide">
					{t(current.where === 'tools' ? 'tour.where_tools_wide' : 'tour.where_panel_wide')}
				</span>
				<span class="narrow">
					{t(current.where === 'tools' ? 'tour.where_tools_narrow' : 'tour.where_panel_narrow')}
				</span>
			</p>
			<a class="guides" href={resolve('/panduan')} onclick={() => dialog.close()}
				>{t('tour.guides')}</a
			>
		</div>

		<footer>
			<button type="button" class="plain" onclick={() => dialog.close()}>{t('tour.skip')}</button>
			<span class="spacer"></span>
			{#if step > 1}
				<button type="button" class="plain" onclick={() => step--}>{t('tour.back')}</button>
			{/if}
			{#if last}
				<button type="button" class="primary" onclick={() => dialog.close()}>
					{t('tour.finish')}
				</button>
			{:else}
				<button type="button" class="primary" onclick={() => step++}>{t('tour.next')}</button>
			{/if}
		</footer>
	</div>
</dialog>

<style>
	dialog.tour {
		width: min(28rem, calc(100% - 2 * var(--space-4)));
		max-height: calc(100dvh - 2 * var(--space-4));
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2xl);
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: var(--shadow-popover);
		overflow: hidden;
	}
	dialog.tour::backdrop {
		background: color-mix(in srgb, var(--color-ink) 40%, transparent);
	}
	.sheet {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
		border-bottom: 1px solid var(--color-border);
	}
	.kicker {
		margin: 0;
		font-weight: var(--weight-strong);
	}
	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--target-min);
		height: var(--target-min);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}
	.close svg {
		stroke: currentColor;
		stroke-width: 2;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		overflow-y: auto;
	}
	.body p,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: var(--text-xl);
	}
	.progress {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.shows {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-4);
		padding: var(--space-3);
		border-radius: var(--radius-lg);
		background: var(--color-ground);
	}
	.where {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	/* The words follow the layout: the tool bar is at the left on a laptop and at the bottom on a phone. */
	.narrow {
		display: none;
	}
	@media (max-width: 39.99rem) {
		.wide {
			display: none;
		}
		.narrow {
			display: inline;
		}
	}
	#tour-body {
		line-height: var(--leading-normal);
	}
	.guides {
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
		color: var(--color-accent-ink);
		font-size: var(--text-sm);
	}
	footer {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-border);
	}
	.spacer {
		flex: 1;
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border-radius: var(--radius-lg);
		font: inherit;
		cursor: pointer;
	}
	.plain {
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface);
		color: var(--color-ink);
	}
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	button:focus-visible,
	a:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	@media (max-width: 39.99rem) {
		dialog.tour {
			width: 100%;
			max-width: none;
			margin: auto 0 0;
			border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
		}
	}
</style>
