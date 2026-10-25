<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	// The panel next to the canvas: a column on a laptop, and a panel under the canvas on a phone
	// with a bar that hides it (the choice is remembered on this device). Later tabs (the table, the
	// definition, conversions) go in here; for now it is the simulation and the checks.
	let { children }: { children: Snippet } = $props();

	const KEY = 'webtomata.panel';
	let hidden = $state(false);

	onMount(() => {
		try {
			hidden = localStorage.getItem(KEY) === 'hidden';
		} catch {
			// Storage is blocked: the panel starts open.
		}
	});

	function toggle() {
		hidden = !hidden;
		try {
			localStorage.setItem(KEY, hidden ? 'hidden' : 'shown');
		} catch {
			// Not remembered, and that is all.
		}
	}
</script>

<aside class="panel" class:hidden aria-label={t('panel.title')}>
	<button
		type="button"
		class="handle"
		aria-expanded={!hidden}
		aria-label={hidden ? t('panel.show') : t('panel.hide')}
		onclick={toggle}
	>
		<span class="bar" aria-hidden="true"></span>
		<span class="name" aria-hidden="true">{t('panel.title')}</span>
	</button>
	<div class="content" {hidden}>
		<h2>{t('panel.title')}</h2>
		{@render children()}
	</div>
</aside>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		width: 22rem;
		flex: none;
		min-height: 0;
		border-left: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.handle {
		display: none;
	}
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-height: 0;
		padding: var(--space-4);
		overflow-y: auto;
	}
	.content[hidden] {
		display: none;
	}
	h2 {
		margin: 0;
		font-size: var(--text-lg);
	}

	/* A phone: under the canvas, with a bar that hides it. */
	@media (max-width: 39.99rem) {
		/* A fixed share of the height, not the height of the content: when the checks arrive the canvas
		   must not change its size (it would move the view under a finger). */
		.panel {
			width: auto;
			height: 40%;
			border-left: 0;
			border-top: 1px solid var(--color-border);
		}
		.panel.hidden {
			height: auto;
		}
		.handle {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: var(--space-1);
			min-height: var(--target-min);
			padding: 0;
			border: 0;
			background: transparent;
			color: var(--color-ink);
			font: inherit;
			cursor: pointer;
		}
		.handle .bar {
			width: 2.5rem;
			height: 4px;
			border-radius: var(--radius-pill);
			background: var(--color-border-strong);
		}
		.handle .name {
			font-size: var(--text-sm);
			color: var(--color-muted);
		}
		.content {
			padding-top: var(--space-1);
		}
		/* The heading stays for a screen reader (the order of the headings), the bar says it. */
		h2 {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
	}
	.handle:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
</style>
