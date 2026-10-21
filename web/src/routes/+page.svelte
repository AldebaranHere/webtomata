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

<h1>WebTomata</h1>
<p class="version"><code>{version}</code></p>

<style>
	.version {
		min-height: 1.5em;
	}
</style>
