<script lang="ts">
	import { onMount } from 'svelte';
	import { engineVersion } from '#lib/engine/client.ts';

	let version = $state('');

	onMount(async () => {
		version = await engineVersion();
	});
</script>

<svelte:head>
	<title>WebTomata</title>
</svelte:head>

<main>
	<h1>WebTomata</h1>
	<p class="version"><code>{version}</code></p>
</main>

<style>
	main {
		padding: var(--space-8) var(--space-4);
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
		font-weight: var(--weight-strong);
	}
	.version {
		margin: 0;
		min-height: 1.5em;
		color: var(--color-muted);
	}
</style>
