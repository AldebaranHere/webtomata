<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { library } from '#lib/storage/library.svelte.ts';
	import LanguageSwitch from './LanguageSwitch.svelte';

	const links = [
		{ href: '/sandbox', label: 'nav.sandbox' },
		{ href: '/soal', label: 'nav.soal' },
		{ href: '/panduan', label: 'nav.panduan' }
	] as const;

	// On a phone the links are behind the Menu button.
	let open = $state(false);
	afterNavigate(() => (open = false));
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (open = false)} />

<header>
	<a class="brand" href={resolve('/')}>{t('app.name')}</a>
	<button
		type="button"
		class="menu"
		aria-expanded={open}
		aria-controls="site-nav"
		onclick={() => (open = !open)}
	>
		{t('nav.menu')}
	</button>
	<nav id="site-nav" aria-label={t('nav.label')} class:open>
		<ul>
			{#each links as { href, label } (href)}
				<li>
					<a href={resolve(href)} aria-current={page.url.pathname === href ? 'page' : undefined}
						>{t(label)}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
	{#if page.route.id === '/sandbox' && library.ready}
		<button type="button" class="machines" onclick={library.show}>
			{t('library.open_button', { count: library.count })}
		</button>
	{/if}
	<LanguageSwitch />
</header>

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		min-height: var(--space-14);
		padding: var(--space-1) var(--space-4);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}
	.brand {
		font-size: var(--text-md);
		font-weight: var(--weight-strong);
		color: var(--color-ink);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
	}
	nav {
		order: 3;
		width: 100%;
		display: none;
	}
	nav.open {
		display: block;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0 0 var(--space-2);
		list-style: none;
	}
	nav a {
		display: flex;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		color: var(--color-ink);
		text-decoration: none;
	}
	nav a:hover {
		background: var(--color-neutral-tint);
	}
	nav a[aria-current='page'] {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.menu {
		margin-left: auto;
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--weight-strong);
		cursor: pointer;
	}

	/* "Mesin saya": in the header on a laptop; a phone has its button in the title bar of the editor. */
	.machines {
		display: none;
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--weight-strong);
		cursor: pointer;
	}
	.machines:hover {
		background: var(--color-neutral-tint);
	}

	/* The one breakpoint: from here the links sit in the bar and the Menu button goes away. */
	@media (min-width: 40rem) {
		.menu {
			display: none;
		}
		.machines {
			display: inline-flex;
			align-items: center;
		}
		nav {
			order: 0;
			width: auto;
			display: block;
			flex-grow: 1;
		}
		ul {
			flex-direction: row;
			padding: 0;
		}
	}
</style>
