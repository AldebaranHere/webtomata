<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Component } from 'svelte';
	import Editor from '#lib/editor/Editor.svelte';
	import Toast from '#lib/editor/Toast.svelte';
	import { endsWith01 } from '#lib/editor/diagram/samples.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { library } from '#lib/storage/library.svelte.ts';

	// The Sandbox opens the machine of the last visit, saved on this device (docs/decisions/0023).
	// With nothing saved it opens the sample, until the first-run screen (X1) replaces that. The page
	// is prerendered with an empty frame the size of the editor, and the editor takes its place when
	// the machine has been read, so that a reload does not show the sample for a moment.
	let editor = $state<Editor | undefined>();
	let skipped = $state(true);

	onMount(() => {
		skipped = false;
		void library.start(endsWith01);
	});
	onDestroy(() => {
		library.hide();
		library.dispose();
	});

	// The title of the open machine is changed through the editor, so that undo works.
	$effect(() => {
		library.renameCurrent = (title) => editor?.setTitle(title) ?? null;
	});

	// The list is code that is needed only when it is opened: it is loaded then.
	let Dialog = $state<Component | null>(null);
	$effect(() => {
		if (library.open && !Dialog) {
			void import('#lib/editor/LibraryDialog.svelte').then((module) => (Dialog = module.default));
		}
	});

	const notice = $derived.by(() => {
		const list = library.skipped;
		if (skipped || list.length === 0) return null;
		if (list.length > 1) return t('storage.skipped_many', { count: list.length });
		const [one] = list;
		return t(`storage.skipped_${one!.reason}` as MessageKey, { title: one!.title });
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
		<button type="button" onclick={() => (skipped = true)}>{t('storage.dismiss')}</button>
	</p>
{/if}
{#if library.current}
	{#key library.current.opened.record.id}
		<Editor
			bind:this={editor}
			doc={library.current.opened.doc}
			autosave={library.current.autosave}
			persistent={library.persistent}
			library={{ count: library.count, onopen: library.show }}
		/>
	{/key}
{:else}
	<div class="frame" aria-busy="true"></div>
{/if}
{#if Dialog}<Dialog />{/if}
{#if library.deleted && !library.open}
	<div class="toast-slot">
		<Toast
			toast={library.deleted}
			onundo={() => library.undoDelete()}
			ondismiss={() => library.dismissDeleted()}
		/>
	</div>
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
	/* The toast of a delete when the list is closed. */
	.toast-slot {
		position: fixed;
		inset: 0;
		pointer-events: none;
	}
	.toast-slot :global(.toast) {
		pointer-events: auto;
	}
</style>
