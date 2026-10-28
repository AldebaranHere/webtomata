<script lang="ts">
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { ListItem } from './list.ts';

	// One question in the list: where it belongs in the syllabus, its title, its type and its difficulty.
	// (The card becomes a link to the page of the question with Q3b.)
	let { item }: { item: ListItem } = $props();

	const title = $derived(getLocale() === 'en' ? item.title.en : item.title.id);
	const pattern = $derived(item.pattern.replaceAll('-', ' '));
</script>

<article>
	<p class="meta">{t('soal.week', { week: item.week })} · {t('soal.pattern', { pattern })}</p>
	<h2>{title}</h2>
	<p class="tags">
		<span class="type">{t(`soal.type.${item.type}`)}</span>
		<span class="level">{t(`soal.difficulty.${item.difficulty}`)}</span>
	</p>
</article>

<style>
	article {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	p,
	h2 {
		margin: 0;
	}
	.meta {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	h2 {
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}
	.type {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
	.level {
		color: var(--color-muted);
	}
</style>
