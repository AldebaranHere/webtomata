<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import '#lib/styles/base.css';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { loadLocale, t } from '#lib/i18n/index.svelte.ts';

	let { children } = $props();

	// The Sandbox and the page of a question are apps that fill the screen: no footer, and the editor takes the height.
	const app = $derived(page.route.id === '/sandbox' || page.route.id === '/soal/[id]');

	// The pages are prerendered in Indonesian; this applies the language the user saved.
	onMount(loadLocale);
</script>

<a class="skip" href="#main">{t('nav.skip')}</a>

<div class="shell" class:app>
	<SiteHeader />
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
	{#if !app}
		<SiteFooter />
	{/if}
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
	.app {
		height: 100dvh;
	}
	.app main {
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	main:focus {
		outline: none;
	}
</style>
