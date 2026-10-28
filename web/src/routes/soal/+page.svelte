<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { openStore } from '#lib/storage/index.ts';
	import type { MachineStore } from '#lib/storage/store.ts';
	import { loadProgress, resetProgress, statusOf, summarize } from '#lib/storage/progress.ts';
	import type { Progress } from '#lib/storage/progress.ts';
	import FilterGroups from '#lib/questions/FilterGroups.svelte';
	import QuestionCard from '#lib/questions/QuestionCard.svelte';
	import {
		NO_FILTERS,
		activeCount,
		applyFilters,
		facets,
		filtersToSearch,
		parseFilters
	} from '#lib/questions/list.ts';
	import type { Filters } from '#lib/questions/list.ts';

	// The list of questions with its three filters. The page is prerendered with the whole list; the
	// filters work in the browser and are kept in the address (?minggu=1&jenis=build-dfsm&tingkat=2),
	// so that a filtered list can be shared. On a phone the filters are in a sheet that opens with the
	// button "Filter" and applies with "Terapkan".
	let { data } = $props();

	const available = $derived(facets(data.questions));
	let filters = $state<Filters>(NO_FILTERS);
	// What is chosen in the sheet, before "Terapkan".
	let pending = $state<Filters>(NO_FILTERS);
	let sheet = $state<HTMLDialogElement>();

	const shown = $derived(applyFilters(data.questions, filters));
	const active = $derived(activeCount(filters));

	// The progress of the student, read from the device once the page is in the browser (the page is prerendered
	// and has none). It is shown only when the browser keeps it: with no storage there is nothing to show.
	let store: MachineStore | null = null;
	let progress = $state.raw<ReadonlyMap<string, Progress> | null>(null);
	let confirming = $state(false);
	let resetDone = $state(false);
	const summary = $derived(progress ? summarize(data.questions, progress) : null);

	// The prerendered page has no filter (an address with a search part cannot be prerendered), so the
	// filters of the address are read here, once the page is in the browser.
	onMount(() => {
		filters = parseFilters(location.search);
		void (async () => {
			try {
				const opened = await openStore();
				if (!opened.persistent) return;
				store = opened.store;
				progress = await loadProgress(opened.store);
			} catch {
				// No progress to show; the list works without it.
			}
		})();
	});

	async function reset() {
		confirming = false;
		if (!store) return;
		try {
			await resetProgress(store);
			progress = await loadProgress(store);
			resetDone = true;
		} catch {
			// The list is as it was.
		}
	}

	function apply(next: Filters) {
		filters = next;
		// The state that the router keeps in the entry is passed on, so that it is not lost.
		history.replaceState(history.state, '', location.pathname + filtersToSearch(next));
	}

	function openSheet() {
		pending = filters;
		sheet?.showModal();
	}

	function applySheet() {
		apply(pending);
		sheet?.close();
	}
</script>

<svelte:head>
	<title>{t('nav.soal')} · {t('app.name')}</title>
	<meta name="description" content={t('soal.description')} />
</svelte:head>

<div class="page">
	<h1>{t('nav.soal')}</h1>
	<p class="intro">{t('soal.intro')}</p>
	<!-- The line is read from the device after the page opens: its place is kept, so that the list does not jump. -->
	<div class="progress">
		{#if summary}
			<p class="muted" role="status">
				{t('soal.progress', { solved: summary.solved, total: summary.total })}
				{#if resetDone}<span class="sr-only"> {t('soal.reset_done')}</span>{/if}
			</p>
			{#if summary.solved + summary.attempted > 0 && !confirming}
				<button
					type="button"
					class="plain"
					onclick={() => {
						confirming = true;
						resetDone = false;
					}}
				>
					{t('soal.reset')}
				</button>
			{/if}
		{/if}
	</div>
	{#if summary}
		{#if confirming}
			<div class="confirm" role="alertdialog" aria-labelledby="soal-reset-question">
				<p id="soal-reset-question">{t('soal.reset_confirm')}</p>
				<div class="row">
					<button type="button" class="danger" onclick={() => void reset()}
						>{t('soal.reset_yes')}</button
					>
					<button type="button" onclick={() => (confirming = false)}
						>{t('soal.reset_cancel')}</button
					>
				</div>
			</div>
		{/if}
	{/if}

	{#if data.questions.length === 0}
		<p class="empty">{t('soal.empty')}</p>
	{:else}
		<div class="filters">
			<FilterGroups name="page" {available} value={filters} onchange={apply} />
		</div>
		<button type="button" class="sheet-button" onclick={openSheet}>
			{t('soal.filter_button', { count: active })}
		</button>

		<p class="count" role="status">{t('soal.count', { count: shown.length })}</p>

		{#if shown.length === 0}
			<div class="empty">
				<p>{t('soal.no_match')}</p>
				<button type="button" onclick={() => apply(NO_FILTERS)}>{t('soal.clear')}</button>
			</div>
		{:else}
			<ul class="cards">
				{#each shown as item (item.id)}
					<li><QuestionCard {item} status={statusOf(progress?.get(item.id))} /></li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<dialog bind:this={sheet} class="sheet" aria-labelledby="soal-sheet-title">
	<div class="body">
		<header>
			<h2 id="soal-sheet-title">{t('soal.sheet_title')}</h2>
			<button type="button" class="plain" onclick={() => sheet?.close()}>{t('soal.close')}</button>
		</header>
		<FilterGroups name="sheet" {available} value={pending} onchange={(next) => (pending = next)} />
		<footer>
			<button type="button" onclick={() => (pending = NO_FILTERS)}>{t('soal.clear')}</button>
			<button type="button" class="primary" onclick={applySheet}>{t('soal.apply')}</button>
		</footer>
	</div>
</dialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	h1 {
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
	}
	.intro {
		max-width: 40rem;
		color: var(--color-muted);
	}
	.progress {
		display: flex;
		min-height: 1.5rem;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.progress p {
		margin: 0;
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.confirm {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.confirm p {
		margin: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.danger {
		border-color: var(--color-warning-ink);
		font-weight: var(--weight-strong);
	}
	.count {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-muted);
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	.plain {
		border-color: transparent;
		background: transparent;
		text-decoration: underline;
	}

	/* A laptop has the filters in the page; a phone has the button and the sheet. */
	.sheet-button {
		display: none;
	}
	dialog.sheet {
		width: min(30rem, calc(100% - 2 * var(--space-4)));
		max-height: min(40rem, calc(100dvh - 2 * var(--space-4)));
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2xl);
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: var(--shadow-popover);
	}
	dialog.sheet::backdrop {
		background: color-mix(in srgb, var(--color-ink) 40%, transparent);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
	}
	.body header,
	.body footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.body h2 {
		font-size: var(--text-lg);
	}
	@media (max-width: 47.99rem) {
		.filters {
			display: none;
		}
		.sheet-button {
			display: block;
			align-self: flex-start;
		}
		dialog.sheet {
			width: 100%;
			max-width: none;
			max-height: 85dvh;
			margin: auto 0 0;
			border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
	@media (min-width: 48rem) {
		dialog.sheet {
			display: none;
		}
	}
</style>
