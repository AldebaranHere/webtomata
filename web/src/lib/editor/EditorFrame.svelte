<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { SaveStatus } from '#lib/storage/index.ts';
	import Announcer from './Announcer.svelte';
	import HistoryButtons from './HistoryButtons.svelte';
	import type { Announcement, Tool } from './interaction/editor.ts';
	import SaveStatusLine from './SaveStatusLine.svelte';
	import Toast from './Toast.svelte';
	import ToolRail from './ToolRail.svelte';

	// The shared frame of the editor: the tools, the title and count bar, the save line,
	// notices, the stage holding the canvas, toast, and responsive layout structure.
	let {
		ready = false,
		tool,
		canUndo,
		canRedo,
		ontool,
		onundo,
		onredo,
		title,
		stateCount,
		saveStatus,
		persistent = true,
		hasAutosave = false,
		onfit,
		problem = null,
		hintLine = null,
		covered = false,
		toast = null,
		ontoastundo = () => {},
		ontoastdismiss = () => {},
		announcement = null,
		actionsBeforeFit,
		actions,
		stage,
		coveredContent,
		overlay,
		panel
	}: {
		ready?: boolean;
		tool: Tool;
		canUndo: boolean;
		canRedo: boolean;
		ontool: (tool: Tool) => void;
		onundo: () => void;
		onredo: () => void;
		title: string;
		stateCount: number;
		saveStatus?: SaveStatus;
		persistent?: boolean;
		hasAutosave?: boolean;
		onfit: () => void;
		problem?: 'unavailable' | 'failed' | null;
		hintLine?: string | null;
		covered?: boolean;
		toast?: Announcement | null;
		ontoastundo?: () => void;
		ontoastdismiss?: () => void;
		announcement?: Announcement | null;
		actionsBeforeFit?: Snippet;
		actions?: Snippet;
		stage: Snippet;
		coveredContent?: Snippet;
		overlay?: Snippet;
		panel?: Snippet;
	} = $props();
</script>

<div class="editor" data-ready={ready || undefined}>
	<ToolRail {tool} {canUndo} {canRedo} {ontool} {onundo} {onredo} />
	<div class="work">
		<div class="bar">
			<p class="title">
				{title}
			</p>
			<p class="count">{t('editor.count', { count: stateCount })}</p>
			{#if hasAutosave && saveStatus}
				<SaveStatusLine status={saveStatus} {persistent} />
			{/if}
			{@render actionsBeforeFit?.()}
			<button type="button" class="fit" onclick={onfit}>{t('editor.fit')}</button>
			{@render actions?.()}
			<span class="phone-history">
				<HistoryButtons {canUndo} {canRedo} {onundo} {onredo} />
			</span>
		</div>
		{#if problem}
			<p class="problem" role="alert">{t(`storage.${problem}_hint`)}</p>
		{/if}
		{#if hintLine}
			<p class="hint-line">
				{hintLine}
			</p>
		{/if}
		<div class="stage" hidden={covered}>
			{@render stage()}
		</div>
		{#if covered && coveredContent}
			{@render coveredContent()}
		{/if}
		{@render overlay?.()}
		<Toast {toast} onundo={ontoastundo} ondismiss={ontoastdismiss} />
	</div>
	{@render panel?.()}
	<Announcer {announcement} />
</div>

<style>
	.editor {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.stage {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	.stage[hidden] {
		display: none;
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
	.fit:hover {
		background: var(--color-neutral-tint);
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
			z-index: 2;
		}
		.editor > :global(aside) {
			order: 2;
			z-index: 1;
		}
		.editor > :global(.rail) {
			order: 3;
		}
		/* A button of the bar keeps its 44 px, and the title gives way: the gaps are small (the hit area is the button). */
		.bar {
			gap: var(--space-1);
			padding: 0 var(--space-2) 0 var(--space-4);
		}
		.fit,
		.phone-history,
		.bar :global(.save) {
			flex-shrink: 0;
		}
		.phone-history,
		.fit {
			display: flex;
			align-items: center;
		}
		/* The bar is full: the number of states is in the table (S5). */
		.count {
			display: none;
		}
		.title {
			flex: 1 1 0;
			min-width: 0;
		}
	}
</style>
