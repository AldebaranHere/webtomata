<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import { engine } from '#lib/engine/client.ts';
	import Announcer from './Announcer.svelte';
	import ChecksList from './ChecksList.svelte';
	import SidePanel from './SidePanel.svelte';
	import { createChecker } from './checker.ts';
	import { flagsOf } from './checks.ts';
	import SaveStatusLine from './SaveStatusLine.svelte';
	import type { Autosave, SaveStatus } from '#lib/storage/index.ts';
	import type { Titles } from '#lib/storage/store.ts';
	import { localizedTitle } from '#lib/storage/titles.ts';
	import EditorCanvas from './EditorCanvas.svelte';
	import HistoryButtons from './HistoryButtons.svelte';
	import { toMachine } from './document.ts';
	import type { MachineDocument } from './document.ts';
	import { createEditor } from './interaction/editor.ts';
	import ToolRail from './ToolRail.svelte';
	import Toast from './Toast.svelte';

	// The editor of a machine: the tools, the canvas and the title bar. It starts from `doc`; later
	// changes to the prop are not read (the editor owns the document and its history).
	//
	// With `autosave`, each change of the document is saved on the device a little later, and the
	// title bar says so. `persistent` is false when the browser gives no storage.
	let {
		doc,
		autosave,
		persistent = true,
		titles,
		library
	}: {
		doc: MachineDocument;
		autosave?: Autosave;
		persistent?: boolean;
		/** The titles of a machine from our content: the bar shows the one of the language. */
		titles?: Titles;
		/** The list of saved machines: how many, and how to open it (a phone has its button here). */
		library?: { count: number; onopen: () => void };
	} = $props();

	/** The title of the machine, as one undo step (the list "Mesin saya" calls this). */
	export function setTitle(title: string) {
		return editor.setTitle(title);
	}

	const editor = createEditor(untrack(() => doc));
	// The page is drawn before it takes keys and touches; the tests wait for this mark.
	let ready = $state(false);
	onMount(() => (ready = true));
	let snapshot = $state(editor.getState());
	let canvas: EditorCanvas;
	$effect(() => editor.subscribe(() => (snapshot = editor.getState())));

	// The checks: the engine (in its worker) looks at the machine a moment after each change, and
	// the states that have something to look at get a mark on the diagram.
	const checker = createChecker({ validate: (d) => engine.validate(toMachine(d)) });
	let checks = $state.raw({
		status: checker.status(),
		items: checker.items(),
		problem: checker.problem()
	});
	$effect(() => {
		const read = () =>
			(checks = { status: checker.status(), items: checker.items(), problem: checker.problem() });
		const stop = checker.subscribe(read);
		// A new check only when the document is a new one (not for a selection or a tool).
		let last = untrack(() => editor.getState().doc);
		const stopEditor = editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			checker.schedule(next);
		});
		// The first check, after the first draw.
		checker.schedule(last);
		return () => {
			stop();
			stopEditor();
			checker.dispose();
		};
	});
	const flags = $derived(flagsOf(checks.items));

	// Saving: each new document goes to the autosave. When the tab is hidden or closed, what waits
	// is saved at once.
	let saveStatus = $state<SaveStatus>(untrack(() => autosave?.status() ?? 'saved'));
	$effect(() => {
		if (!autosave) return;
		const save = autosave;
		saveStatus = save.status();
		return save.subscribe(() => (saveStatus = save.status()));
	});
	// The store is asked, not the reactive copy of its state: that is a proxy, and a proxy of a
	// document is never the same object as the document.
	$effect(() => {
		if (!autosave) return;
		const save = autosave;
		let last = editor.getState().doc;
		return editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			save.schedule(next);
		});
	});
	$effect(() => {
		if (!autosave) return;
		const save = autosave;
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
	const problem = $derived(!persistent ? 'unavailable' : saveStatus === 'failed' ? 'failed' : null);

	// Leaving the page loses the changes that are not saved on the device: ask first.
	const unsaved = $derived(
		autosave ? (persistent ? saveStatus !== 'saved' : snapshot.dirty) : snapshot.dirty
	);
	$effect(() => {
		if (!unsaved) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});
</script>

<div class="editor" data-ready={ready || undefined}>
	<ToolRail
		tool={snapshot.tool}
		canUndo={snapshot.canUndo}
		canRedo={snapshot.canRedo}
		ontool={(tool) => editor.setTool(tool)}
		onundo={() => editor.undo()}
		onredo={() => editor.redo()}
	/>
	<div class="work">
		<div class="bar">
			<p class="title">
				{localizedTitle(titles, snapshot.doc.title, getLocale()) || t('editor.untitled')}
			</p>
			<p class="count">{t('editor.count', { count: snapshot.doc.states.length })}</p>
			{#if autosave}
				<SaveStatusLine status={saveStatus} {persistent} />
			{/if}
			<button type="button" class="fit" onclick={() => canvas.zoom('fit')}>{t('editor.fit')}</button
			>
			{#if library}
				<button
					type="button"
					class="machines"
					aria-label={t('library.open_button', { count: library.count })}
					onclick={library.onopen}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M4 7l8-4 8 4-8 4z" stroke-linejoin="round" />
						<path d="M4 12l8 4 8-4M4 16.5l8 4 8-4" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			{/if}
			<span class="phone-history">
				<HistoryButtons
					canUndo={snapshot.canUndo}
					canRedo={snapshot.canRedo}
					onundo={() => editor.undo()}
					onredo={() => editor.redo()}
				/>
			</span>
		</div>
		{#if problem}
			<p class="problem" role="alert">{t(`storage.${problem}_hint`)}</p>
		{/if}
		{#if snapshot.tool === 'transition' && snapshot.labeling === null}
			<p class="hint-line">
				{t(snapshot.link ? 'editor.hint_pick_target' : 'editor.hint_pick_source')}
			</p>
		{/if}
		<EditorCanvas bind:this={canvas} {editor} state={snapshot} {flags} />
		<Toast
			toast={snapshot.toast}
			onundo={() => editor.undo()}
			ondismiss={() => editor.dismissToast()}
		/>
	</div>
	<SidePanel>
		<ChecksList
			status={checks.status}
			items={checks.items}
			problem={checks.problem}
			onretry={() => checker.retry()}
			onselect={(id) => editor.focusState(id, { keepSelection: false })}
		/>
	</SidePanel>
	<Announcer announcement={snapshot.announcement} />
</div>

<style>
	.editor {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.work {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}
	.title {
		margin: 0;
		font-weight: var(--weight-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.count {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-muted);
		flex-grow: 1;
		white-space: nowrap;
	}
	.phone-history {
		display: none;
	}
	.problem {
		margin: 0;
		padding: var(--space-2) var(--space-4);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	/* A phone zooms by pinching; this button brings the whole machine back into view. */
	.fit {
		display: none;
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--weight-strong);
		cursor: pointer;
	}
	.fit:hover,
	.machines:hover {
		background: var(--color-neutral-tint);
	}
	/* On a laptop the button "Mesin saya" is in the header; a phone has it here. */
	.machines {
		display: none;
		align-items: center;
		justify-content: center;
		width: var(--target-min);
		height: var(--target-min);
		padding: 0;
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}
	.machines svg {
		stroke: currentColor;
		stroke-width: 1.8;
	}
	/* What to do next while a transition is being made. The same words are said by the live region. */
	.hint-line {
		position: absolute;
		top: calc(var(--target-min) + var(--space-3));
		left: 50%;
		z-index: 2;
		max-width: calc(100% - 2 * var(--space-4));
		margin: 0;
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-sm);
		transform: translateX(-50%);
		pointer-events: none;
	}

	@media (max-width: 39.99rem) {
		/* Top to bottom: the canvas, the panel, the tools. */
		.editor {
			flex-direction: column;
		}
		.editor > :global(.work) {
			order: 1;
		}
		.editor > :global(aside) {
			order: 2;
		}
		.editor > :global(.rail) {
			order: 3;
		}
		.bar {
			padding: 0 var(--space-2) 0 var(--space-4);
		}
		.phone-history,
		.fit,
		.machines {
			display: flex;
			align-items: center;
		}
		/* The bar is full: the number of states is in the table (S5). */
		.count {
			display: none;
		}
		.title {
			flex-grow: 1;
		}
	}
</style>
