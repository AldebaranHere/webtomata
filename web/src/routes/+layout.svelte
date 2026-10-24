<script lang="ts">
	import { onMount } from 'svelte';
	import '#lib/styles/base.css';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { loadLocale, t } from '#lib/i18n/index.svelte.ts';

	let { children } = $props();

	// The pages are prerendered in Indonesian; this applies the language the user saved.
	onMount(loadLocale);
</script>

<a class="skip" href="#main">{t('nav.skip')}</a>

<div class="shell">
	<SiteHeader />
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
	<footer>
		<p>{t('app.privacy')}</p>
	</footer>
</div>

<style>
	.skip {
		position: absolute;
		left: var(--space-2);
		top: var(--space-2);
		z-index: 1;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		transform: translateY(-200%);
	}
	.skip:focus {
		transform: none;
	}
	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	main {
		flex: 1;
	}
	main:focus {
		outline: none;
	}
	footer {
		padding: var(--space-4);
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	footer p {
		margin: 0;
	}
</style>
