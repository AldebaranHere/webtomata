<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick } from 'svelte';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { PANEL_TABS, nextTab } from './panel-tab.ts';
	import type { PanelTab } from './panel-tab.ts';
	import {
		DEFAULT_REM,
		MIN_REM,
		clampRem,
		maxRem,
		pxToRem,
		readWidth,
		saveWidth,
		stepRem
	} from './panel-width.ts';

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

	// The width on a laptop: the panel is pulled wider by its left edge (for the table), and the
	// width is remembered on this device. A phone has no handle, and its panel keeps its share of the
	// height.
	let aside = $state<HTMLElement>();
	let width = $state(DEFAULT_REM);
	let widest = $state(maxRem(1440));
	let dragging = $state(false);
	let drag: { startX: number; startRem: number } | null = null;

	onMount(() => {
		try {
			hidden = localStorage.getItem(KEY) === 'hidden';
		} catch {
			// Storage is blocked: the panel starts open.
		}
		width = readWidth(window.innerWidth);
		widest = maxRem(window.innerWidth);
		// A smaller window brings the width back inside the limits.
		const onresize = () => {
			widest = maxRem(window.innerWidth);
			width = clampRem(width, window.innerWidth);
		};
		window.addEventListener('resize', onresize);
		return () => window.removeEventListener('resize', onresize);
	});
	// Through the CSS object model: the page does not allow an inline style attribute.
	$effect(() => {
		aside?.style.setProperty('--panel-width', `${width}rem`);
	});

	function grab(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { startX: event.clientX, startRem: width };
		dragging = true;
	}
	function pull(event: PointerEvent) {
		if (!drag) return;
		// The handle is on the left edge: to the left is wider.
		width = clampRem(drag.startRem + pxToRem(drag.startX - event.clientX), window.innerWidth);
	}
	function release() {
		if (!drag) return;
		drag = null;
		dragging = false;
		saveWidth(width);
	}
	function stepWidth(event: KeyboardEvent) {
		const next = stepRem(width, event.key, event.shiftKey, window.innerWidth);
		if (next === null) return;
		event.preventDefault();
		width = next;
		saveWidth(next);
	}
	function resetWidth() {
		width = DEFAULT_REM;
		saveWidth(width);
	}

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

<aside class="panel" class:hidden bind:this={aside} aria-label={t('panel.title')}>
	<!-- A separator that can be moved (the "window splitter" pattern of the ARIA guide): with a value
	     and a tab stop it is an interactive widget, which the checker of Svelte does not know. A laptop only. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="resize"
		class:dragging
		role="separator"
		aria-orientation="vertical"
		aria-label={t('panel.resize')}
		aria-valuemin={MIN_REM}
		aria-valuemax={Math.floor(widest)}
		aria-valuenow={Math.round(width)}
		tabindex="0"
		onpointerdown={grab}
		onpointermove={pull}
		onpointerup={release}
		onpointercancel={release}
		onkeydown={stepWidth}
		ondblclick={resetWidth}
	></div>
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
		position: relative;
		display: flex;
		flex-direction: column;
		width: var(--panel-width, 22rem);
		flex: none;
		min-height: 0;
		border-left: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.handle {
		display: none;
	}
	/* The handle to pull the panel wider: 24 px across, over the border, and it shows itself when
	   it is hovered, focused or held. */
	.resize {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -12px;
		z-index: 3;
		width: 24px;
		cursor: col-resize;
		touch-action: none;
		outline: none;
	}
	.resize::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 11px;
		width: 2px;
		background: transparent;
	}
	.resize:hover::after,
	.resize:focus-visible::after,
	.resize.dragging::after {
		background: var(--color-accent);
	}
	.resize:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
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
		.resize {
			display: none;
		}
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
