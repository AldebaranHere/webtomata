<script lang="ts">
	import { onMount } from 'svelte';
	import { createMemoryStore, openStore } from '#lib/storage/index.ts';
	import { createAutosave } from '#lib/storage/autosave.ts';
	import type { PdaAutosave } from '#lib/storage/autosave.ts';
	import { openLatestPda, pdaDocumentCodec } from '#lib/storage/pda-work.ts';
	import type { OpenedPda, SkippedPda } from '#lib/storage/pda-work.ts';
	import PdaEditor from './PdaEditor.svelte';

	// The workstation for Pushdown Automata (PDA).
	// Opens its own storage and the latest PDA record on device.
	// Emits `onskipped` to inform the page of any unreadable records.
	// See docs/agent/PLAN.md (Task T-057).
	let {
		onskipped
	}: {
		onskipped?: (skipped: SkippedPda[]) => void;
	} = $props();

	let opened = $state<OpenedPda | null>(null);
	let autosave = $state<PdaAutosave | null>(null);
	let persistent = $state(true);

	onMount(() => {
		let active = true;

		void (async () => {
			const found = await openStore();
			if (!active) return;

			let { store, persistent: isPersistent } = found;
			let result: OpenedPda;
			try {
				result = await openLatestPda(store, () => Date.now());
			} catch {
				// The store opened but list threw: fall back to memory store
				store = createMemoryStore();
				isPersistent = false;
				result = await openLatestPda(store, () => Date.now());
			}
			if (!active) return;

			persistent = isPersistent;
			opened = result;
			onskipped?.(result.skipped);

			autosave = createAutosave({
				store,
				base: result.record,
				codec: pdaDocumentCodec
			});
		})();

		return () => {
			active = false;
		};
	});
</script>

{#if opened && autosave}
	{#key opened.record.id}
		<PdaEditor doc={opened.doc} {autosave} {persistent} />
	{/key}
{:else}
	<div class="frame" aria-busy="true"></div>
{/if}

<style>
	.frame {
		flex: 1;
		min-height: 0;
		background: var(--color-ground);
	}
</style>
