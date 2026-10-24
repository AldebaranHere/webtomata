<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import { engineVersion } from '#lib/engine/client.ts';
	import { engineProblem } from '#lib/engine/problem.ts';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let version = $state('');
	let problem = $state<EngineProblem>();

	// The engine starts after the first render. Its version proves that the worker, the WASM file
	// and the CSP work (the smoke test and the browser tests wait for it). If it fails, the user
	// sees a notice with a button to try again.
	async function loadVersion() {
		problem = undefined;
		try {
			version = await engineVersion();
		} catch (error) {
			problem = engineProblem(error);
		}
	}
	onMount(loadVersion);

	const entries = [
		{ href: '/sandbox', name: 'nav.sandbox', hint: 'home.sandbox_hint' },
		{ href: '/soal', name: 'nav.soal', hint: 'home.soal_hint' },
		{ href: '/panduan', name: 'nav.panduan', hint: 'home.panduan_hint' }
	] as const;
</script>

<svelte:head>
	<title>{t('app.name')}</title>
	<meta name="description" content={t('home.description')} />
</svelte:head>

<div class="page">
	<h1>{t('app.name')}</h1>
	<p class="tagline">{t('app.tagline')}</p>

	<ul class="entries">
		{#each entries as { href, name, hint } (href)}
			<li>
				<a href={resolve(href)}>
					<span class="name">{t(name)}</span>
					<span class="hint">{t(hint)}</span>
				</a>
			</li>
		{/each}
	</ul>

	{#if problem}
		<div class="problem"><EngineNotice {problem} onretry={loadVersion} /></div>
	{/if}

	<p class="version">{t('home.engine')} <code>{version}</code></p>
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
	.tagline {
		margin: 0 0 var(--space-6);
		font-size: var(--text-md);
		color: var(--color-muted);
	}
	.entries {
		display: grid;
		gap: var(--space-3);
		margin: 0 0 var(--space-8);
		padding: 0;
		list-style: none;
	}
	.entries a {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-height: var(--target-min);
		padding: var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-ink);
		text-decoration: none;
	}
	.entries a:hover {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
	}
	.name {
		font-size: var(--text-lg);
		font-weight: var(--weight-strong);
	}
	.hint {
		color: var(--color-muted);
	}
	.problem {
		margin-bottom: var(--space-4);
	}
	.version {
		margin: 0;
		min-height: 1.5em;
		font-size: var(--text-sm);
		color: var(--color-muted);
	}
</style>
