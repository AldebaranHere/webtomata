<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Announcer from './Announcer.svelte';
	import EditorCanvas from './EditorCanvas.svelte';
	import HistoryButtons from './HistoryButtons.svelte';
	import type { MachineDocument } from './document.ts';
	import { createEditor } from './interaction/editor.ts';
	import ToolRail from './ToolRail.svelte';
	import Toast from './Toast.svelte';

	// The editor of a machine: the tools, the canvas and the title bar. It starts from `doc`; later
	// changes to the prop are not read (the editor owns the document and its history).
	let { doc }: { doc: MachineDocument } = $props();

	const editor = createEditor(untrack(() => doc));
	let snapshot = $state(editor.getState());
	$effect(() => editor.subscribe(() => (snapshot = editor.getState())));

	// Until the machine is saved on the device (S10a), leaving the page loses the changes: ask first.
	$effect(() => {
		if (!snapshot.dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});
</script>

<div class="editor">
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
			<p class="title">{snapshot.doc.title || t('editor.untitled')}</p>
			<p class="count">{t('editor.count', { count: snapshot.doc.states.length })}</p>
			<span class="phone-history">
				<HistoryButtons
					canUndo={snapshot.canUndo}
					canRedo={snapshot.canRedo}
					onundo={() => editor.undo()}
					onredo={() => editor.redo()}
				/>
			</span>
		</div>
		{#if snapshot.tool === 'transition' && snapshot.labeling === null}
			<p class="hint-line">
				{t(snapshot.link ? 'editor.hint_pick_target' : 'editor.hint_pick_source')}
			</p>
		{/if}
		<EditorCanvas {editor} state={snapshot} />
		<Toast
			toast={snapshot.toast}
			onundo={() => editor.undo()}
			ondismiss={() => editor.dismissToast()}
		/>
	</div>
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
		.editor {
			flex-direction: column-reverse;
		}
		.bar {
			padding: 0 var(--space-2) 0 var(--space-4);
		}
		.phone-history {
			display: flex;
		}
	}
</style>
