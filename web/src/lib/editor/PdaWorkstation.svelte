<script lang="ts">
	import '#lib/i18n/pda-messages.ts'; // The PDA messages travel with this workstation only (T-063).
	import { onDestroy, onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { library } from '#lib/storage/library.svelte.ts';
	import type { Problem } from '#lib/storage/library.ts';
	import { createAutosave } from '#lib/storage/autosave.ts';
	import type { PdaAutosave } from '#lib/storage/autosave.ts';
	import { createPdaDocument, serializePdaDocument } from '#lib/editor/pda-document.ts';
	import {
		openLatestPda,
		pdaDocumentCodec,
		placePdaExample,
		readStoredPda
	} from '#lib/storage/pda-work.ts';
	import type { OpenedPda, SkippedPda } from '#lib/storage/pda-work.ts';
	import { isPdaRecord, newId } from '#lib/storage/store.ts';
	import type { MachineStore, SavedPdaMachine } from '#lib/storage/store.ts';
	import type { FirstRunRow } from './FirstRun.svelte';
	import PdaEditor from './PdaEditor.svelte';
	import { PDA_SAMPLES } from './pda-samples.ts';

	// The workstation for Pushdown Automata (PDA).
	// Uses the shared library store and the latest PDA record on device.
	// Emits `onskipped` to inform the page of any unreadable records.
	// An empty document shows "Coba contoh" (T-073): one tap copies a sample into a PDA record.
	// See docs/agent/PLAN.md (Task T-057, T-073, T-074).
	let {
		onskipped,
		openRequest
	}: {
		onskipped?: (skipped: SkippedPda[]) => void;
		openRequest?: { id: string; seq: number } | null;
	} = $props();

	let pdaEditor = $state<ReturnType<typeof PdaEditor> | undefined>();
	let opened = $state<OpenedPda | null>(null);
	let autosave = $state<PdaAutosave | null>(null);
	let persistent = $state(true);
	/** The store from library: null until library is ready. */
	let machineStore: MachineStore | null = null;
	/** The last example could not be written: the card says so calmly and the editor stays. */
	let failed = $state(false);
	/** A replaced record keeps its id: the editor is made again when this changes (as Library.Current.key). */
	let editorKey = $state(0);
	let active = true;

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
			library.pdaCurrentId = placed.record.id;
			await library.refresh();
		} catch {
			// The card shows `first.failed`; the record and the editor are as they were.
			failed = true;
		}
	}

	async function openPdaById(id: string): Promise<Problem | null> {
		if (!machineStore) return null;
		if (opened?.record.id === id) {
			return null;
		}
		const record = await machineStore.get(id);
		if (!record || !isPdaRecord(record)) return { key: 'library.missing', params: {} };
		const read = readStoredPda(record.doc);
		if (!read.ok) return { key: 'library.unreadable', params: {} };
		await autosave?.flush();
		autosave?.dispose();
		const updatedRecord = { ...record, openedAt: Date.now() };
		try {
			await machineStore.put(updatedRecord);
		} catch {
			// refused write does not stop opening
		}
		opened = { record: updatedRecord, doc: read.doc, skipped: [] };
		autosave = createAutosave({
			store: machineStore,
			base: updatedRecord,
			codec: pdaDocumentCodec
		});
		editorKey++;
		library.pdaCurrentId = updatedRecord.id;
		await library.refresh();
		return null;
	}

	async function newPdaMachine(): Promise<Problem | null> {
		if (!machineStore) return null;
		await autosave?.flush();
		autosave?.dispose();
		const emptyDoc = createPdaDocument();
		const time = Date.now();
		const record: SavedPdaMachine = {
			id: newId(),
			recordVersion: 1,
			type: 'pda',
			title: emptyDoc.title,
			kind: emptyDoc.kind,
			createdAt: time,
			updatedAt: time,
			openedAt: time,
			doc: serializePdaDocument(emptyDoc)
		};
		try {
			await machineStore.put(record);
		} catch {
			// refused write does not stop opening
		}
		opened = { record, doc: emptyDoc, skipped: [] };
		autosave = createAutosave({
			store: machineStore,
			base: record,
			codec: pdaDocumentCodec
		});
		editorKey++;
		library.pdaCurrentId = record.id;
		await library.refresh();
		return null;
	}

	// Register hooks on library
	$effect(() => {
		if (active) {
			library.flushPda = async () => {
				await autosave?.flush();
			};
			library.openPda = openPdaById;
			library.newPdaMachine = newPdaMachine;
			library.renameCurrent = (title) => pdaEditor?.setTitle(title) ?? null;
		}
	});

	// Handle external open requests (from page)
	$effect(() => {
		if (openRequest?.id) {
			void openPdaById(openRequest.id);
		}
	});

	// Initial load once library is ready
	$effect(() => {
		if (!active || !library.ready || !library.store || opened) return;
		persistent = library.persistent;
		machineStore = library.store;
		void (async () => {
			let result: OpenedPda;
			try {
				result = await openLatestPda(machineStore!, () => Date.now());
			} catch {
				return;
			}
			if (!active) return;
			opened = result;
			library.pdaCurrentId = result.record.id;
			onskipped?.(result.skipped);
			autosave = createAutosave({
				store: machineStore!,
				base: result.record,
				codec: pdaDocumentCodec
			});
		})();
	});

	onMount(() => {
		active = true;
		return () => {
			active = false;
		};
	});

	onDestroy(() => {
		active = false;
		autosave?.dispose();
		if (library.pdaCurrentId === opened?.record.id) {
			library.pdaCurrentId = null;
		}
	});
</script>

{#if opened && autosave}
	{#key editorKey}
		<PdaEditor
			bind:this={pdaEditor}
			doc={opened.doc}
			{autosave}
			{persistent}
			library={{ count: library.count, onopen: library.show }}
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
