<script lang="ts">
	import { resolve } from '$app/paths';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { Status } from '#lib/storage/progress.ts';
	import type { ListItem } from './list.ts';

	// One question in the list: where it belongs in the syllabus, its title, its type and its difficulty.
	// The title is the link to the page of the question; the whole card is its target (see the style).
	let { item, status = 'none' }: { item: ListItem; status?: Status } = $props();

	const title = $derived(getLocale() === 'en' ? item.title.en : item.title.id);
	const pattern = $derived(item.pattern.replaceAll('-', ' '));
</script>

<article>
	<p class="meta">{t('soal.week', { week: item.week })} · {t('soal.pattern', { pattern })}</p>
	<h2><a href={resolve('/soal/[id]', { id: item.id })}>{title}</a></h2>
	<p class="tags">
		<span class="type">{t(`soal.type.${item.type}`)}</span>
		<span class="level">{t(`soal.difficulty.${item.difficulty}`)}</span>
		{#if status !== 'none'}
			<span class="status {status}">{t(`soal.status.${status}`)}</span>
		{/if}
	</p>
</article>

<style>
	article {
		position: relative;
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
	h2 a {
		color: inherit;
		text-decoration: none;
	}
	/* The link covers the whole card, so that a finger or a click anywhere on it opens the question. */
	h2 a::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius-lg);
	}
	h2 a:focus-visible::after {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	article:hover {
		border-color: var(--color-border-strong);
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
	.status {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.status.solved {
		background: var(--color-success-tint);
		color: var(--color-success-ink);
		font-weight: var(--weight-strong);
	}
	.level {
		color: var(--color-muted);
	}
</style>
