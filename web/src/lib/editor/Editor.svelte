<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Params } from '#lib/i18n/translate.ts';
	import type { Component } from 'svelte';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import { engine } from '#lib/engine/client.ts';
	import Announcer from './Announcer.svelte';
	import ChecksList from './ChecksList.svelte';
	import DefinitionView from './DefinitionView.svelte';
	import KindSwitch from './KindSwitch.svelte';
	import RunPanel from './RunPanel.svelte';
	import SidePanel from './SidePanel.svelte';
	import TestList from './TestList.svelte';
	import { createRunner } from './run.ts';
	import type { Text } from './run-text.ts';
	import { readTab, saveTab } from './panel-tab.ts';
	import type { PanelTab } from './panel-tab.ts';
	import type { TableViewProps as TableProps } from './table-props.ts';
	import type { Kind } from './document.ts';
	import { addTest, readTests, removeTest } from './test-list.ts';
	import { createTester } from './tester.ts';
	import { LayoutCancelled, LayoutTimeout, layoutClient } from './layout-client.ts';
	import { layoutGraph, placeAll, refusalOf } from './layout.ts';
	import { createChecker } from './checker.ts';
	import { flagsOf } from './checks.ts';
	import SaveStatusLine from './SaveStatusLine.svelte';
	import type { Autosave, SaveStatus } from '#lib/storage/index.ts';
	import type { Titles } from '#lib/storage/store.ts';
	import { localizedTitle } from '#lib/storage/titles.ts';
	import EditorCanvas from './EditorCanvas.svelte';
	import FirstRun from './FirstRun.svelte';
	import type { Example } from '#lib/examples/examples.ts';
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
		library,
		tests: savedTests,
		firstRun,
		onhelp
	}: {
		doc: MachineDocument;
		autosave?: Autosave;
		persistent?: boolean;
		/** The titles of a machine from our content: the bar shows the one of the language. */
		titles?: Titles;
		/** The list of saved machines: how many, and how to open it (a phone has its button here). */
		library?: { count: number; onopen: () => void };
		/** The test strings that were saved with the machine (read again here: anything may be in the record). */
		tests?: unknown;
		/** With this, an empty machine shows "Coba contoh" over the canvas. */
		firstRun?: {
			examples: readonly Example[];
			tourSeen: boolean;
			failed: boolean;
			onexample: (id: string) => void;
			ontour: () => void;
		};
		/** The "?" button of the bar: the tour. */
		onhelp?: () => void;
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

	// Running one string: one call to the engine, and then the page steps through the answer. Any
	// change of the document makes the run old, so it is cleared (a run is not part of the history).
	const runner = createRunner({
		simulate: (d, input) => engine.simulate(toMachine(d), input)
	});
	const readRun = () => ({
		status: runner.status(),
		view: runner.view(),
		refusal: runner.refusal(),
		problem: runner.problem(),
		said: runner.announcement()
	});
	let run = $state.raw(readRun());
	$effect(() => {
		const stop = runner.subscribe(() => (run = readRun()));
		let last = untrack(() => editor.getState().doc);
		const stopEditor = editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			runner.clear();
		});
		return () => {
			stop();
			stopEditor();
			runner.dispose();
		};
	});
	// The test strings: saved with the machine (not in the document, not in the undo history), and
	// run in the engine after each change of the machine or of the list.
	const tester = createTester({
		run: (d, inputs) => engine.simulateMany(toMachine(d), inputs)
	});
	let testList = $state.raw(readTests(untrack(() => savedTests)));
	const readTesting = () => ({
		status: tester.status(),
		problem: tester.problem(),
		rows: testList.map((text) => ({ text, outcome: tester.outcome(text) }))
	});
	let testing = $state.raw(readTesting());
	$effect(() => {
		const stop = tester.subscribe(() => (testing = readTesting()));
		let last = untrack(() => editor.getState().doc);
		const stopEditor = editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			tester.schedule(next, testList);
		});
		// Not tracked: a change of the list must not end this effect (that would end the tester).
		untrack(() => tester.schedule(last, testList));
		return () => {
			stop();
			stopEditor();
			tester.dispose();
		};
	});
	function changeTests(list: string[]) {
		testList = list;
		autosave?.scheduleTests(list);
		tester.schedule(editor.getState().doc, list);
	}
	function addString(text: string): Text | null {
		const added = addTest(testList, text);
		if (!added.ok) return added.error;
		changeTests(added.list);
		return null;
	}

	// "Coba contoh" is over the canvas while the machine is empty. It goes away for good (in this
	// editor) when a state is added or the student chooses to start from an empty canvas: a student who
	// deletes everything is working, and the card must not cover the canvas again.
	let leftFirstRun = $state(false);
	$effect(() => {
		if (snapshot.doc.states.length > 0) leftFirstRun = true;
	});
	const showFirstRun = $derived(
		firstRun !== undefined && !leftFirstRun && snapshot.doc.states.length === 0
	);

	// The tabs of the panel; the last one that was open is remembered on this device.
	let tab = $state<PanelTab>(readTab());
	function chooseTab(next: PanelTab) {
		tab = next;
		saveTab(next);
	}
	// DFSM or NDFSM: one undo step, and a screen reader hears the new type.
	function chooseKind(kind: Kind) {
		editor.apply(
			{ type: 'setKind', kind },
			{ say: { key: 'editor.kind_set', params: { kind: t(`kind.${kind}`) } } }
		);
	}

	// The table is code that is needed only when its tab opens: it is loaded then.
	let Table = $state<Component<TableProps> | null>(null);
	$effect(() => {
		if (tab === 'table' && !Table) {
			void import('./TableView.svelte').then((module) => (Table = module.default));
		}
	});

	// Auto layout ("Tata letak otomatis"): the places come from a worker that is started now (the
	// library is not in the first load). The result is one undo step, with a message with Urungkan.
	// A machine that changed meanwhile, a machine that is too big, a failure and a timeout each say so
	// calmly and change nothing.
	let laying = $state(false);
	let layoutNote = $state<{ key: MessageKey; params: Params } | null>(null);
	$effect(() => {
		if (!layoutNote) return;
		const timer = setTimeout(() => (layoutNote = null), 6000);
		return () => clearTimeout(timer);
	});
	async function autoLayout() {
		if (laying) return;
		const doc = editor.getState().doc;
		if (doc.states.length === 0) return;
		const refusal = refusalOf(doc);
		if (refusal) {
			layoutNote = refusal;
			return;
		}
		laying = true;
		layoutNote = null;
		try {
			const positions = await layoutClient.run(layoutGraph(doc));
			if (editor.getState().doc !== doc) {
				layoutNote = { key: 'layout.stale', params: {} };
				return;
			}
			const command = placeAll(doc, positions);
			if (command) {
				editor.apply(command, { say: { key: 'layout.done' }, toast: true });
			} else {
				layoutNote = { key: 'layout.done', params: {} };
			}
			canvas.zoom('fit');
		} catch (error) {
			if (error instanceof LayoutCancelled) return;
			layoutNote = {
				key: error instanceof LayoutTimeout ? 'layout.timeout' : 'layout.failed',
				params: {}
			};
		} finally {
			laying = false;
		}
	}
	$effect(() => () => layoutClient.cancel());

	const active = $derived(new Set(run.view?.active ?? []));
	const taken = $derived(new Set(run.view?.taken.map((e) => `${e.from}>${e.to}`) ?? []));
	async function startRun(input: string, play: boolean) {
		await runner.start(editor.getState().doc, input);
		if (play) runner.play();
		else runner.step();
	}

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
			{#if snapshot.doc.states.length > 0}
				<button type="button" class="layout" aria-busy={laying} onclick={() => void autoLayout()}>
					{t('editor.menu.layout')}
				</button>
			{/if}
			<button type="button" class="fit" onclick={() => canvas.zoom('fit')}>{t('editor.fit')}</button
			>
			{#if onhelp}
				<button type="button" class="help" aria-label={t('help.open')} onclick={onhelp}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle cx="12" cy="12" r="9" />
						<path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.6" stroke-linecap="round" />
						<path d="M12 16.8h.01" stroke-linecap="round" />
					</svg>
				</button>
			{/if}
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
		<EditorCanvas
			bind:this={canvas}
			{editor}
			state={snapshot}
			{flags}
			{active}
			{taken}
			onlayout={() => void autoLayout()}
		/>
		{#if layoutNote}
			<p class="layout-note" aria-live="polite">{t(layoutNote.key, layoutNote.params)}</p>
		{/if}
		{#if showFirstRun && firstRun}
			<div class="first-run">
				<FirstRun
					examples={firstRun.examples}
					tourSeen={firstRun.tourSeen}
					failed={firstRun.failed}
					onexample={firstRun.onexample}
					onblank={() => (leftFirstRun = true)}
					ontour={firstRun.ontour}
				/>
			</div>
		{/if}
		<Toast
			toast={snapshot.toast}
			onundo={() => editor.undo()}
			ondismiss={() => editor.dismissToast()}
		/>
	</div>
	<!-- Nothing to run, test or copy exists before a machine is chosen: the panel waits for one. -->
	{#if !showFirstRun}
		<SidePanel {tab} ontab={chooseTab}>
			{#snippet simulation()}
				<RunPanel
					status={run.status}
					view={run.view}
					refusal={run.refusal}
					problem={run.problem}
					said={run.said}
					onstart={(input, play) => void startRun(input, play)}
					onplay={() => runner.play()}
					onpause={() => runner.pause()}
					onstep={() => runner.step()}
					onback={() => runner.back()}
					onreset={() => runner.toStart()}
					onedit={() => runner.clear()}
				/>
				<TestList
					rows={testing.rows}
					status={testing.status}
					problem={testing.problem}
					onadd={addString}
					onremove={(text) => changeTests(removeTest(testList, text))}
					onretry={() => tester.retry()}
				/>
				<ChecksList
					status={checks.status}
					items={checks.items}
					problem={checks.problem}
					onretry={() => checker.retry()}
					onselect={(id) => editor.focusState(id, { keepSelection: false })}
				/>
			{/snippet}
			{#snippet table()}
				<KindSwitch kind={snapshot.doc.kind} onchange={chooseKind} />
				{#if Table}
					<Table
						doc={snapshot.doc}
						selection={snapshot.selection}
						onapply={(command, note) => editor.apply(command, note)}
						onselect={(id) => editor.selectOnly(id)}
					/>
				{/if}
			{/snippet}
			{#snippet definition()}
				<KindSwitch kind={snapshot.doc.kind} onchange={chooseKind} />
				<DefinitionView doc={snapshot.doc} />
			{/snippet}
		</SidePanel>
	{/if}
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
	/* Drawn 36 px high, so that it does not touch the lines of the bar; the hit area is 44 px. */
	.layout {
		position: relative;
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.layout::after {
		content: '';
		position: absolute;
		inset: -4px 0;
	}
	.layout:hover {
		background: var(--color-neutral-tint);
	}
	.layout-note {
		position: absolute;
		top: calc(var(--target-min) + var(--space-3));
		left: 0;
		right: 0;
		z-index: 2;
		width: max-content;
		max-width: calc(100% - 2 * var(--space-4));
		margin: 0 auto;
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-sm);
		pointer-events: none;
	}
	.fit:hover,
	.help:hover,
	.machines:hover {
		background: var(--color-neutral-tint);
	}
	.help {
		display: flex;
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
	.help svg {
		stroke: currentColor;
		stroke-width: 1.8;
	}
	/* The place of "Coba contoh": the canvas, under the bar. */
	.first-run {
		position: absolute;
		inset: var(--target-min) 0 0 0;
		pointer-events: none;
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
		/* The bar is full: on a phone, auto layout is in the menu of the empty canvas. */
		.layout {
			display: none;
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
