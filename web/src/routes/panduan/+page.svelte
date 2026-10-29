<script lang="ts">
	import { onMount } from 'svelte';
	import GuideCard from '#lib/guides/GuideCard.svelte';
	import { TOPICS, applyTopicFilter, parseTopicFilter, topicToSearch } from '#lib/guides/list.ts';
	import type { GuideTopic } from '#lib/guides/types.ts';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import { OG_TYPE_WEBSITE, ogLocale } from '#lib/seo.ts';

	let { data } = $props();

	let topic = $state<GuideTopic | null>(null);
	const shown = $derived(applyTopicFilter(data.guides, topic));
	const pageTitle = $derived(`${t('nav.panduan')} · ${t('app.name')}`);
	const localeTag = $derived(ogLocale(getLocale()));

	onMount(() => {
		topic = parseTopicFilter(location.search);
	});

	function selectTopic(next: GuideTopic | null) {
		topic = next;
		history.replaceState(history.state, '', location.pathname + topicToSearch(next));
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={t('panduan.description')} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={t('panduan.description')} />
	<meta property="og:type" content={OG_TYPE_WEBSITE} />
	<meta property="og:locale" content={localeTag} />
</svelte:head>

<div class="page">
	<header class="head">
		<h1>{t('nav.panduan')}</h1>
		<p class="intro">{t('panduan.intro')}</p>
	</header>

	{#if data.guides.length === 0}
		<p class="empty">{t('panduan.empty')}</p>
	{:else}
		<fieldset class="filters">
			<legend class="sr-only">{t('panduan.filter.label')}</legend>
			<div class="chips">
				<label class="chip">
					<input
						type="radio"
						name="panduan-topic"
						checked={topic === null}
						onchange={() => selectTopic(null)}
					/>
					<span>{t('panduan.filter.all')}</span>
				</label>
				{#each TOPICS as option (option)}
					<label class="chip">
						<input
							type="radio"
							name="panduan-topic"
							checked={topic === option}
							onchange={() => selectTopic(option)}
						/>
						<span>{t(`panduan.topic.${option}`)}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<p class="count" role="status">{t('panduan.count', { count: shown.length })}</p>

		{#if shown.length === 0}
			<div class="empty">
				<p>{t('panduan.no_match')}</p>
				<button type="button" onclick={() => selectTopic(null)}>{t('panduan.clear')}</button>
			</div>
		{:else}
			<ul class="cards">
				{#each shown as item (item.id)}
					<li><GuideCard {item} /></li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 72.5rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 42rem;
	}
	h1,
	p {
		margin: 0;
	}
	h1 {
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
	}
	.intro {
		color: var(--color-muted);
		line-height: var(--leading-normal);
	}
	.filters {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		position: relative;
		display: inline-flex;
	}
	.chip input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.chip span {
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-base);
	}
	.chip input:checked + span {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.chip input:focus-visible + span {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.count {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-4);
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
</style>
