<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick } from 'svelte';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { PANEL_TABS, nextTab } from './panel-tab.ts';
	import type { PanelTab } from './panel-tab.ts';

	// The panel next to the canvas: a column on a laptop, and a panel under the canvas on a phone
	// with a bar that hides it (the choice is remembered on this device). It has tabs: Simulasi (the
	// run, the test strings and the checks), Tabel and Definisi. The tabs follow the pattern of the
	// ARIA guide: one Tab stop, the arrow keys move between them. Simulasi stays in the page while
	// another tab is open (what was typed in it is not lost); the others are made when they open.
	let {
		tab,
		ontab,
		simulation,
		table,
		definition
	}: {
		tab: PanelTab;
		ontab: (tab: PanelTab) => void;
		simulation: Snippet;
		table: Snippet;
		definition: Snippet;
	} = $props();

	const KEY = 'webtomata.panel';
	let hidden = $state(false);
	const labels: Record<PanelTab, MessageKey> = {
		simulation: 'panel.tab_simulation',
		table: 'panel.tab_table',
		definition: 'panel.tab_definition'
	};

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

	// Each tab keeps its own place when it scrolls: a tab that opens starts where it was left (the
	// first time, at the top), not where the tab before it was.
	let panes: HTMLElement;
	const places: Partial<Record<PanelTab, number>> = {};
	async function choose(next: PanelTab) {
		if (next === tab) return;
		places[tab] = panes.scrollTop;
		ontab(next);
		await tick();
		panes.scrollTop = places[next] ?? 0;
	}

	function onkeydown(event: KeyboardEvent) {
		const next = nextTab(tab, event.key);
		if (!next) return;
		event.preventDefault();
		void choose(next);
		document.getElementById(`panel-tab-${next}`)?.focus();
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
		<h2 class="sr-only">{t('panel.title')}</h2>
		<div class="tabs" role="tablist" aria-label={t('panel.tabs')} {onkeydown} tabindex="-1">
			{#each PANEL_TABS as id (id)}
				<button
					type="button"
					role="tab"
					id="panel-tab-{id}"
					aria-selected={tab === id}
					aria-controls="panel-pane-{id}"
					tabindex={tab === id ? 0 : -1}
					onclick={() => void choose(id)}
				>
					{t(labels[id])}
				</button>
			{/each}
		</div>
		<div class="panes" bind:this={panes}>
			<div
				role="tabpanel"
				id="panel-pane-simulation"
				aria-labelledby="panel-tab-simulation"
				class="pane"
				hidden={tab !== 'simulation'}
			>
				{@render simulation()}
			</div>
			{#if tab === 'table'}
				<div role="tabpanel" id="panel-pane-table" aria-labelledby="panel-tab-table" class="pane">
					{@render table()}
				</div>
			{:else if tab === 'definition'}
				<div
					role="tabpanel"
					id="panel-pane-definition"
					aria-labelledby="panel-tab-definition"
					class="pane"
				>
					{@render definition()}
				</div>
			{/if}
		</div>
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
		flex: 1;
		flex-direction: column;
		gap: var(--space-3);
		min-height: 0;
		padding: var(--space-4);
	}
	.content[hidden],
	.pane[hidden] {
		display: none;
	}
	.tabs {
		display: flex;
		flex: none;
		gap: var(--space-1);
	}
	.tabs button {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		cursor: pointer;
	}
	.tabs button:hover {
		background: var(--color-neutral-tint);
	}
	.tabs button[aria-selected='true'] {
		background: var(--color-ink);
		color: var(--color-on-ink);
		font-weight: var(--weight-strong);
	}
	.tabs button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	/* What is under the tabs scrolls, and the tabs stay. */
	.panes {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.pane {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
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
	}
	.handle:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
</style>
