<script lang="ts">
	import { resolve } from '$app/paths';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { GuideListItem } from './list.ts';

	// One guide card on /panduan: topic badge, title (link covering the whole card), one-sentence
	// summary, and linked question count + reading time.
	let { item }: { item: GuideListItem } = $props();

	const english = $derived(getLocale() === 'en');
	const title = $derived(english && item.cardTitle.en ? item.cardTitle.en : item.cardTitle.id);
	const summary = $derived(english && item.summary.en ? item.summary.en : item.summary.id);
</script>

<article>
	<span class="topic">{t(`panduan.topic.${item.topic}`)}</span>
	<h2><a href={resolve('/panduan/[id]', { id: item.id })}>{title}</a></h2>
	<p class="summary">{summary}</p>
	<p class="meta">
		{t('panduan.card_meta', { questions: item.questionCount, minutes: item.readingMinutes })}
	</p>
</article>

<style>
	article {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		height: 100%;
		padding: var(--space-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-sizing: border-box;
	}
	article:hover {
		border-color: var(--color-border-strong);
	}
	h2,
	p {
		margin: 0;
	}
	.topic {
		align-self: flex-start;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
	}
	h2 {
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
	}
	h2 a {
		color: inherit;
		text-decoration: none;
	}
	h2 a::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius-xl);
	}
	h2 a:focus-visible::after {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.summary {
		flex: 1;
		color: var(--color-muted);
		line-height: var(--leading-normal);
	}
	.meta {
		color: var(--color-accent-ink);
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
	}
</style>
