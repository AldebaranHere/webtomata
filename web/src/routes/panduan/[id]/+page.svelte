<script lang="ts">
	import { resolve } from '$app/paths';
	import MachineEmbed from '#lib/components/guides/MachineEmbed.svelte';
	import type { InlinePiece } from '#lib/guides/types.ts';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import { OG_TYPE_ARTICLE, ogLocale } from '#lib/seo.ts';

	let { data } = $props();

	const guide = $derived(data.guide);
	const english = $derived(getLocale() === 'en');
	const title = $derived(english && guide.title.en ? guide.title.en : guide.title.id);
	const summary = $derived(english && guide.summary.en ? guide.summary.en : guide.summary.id);
	const pageTitle = $derived(`${title} · ${t('nav.panduan')} · ${t('app.name')}`);
	const localeTag = $derived(ogLocale(getLocale()));
	const prevTitle = $derived(
		guide.prev
			? english && guide.prev.cardTitle.en
				? guide.prev.cardTitle.en
				: guide.prev.cardTitle.id
			: ''
	);
	const nextTitle = $derived(
		guide.next
			? english && guide.next.cardTitle.en
				? guide.next.cardTitle.en
				: guide.next.cardTitle.id
			: ''
	);

	let tocOpen = $state(false);

	function closeToc() {
		tocOpen = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && tocOpen) {
			tocOpen = false;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={summary} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={summary} />
	<meta property="og:type" content={OG_TYPE_ARTICLE} />
	<meta property="og:locale" content={localeTag} />
</svelte:head>

{#snippet inlineText(pieces: InlinePiece[])}
	{#each pieces as piece, i (i)}{#if piece.kind === 'code'}<code>{piece.text}</code
			>{:else}{piece.text}{/if}{/each}
{/snippet}

{#snippet tocLinks(onclick?: () => void)}
	{#each guide.sections as section (section.id)}
		<a href="#{section.id}" {onclick}>{section.heading}</a>
	{/each}
	{#if guide.linkedQuestions.length > 0}
		<a href="#soal" {onclick}>{t('panduan.related_questions')}</a>
	{/if}
{/snippet}

<div class="guide-shell">
	<div class="phone-bar">
		<a class="back" href={resolve('/panduan')} aria-label={t('panduan.back')}>
			<span aria-hidden="true">‹</span>
			<span>{t('nav.panduan')}</span>
		</a>
		<button
			type="button"
			class="toc-toggle"
			aria-expanded={tocOpen}
			aria-controls="phone-toc"
			onclick={() => (tocOpen = !tocOpen)}
		>
			{t('panduan.toc_button')} ▾
		</button>
	</div>

	{#if tocOpen}
		<nav id="phone-toc" class="phone-toc" aria-label={t('panduan.toc_heading')}>
			{@render tocLinks(closeToc)}
		</nav>
	{/if}

	<div class="layout">
		<nav class="side-toc" aria-label={t('panduan.toc_heading')}>
			<span class="toc-label">{t('panduan.toc_heading')}</span>
			{@render tocLinks()}
		</nav>

		<article class="content">
			<nav class="crumbs" aria-label={t('panduan.crumbs')}>
				<a href={resolve('/panduan')}>{t('nav.panduan')}</a>
				<span aria-hidden="true">›</span>
				<span>{t(`panduan.topic.${guide.topic}`)}</span>
			</nav>

			<header class="head">
				<h1>{title}</h1>
				<div class="meta">
					<span class="topic">{t(`panduan.topic.${guide.topic}`)}</span>
					<span>{t('panduan.reading_time', { minutes: guide.readingMinutes })}</span>
					{#if guide.referencesText}
						<span>· {guide.referencesText}</span>
					{/if}
				</div>
			</header>

			{#each guide.intro as pieces, i (i)}
				<p>{@render inlineText(pieces)}</p>
			{/each}

			{#each guide.sections as section (section.id)}
				<section class="section" aria-labelledby={section.id}>
					<h2 id={section.id}>{section.heading}</h2>
					{#each section.blocks as block, j (j)}
						{#if block.kind === 'paragraph'}
							<p>{@render inlineText(block.pieces)}</p>
						{:else if block.kind === 'machine'}
							<MachineEmbed doc={block.doc} openHref={block.openHref} caption={block.caption} />
						{:else if block.kind === 'ordered-list'}
							<ol>
								{#each block.items as item, k (k)}
									<li>{@render inlineText(item)}</li>
								{/each}
							</ol>
						{:else}
							<ul>
								{#each block.items as item, k (k)}
									<li>{@render inlineText(item)}</li>
								{/each}
							</ul>
						{/if}
					{/each}
				</section>
			{/each}

			{#if guide.linkedQuestions.length > 0}
				<section id="soal" class="related" aria-labelledby="soal-heading">
					<h2 id="soal-heading">{t('panduan.related_questions')}</h2>
					<ul class="related-list">
						{#each guide.linkedQuestions as q (q.id)}
							<li>
								<a href={resolve('/soal/[id]', { id: q.id })}>
									<span class="q-title">{english ? q.title.en : q.title.id}</span>
									<span class="q-level">{t(`soal.difficulty.${q.difficulty}`)}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<footer class="pager">
				{#if guide.prev}
					<a class="pager-link" href={resolve('/panduan/[id]', { id: guide.prev.id })}>
						{t('panduan.prev', { title: prevTitle })}
					</a>
				{:else}
					<span class="pager-muted">{t('panduan.first_guide')}</span>
				{/if}

				{#if guide.next}
					<a class="pager-link" href={resolve('/panduan/[id]', { id: guide.next.id })}>
						{t('panduan.next', { title: nextTitle })}
					</a>
				{:else}
					<span class="pager-muted">{t('panduan.last_guide')}</span>
				{/if}
			</footer>
		</article>
	</div>
</div>

<style>
	.guide-shell {
		display: flex;
		flex-direction: column;
	}
	.phone-bar,
	.phone-toc {
		display: none;
	}
	.layout {
		display: flex;
		justify-content: center;
		gap: var(--space-10);
		max-width: 72.5rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
		box-sizing: border-box;
	}
	.side-toc {
		position: sticky;
		top: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 13.75rem;
		flex-shrink: 0;
		align-self: flex-start;
	}
	.toc-label {
		padding: 0 var(--space-3) var(--space-1);
		color: var(--color-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
	}
	.side-toc a,
	.phone-toc a {
		display: flex;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		color: var(--color-ink);
		text-decoration: none;
	}
	.side-toc a:hover,
	.phone-toc a:hover {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
	.side-toc a:focus-visible,
	.phone-toc a:focus-visible,
	.crumbs a:focus-visible,
	.related-list a:focus-visible,
	.pager-link:focus-visible,
	.back:focus-visible,
	.toc-toggle:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 45rem;
		min-width: 0;
		flex: 1;
		font-size: var(--text-base);
		line-height: var(--leading-normal);
	}
	h1,
	h2,
	p,
	ol,
	ul {
		margin: 0;
	}
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.crumbs a {
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
		color: var(--color-accent-ink);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h1 {
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.topic {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-2);
	}
	h2 {
		font-size: var(--text-xl);
		line-height: var(--leading-tight);
	}
	ol,
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-left: var(--space-6);
	}
	code {
		padding: 0 var(--space-1);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		font-family: var(--font-mono);
		font-size: 0.95em;
		line-height: 1;
	}
	.related {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}
	.related h2 {
		font-size: var(--text-lg);
	}
	.related-list {
		padding: 0;
		list-style: none;
	}
	.related-list a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
		text-decoration: none;
	}
	.related-list a:hover {
		border-color: var(--color-border-strong);
	}
	.q-level {
		color: var(--color-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-normal);
	}
	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
	}
	.pager-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
		text-decoration: none;
	}
	.pager-muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	@media (max-width: 63.99rem) {
		.side-toc,
		.crumbs {
			display: none;
		}
		.phone-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-2);
			padding: var(--space-1) var(--space-4);
			border-bottom: 1px solid var(--color-border);
			background: var(--color-surface);
		}
		.back {
			display: inline-flex;
			align-items: center;
			gap: var(--space-2);
			min-height: var(--target-min);
			color: var(--color-ink);
			font-weight: var(--weight-strong);
			text-decoration: none;
		}
		.toc-toggle {
			min-height: var(--target-min);
			padding: 0 var(--space-3);
			border: 1px solid var(--color-border-strong);
			border-radius: var(--radius-lg);
			background: var(--color-surface);
			color: var(--color-ink);
			font: inherit;
			font-size: var(--text-sm);
			font-weight: var(--weight-strong);
			cursor: pointer;
		}
		.phone-toc {
			display: flex;
			flex-direction: column;
			gap: var(--space-1);
			padding: var(--space-2) var(--space-4);
			border-bottom: 1px solid var(--color-border);
			background: var(--color-surface);
		}
		.layout {
			padding: var(--space-6) var(--space-4);
		}
	}
</style>
