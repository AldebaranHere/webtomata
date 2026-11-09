<script lang="ts">
	import '#lib/i18n/pda-messages.ts'; // The PDA messages travel with this workstation only (T-063).
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { createMemoryStore, openStore } from '#lib/storage/index.ts';
	import { createAutosave } from '#lib/storage/autosave.ts';
	import type { PdaAutosave } from '#lib/storage/autosave.ts';
	import { openLatestPda, pdaDocumentCodec, placePdaExample } from '#lib/storage/pda-work.ts';
	import type { OpenedPda, SkippedPda } from '#lib/storage/pda-work.ts';
	import type { MachineStore } from '#lib/storage/store.ts';
	import type { FirstRunRow } from './FirstRun.svelte';
	import PdaEditor from './PdaEditor.svelte';
	import { PDA_SAMPLES } from './pda-samples.ts';

	// The workstation for Pushdown Automata (PDA).
	// Opens its own storage and the latest PDA record on device.
	// Emits `onskipped` to inform the page of any unreadable records.
	// An empty document shows "Coba contoh" (T-073): one tap copies a sample into a PDA record.
	// See docs/agent/PLAN.md (Task T-057 and T-073).
	let {
		onskipped
	}: {
		onskipped?: (skipped: SkippedPda[]) => void;
	} = $props();

	let opened = $state<OpenedPda | null>(null);
	let autosave = $state<PdaAutosave | null>(null);
	let persistent = $state(true);
	/** The store that was opened, kept for the card: null until the page has one. */
	let machineStore: MachineStore | null = null;
	/** The last example could not be written: the card says so calmly and the editor stays. */
	let failed = $state(false);
	/** A replaced record keeps its id: the editor is made again when this changes (as Library.Current.key). */
	let editorKey = $state(0);

	// The three samples of T-033, in this order (PDA_SAMPLES), with the texts that travel with the
	// PDA mode and the chip of the document kind. No tour in this mode.
	const EXAMPLES = [
		{
			id: 'anbn',
			sample: PDA_SAMPLES[0]!,
			title: 'pda_first.anbn_title',
			description: 'pda_first.anbn_description',
			chip: 'kind.dpda'
		},
		{
			id: 'wcwr',
			sample: PDA_SAMPLES[1]!,
			title: 'pda_first.wcwr_title',
			description: 'pda_first.wcwr_description',
			chip: 'kind.dpda'
		},
		{
			id: 'wwr',
			sample: PDA_SAMPLES[2]!,
			title: 'pda_first.wwr_title',
			description: 'pda_first.wwr_description',
			chip: 'kind.ndpda'
		}
	] as const;

	const examples = $derived(
		EXAMPLES.map((example): FirstRunRow => ({
			id: example.id,
			title: t(example.title),
			description: t(example.description),
			chip: t(example.chip)
		}))
	);

	/** Taps a row: copies the sample into the record of the empty document, or into a new one. */
	async function openExample(id: string) {
		const example = EXAMPLES.find((item) => item.id === id);
		if (!example || !machineStore) return;
		failed = false;
		try {
			await autosave?.flush();
			const placed = await placePdaExample(machineStore, opened?.record.id, example.sample, () =>
				Date.now()
			);
			autosave?.dispose();
			opened = { record: placed.record, doc: placed.doc, skipped: [] };
			autosave = createAutosave({
				store: machineStore,
				base: placed.record,
				codec: pdaDocumentCodec
			});
			editorKey++;
		} catch {
			// The card shows `first.failed`; the record and the editor are as they were.
			failed = true;
		}
	}

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
			machineStore = store;
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
	{#key editorKey}
		<PdaEditor
			doc={opened.doc}
			{autosave}
			{persistent}
			firstRun={{ examples, failed, onexample: (id) => void openExample(id) }}
		/>
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
