<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '#lib/editor/Editor.svelte';
	import { endsWith01 } from '#lib/editor/diagram/samples.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { createAutosave, openLatest, openStore } from '#lib/storage/index.ts';
	import type { Autosave, Opened, Skipped } from '#lib/storage/index.ts';
	import { createMemoryStore } from '#lib/storage/memory.ts';

	// The Sandbox opens the machine of the last visit, saved on this device (docs/decisions/0023).
	// With nothing saved it opens the sample, until the first-run screen (X1) replaces that. The page
	// is prerendered with an empty frame the size of the editor, and the editor takes its place when
	// the machine has been read, so that a reload does not show the sample for a moment.
	let loaded = $state<{
		opened: Opened;
		autosave: Autosave;
		persistent: boolean;
	} | null>(null);
	let skipped = $state<Skipped[]>([]);

	onMount(async () => {
		let { store, persistent } = await openStore();
		let opened: Opened;
		try {
			opened = await openLatest(store, endsWith01);
		} catch {
			// The store opened but does not work: the editor goes on in memory, and says so.
			store = createMemoryStore();
			persistent = false;
			opened = await openLatest(store, endsWith01);
		}
		skipped = opened.skipped;
		loaded = { opened, autosave: createAutosave({ store, base: opened.record }), persistent };
	});

	const notice = $derived.by(() => {
		if (skipped.length === 0) return null;
		if (skipped.length > 1) return t('storage.skipped_many', { count: skipped.length });
		const [one] = skipped;
		return t(`storage.skipped_${one!.reason}`, { title: one!.title });
	});
</script>

<svelte:head>
	<title>{t('nav.sandbox')} · {t('app.name')}</title>
	<meta name="description" content={t('sandbox.description')} />
</svelte:head>

<h1 class="sr-only">{t('nav.sandbox')}</h1>
{#if notice}
	<p class="notice" role="status">
		<span>{notice}</span>
		<button type="button" onclick={() => (skipped = [])}>{t('storage.dismiss')}</button>
	</p>
{/if}
{#if loaded}
	<Editor doc={loaded.opened.doc} autosave={loaded.autosave} persistent={loaded.persistent} />
{:else}
	<div class="frame" aria-busy="true"></div>
{/if}

<style>
	.frame {
		flex: 1;
		min-height: 0;
		background: var(--color-ground);
	}
	.notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-2) var(--space-4);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.notice button {
		flex: none;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: var(--weight-strong);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
