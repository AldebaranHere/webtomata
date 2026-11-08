// Shared autosave wiring between editor components (Editor.svelte and PdaEditor.svelte).
// Subscribes to document changes from the editor, schedules saves on the autosave queue,
// coordinates pagehide/visibilitychange flushes, handles beforeunload warnings,
// and computes save status and problem indications.
// See docs/agent/PLAN.md (Task T-057) and docs/decisions/0048-pda-editor-shell.md.

import { untrack } from 'svelte';
import type { BaseAutosave, SaveStatus } from '#lib/storage/autosave.ts';

export interface AutosaveEditorTarget<D> {
	getState(): { readonly doc: D };
	subscribe(fn: () => void): () => void;
}

export interface AutosaveBindingOptions<D> {
	editor: AutosaveEditorTarget<D>;
	autosave: () => BaseAutosave<D> | undefined;
	persistent: () => boolean;
	dirty: () => boolean;
}

export interface AutosaveBindingResult {
	readonly saveStatus: SaveStatus;
	readonly problem: 'unavailable' | 'failed' | null;
}

export function useAutosaveBinding<D>(options: AutosaveBindingOptions<D>): AutosaveBindingResult {
	const { editor, autosave, persistent, dirty } = options;

	let saveStatus = $state<SaveStatus>(untrack(() => autosave()?.status() ?? 'saved'));

	$effect(() => {
		const save = autosave();
		if (!save) return;
		saveStatus = save.status();
		return save.subscribe(() => (saveStatus = save.status()));
	});

	// The store is asked, not the reactive copy of its state: that is a proxy, and a proxy of a
	// document is never the same object as the document.
	$effect(() => {
		const save = autosave();
		if (!save) return;
		let last = editor.getState().doc;
		return editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			save.schedule(next);
		});
	});

	$effect(() => {
		const save = autosave();
		if (!save) return;
		const flush = () => void save.flush();
		const onVisibility = () => document.visibilityState === 'hidden' && flush();
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', flush);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', flush);
			flush();
		};
	});

	const problem = $derived(!persistent() ? 'unavailable' : saveStatus === 'failed' ? 'failed' : null);

	// Leaving the page loses the changes that are not saved on the device: ask first.
	const unsaved = $derived(
		autosave() ? (persistent() ? saveStatus !== 'saved' : dirty()) : dirty()
	);

	$effect(() => {
		if (!unsaved) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});

	return {
		get saveStatus() {
			return saveStatus;
		},
		get problem() {
			return problem;
		}
	};
}
