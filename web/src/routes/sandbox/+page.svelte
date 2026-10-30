<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Component } from 'svelte';
	import Editor from '#lib/editor/Editor.svelte';
	import Toast from '#lib/editor/Toast.svelte';
	import LanguageWorkstation from '#lib/language/LanguageWorkstation.svelte';
	import { createDocument } from '#lib/editor/document.ts';
	import type { MachineDocument } from '#lib/editor/document.ts';
	import { decodeLink, linkFragment } from '#lib/share/link.ts';
	import { markTourSeen, tourSeen } from '#lib/editor/tour.ts';
	import { EXAMPLES, buildExample, exampleParam } from '#lib/examples/examples.ts';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import { id as idMessages } from '#lib/i18n/id.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { OG_TYPE_WEBSITE, ogLocale } from '#lib/seo.ts';
	import { library } from '#lib/storage/library.svelte.ts';
	import { localizedTitle } from '#lib/storage/titles.ts';

	const localeTag = $derived(ogLocale(getLocale()));
	const pageTitle = $derived(`${t('nav.sandbox')} · ${t('app.name')}`);

	// The Sandbox opens the machine of the last visit, saved on this device (docs/decisions/0023).
	// With nothing saved it opens an empty machine, and the editor shows "Coba contoh" over it (X1).
	// The page is prerendered with an empty frame the size of the editor, and the editor takes its
	// place when the machine has been read, so that a reload does not show the card for a moment.
	let editor = $state<Editor | undefined>();
	let skipped = $state(true);
	let activeMode = $state<'fsm' | 'language'>('fsm');

	// A link of a shared machine (`#m1=...`) opens as a machine of its own, never over the one of the
	// student, and the address is cleaned so that a reload does not open it again.
	let linkNote = $state<{ key: MessageKey; params: Record<string, string | number> } | null>(null);
	// What was changed when a file was opened (a label that became a chain of states, a name that was repaired).
	let fileNotes = $state.raw<{ key: MessageKey; params: Record<string, string | number> }[]>([]);
	async function openLink() {
		const exampleId = exampleParam(location.search);
		if (exampleId !== null) {
			history.replaceState(null, '', location.pathname + location.hash);
			const example = EXAMPLES.find((e) => e.id === exampleId);
			if (example) {
				fileNotes = [];
				exampleFailed = (await library.openExample(buildExample(example, getLocale()))) !== null;
			}
			return;
		}
		const fragment = linkFragment(location.hash);
		if (fragment === null) return;
		fileNotes = [];
		history.replaceState(null, '', location.pathname + location.search);
		const result = await decodeLink(fragment);
		if (!result.ok) {
			// A message that has no words of its own is a damaged link.
			const known = Object.hasOwn(idMessages, result.error.key);
			linkNote = known
				? { key: result.error.key as MessageKey, params: result.error.params }
				: { key: 'share.invalid_link', params: {} };
			return;
		}
		const doc = result.value;
		const problem = await library.openExample({
			doc,
			titles: { id: doc.title, en: doc.title },
			tests: []
		});
		linkNote = problem
			? { key: problem.key as MessageKey, params: problem.params }
			: {
					key: 'share.opened',
					params: { title: doc.title || t('editor.untitled') }
				};
	}

	onMount(() => {
		skipped = false;
		seen = tourSeen();
		const urlMode = new URLSearchParams(window.location.search).get('mode');
		if (urlMode === 'language') {
			activeMode = 'language';
		}
		void library.start(() => ({ doc: createDocument() })).then(openLink);
		// A link pasted in a tab that already shows the Sandbox only changes the fragment: the page is not
		// loaded again, so the change itself must open it.
		const onHash = () => void openLink();
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});
	onDestroy(() => {
		library.hide();
		library.dispose();
	});

	// The title of the open machine is changed through the editor, so that undo works.
	$effect(() => {
		library.renameCurrent = (title) => editor?.setTitle(title) ?? null;
	});

	// The tour: code that is needed only when it is opened. It is seen when it is closed in any way.
	let seen = $state(false);
	let tourOpen = $state(false);
	let Tour = $state<Component<{ onclose: () => void }> | null>(null);
	function openTour() {
		tourOpen = true;
		if (!Tour) {
			void import('#lib/editor/TourDialog.svelte').then((module) => (Tour = module.default));
		}
	}
	function closeTour() {
		tourOpen = false;
		markTourSeen();
		seen = true;
	}

	// An example from "Coba contoh": in the place of the empty machine (see placeExample).
	let exampleFailed = $state(false);
	async function openExample(id: string) {
		const example = EXAMPLES.find((e) => e.id === id);
		if (!example) return;
		exampleFailed = (await library.openExample(buildExample(example, getLocale()))) !== null;
	}

	// A file of a machine, from "Buka file…": always a new machine, never over the open one. The code that reads
	// it (and the engine) is loaded only now. A file that cannot be opened is said in the list, which stays open.
	const known = (key: string) => Object.hasOwn(idMessages, key);
	async function openFromFile(file: File) {
		const [{ openFile }, { engine }] = await Promise.all([
			import('#lib/share/open-file.ts'),
			import('#lib/engine/client.ts')
		]);
		const result = await openFile(file, engine);
		if (!result.ok) {
			library.problem = known(result.error.key)
				? { key: result.error.key, params: result.error.params }
				: { key: 'import.unreadable', params: {} };
			return;
		}
		const { doc, notes } = result.value;
		const problem = await library.openDocument(doc);
		if (problem) return;
		fileNotes = notes
			.filter((note) => known(note.key))
			.map((note) => ({ key: note.key as MessageKey, params: note.params }));
		linkNote = {
			key: 'import.opened',
			params: { title: doc.title || t('editor.untitled') }
		};
	}
	$effect(() => {
		library.openFile = (file) => void openFromFile(file);
	});

	// The share dialog is code that is needed only when it is opened: it is loaded then.
	let sharing = $state.raw<MachineDocument | null>(null);
	let ShareDialog = $state<Component<{ doc: MachineDocument; onclose: () => void }> | null>(null);
	// The row action of "Mesin saya": a saved machine is read, and the list gives way to the dialog.
	async function shareSaved(id: string) {
		const doc = await library.readDocument(id);
		if (!doc) return;
		library.hide();
		share(doc);
	}
	$effect(() => {
		library.share = (id) => void shareSaved(id);
	});
	function share(doc: MachineDocument) {
		sharing = doc;
		if (!ShareDialog) {
			void import('#lib/share/ShareDialog.svelte').then((module) => (ShareDialog = module.default));
		}
	}

	// The list is code that is needed only when it is opened: it is loaded then.
	let Dialog = $state<Component | null>(null);
	$effect(() => {
		if (library.open && !Dialog) {
			void import('#lib/editor/LibraryDialog.svelte').then((module) => (Dialog = module.default));
		}
	});

	// The other saved machines, for the second machine of a union.
	const others = $derived(
		library.entries
			.filter((entry) => entry.id !== library.current?.opened.record.id)
			.map((entry) => ({
				id: entry.id,
				title: localizedTitle(entry.titles, entry.title, getLocale()) || t('editor.untitled'),
				kind: entry.kind,
				stamp: entry.updatedAt,
				readable: entry.readable
			}))
	);

	const notice = $derived.by(() => {
		const list = library.skipped;
		if (skipped || list.length === 0) return null;
		if (list.length > 1) return t('storage.skipped_many', { count: list.length });
		const [one] = list;
		return t(`storage.skipped_${one!.reason}` as MessageKey, { title: one!.title });
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={t('sandbox.description')} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={t('sandbox.description')} />
	<meta property="og:type" content={OG_TYPE_WEBSITE} />
	<meta property="og:locale" content={localeTag} />
</svelte:head>

<h1 class="sr-only">{t('nav.sandbox')}</h1>
{#if linkNote}
	<div class="notice" role="status">
		<div>
			{t(linkNote.key, linkNote.params)}
			{#if fileNotes.length > 0}
				{t('import.notes_label')}
				<ul>
					{#each fileNotes as note, i (i)}<li>{t(note.key, note.params)}</li>{/each}
				</ul>
			{/if}
		</div>
		<button type="button" onclick={() => (linkNote = null)}>{t('storage.dismiss')}</button>
	</div>
{/if}
{#if notice}
	<p class="notice" role="status">
		<span>{notice}</span>
		<button type="button" onclick={() => (skipped = true)}>{t('storage.dismiss')}</button>
	</p>
{/if}

<div class="mode-bar" class:fsm-mode={activeMode === 'fsm'}>
	<div class="mode-toggles" role="group" aria-label={t('sandbox.mode_aria')}>
		<button
			type="button"
			aria-pressed={activeMode === 'fsm'}
			class="mode-btn"
			class:active={activeMode === 'fsm'}
			onclick={() => (activeMode = 'fsm')}
		>
			<span>{t('sandbox.mode_fsm')}</span>
		</button>
		<button
			type="button"
			aria-pressed={activeMode === 'language'}
			class="mode-btn"
			class:active={activeMode === 'language'}
			onclick={() => (activeMode = 'language')}
		>
			<span>{t('sandbox.mode_language')}</span>
		</button>
	</div>
</div>

{#if activeMode === 'language'}
	<LanguageWorkstation />
{:else if library.current}
	{#key library.current.key}
		<Editor
			bind:this={editor}
			doc={library.current.opened.doc}
			autosave={library.current.autosave}
			persistent={library.persistent}
			titles={library.current.opened.record.titles}
			tests={library.current.opened.record.tests}
			library={{ count: library.count, onopen: library.show }}
			firstRun={{
				examples: EXAMPLES,
				tourSeen: seen,
				failed: exampleFailed,
				onexample: (id) => void openExample(id),
				ontour: openTour
			}}
			onhelp={openTour}
			onopendoc={(doc) => void library.openDocument(doc, true)}
			onshare={share}
			machines={{ others, load: (id) => library.readDocument(id) }}
		/>
	{/key}
{:else}
	<div class="frame" aria-busy="true"></div>
{/if}
{#if Dialog}<Dialog />{/if}
{#if sharing && ShareDialog}<ShareDialog doc={sharing} onclose={() => (sharing = null)} />{/if}
{#if tourOpen && Tour}<Tour onclose={closeTour} />{/if}
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
	.mode-bar {
		display: flex;
		align-items: center;
		padding: var(--space-2) var(--space-4);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}
	@media (max-width: 640px) {
		.mode-bar.fsm-mode {
			display: none;
		}
	}
	.mode-toggles {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		background: var(--color-ground);
		padding: 2px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}
	.mode-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.mode-btn:hover {
		color: var(--color-ink);
	}
	.mode-btn.active {
		background: var(--color-surface);
		color: var(--color-accent-ink);
		border-color: var(--color-border);
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
	.notice ul {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-4);
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
