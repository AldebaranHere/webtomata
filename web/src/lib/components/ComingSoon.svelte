<script lang="ts">
	import { resolve } from '$app/paths';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	// A page that is not built yet. `title` and `description` are message keys.
	let { title, description }: { title: MessageKey; description: MessageKey } = $props();
</script>

<svelte:head>
	<title>{t(title)} · {t('app.name')}</title>
	<meta name="description" content={t(description)} />
</svelte:head>

<div class="page">
	<h1>{t(title)}</h1>
	<p>{t('page.soon')}</p>
	<p><a href={resolve('/')}>{t('page.home')}</a></p>
</div>

<style>
	.page {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
		font-weight: var(--weight-strong);
	}
	p {
		margin: 0 0 var(--space-3);
		color: var(--color-muted);
	}
	a {
		color: var(--color-accent-ink);
	}
</style>
